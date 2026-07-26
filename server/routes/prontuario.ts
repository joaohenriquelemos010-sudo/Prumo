import { Router } from 'express'
import { requireAuth, requireRole } from '../auth.js'
import { resolveCriancaOr403 } from '../services/acesso.js'
import { Prontuario } from '../models/Prontuario.js'
import type { ProntuarioDoc } from '../models/Prontuario.js'
import type { HydratedDocument, Types } from 'mongoose'
import { resumoNascimentoSchema, prontuarioUpdateSchema, prontuarioEventoSchema } from '../validation.js'
import { normalizeField } from '../sanitize.js'

export const prontuarioRouter = Router()

async function getOrCreateProntuario(criancaId: Types.ObjectId): Promise<HydratedDocument<ProntuarioDoc>> {
  const existing = await Prontuario.findOne({ crianca: criancaId })
  if (existing) return existing
  return Prontuario.create({ crianca: criancaId })
}

function serialize(p: HydratedDocument<ProntuarioDoc>) {
  return {
    tipoSanguineo: p.tipoSanguineo,
    alergias: p.alergias,
    resumoGestacional: p.resumoGestacional,
    condicoes: p.condicoes,
    resumoNascimento: p.resumoNascimento?.preenchido
      ? {
          preenchido: true,
          igAoNascerSemanas: p.resumoNascimento.igAoNascerSemanas,
          igAoNascerDias: p.resumoNascimento.igAoNascerDias,
          tipoParto: p.resumoNascimento.tipoParto,
          apgar1: p.resumoNascimento.apgar1,
          apgar5: p.resumoNascimento.apgar5,
          pesoNascimentoG: p.resumoNascimento.pesoNascimentoG,
          comprimentoNascimentoCm: p.resumoNascimento.comprimentoNascimentoCm,
          pcNascimentoCm: p.resumoNascimento.pcNascimentoCm,
          intercorrencias: p.resumoNascimento.intercorrencias,
          sorologiasMaternas: p.resumoNascimento.sorologiasMaternas,
          gbs: p.resumoNascimento.gbs,
          aleitamento: p.resumoNascimento.aleitamento,
          triagens: p.resumoNascimento.triagens ?? [],
          registradoEm: p.resumoNascimento.registradoEm
            ? new Date(p.resumoNascimento.registradoEm).toISOString()
            : null,
        }
      : null,
    eventos: p.eventos
      .map((e) => ({
        id: String(e._id),
        data: e.data ? new Date(e.data).toISOString() : new Date().toISOString(),
        autorId: e.autorId,
        autorNome: e.autorNome,
        autorPapel: e.autorPapel,
        texto: e.texto,
      }))
      .reverse(),
  }
}

// GET /api/prontuario
prontuarioRouter.get('/', requireAuth, async (req, res) => {
  const crianca = await resolveCriancaOr403(req, res)
  if (!crianca) return
  const prontuario = await getOrCreateProntuario(crianca._id)
  res.json({ prontuario: serialize(prontuario) })
})

/**
 * PUT /api/prontuario/nascimento — the handoff from obstetrics to paediatrics.
 *
 * One save does the whole turn: it records how the pregnancy ended and what the
 * newborn screening already answered, flips the journey to `ja-nasceu`, and drops
 * a dated event on the timeline so the pediatrician sees the transition rather
 * than inferring it. Doctor-only, because it is a clinical record.
 */
prontuarioRouter.put('/nascimento', requireAuth, requireRole('medico'), async (req, res) => {
  const parsed = resumoNascimentoSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Confere os dados do nascimento.' })
    return
  }
  const crianca = await resolveCriancaOr403(req, res)
  if (!crianca) return

  const d = parsed.data
  const prontuario = await getOrCreateProntuario(crianca._id)

  prontuario.resumoNascimento = {
    preenchido: true,
    igAoNascerSemanas: d.igAoNascerSemanas ?? null,
    igAoNascerDias: d.igAoNascerDias ?? null,
    tipoParto: d.tipoParto ?? '',
    apgar1: d.apgar1 ?? null,
    apgar5: d.apgar5 ?? null,
    pesoNascimentoG: d.pesoNascimentoG ?? null,
    comprimentoNascimentoCm: d.comprimentoNascimentoCm ?? null,
    pcNascimentoCm: d.pcNascimentoCm ?? null,
    intercorrencias: normalizeField(d.intercorrencias ?? '', 1000),
    sorologiasMaternas: normalizeField(d.sorologiasMaternas ?? '', 500),
    gbs: d.gbs ?? '',
    aleitamento: normalizeField(d.aleitamento ?? '', 200),
    triagens: (d.triagens ?? []).map((t) => ({
      id: t.id,
      feito: t.feito,
      data: t.feito ? new Date() : null,
      resultado: normalizeField(t.resultado ?? '', 200),
    })),
    registradoPor: req.user!.id,
    registradoEm: new Date(),
  } as typeof prontuario.resumoNascimento

  // The timeline is what the next clinician scrolls; say the turn happened.
  const resumo = [
    d.igAoNascerSemanas != null && `${d.igAoNascerSemanas}s${d.igAoNascerDias ?? 0}d`,
    d.tipoParto && `parto ${d.tipoParto}`,
    d.pesoNascimentoG && `${d.pesoNascimentoG} g`,
    d.apgar1 != null && d.apgar5 != null && `Apgar ${d.apgar1}/${d.apgar5}`,
  ]
    .filter(Boolean)
    .join(' · ')

  prontuario.eventos.push({
    data: d.dataNascimento ? new Date(d.dataNascimento) : new Date(),
    autorId: req.user!.id,
    autorNome: req.user!.nome,
    autorPapel: req.user!.papel,
    texto: `Nascimento registrado${resumo ? `: ${resumo}` : ''}. Acompanhamento segue com a pediatria.`,
  })
  await prontuario.save()

  // Flip the journey, so every derived schedule (vaccines, puericultura) starts.
  crianca.momento = 'ja-nasceu'
  if (d.dataNascimento) crianca.dataNascimento = new Date(d.dataNascimento)
  else if (!crianca.dataNascimento) crianca.dataNascimento = new Date()
  await crianca.save()

  res.json({ prontuario: serialize(prontuario) })
})

// PUT /api/prontuario — update the structured summary (doctor-only).
prontuarioRouter.put('/', requireAuth, requireRole('medico'), async (req, res) => {
  const parsed = prontuarioUpdateSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Confere os dados, por favor.' })
    return
  }
  const crianca = await resolveCriancaOr403(req, res)
  if (!crianca) return
  const prontuario = await getOrCreateProntuario(crianca._id)
  const { tipoSanguineo, alergias, resumoGestacional, condicoes } = parsed.data
  if (tipoSanguineo !== undefined) prontuario.tipoSanguineo = normalizeField(tipoSanguineo, 8)
  if (alergias !== undefined) prontuario.alergias = normalizeField(alergias, 500)
  if (resumoGestacional !== undefined) prontuario.resumoGestacional = normalizeField(resumoGestacional, 2000)
  if (condicoes !== undefined) prontuario.condicoes = condicoes.map((c) => normalizeField(c, 120)).filter(Boolean)
  await prontuario.save()
  res.json({ prontuario: serialize(prontuario) })
})

// POST /api/prontuario/evento — append a dated note.
prontuarioRouter.post('/evento', requireAuth, async (req, res) => {
  const parsed = prontuarioEventoSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Escreva a anotação.' })
    return
  }
  const crianca = await resolveCriancaOr403(req, res)
  if (!crianca) return
  const prontuario = await getOrCreateProntuario(crianca._id)
  prontuario.eventos.push({
    data: new Date(),
    autorId: req.user!.id,
    autorNome: req.user!.nome,
    autorPapel: req.user!.papel,
    texto: normalizeField(parsed.data.texto, 2000),
  })
  await prontuario.save()
  res.status(201).json({ prontuario: serialize(prontuario) })
})

// PUT /api/prontuario/evento/:id — edit an annotation (author only).
prontuarioRouter.put('/evento/:id', requireAuth, async (req, res) => {
  const parsed = prontuarioEventoSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Escreva a anotação.' })
    return
  }
  const crianca = await resolveCriancaOr403(req, res)
  if (!crianca) return
  const prontuario = await getOrCreateProntuario(crianca._id)
  const evento = prontuario.eventos.find((e) => String(e._id) === req.params.id)
  if (!evento) {
    res.status(404).json({ error: 'Não encontramos essa anotação.' })
    return
  }
  if (evento.autorId !== req.user!.id) {
    res.status(403).json({ error: 'Você só pode editar as suas próprias anotações.' })
    return
  }
  evento.texto = normalizeField(parsed.data.texto, 2000)
  await prontuario.save()
  res.json({ prontuario: serialize(prontuario) })
})

// DELETE /api/prontuario/evento/:id — remove an annotation (author only).
prontuarioRouter.delete('/evento/:id', requireAuth, async (req, res) => {
  const crianca = await resolveCriancaOr403(req, res)
  if (!crianca) return
  const prontuario = await getOrCreateProntuario(crianca._id)
  const evento = prontuario.eventos.find((e) => String(e._id) === req.params.id)
  if (!evento) {
    res.status(404).json({ error: 'Não encontramos essa anotação.' })
    return
  }
  if (evento.autorId !== req.user!.id) {
    res.status(403).json({ error: 'Você só pode remover as suas próprias anotações.' })
    return
  }
  prontuario.eventos.pull({ _id: req.params.id })
  await prontuario.save()
  res.json({ prontuario: serialize(prontuario) })
})
