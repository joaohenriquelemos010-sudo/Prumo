import { Router } from 'express'
import { isValidObjectId } from 'mongoose'
import { requireAuth, requireRole } from '../auth.js'
import { Agendamento } from '../models/Agendamento.js'
import { Disponibilidade } from '../models/Disponibilidade.js'
import { TipoAtendimento } from '../models/TipoAtendimento.js'
import { Jornada } from '../models/Jornada.js'
import { Vinculo } from '../models/Vinculo.js'
import { resolveJornada } from '../services/jornada.js'
import { agendaMarcarSchema } from '../validation.js'
import { normalizeField } from '../sanitize.js'

export const agendaRouter = Router()

/**
 * A agenda do médico como calendário.
 *
 * Separada de `routes/agendamentos.ts` porque a pergunta é outra: aquele arquivo
 * responde "o que aconteceu com este agendamento", este responde "como está
 * minha semana". Um calendário precisa dos compromissos **e** do que desenha o
 * fundo — expediente, almoço, bloqueios — e buscar isso em quatro requisições
 * faria a grade se montar em pedaços na frente de quem abriu.
 */

function data(valor: unknown): Date | null {
  if (typeof valor !== 'string' || !valor.trim()) return null
  const d = new Date(valor)
  return Number.isNaN(d.getTime()) ? null : d
}

/**
 * GET /api/agenda?de=&ate= — tudo o que o calendário desenha, numa resposta.
 */
agendaRouter.get('/', requireAuth, requireRole('medico'), async (req, res) => {
  const de = data(req.query.de) ?? new Date()
  const ate = data(req.query.ate) ?? new Date(de.getTime() + 7 * 86_400_000)

  // Um teto de janela: sem ele, `?de=1900&ate=2100` viraria uma varredura da
  // coleção inteira disparada por um parâmetro de query.
  if (ate.getTime() - de.getTime() > 62 * 86_400_000) {
    res.status(400).json({ error: 'Janela grande demais — peça no máximo dois meses.' })
    return
  }

  const [agendamentos, disp, tipos] = await Promise.all([
    Agendamento.find({
      medicoId: req.user!.id,
      inicio: { $gte: de, $lte: ate },
      status: { $nin: ['cancelado', 'recusado'] },
    })
      .sort({ inicio: 1 })
      .limit(500),
    Disponibilidade.findOne({ medicoId: req.user!.id }),
    TipoAtendimento.find({ medicoId: req.user!.id }),
  ])

  const corPorTipo = new Map(tipos.map((t) => [String(t._id), t.cor]))

  res.json({
    agendamentos: agendamentos.map((a) => ({
      id: String(a._id),
      inicio: new Date(a.inicio).toISOString(),
      duracaoMin: a.duracaoMin,
      pacienteNome: a.pacienteNome,
      jornada: String(a.crianca),
      objetivo: a.objetivo,
      modalidade: a.modalidade,
      status: a.status,
      local: a.local,
      cobertura: a.cobertura,
      tipoNome: a.tipoAtendimentoNome,
      /** A cor vem do catálogo, não do agendamento: mudar a cor do tipo repinta
       *  o histórico inteiro, que é o comportamento que se espera de uma legenda. */
      cor: a.tipoAtendimento ? (corPorTipo.get(String(a.tipoAtendimento)) ?? 'indigo') : 'indigo',
      consultaId: a.consulta ? String(a.consulta) : '',
    })),
    /** O fundo da grade: quando se trabalha, quando se almoça, o que está fechado. */
    expediente: {
      ativo: disp?.ativo ?? false,
      duracaoPadraoMin: disp?.duracaoPadraoMin ?? 30,
      almoco: { inicio: disp?.almoco?.inicio ?? '', fim: disp?.almoco?.fim ?? '' },
      regras: (disp?.regras ?? []).map((r) => ({
        diaSemana: r.diaSemana,
        inicio: r.inicio,
        fim: r.fim,
      })),
      bloqueios: (disp?.bloqueios ?? [])
        .filter((b) => new Date(b.ate) >= de && new Date(b.de) <= ate)
        .map((b) => ({
          de: new Date(b.de).toISOString(),
          ate: new Date(b.ate).toISOString(),
          motivo: b.motivo,
        })),
    },
    tipos: tipos
      .filter((t) => t.ativo)
      .map((t) => ({
        id: String(t._id),
        nome: t.nome,
        cor: t.cor,
        duracaoMin: t.duracaoMin,
      })),
  })
})

/**
 * POST /api/agenda/marcar — o médico marca, e marcar já é confirmar.
 *
 * O caminho que existia (`POST /api/agendamentos`) é o da família pedindo um
 * horário: nasce `pendente`, esperando resposta, e grava `pacienteId` a partir
 * de quem chamou. Usado pelo médico, ele registraria o próprio médico como
 * paciente e criaria um pedido que ele mesmo teria que aprovar.
 *
 * Aqui é o contrário em tudo: quem marca é a autoridade sobre a própria agenda,
 * então o horário nasce `confirmado`, e **fora do expediente é permitido** — o
 * encaixe das 19h existe, e um sistema que o recusa é um sistema que se
 * contorna com papel. O que não se permite é conflito: dois pacientes no mesmo
 * minuto sem alguém ter dito que quer isso.
 */
agendaRouter.post('/marcar', requireAuth, requireRole('medico'), async (req, res) => {
  const parsed = agendaMarcarSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Confere os dados.' })
    return
  }
  const d = parsed.data

  const jornada = await resolveJornada(req.user!, d.jornadaId)
  if (!jornada) {
    res.status(403).json({ error: 'Você não tem acesso a essa paciente.' })
    return
  }

  const inicio = new Date(d.inicio)
  if (Number.isNaN(inicio.getTime())) {
    res.status(400).json({ error: 'Data inválida.' })
    return
  }

  const tipo = d.tipoAtendimentoId
    ? await TipoAtendimento.findOne({
        _id: isValidObjectId(d.tipoAtendimentoId) ? d.tipoAtendimentoId : null,
        medicoId: req.user!.id,
      })
    : null

  const disp = await Disponibilidade.findOne({ medicoId: req.user!.id })
  const duracaoMin = d.duracaoMin ?? tipo?.duracaoMin ?? disp?.duracaoPadraoMin ?? 30
  const fim = new Date(inicio.getTime() + duracaoMin * 60_000)

  /*
   * Conflito é checado no servidor, sempre. A grade que o médico está vendo pode
   * ter segundos de idade, e "o horário parecia livro na tela" não é uma defesa
   * quando duas pacientes chegam às 14h.
   */
  if (!d.permitirConflito) {
    const vizinhos = await Agendamento.find({
      medicoId: req.user!.id,
      status: { $nin: ['cancelado', 'recusado'] },
      inicio: { $lt: fim, $gte: new Date(inicio.getTime() - 8 * 3600_000) },
    }).select('inicio duracaoMin pacienteNome')

    const choque = vizinhos.find((v) => {
      const vi = new Date(v.inicio).getTime()
      return vi < fim.getTime() && vi + v.duracaoMin * 60_000 > inicio.getTime()
    })
    if (choque) {
      res.status(409).json({
        error: `Esse horário já tem ${choque.pacienteNome || 'um atendimento'}.`,
        conflito: {
          inicio: new Date(choque.inicio).toISOString(),
          pacienteNome: choque.pacienteNome,
        },
      })
      return
    }
  }

  const agendamento = await Agendamento.create({
    crianca: jornada._id,
    pacienteId: jornada.responsavel ? String(jornada.responsavel) : '',
    pacienteNome: jornada.titular?.nome || jornada.nome || 'Paciente',
    medicoId: req.user!.id,
    medicoNome: req.user!.nome,
    origem: 'medico',
    objetivo:
      d.objetivo ??
      (jornada.momento === 'ja-nasceu'
        ? 'consulta-crianca'
        : jornada.momento === 'planejando'
          ? 'pre-concepcional'
          : 'consulta-gestante'),
    modalidade: d.modalidade ?? 'presencial',
    inicio,
    duracaoMin,
    tipoAtendimento: tipo?._id ?? null,
    tipoAtendimentoNome: tipo?.nome ?? '',
    cobertura: d.cobertura ?? 'particular',
    mensagem: normalizeField(d.observacao ?? '', 500),
    // Marcado pelo médico já nasce confirmado: não há a quem pedir confirmação.
    status: 'confirmado',
    historico: [
      {
        em: new Date(),
        porId: req.user!.id,
        porNome: req.user!.nome,
        de: '',
        para: 'confirmado',
        nota: 'Marcado pelo consultório',
      },
    ],
  })

  // O vínculo é o que faz a paciente aparecer em "Pacientes". Marcar para alguém
  // sem vínculo (uma indicação, um encaixe) cria a ligação em vez de recusar.
  await Vinculo.updateOne(
    { crianca: jornada._id, medicoId: req.user!.id },
    {
      $setOnInsert: {
        pacienteId: jornada.responsavel ? String(jornada.responsavel) : '',
        pacienteNome: jornada.titular?.nome || jornada.nome || '',
        medicoNome: req.user!.nome,
        status: 'ativo',
      },
    },
    { upsert: true },
  ).catch(() => {
    /* já existe */
  })

  res.status(201).json({
    agendamento: {
      id: String(agendamento._id),
      inicio: agendamento.inicio.toISOString(),
      duracaoMin: agendamento.duracaoMin,
      pacienteNome: agendamento.pacienteNome,
      jornada: String(jornada._id),
      status: agendamento.status,
      tipoNome: agendamento.tipoAtendimentoNome,
      cor: tipo?.cor ?? 'indigo',
    },
  })
})

/**
 * GET /api/agenda/pacientes — a busca do campo "Buscar cliente".
 *
 * Devolve pouco e rápido: só o que o seletor precisa para mostrar uma linha. A
 * lista completa de pacientes tem contadores, próximo horário e alertas, e nada
 * disso ajuda alguém que está digitando um nome para marcar um horário.
 */
agendaRouter.get('/pacientes', requireAuth, requireRole('medico'), async (req, res) => {
  const q = String(req.query.q ?? '').trim()
  const vinculos = await Vinculo.find({ medicoId: req.user!.id, status: 'ativo' }).select('crianca')
  if (vinculos.length === 0) {
    res.json({ pacientes: [] })
    return
  }

  const jornadas = await Jornada.find({ _id: { $in: vinculos.map((v) => v.crianca) } }).select(
    'nome titular momento dpp dataNascimento responsavel',
  )

  const semAcento = (v: string) =>
    v
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
  const termo = semAcento(q)

  res.json({
    pacientes: jornadas
      .map((j) => ({
        jornada: String(j._id),
        nome: j.titular?.nome || j.nome || 'Paciente',
        telefone: j.titular?.telefone ?? '',
        momento: j.momento,
        temConta: Boolean(j.responsavel),
      }))
      .filter((p) => !termo || semAcento(p.nome).includes(termo) || p.telefone.includes(q))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
      .slice(0, 30),
  })
})
