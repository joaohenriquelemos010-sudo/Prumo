import { Router } from 'express'
import { isValidObjectId } from 'mongoose'
import type { HydratedDocument } from 'mongoose'
import { requireAuth, requireRole } from '../auth.js'
import { auditar, registrar as auditarAgora } from '../services/auditoria.js'
import { Jornada } from '../models/Jornada.js'
import type { JornadaDoc } from '../models/Jornada.js'
import { Vinculo } from '../models/Vinculo.js'
import { Agendamento } from '../models/Agendamento.js'
import { registrar } from '../services/evolucao.js'
import {
  codigoNovo,
  codigoValido,
  formatarCodigo,
  jornadaVazia,
  normalizarCodigo,
  semConta,
} from '../services/pacientes.js'
import { pacienteCreateSchema, pacientePatchSchema, vincularCodigoSchema } from '../validation.js'
import { normalizeField } from '../sanitize.js'

export const pacientesRouter = Router()

/** Data só quando é data. Campo bagunçado vira vazio, nunca `Invalid Date`. */
function data(valor: unknown): Date | null {
  if (typeof valor !== 'string' || valor.trim() === '') return null
  const d = new Date(valor)
  return Number.isNaN(d.getTime()) ? null : d
}

function serialize(j: HydratedDocument<JornadaDoc>) {
  const iso = (d?: Date | null) => (d ? new Date(d).toISOString() : null)
  const pendente = codigoValido(j.vinculacao)
  return {
    id: String(j._id),
    nome: j.titular?.nome || j.nome || 'Paciente',
    nomeBebe: j.nome ?? '',
    momento: j.momento,
    dpp: iso(j.dpp),
    dataNascimento: iso(j.dataNascimento),
    temConta: !semConta(j),
    titular: {
      nome: j.titular?.nome ?? '',
      dataNascimento: iso(j.titular?.dataNascimento),
      telefone: j.titular?.telefone ?? '',
      email: j.titular?.email ?? '',
      observacoes: j.titular?.observacoes ?? '',
    },
    /**
     * O código só volta enquanto vale. Um código expirado exibido na tela é uma
     * promessa que a paciente vai tentar cumprir digitando e não vai funcionar.
     */
    vinculacao: {
      codigo: pendente ? formatarCodigo(j.vinculacao!.codigo!) : '',
      expiraEm: pendente ? iso(j.vinculacao?.expiraEm) : null,
      vinculadaEm: iso(j.vinculacao?.vinculadaEm),
    },
  }
}

/** A jornada precisa existir E ser deste médico. As duas coisas, sempre. */
async function minhaOr404(id: string, medicoId: string) {
  if (!isValidObjectId(id)) return null
  const vinculo = await Vinculo.exists({ crianca: id, medicoId, status: 'ativo' })
  if (!vinculo) return null
  return Jornada.findById(id)
}

/**
 * POST /api/pacientes — abre uma jornada para quem ainda não tem conta.
 *
 * É o cadastro de balcão: o médico digita o nome, atende, e o registro existe.
 * Nasce com `responsavel: null` e um `Vinculo` já ativo — o vínculo é o que faz a
 * paciente aparecer em "Meus pacientes" e o que autoriza o acesso, e não há
 * motivo para essas duas coisas esperarem por um cadastro que talvez nunca venha.
 */
pacientesRouter.post('/', requireAuth, requireRole('medico'), auditar('paciente.criar', 'criancas'), async (req, res) => {
  const parsed = pacienteCreateSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Confere os dados.' })
    return
  }
  const d = parsed.data

  const jornada = await Jornada.create({
    responsavel: null,
    criadaPorMedico: req.user!.id,
    momento: d.momento,
    dpp: data(d.dpp),
    dataNascimento: data(d.dataNascimentoBebe),
    nome: normalizeField(d.nomeBebe ?? '', 80),
    titular: {
      nome: normalizeField(d.nome, 80),
      dataNascimento: data(d.dataNascimento),
      telefone: normalizeField(d.telefone ?? '', 20),
      email: d.email ?? '',
      observacoes: normalizeField(d.observacoes ?? '', 500),
    },
  })

  await Vinculo.create({
    crianca: jornada._id,
    pacienteId: '',
    pacienteNome: jornada.titular?.nome ?? '',
    medicoId: req.user!.id,
    medicoNome: req.user!.nome,
    status: 'ativo',
  })

  // A abertura da jornada é o primeiro fato da história dela.
  await registrar(jornada._id, {
    tipo: 'admissao',
    autorId: req.user!.id,
    autorNome: req.user!.nome,
    autorPapel: req.user!.papel,
    texto: `Cadastro aberto no consultório por ${req.user!.nome}, sem conta na plataforma.`,
  }).catch(() => {
    /* o cadastro vale mesmo se a anotação falhar */
  })

  res.status(201).json({ paciente: serialize(jornada) })
})

/** GET /api/pacientes/:id — o cabeçalho do hub da paciente. */
pacientesRouter.get('/:id', requireAuth, requireRole('medico'), async (req, res) => {
  const jornada = await minhaOr404(req.params.id, req.user!.id)
  if (!jornada) {
    res.status(404).json({ error: 'Não encontramos essa paciente.' })
    return
  }
  res.json({ paciente: serialize(jornada) })
})

/** PATCH /api/pacientes/:id — corrigir o que foi digitado às pressas. */
pacientesRouter.patch('/:id', requireAuth, requireRole('medico'), async (req, res) => {
  const parsed = pacientePatchSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Confere os dados.' })
    return
  }
  const jornada = await minhaOr404(req.params.id, req.user!.id)
  if (!jornada) {
    res.status(404).json({ error: 'Não encontramos essa paciente.' })
    return
  }
  const d = parsed.data

  if (d.momento) jornada.momento = d.momento
  if (d.dpp !== undefined) jornada.dpp = data(d.dpp)
  if (d.dataNascimentoBebe !== undefined) jornada.dataNascimento = data(d.dataNascimentoBebe)
  if (d.nomeBebe !== undefined) jornada.nome = normalizeField(d.nomeBebe, 80)

  // Jornadas anteriores a este campo não têm o subdocumento: parte-se do que
  // existe, e não de um objeto novo que apagaria o resto ao salvar.
  const titular = {
    nome: '',
    email: '',
    cpf: '',
    telefone: '',
    observacoes: '',
    dataNascimento: null as Date | null,
    ...(jornada.titular ?? {}),
  }
  if (d.nome !== undefined) titular.nome = normalizeField(d.nome, 80)
  if (d.dataNascimento !== undefined) titular.dataNascimento = data(d.dataNascimento)
  if (d.telefone !== undefined) titular.telefone = normalizeField(d.telefone, 20)
  if (d.email !== undefined) titular.email = d.email
  if (d.observacoes !== undefined) titular.observacoes = normalizeField(d.observacoes, 500)
  jornada.titular = titular
  await jornada.save()

  // O nome também vive no vínculo, que é o que a lista lê sem abrir a jornada.
  if (d.nome !== undefined) {
    await Vinculo.updateOne(
      { crianca: jornada._id, medicoId: req.user!.id },
      { $set: { pacienteNome: titular.nome ?? '' } },
    )
  }

  res.json({ paciente: serialize(jornada) })
})

/**
 * POST /api/pacientes/:id/codigo — gera o código que a paciente vai digitar.
 *
 * Regerar invalida o anterior, e isso é a funcionalidade: um código anotado num
 * papel que se perdeu deixa de existir no momento em que o médico gera outro.
 */
pacientesRouter.post('/:id/codigo', requireAuth, requireRole('medico'), async (req, res) => {
  const jornada = await minhaOr404(req.params.id, req.user!.id)
  if (!jornada) {
    res.status(404).json({ error: 'Não encontramos essa paciente.' })
    return
  }
  if (!semConta(jornada)) {
    res.status(409).json({ error: 'Essa paciente já tem conta vinculada.' })
    return
  }

  jornada.vinculacao = { ...codigoNovo(), vinculadaEm: null }
  await jornada.save()
  res.json({ paciente: serialize(jornada) })
})

/** DELETE /api/pacientes/:id/codigo — o médico corta o convite. */
pacientesRouter.delete('/:id/codigo', requireAuth, requireRole('medico'), async (req, res) => {
  const jornada = await minhaOr404(req.params.id, req.user!.id)
  if (!jornada) {
    res.status(404).json({ error: 'Não encontramos essa paciente.' })
    return
  }
  jornada.vinculacao = { codigo: '', geradoEm: null, expiraEm: null, vinculadaEm: null }
  await jornada.save()
  res.json({ paciente: serialize(jornada) })
})

/**
 * POST /api/pacientes/vincular — a paciente reivindica a própria jornada.
 *
 * Quem age aqui é a paciente, com o código em mãos, e não o médico apontando
 * para um e-mail. A diferença não é de estilo: um erro de digitação do médico
 * entregaria o prontuário inteiro para outra pessoa, e ninguém perceberia. Com o
 * código, o registro só encontra dono quando quem esteve na consulta age.
 *
 * O que acontece por dentro é uma **adoção, não uma cópia**: a jornada do
 * consultório passa a ser a jornada da conta, com o histórico inteiro no lugar.
 * A jornada automática que o cadastro criou é descartada — e só se estiver
 * vazia, verificado coleção por coleção.
 */
pacientesRouter.post('/vincular', requireAuth, async (req, res) => {
  const parsed = vincularCodigoSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Confere o código.' })
    return
  }
  const codigo = normalizarCodigo(parsed.data.codigo)
  if (codigo.length < 6) {
    res.status(400).json({ error: 'Esse código não parece completo.' })
    return
  }

  // Um médico não reivindica jornada para si: ele já tem acesso pelo vínculo, e
  // virar responsável o tornaria a família do próprio paciente.
  if (req.user!.papel === 'medico') {
    res.status(403).json({ error: 'Códigos de vinculação são para a paciente, não para o médico.' })
    return
  }

  const alvo = await Jornada.findOne({ 'vinculacao.codigo': codigo })
  if (!alvo || !semConta(alvo)) {
    res.status(404).json({ error: 'Código não encontrado. Confere com quem te atendeu.' })
    return
  }
  if (!codigoValido(alvo.vinculacao)) {
    res.status(410).json({ error: 'Esse código expirou. Peça um novo ao seu médico.' })
    return
  }

  /*
   * Antes de tocar em qualquer coisa: as jornadas que a conta já tem podem ser
   * descartadas? Perguntar primeiro e só então reivindicar é o que garante que
   * uma recusa aqui deixe tudo exatamente como estava.
   */
  const minhas = await Jornada.find({ responsavel: req.user!.id })
  for (const minha of minhas) {
    if (!(await jornadaVazia(minha._id))) {
      res.status(409).json({
        error:
          'Você já tem uma jornada com registros nesta conta. Peça ao seu médico para transferir o prontuário em vez de vincular.',
      })
      return
    }
  }

  /*
   * A reivindicação é uma escrita condicional só: quem chegar primeiro leva. Ler
   * e depois gravar deixaria duas pessoas com o mesmo código virarem donas da
   * mesma jornada — e a segunda apagaria a primeira sem aviso.
   */
  const jornada = await Jornada.findOneAndUpdate(
    { _id: alvo._id, 'vinculacao.codigo': codigo, responsavel: null },
    {
      $set: {
        responsavel: req.user!.id,
        'vinculacao.codigo': '',
        'vinculacao.expiraEm': null,
        'vinculacao.vinculadaEm': new Date(),
      },
    },
    { returnDocument: 'after' },
  )
  if (!jornada) {
    res.status(409).json({ error: 'Esse código acabou de ser usado.' })
    return
  }

  // Só agora, com a adoção feita, as jornadas vazias saem de cena.
  await Jornada.deleteMany({ _id: { $in: minhas.map((m) => m._id) }, responsavel: req.user!.id })

  /*
   * O que estava marcado como "sem conta" passa a apontar para a conta. Sem isto
   * a paciente entraria e não veria os próprios agendamentos, e o médico veria
   * um nome antigo na lista — o vínculo estaria certo e a tela, errada.
   */
  await Promise.all([
    Vinculo.updateMany(
      { crianca: jornada._id },
      { $set: { pacienteId: req.user!.id, pacienteNome: req.user!.nome } },
    ),
    Agendamento.updateMany(
      { crianca: jornada._id, pacienteId: '' },
      { $set: { pacienteId: req.user!.id, pacienteNome: req.user!.nome } },
    ),
  ])

  await registrar(jornada._id, {
    tipo: 'evolucao',
    autorId: req.user!.id,
    autorNome: req.user!.nome,
    autorPapel: req.user!.papel,
    texto: `${req.user!.nome} vinculou a própria conta a este prontuário.`,
  }).catch(() => {
    /* a vinculação vale mesmo se a anotação falhar */
  })

  auditarAgora({
    acao: 'paciente.vincular',
    atorId: req.user!.id,
    atorPapel: req.user!.papel,
    recurso: { colecao: 'criancas', id: String(jornada._id) },
    jornada: String(jornada._id),
    ip: req.ip,
    userAgent: req.get('user-agent') ?? '',
  })

  res.json({ vinculada: true, jornada: String(jornada._id) })
})
