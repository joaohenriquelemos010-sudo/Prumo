import { Router } from 'express'
import type { Request, Response } from 'express'
import { isValidObjectId } from 'mongoose'
import type { HydratedDocument } from 'mongoose'
import { randomBytes } from 'node:crypto'
import { requireAuth, requireRole } from '../auth.js'
import { resolveJornadaOr403, resolveJornada } from '../services/jornada.js'
import { auditar } from '../services/auditoria.js'
import { Transferencia } from '../models/Transferencia.js'
import type { TransferenciaDoc } from '../models/Transferencia.js'
import { ESCOPOS_TRANSFERENCIA } from '../models/Transferencia.js'
import { Vinculo } from '../models/Vinculo.js'
import { Jornada } from '../models/Jornada.js'
import { montarPacote } from '../services/pacoteClinico.js'
import { pacoteParaFhir } from '../services/fhir/index.js'
import { registrar } from '../services/evolucao.js'
import { transferenciaCreateSchema } from '../validation.js'
import { normalizeField } from '../sanitize.js'

export const transferenciasRouter = Router()

/** O link vale uma semana — tempo de o colega abrir, não de esquecer aberto. */
const VALIDADE_MS = 7 * 24 * 60 * 60 * 1000

/**
 * O token NUNCA sai daqui. Ele é entregue uma vez só, na resposta do
 * consentimento — quem o guardou, guardou. Um serializer que o incluísse o
 * exporia em toda listagem, para os dois lados.
 */
function serialize(t: HydratedDocument<TransferenciaDoc>) {
  const iso = (d?: Date | null) => (d ? new Date(d).toISOString() : null)
  return {
    id: String(t._id),
    deMedicoNome: t.deMedicoNome,
    paraMedicoEmail: t.paraMedicoEmail,
    paraMedicoNome: t.paraMedicoNome,
    escopo: t.escopo,
    motivo: t.motivo,
    estado: t.estado,
    consentidoEm: iso(t.consentidoEm),
    baixadaEm: iso(t.baixadaEm),
    expiraEm: iso(t.expiraEm),
    criadaEm: iso((t as unknown as { createdAt?: Date }).createdAt),
  }
}

/**
 * POST /api/transferencias — o médico pede para passar o caso adiante.
 *
 * Pedir não dá acesso a nada. Cria o pedido `pendente`, e o token só nasce
 * quando a responsável consentir — antes disso não existe link que baixe coisa
 * alguma, nem por engano nem por vazamento.
 */
transferenciasRouter.post('/', requireAuth, requireRole('medico'), auditar('transferencia.solicitar', 'transferencias'), async (req, res) => {
  const parsed = transferenciaCreateSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Confere os dados.' })
    return
  }
  const jornada = await resolveJornadaOr403(req, res)
  if (!jornada) return

  // Vínculo ativo é o que autoriza pedir. Sem ele, o médico não deveria nem
  // conseguir enxergar a jornada para querer transferi-la.
  const vinculo = await Vinculo.exists({
    crianca: jornada._id,
    medicoId: req.user!.id,
    status: 'ativo',
  })
  if (!vinculo) {
    res.status(403).json({ error: 'Você não está conectado a essa paciente.' })
    return
  }

  const d = parsed.data
  const transferencia = await Transferencia.create({
    jornada: jornada._id,
    deMedicoId: req.user!.id,
    deMedicoNome: req.user!.nome,
    paraMedicoEmail: d.paraMedicoEmail,
    paraMedicoNome: normalizeField(d.paraMedicoNome ?? '', 80),
    escopo: d.escopo?.length ? d.escopo : ['prontuario'],
    motivo: normalizeField(d.motivo ?? '', 300),
    estado: 'pendente',
  })

  res.status(201).json({ transferencia: serialize(transferencia) })
})

/**
 * GET /api/transferencias — o que existe nesta jornada.
 *
 * Serve aos dois lados: o médico vê o que pediu, a família vê o que tem para
 * aprovar e o que já autorizou. Mesma rota porque é a mesma lista — quem lê
 * muda o que ela significa, não o conteúdo.
 */
transferenciasRouter.get('/', requireAuth, async (req, res) => {
  const jornada = await resolveJornadaOr403(req, res)
  if (!jornada) return
  const lista = await Transferencia.find({ jornada: jornada._id }).sort({ createdAt: -1 }).limit(50)
  res.json({ transferencias: lista.map(serialize) })
})

/**
 * POST /api/transferencias/:id/consentir — a responsável autoriza.
 *
 * Só quem é dono da jornada consente, e um médico vinculado explicitamente NÃO
 * pode: seria o solicitante aprovando o próprio pedido. É aqui que o token
 * nasce.
 */
transferenciasRouter.post('/:id/consentir', requireAuth, auditar('transferencia.consentir', 'transferencias'), async (req, res) => {
  if (!isValidObjectId(req.params.id)) {
    res.status(404).json({ error: 'Não encontramos esse pedido.' })
    return
  }
  const transferencia = await Transferencia.findById(req.params.id)
  if (!transferencia) {
    res.status(404).json({ error: 'Não encontramos esse pedido.' })
    return
  }

  const jornada = await Jornada.findById(transferencia.jornada)
  if (!jornada) {
    res.status(404).json({ error: 'Não encontramos essa jornada.' })
    return
  }
  const ehDono =
    String(jornada.responsavel) === req.user!.id ||
    (jornada.coResponsaveis ?? []).includes(req.user!.id)
  if (!ehDono) {
    res.status(403).json({ error: 'Só quem é responsável pela jornada pode autorizar.' })
    return
  }
  if (transferencia.estado !== 'pendente') {
    res.status(409).json({ error: 'Esse pedido já foi respondido.' })
    return
  }

  const aprovar = req.body?.aprovar !== false

  if (!aprovar) {
    transferencia.estado = 'recusada'
    transferencia.recusadoEm = new Date()
    await transferencia.save()
    res.json({ transferencia: serialize(transferencia) })
    return
  }

  transferencia.estado = 'consentida'
  transferencia.consentidoPor = req.user!.id
  transferencia.consentidoEm = new Date()
  transferencia.token = randomBytes(24).toString('hex')
  transferencia.expiraEm = new Date(Date.now() + VALIDADE_MS)
  await transferencia.save()

  // A transferência é um fato clínico: fica na história, com autor e data.
  await registrar(jornada._id, {
    tipo: 'transferencia',
    autorId: req.user!.id,
    autorNome: req.user!.nome,
    autorPapel: req.user!.papel,
    texto: `Prontuário autorizado para ${transferencia.paraMedicoNome || transferencia.paraMedicoEmail}, a pedido de ${transferencia.deMedicoNome}.`,
  }).catch(() => {
    /* o consentimento vale mesmo se a anotação falhar */
  })

  res.json({
    transferencia: serialize(transferencia),
    /** Só aparece aqui, uma vez — é o link que a família entrega. */
    path: `/api/transferencias/${transferencia.token}/pacote`,
  })
})

/** POST /api/transferencias/:id/revogar — qualquer um dos dois lados corta. */
transferenciasRouter.post('/:id/revogar', requireAuth, async (req, res) => {
  if (!isValidObjectId(req.params.id)) {
    res.status(404).json({ error: 'Não encontramos esse pedido.' })
    return
  }
  const transferencia = await Transferencia.findById(req.params.id)
  if (!transferencia) {
    res.status(404).json({ error: 'Não encontramos esse pedido.' })
    return
  }
  const jornada = await resolveJornada(req.user!, String(transferencia.jornada))
  if (!jornada) {
    res.status(403).json({ error: 'Você não tem acesso a essa jornada.' })
    return
  }

  transferencia.estado = 'revogada'
  transferencia.revogadaEm = new Date()
  transferencia.token = '' // o link morre na hora
  await transferencia.save()
  res.json({ transferencia: serialize(transferencia) })
})

/**
 * O corpo comum das duas rotas de download.
 *
 * `/pacote` e `/fhir` entregam exatamente o mesmo conteúdo em dois formatos, e
 * por isso precisam da *mesma* porta: se um dia alguém apertar a regra de um
 * lado e esquecer do outro, o formato mais novo vira a porta dos fundos. Uma
 * função só, dois chamadores.
 *
 * Devolve `null` depois de já ter respondido o erro.
 */
async function pacoteAutorizado(req: Request, res: Response) {
  const transferencia = await Transferencia.findOne({ token: req.params.token })
  if (!transferencia || !transferencia.token) {
    res.status(404).json({ error: 'Esse link não é mais válido. Peça um novo.' })
    return null
  }
  if (transferencia.estado !== 'consentida' && transferencia.estado !== 'baixada') {
    res.status(403).json({ error: 'Essa transferência não está autorizada.' })
    return null
  }
  if (transferencia.expiraEm && transferencia.expiraEm.getTime() < Date.now()) {
    res.status(410).json({ error: 'Esse link expirou. Peça um novo.' })
    return null
  }

  const pacote = await montarPacote(
    transferencia.jornada,
    transferencia.escopo as (typeof ESCOPOS_TRANSFERENCIA)[number][],
  )
  if (!pacote) {
    res.status(404).json({ error: 'Não encontramos essa jornada.' })
    return null
  }

  // Carimba quem baixou e quando — a transferência é rastreável dos dois lados.
  transferencia.estado = 'baixada'
  transferencia.baixadaEm = new Date()
  transferencia.paraMedicoId = req.user!.id
  await transferencia.save()

  return pacote
}

/**
 * GET /api/transferencias/:token/pacote — o médico receptor baixa.
 *
 * Exige sessão de médico: o token diz *qual* pacote, não *quem* pode. Um link
 * vazado numa caixa de e-mail comprometida ainda esbarra na necessidade de
 * estar autenticado como profissional.
 */
transferenciasRouter.get('/:token/pacote', requireAuth, requireRole('medico'), auditar('transferencia.baixar', 'transferencias'), async (req, res) => {
  const pacote = await pacoteAutorizado(req, res)
  if (!pacote) return
  res.json({ pacote })
})

/**
 * GET /api/transferencias/:token/fhir — o mesmo pacote como Bundle FHIR R4.
 *
 * Mesmo token, mesma porta, mesma auditoria — só muda o formato do que sai.
 * Quem recebe é software: um prontuário do outro lado que sabe ler FHIR importa
 * isto sem ninguém redigitar nada.
 *
 * ATENÇÃO: é R4 base, não perfil da RNDS. Ver o cabeçalho de
 * `server/services/fhir/index.ts` para o que ainda falta antes de mandar isto
 * para o barramento nacional.
 */
transferenciasRouter.get('/:token/fhir', requireAuth, requireRole('medico'), auditar('transferencia.baixar-fhir', 'transferencias'), async (req, res) => {
  const pacote = await pacoteAutorizado(req, res)
  if (!pacote) return
  // O content-type oficial do FHIR JSON. Um cliente conforme roteia por ele.
  res.type('application/fhir+json').json(pacoteParaFhir(pacote))
})
