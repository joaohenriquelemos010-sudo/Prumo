import { Router } from 'express'
import { isValidObjectId } from 'mongoose'
import type { HydratedDocument } from 'mongoose'
import { requireAuth, requireRole } from '../auth.js'
import { Recebimento, competenciaDe } from '../models/Recebimento.js'
import type { RecebimentoDoc } from '../models/Recebimento.js'
import { Agendamento } from '../models/Agendamento.js'
import { resumir } from '../services/financeiro.js'
import { recebimentoCreateSchema, recebimentoPatchSchema } from '../validation.js'
import { normalizeField } from '../sanitize.js'

export const financeiroRouter = Router()

/**
 * O financeiro da médica.
 *
 * ## Escopo por médico, e isso é a regra inteira
 *
 * Todo o resto do Prumo é escopado por `Crianca` — a jornada é da família. Aqui
 * é o contrário: **o dado é do médico**, e a paciente não tem nada com quanto
 * ele cobrou. Por isso não há `resolveJornadaOr403` em lugar nenhum deste
 * arquivo, e toda query carrega `medicoId: req.user!.id`.
 *
 * A consequência que importa: um recebimento **nunca** aparece na exportação
 * LGPD da paciente nem no pacote de transferência. Se um dia aparecer, é
 * vazamento — na direção contrária da usual, mas vazamento.
 *
 * ## Não é TISS
 *
 * Deliberado. TISS 4.x é meses de trabalho com particularidades por operadora e
 * só paga para quem fatura convênio direto. Isto responde a pergunta que a
 * obstetra faz todo mês — *quanto entrou?* — e nada além.
 */

function serialize(r: HydratedDocument<RecebimentoDoc>) {
  return {
    id: String(r._id),
    jornada: r.jornada ? String(r.jornada) : null,
    pacienteNome: r.pacienteNome,
    agendamento: r.agendamento ? String(r.agendamento) : null,
    valorCentavos: r.valorCentavos,
    forma: r.forma,
    convenio: r.convenio,
    estado: r.estado,
    dataAtendimento: new Date(r.dataAtendimento).toISOString(),
    recebidoEm: r.recebidoEm ? new Date(r.recebidoEm).toISOString() : null,
    competencia: r.competencia,
    observacao: r.observacao,
  }
}

/**
 * GET /api/financeiro?competencia=AAAA-MM — o mês, com o resumo pronto.
 *
 * O resumo vem do servidor em vez de ser somado no cliente porque é o mesmo
 * número que sai no PDF: duas somas em dois lugares divergem no dia em que
 * alguém mudar a regra de "cancelado não conta" num só deles.
 */
financeiroRouter.get('/', requireAuth, requireRole('medico'), async (req, res) => {
  const pedida = String(req.query.competencia ?? '')
  const competencia = /^\d{4}-\d{2}$/.test(pedida) ? pedida : competenciaDe(new Date())

  const recebimentos = await Recebimento.find({
    medicoId: req.user!.id,
    competencia,
  }).sort({ dataAtendimento: -1 })

  const linhas = recebimentos.map(serialize)

  res.json({
    competencia,
    recebimentos: linhas,
    resumo: resumir(linhas),
  })
})

/**
 * GET /api/financeiro/meses — as competências que têm algo.
 *
 * Alimenta o seletor de mês. Devolver só o que existe evita a tela oferecer
 * dezembro de 2019 e a médica descobrir que está vazio depois de clicar.
 */
financeiroRouter.get('/meses', requireAuth, requireRole('medico'), async (req, res) => {
  const meses = await Recebimento.distinct('competencia', { medicoId: req.user!.id })
  // String ordena cronologicamente porque o formato é AAAA-MM. Mais recente
  // primeiro: é o mês que a pessoa quer ver.
  res.json({ meses: (meses as string[]).sort().reverse() })
})

/**
 * GET /api/financeiro/pendentes — atendimentos realizados que ninguém lançou.
 *
 * É o que faz o mês fechar sozinho em vez de virar digitação dupla. A agenda já
 * sabe quem foi atendido; sem esta lista, a médica teria que reler a própria
 * agenda e transcrever à mão — e é assim que um financeiro deixa de ser usado
 * na segunda semana.
 */
financeiroRouter.get('/pendentes', requireAuth, requireRole('medico'), async (req, res) => {
  const desde = new Date()
  desde.setDate(desde.getDate() - 60)

  const realizados = await Agendamento.find({
    medicoId: req.user!.id,
    status: 'realizado',
    inicio: { $gte: desde },
  })
    .sort({ inicio: -1 })
    .limit(100)

  // Um `$nin` com os ids já lançados é uma query a mais e evita 100 idas ao
  // banco — a alternativa ingênua aqui é o clássico N+1.
  const jaLancados = await Recebimento.distinct('agendamento', {
    medicoId: req.user!.id,
    agendamento: { $in: realizados.map((a) => a._id) },
  })
  const lancados = new Set((jaLancados as unknown[]).map(String))

  res.json({
    pendentes: realizados
      .filter((a) => !lancados.has(String(a._id)))
      .map((a) => ({
        id: String(a._id),
        pacienteNome: a.pacienteNome,
        inicio: new Date(a.inicio).toISOString(),
        objetivo: a.objetivo,
        convenio: a.convenio,
      })),
  })
})

/** POST /api/financeiro — registra o que foi (ou será) cobrado. */
financeiroRouter.post('/', requireAuth, requireRole('medico'), async (req, res) => {
  const parsed = recebimentoCreateSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Confere os dados.' })
    return
  }
  const d = parsed.data

  let jornada = null
  let pacienteNome = normalizeField(d.pacienteNome ?? '', 120)
  let dataAtendimento = d.dataAtendimento ? new Date(d.dataAtendimento) : new Date()

  if (d.agendamentoId) {
    if (!isValidObjectId(d.agendamentoId)) {
      res.status(404).json({ error: 'Não encontramos esse agendamento.' })
      return
    }
    const agendamento = await Agendamento.findById(d.agendamentoId)
    // Escopado ao dono: sem isso, conhecer um id de agendamento permitiria
    // pendurar um recebimento na agenda de outro médico.
    if (!agendamento || agendamento.medicoId !== req.user!.id) {
      res.status(404).json({ error: 'Não encontramos esse agendamento.' })
      return
    }
    jornada = agendamento.crianca
    pacienteNome = pacienteNome || agendamento.pacienteNome
    dataAtendimento = new Date(agendamento.inicio)
  }

  const recebido = d.estado === 'recebido'

  try {
    const recebimento = await Recebimento.create({
      medicoId: req.user!.id,
      jornada,
      pacienteNome,
      agendamento: d.agendamentoId ?? null,
      valorCentavos: d.valorCentavos,
      forma: d.forma,
      convenio: d.forma === 'convenio' ? normalizeField(d.convenio ?? '', 80) : '',
      estado: d.estado,
      dataAtendimento,
      recebidoEm: recebido ? (d.recebidoEm ? new Date(d.recebidoEm) : new Date()) : null,
      competencia: competenciaDe(dataAtendimento),
      observacao: normalizeField(d.observacao ?? '', 300),
    })
    res.status(201).json({ recebimento: serialize(recebimento) })
  } catch (err) {
    /**
     * Índice único em `agendamento`. Clicar duas vezes em "registrar" dobraria o
     * faturamento do mês — e ninguém confere um relatório financeiro contra a
     * agenda item a item. Devolve o que já existe, em vez de um erro que faria
     * a pessoa tentar de novo.
     */
    if ((err as { code?: number }).code === 11000 && d.agendamentoId) {
      const existente = await Recebimento.findOne({
        medicoId: req.user!.id,
        agendamento: d.agendamentoId,
      })
      if (existente) {
        res.status(200).json({ recebimento: serialize(existente), jaExistia: true })
        return
      }
    }
    throw err
  }
})

/** PATCH /api/financeiro/:id — marca como recebido, corrige valor, cancela. */
financeiroRouter.patch('/:id', requireAuth, requireRole('medico'), async (req, res) => {
  const parsed = recebimentoPatchSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Confere os dados.' })
    return
  }
  if (!isValidObjectId(req.params.id)) {
    res.status(404).json({ error: 'Não encontramos esse lançamento.' })
    return
  }

  const recebimento = await Recebimento.findOne({
    _id: req.params.id,
    medicoId: req.user!.id,
  })
  if (!recebimento) {
    res.status(404).json({ error: 'Não encontramos esse lançamento.' })
    return
  }

  const d = parsed.data
  if (d.valorCentavos !== undefined) recebimento.valorCentavos = d.valorCentavos
  if (d.forma !== undefined) recebimento.forma = d.forma
  if (d.convenio !== undefined) recebimento.convenio = normalizeField(d.convenio, 80)
  if (d.observacao !== undefined) recebimento.observacao = normalizeField(d.observacao, 300)

  if (d.estado !== undefined) {
    recebimento.estado = d.estado
    // A data de recebimento acompanha o estado: marcar como recebido carimba
    // agora, voltar para previsto limpa. Deixar um carimbo velho num lançamento
    // que voltou a ser previsto é como um relatório passa a mentir.
    recebimento.recebidoEm =
      d.estado === 'recebido' ? (recebimento.recebidoEm ?? new Date()) : null
  }

  if (d.dataAtendimento) {
    const nova = new Date(d.dataAtendimento)
    recebimento.dataAtendimento = nova
    // A competência é derivada: mudar a data sem mudá-la faria o lançamento
    // sumir do mês certo e aparecer no errado.
    recebimento.competencia = competenciaDe(nova)
  }

  await recebimento.save()
  res.json({ recebimento: serialize(recebimento) })
})

/** DELETE /api/financeiro/:id — some de vez. Não é dado clínico. */
financeiroRouter.delete('/:id', requireAuth, requireRole('medico'), async (req, res) => {
  if (!isValidObjectId(req.params.id)) {
    res.status(404).json({ error: 'Não encontramos esse lançamento.' })
    return
  }
  const r = await Recebimento.deleteOne({ _id: req.params.id, medicoId: req.user!.id })
  if (r.deletedCount === 0) {
    res.status(404).json({ error: 'Não encontramos esse lançamento.' })
    return
  }
  res.status(204).end()
})
