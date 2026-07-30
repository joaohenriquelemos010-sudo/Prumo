import { Router } from 'express'
import { isValidObjectId } from 'mongoose'
import { requireAuth, requireRole } from '../auth.js'
import { resolveCriancaOr403 } from '../services/acesso.js'
import { Prontuario } from '../models/Prontuario.js'
import type { ProntuarioDoc } from '../models/Prontuario.js'
import type { HydratedDocument, Types } from 'mongoose'
import { resumoNascimentoSchema, prontuarioUpdateSchema, prontuarioEventoSchema } from '../validation.js'
import { normalizeField } from '../sanitize.js'
import { Evolucao } from '../models/Evolucao.js'
import { registrar, retificar, verificarCadeia, linhaDoTempo } from '../services/evolucao.js'

export const prontuarioRouter = Router()

async function getOrCreateProntuario(criancaId: Types.ObjectId): Promise<HydratedDocument<ProntuarioDoc>> {
  const existing = await Prontuario.findOne({ crianca: criancaId })
  if (existing) return existing
  return Prontuario.create({ crianca: criancaId })
}

export function serializeProntuario(p: HydratedDocument<ProntuarioDoc>) {
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
  res.json({
    prontuario: serializeProntuario(prontuario),
    evolucoes: await linhaDoTempo(crianca._id, req.user!.papel === 'medico'),
  })
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

  await prontuario.save()

  // A virada é um marco da história clínica, não uma anotação solta: entra na
  // cadeia como `admissao`, que é o que a pediatra vai ler como ponto de partida.
  await registrar(crianca._id, {
    tipo: 'admissao',
    autorId: req.user!.id,
    autorNome: req.user!.nome,
    autorPapel: req.user!.papel,
    em: d.dataNascimento ? new Date(d.dataNascimento) : new Date(),
    texto: `Nascimento registrado${resumo ? `: ${resumo}` : ''}. Acompanhamento segue com a pediatria.`,
    estruturado: { resumoNascimento: prontuario.resumoNascimento },
  })

  // Flip the journey, so every derived schedule (vaccines, puericultura) starts.
  crianca.momento = 'ja-nasceu'
  if (d.dataNascimento) crianca.dataNascimento = new Date(d.dataNascimento)
  else if (!crianca.dataNascimento) crianca.dataNascimento = new Date()
  await crianca.save()

  res.json({ prontuario: serializeProntuario(prontuario) })
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
  res.json({ prontuario: serializeProntuario(prontuario) })
})

/**
 * POST /api/prontuario/evento — acrescenta uma entrada à história clínica.
 *
 * Mantém o caminho antigo (o cliente ainda chama assim) mas grava numa
 * `Evolucao` encadeada por hash, e não mais num subdocumento editável.
 */
prontuarioRouter.post('/evento', requireAuth, async (req, res) => {
  const parsed = prontuarioEventoSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Escreva a anotação.' })
    return
  }
  const crianca = await resolveCriancaOr403(req, res)
  if (!crianca) return

  await registrar(crianca._id, {
    tipo: 'evolucao',
    autorId: req.user!.id,
    autorNome: req.user!.nome,
    autorPapel: req.user!.papel,
    texto: parsed.data.texto,
  })

  const prontuario = await getOrCreateProntuario(crianca._id)
  res.status(201).json({
    prontuario: serializeProntuario(prontuario),
    evolucoes: await linhaDoTempo(crianca._id, req.user!.papel === 'medico'),
  })
})

/**
 * POST /api/prontuario/evolucao/:id/retificacao — corrige uma entrada anterior.
 *
 * Substitui o antigo par PUT/DELETE de `/evento/:id`. Um prontuário não se
 * edita nem se apaga: corrige-se escrevendo uma entrada nova que aponta para a
 * anterior, e as duas ficam na história. Foi assim no papel por um século, e a
 * versão eletrônica só é aceitável se preservar isso — é o que a Res. CFM
 * 1.821/2007 e o nível NGS2 da SBIS cobram.
 *
 * Só o autor da entrada original retifica: corrigir o registro de outra pessoa
 * seria reescrever o que ELA observou.
 */
prontuarioRouter.post('/evolucao/:id/retificacao', requireAuth, async (req, res) => {
  const parsed = prontuarioEventoSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Escreva a correção.' })
    return
  }
  if (!isValidObjectId(req.params.id)) {
    res.status(404).json({ error: 'Não encontramos essa anotação.' })
    return
  }
  const crianca = await resolveCriancaOr403(req, res)
  if (!crianca) return

  const original = await Evolucao.findOne({ _id: req.params.id, jornada: crianca._id })
  if (!original) {
    res.status(404).json({ error: 'Não encontramos essa anotação.' })
    return
  }
  if (original.autorId !== req.user!.id) {
    res.status(403).json({ error: 'Você só pode retificar as suas próprias anotações.' })
    return
  }
  if (original.retificadaPor) {
    res.status(409).json({ error: 'Essa anotação já foi retificada.' })
    return
  }

  await retificar(crianca._id, original._id, {
    tipo: original.tipo as 'evolucao',
    autorId: req.user!.id,
    autorNome: req.user!.nome,
    autorPapel: req.user!.papel,
    texto: parsed.data.texto,
    visibilidade: original.visibilidade as 'familia' | 'equipe',
  })

  res.status(201).json({
    evolucoes: await linhaDoTempo(crianca._id, req.user!.papel === 'medico'),
  })
})

/**
 * GET /api/prontuario/integridade — recalcula a cadeia inteira.
 *
 * É o que transforma "prometemos que não adulteramos" em "dá para conferir".
 * Aberto a quem já tem acesso à jornada: o dono do prontuário tem tanto direito
 * de auditar quanto nós.
 */
prontuarioRouter.get('/integridade', requireAuth, async (req, res) => {
  const crianca = await resolveCriancaOr403(req, res)
  if (!crianca) return
  res.json(await verificarCadeia(crianca._id))
})
