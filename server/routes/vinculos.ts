import { Router } from 'express'
import { isValidObjectId } from 'mongoose'
import { randomBytes } from 'node:crypto'
import { requireAuth, requireRole } from '../auth.js'
import { getOrCreateCrianca } from '../services/crianca.js'
import { Crianca } from '../models/Crianca.js'
import { Vinculo } from '../models/Vinculo.js'
import { ConviteVinculo } from '../models/ConviteVinculo.js'
import { Agendamento } from '../models/Agendamento.js'
import { Alerta } from '../models/Alerta.js'
import { Duvida } from '../models/Duvida.js'
import { Consulta } from '../models/Consulta.js'
import { calcularInsights } from '../services/insights.js'

export const vinculosRouter = Router()

/**
 * Comparação de nome sem acento e sem caixa.
 *
 * Quem digita "jose" tem que achar "José" — em português, exigir o acento na
 * busca é o mesmo que não ter busca.
 */
function normalizarBusca(v: string): string {
  return v
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

const VALIDADE_MS = 7 * 24 * 60 * 60 * 1000

// POST /api/vinculos/convite — either side generates a share token (link/QR).
// `tipo: 'coparent'` (family only) invites the other parent onto the same journey;
// otherwise the invite connects a doctor.
vinculosRouter.post('/convite', requireAuth, async (req, res) => {
  const token = randomBytes(16).toString('hex')
  const base = {
    token,
    criadorId: req.user!.id,
    criadorNome: req.user!.nome,
    criadorPapel: req.user!.papel,
    expiraEm: new Date(Date.now() + VALIDADE_MS),
  }

  if (req.user!.papel === 'medico') {
    await ConviteVinculo.create({ ...base, medicoId: req.user!.id, tipo: 'medico' })
  } else {
    const tipo = req.body?.tipo === 'coparent' ? 'coparent' : 'medico'
    const crianca = await getOrCreateCrianca(req.user!.id)
    await ConviteVinculo.create({ ...base, crianca: crianca._id, tipo })
  }

  res.status(201).json({ token, path: `/vincular/${token}` })
})

// GET /api/vinculos/convite/:token — info for the confirmation screen.
vinculosRouter.get('/convite/:token', requireAuth, async (req, res) => {
  const convite = await ConviteVinculo.findOne({ token: req.params.token })
  if (!convite || convite.usado || convite.expiraEm.getTime() < Date.now()) {
    res.status(404).json({ error: 'Esse convite não é mais válido. Peça um novo.' })
    return
  }
  res.json({
    criadorNome: convite.criadorNome,
    criadorPapel: convite.criadorPapel,
    tipo: convite.tipo,
    // 'coparent' → o outro responsável (família) aceita; senão médico↔paciente.
    aceitaPor:
      convite.tipo === 'coparent'
        ? 'familia'
        : convite.criadorPapel === 'medico'
          ? 'paciente'
          : 'medico',
  })
})

// POST /api/vinculos/aceitar/:token — creates the Vínculo (consented connection).
vinculosRouter.post('/aceitar/:token', requireAuth, async (req, res) => {
  const convite = await ConviteVinculo.findOne({ token: req.params.token })
  if (!convite || convite.usado || convite.expiraEm.getTime() < Date.now()) {
    res.status(404).json({ error: 'Esse convite não é mais válido. Peça um novo.' })
    return
  }
  if (convite.criadorId === req.user!.id) {
    res.status(400).json({ error: 'Esse convite foi criado por você — compartilhe com a outra pessoa.' })
    return
  }

  // Co-parent invite: the other parent joins the same journey as co-responsável.
  if (convite.tipo === 'coparent') {
    if (req.user!.papel === 'medico') {
      res.status(400).json({ error: 'Esse convite é para o outro responsável (mãe/pai), não para um médico.' })
      return
    }
    const crianca = await Crianca.findById(convite.crianca)
    if (!crianca) {
      res.status(404).json({ error: 'Jornada não encontrada.' })
      return
    }
    if (String(crianca.responsavel) === req.user!.id) {
      res.status(400).json({ error: 'Você já é o responsável por essa jornada.' })
      return
    }
    if (!crianca.coResponsaveis.includes(req.user!.id)) {
      crianca.coResponsaveis.push(req.user!.id)
      await crianca.save()
    }
    convite.usado = true
    await convite.save()
    res.status(201).json({ ok: true, coparent: true, pacienteNome: convite.criadorNome })
    return
  }

  let dados: { crianca: unknown; pacienteId: string; pacienteNome: string; medicoId: string; medicoNome: string }

  if (convite.crianca) {
    // Patient-initiated → the accepter must be a doctor.
    if (req.user!.papel !== 'medico') {
      res.status(400).json({ error: 'Esse convite é para um médico se conectar.' })
      return
    }
    const crianca = await Crianca.findById(convite.crianca)
    if (!crianca) {
      res.status(404).json({ error: 'Paciente não encontrado.' })
      return
    }
    dados = {
      crianca: crianca._id,
      pacienteId: String(crianca.responsavel),
      pacienteNome: convite.criadorNome,
      medicoId: req.user!.id,
      medicoNome: req.user!.nome,
    }
  } else {
    // Doctor-initiated → the accepter must be a patient (mother/pregnant).
    if (req.user!.papel === 'medico') {
      res.status(400).json({ error: 'Esse convite é para um paciente se conectar.' })
      return
    }
    const crianca = await getOrCreateCrianca(req.user!.id)
    dados = {
      crianca: crianca._id,
      pacienteId: req.user!.id,
      pacienteNome: req.user!.nome,
      medicoId: convite.medicoId,
      medicoNome: convite.criadorNome,
    }
  }

  try {
    await Vinculo.create({ ...dados, status: 'ativo' })
  } catch {
    // Unique index → already connected; treat as success (idempotent).
  }
  convite.usado = true
  await convite.save()

  res.status(201).json({ ok: true, medicoNome: dados.medicoNome, pacienteNome: dados.pacienteNome })
})

// GET /api/vinculos — my connections (doctor sees patients, patient sees doctors).
vinculosRouter.get('/', requireAuth, async (req, res) => {
  if (req.user!.papel === 'medico') {
    const vinculos = await Vinculo.find({ medicoId: req.user!.id, status: 'ativo' }).sort({ createdAt: -1 })
    res.json({
      vinculos: vinculos.map((v) => ({ id: String(v._id), crianca: String(v.crianca), nome: v.pacienteNome, papel: 'paciente' })),
    })
    return
  }
  const vinculos = await Vinculo.find({ pacienteId: req.user!.id, status: 'ativo' }).sort({ createdAt: -1 })
  res.json({
    vinculos: vinculos.map((v) => ({ id: String(v._id), nome: v.medicoNome, papel: 'medico' })),
  })
})

/**
 * GET /api/vinculos/pacientes — a lista de "Meus pacientes", já com o que faz
 * alguém abrir a ficha.
 *
 * Nome sozinho não ajuda ninguém a decidir quem olhar primeiro. Aqui vêm também
 * o próximo horário marcado, quantos alertas estão abertos e quantas dúvidas
 * esperam resposta — que é a ordem de urgência real de uma manhã de consultório.
 *
 * Três agregações em vez de N+1 consultas: com 200 pacientes vinculados, o laço
 * ingênuo seria 600 idas ao banco.
 */
vinculosRouter.get('/pacientes', requireAuth, requireRole('medico'), async (req, res) => {
  const vinculos = await Vinculo.find({ medicoId: req.user!.id, status: 'ativo' }).sort({
    createdAt: -1,
  })
  if (vinculos.length === 0) {
    res.json({ pacientes: [] })
    return
  }

  const ids = vinculos.map((v) => v.crianca)
  const agora = new Date()

  const [jornadas, proximos, alertas, duvidas] = await Promise.all([
    Crianca.find({ _id: { $in: ids } }),
    Agendamento.find({
      crianca: { $in: ids },
      medicoId: req.user!.id,
      inicio: { $gte: agora },
      status: { $in: ['pendente', 'confirmado'] },
    })
      .sort({ inicio: 1 })
      .select('crianca inicio status modalidade'),
    Alerta.aggregate([
      { $match: { crianca: { $in: ids }, resolvido: false } },
      { $group: { _id: '$crianca', total: { $sum: 1 } } },
    ]),
    Duvida.aggregate([
      { $match: { crianca: { $in: ids }, respondida: false, compartilhada: true } },
      { $group: { _id: '$crianca', total: { $sum: 1 } } },
    ]),
  ])

  const contar = (linhas: { _id: unknown; total: number }[], id: unknown) =>
    linhas.find((l) => String(l._id) === String(id))?.total ?? 0

  /*
   * Busca no servidor, sobre o nome do vínculo E o da titular.
   *
   * Filtrar no cliente funcionaria hoje e quebraria em silêncio no dia em que a
   * lista passar do limite da consulta — o consultório com 400 pacientes é
   * exatamente quem precisa de busca, e seria o único a não achar ninguém.
   */
  const termo = normalizarBusca(String(req.query.q ?? ''))

  res.json({
    pacientes: vinculos.map((v) => {
      const jornada = jornadas.find((j) => String(j._id) === String(v.crianca))
      const proximo = proximos.find((a) => String(a.crianca) === String(v.crianca))
      return {
        vinculoId: String(v._id),
        crianca: String(v.crianca),
        nome: jornada?.titular?.nome || v.pacienteNome || jornada?.nome || 'Paciente',
        /**
         * Falso enquanto a paciente foi cadastrada no consultório e não criou
         * conta. A lista mostra isso porque muda o que o médico pode esperar:
         * ninguém do outro lado está lendo o que ele escreve ainda.
         */
        temConta: Boolean(jornada?.responsavel),
        /** A foto da ficha, quando existe — a lista vira rostos, não linhas. */
        foto: jornada?.titular?.foto ?? '',
        telefone: jornada?.titular?.telefone ?? '',
        /**
         * A paciente mandou a ficha pelo link e ninguém conferiu ainda. É o
         * único item desta lista que pede uma ação de cadastro, e não clínica —
         * some assim que alguém abre e salva a ficha.
         */
        fichaPendente: Boolean(
          jornada?.preCadastro?.recebidoEm && !jornada?.preCadastro?.revisadoEm,
        ),
        momento: jornada?.momento ?? null,
        dpp: jornada?.dpp ? new Date(jornada.dpp).toISOString() : null,
        dataNascimento: jornada?.dataNascimento
          ? new Date(jornada.dataNascimento).toISOString()
          : null,
        proximo: proximo
          ? {
              id: String(proximo._id),
              inicio: new Date(proximo.inicio).toISOString(),
              status: proximo.status,
              modalidade: proximo.modalidade,
            }
          : null,
        alertas: contar(alertas, v.crianca),
        duvidas: contar(duvidas, v.crianca),
      }
    }).filter((p) => !termo || normalizarBusca(p.nome).includes(termo)),
  })
})

/**
 * GET /api/vinculos/insights — o consultório visto de cima.
 *
 * Cada número existe para mudar o que o médico faz hoje: quantas gestantes
 * entram no terceiro trimestre (quantas consultas quinzenais vêm por aí), quem
 * está sem retorno marcado (quem some se ninguém ligar), quantas ainda não têm
 * conta (quanto do produto ainda é invisível para as pacientes).
 */
vinculosRouter.get('/insights', requireAuth, requireRole('medico'), async (req, res) => {
  const vinculos = await Vinculo.find({ medicoId: req.user!.id, status: 'ativo' })
  if (vinculos.length === 0) {
    res.json({ insights: calcularInsights([]) })
    return
  }

  const ids = vinculos.map((v) => v.crianca)
  const agora = new Date()

  const [jornadas, proximos, ultimas, alertas] = await Promise.all([
    Crianca.find({ _id: { $in: ids } }).select('nome titular momento dpp dataNascimento responsavel'),
    Agendamento.find({
      crianca: { $in: ids },
      medicoId: req.user!.id,
      inicio: { $gte: agora },
      status: { $in: ['pendente', 'confirmado'] },
    }).sort({ inicio: 1 }).select('crianca inicio'),
    // A última consulta FINALIZADA de cada jornada — rascunho não é atendimento.
    Consulta.aggregate([
      { $match: { crianca: { $in: ids }, status: 'finalizada' } },
      { $group: { _id: '$crianca', em: { $max: '$data' } } },
    ]),
    Alerta.aggregate([
      { $match: { crianca: { $in: ids }, resolvido: false } },
      { $group: { _id: '$crianca', total: { $sum: 1 } } },
    ]),
  ])

  const brutos = vinculos.map((v) => {
    const j = jornadas.find((x) => String(x._id) === String(v.crianca))
    const prox = proximos.find((a) => String(a.crianca) === String(v.crianca))
    const ult = ultimas.find((u) => String(u._id) === String(v.crianca))
    return {
      jornada: String(v.crianca),
      nome: j?.titular?.nome || v.pacienteNome || j?.nome || 'Paciente',
      momento: j?.momento ?? null,
      dpp: j?.dpp ? new Date(j.dpp) : null,
      dataNascimento: j?.dataNascimento ? new Date(j.dataNascimento) : null,
      temConta: Boolean(j?.responsavel),
      proximo: prox ? new Date(prox.inicio) : null,
      ultimaConsulta: ult?.em ? new Date(ult.em) : null,
      alertas: alertas.find((a) => String(a._id) === String(v.crianca))?.total ?? 0,
    }
  })

  res.json({ insights: calcularInsights(brutos, agora) })
})

// DELETE /api/vinculos/:id — revoke (either party; the patient can always cut it).
vinculosRouter.delete('/:id', requireAuth, async (req, res) => {
  if (!isValidObjectId(req.params.id)) {
    res.status(404).json({ error: 'Vínculo não encontrado.' })
    return
  }
  const vinculo = await Vinculo.findById(req.params.id)
  if (!vinculo) {
    res.status(404).json({ error: 'Vínculo não encontrado.' })
    return
  }
  if (vinculo.pacienteId !== req.user!.id && vinculo.medicoId !== req.user!.id) {
    res.status(403).json({ error: 'Esse vínculo não é seu.' })
    return
  }
  await vinculo.deleteOne()
  res.status(204).end()
})
