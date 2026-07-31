import { Router } from 'express'
import { isValidObjectId } from 'mongoose'
import type { HydratedDocument } from 'mongoose'
import { requireAuth, requireRole } from '../auth.js'
import { resolveJornadaOr403 } from '../services/jornada.js'
import { Prescricao, VIAS_POR_TIPO } from '../models/Prescricao.js'
import type { PrescricaoDoc, TipoPrescricao } from '../models/Prescricao.js'
import { User } from '../models/User.js'
import { prescricaoCreateSchema, prescricaoCancelarSchema } from '../validation.js'
import { normalizeField, normalizeTexto } from '../sanitize.js'
import { registrar as registrarEvolucao } from '../services/evolucao.js'
import { auditar } from '../services/auditoria.js'

export const prescricoesRouter = Router()

/**
 * Por quantos dias a receita vale.
 *
 * Antimicrobiano: 10 dias (RDC 20/2011). Controle especial: 30 (Portaria
 * 344/1998). Simples: 30 é a prática corrente — não há prazo legal, e é o que
 * as farmácias aceitam sem discussão.
 *
 * Gravado no documento em vez de calculado na leitura: se a regra mudar, a
 * receita emitida ontem continua valendo pelo prazo de ontem.
 */
const VALIDADE_DIAS: Record<TipoPrescricao, number> = {
  simples: 30,
  antimicrobiano: 10,
  especial: 30,
}

export function serializePrescricao(p: HydratedDocument<PrescricaoDoc>) {
  return {
    id: String(p._id),
    jornada: String(p.jornada),
    consulta: p.consulta ? String(p.consulta) : null,
    medicoId: p.medicoId,
    medicoNome: p.medicoNome,
    medicoCrm: p.medicoCrm,
    medicoCrmUf: p.medicoCrmUf,
    medicoEspecialidade: p.medicoEspecialidade,
    pacienteNome: p.pacienteNome,
    tipo: p.tipo,
    vias: VIAS_POR_TIPO[p.tipo as TipoPrescricao] ?? 1,
    itens: (p.itens ?? []).map((i) => ({
      medicamento: i.medicamento,
      dose: i.dose,
      posologia: i.posologia,
      duracao: i.duracao,
      quantidade: i.quantidade,
      observacao: i.observacao,
    })),
    orientacoes: p.orientacoes,
    emitidaEm: new Date(p.emitidaEm).toISOString(),
    validaAte: new Date(p.validaAte).toISOString(),
    canceladaEm: p.canceladaEm ? new Date(p.canceladaEm).toISOString() : null,
    motivoCancelamento: p.motivoCancelamento,
  }
}

/**
 * GET /api/prescricoes — as receitas desta jornada.
 *
 * A família lê as próprias receitas, e isso é o ponto: hoje a receita vive num
 * papel amassado na bolsa e some. Não há nada aqui que ela não deva ver — foi
 * escrito para ela levar à farmácia.
 */
prescricoesRouter.get('/', requireAuth, async (req, res) => {
  const jornada = await resolveJornadaOr403(req, res)
  if (!jornada) return

  const prescricoes = await Prescricao.find({ jornada: jornada._id }).sort({ emitidaEm: -1 }).limit(100)
  res.json({ prescricoes: prescricoes.map(serializePrescricao) })
})

/**
 * POST /api/prescricoes — a médica prescreve.
 *
 * Grava a receita **e** uma entrada na história clínica. As duas coisas, e nesta
 * ordem: prescrever é um ato, e um ato que não entra na cadeia encadeada é um
 * buraco no prontuário — visível na lista de receitas e invisível na
 * transferência para o próximo médico.
 */
prescricoesRouter.post(
  '/',
  requireAuth,
  requireRole('medico'),
  auditar('prontuario.escrever', 'prescricoes'),
  async (req, res) => {
    const parsed = prescricaoCreateSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Confere a receita.' })
      return
    }
    const jornada = await resolveJornadaOr403(req, res)
    if (!jornada) return

    const d = parsed.data
    // O CRM vem do cadastro, e não do corpo do request: é identidade
    // profissional, não campo de formulário.
    const medico = await User.findById(req.user!.id).select('nome crm crmUf especialidade')

    const emitidaEm = new Date()
    const validaAte = new Date(emitidaEm.getTime() + VALIDADE_DIAS[d.tipo] * 864e5)

    const prescricao = await Prescricao.create({
      jornada: jornada._id,
      consulta: d.consultaId && isValidObjectId(d.consultaId) ? d.consultaId : null,
      medicoId: req.user!.id,
      medicoNome: medico?.nome ?? req.user!.nome,
      medicoCrm: medico?.crm ?? '',
      medicoCrmUf: medico?.crmUf ?? '',
      medicoEspecialidade: medico?.especialidade ?? '',
      pacienteNome: normalizeField(d.pacienteNome ?? jornada.nome ?? '', 120),
      tipo: d.tipo,
      itens: d.itens.map((i) => ({
        medicamento: normalizeField(i.medicamento, 200),
        dose: normalizeField(i.dose ?? '', 120),
        posologia: normalizeField(i.posologia ?? '', 200),
        duracao: normalizeField(i.duracao ?? '', 120),
        quantidade: normalizeField(i.quantidade ?? '', 80),
        observacao: normalizeField(i.observacao ?? '', 300),
      })),
      orientacoes: normalizeTexto(d.orientacoes ?? '', 1000),
      emitidaEm,
      validaAte,
    })

    await registrarEvolucao(jornada._id, {
      tipo: 'prescricao',
      consulta: prescricao.consulta,
      autorId: req.user!.id,
      autorNome: medico?.nome ?? req.user!.nome,
      autorPapel: req.user!.papel,
      autorCrm: medico?.crm ?? '',
      autorEspecialidade: medico?.especialidade ?? '',
      em: emitidaEm,
      texto: prescricao.itens
        .map((i) =>
          [i.medicamento, i.dose, i.posologia, i.duracao].filter(Boolean).join(' · '),
        )
        .join('\n'),
      estruturado: { prescricao: String(prescricao._id), tipo: prescricao.tipo },
      // A receita é da paciente: ela precisa vê-la, e foi escrita para ela levar.
      visibilidade: 'familia',
    }).catch(() => {
      /* a história importa, mas não a ponto de custar a receita já emitida */
    })

    res.status(201).json({ prescricao: serializePrescricao(prescricao) })
  },
)

/**
 * POST /api/prescricoes/:id/cancelar — a médica desfaz.
 *
 * Cancelar **não apaga**: o registro é append-only, e a receita existiu. O que
 * muda é que ela para de valer e o PDF sai carimbado — porque a paciente pode
 * ter impresso a via anterior, e a farmácia precisa conseguir distinguir.
 *
 * Só a autora cancela. Outro médico vinculado não desfaz a prescrição de um
 * colega: se ele discorda, prescreve o dele e assina.
 */
prescricoesRouter.post(
  '/:id/cancelar',
  requireAuth,
  requireRole('medico'),
  auditar('prontuario.retificar', 'prescricoes'),
  async (req, res) => {
    const parsed = prescricaoCancelarSchema.safeParse(req.body ?? {})
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Confere os dados.' })
      return
    }
    if (!isValidObjectId(req.params.id)) {
      res.status(404).json({ error: 'Não encontramos essa receita.' })
      return
    }

    const prescricao = await Prescricao.findById(req.params.id)
    if (!prescricao) {
      res.status(404).json({ error: 'Não encontramos essa receita.' })
      return
    }
    if (prescricao.medicoId !== req.user!.id) {
      res.status(403).json({ error: 'Só quem prescreveu pode cancelar.' })
      return
    }
    if (prescricao.canceladaEm) {
      res.json({ prescricao: serializePrescricao(prescricao) })
      return
    }

    prescricao.canceladaEm = new Date()
    prescricao.motivoCancelamento = normalizeField(parsed.data.motivo ?? '', 300)
    await prescricao.save()

    await registrarEvolucao(prescricao.jornada, {
      tipo: 'prescricao',
      autorId: req.user!.id,
      autorNome: req.user!.nome,
      autorPapel: req.user!.papel,
      em: prescricao.canceladaEm,
      texto: `Receita cancelada.${prescricao.motivoCancelamento ? ` Motivo: ${prescricao.motivoCancelamento}` : ''}`,
      estruturado: { prescricao: String(prescricao._id), cancelada: true },
      visibilidade: 'familia',
    }).catch(() => {})

    res.json({ prescricao: serializePrescricao(prescricao) })
  },
)
