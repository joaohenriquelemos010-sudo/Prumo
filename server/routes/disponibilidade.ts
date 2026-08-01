import { Router } from 'express'
import { requireAuth, requireRole } from '../auth.js'
import { Disponibilidade } from '../models/Disponibilidade.js'
import type { DisponibilidadeDoc } from '../models/Disponibilidade.js'
import { Agendamento, STATUS_OCUPAM_SLOT } from '../models/Agendamento.js'
import { User } from '../models/User.js'
import { disponibilidadeUpdateSchema } from '../validation.js'
import { normalizeField } from '../sanitize.js'
import { expandirSlots } from '../services/slots.js'
import type { ConfigDisponibilidade } from '../services/slots.js'
import { chaveDia, partesDaData, somarDias } from '../services/fuso.js'
import type { HydratedDocument } from 'mongoose'

export const disponibilidadeRouter = Router()

type FaixaSemanalDoc = { _id?: unknown; diaSemana: number; inicio: string; fim: string; motivo?: string }

function serializarFaixas(faixas: FaixaSemanalDoc[] | undefined) {
  return (faixas ?? []).map((f) => ({
    id: String(f._id ?? ''),
    diaSemana: f.diaSemana,
    inicio: f.inicio,
    fim: f.fim,
    motivo: f.motivo ?? '',
  }))
}

function serialize(d: HydratedDocument<DisponibilidadeDoc>) {
  return {
    ativo: d.ativo,
    duracaoPadraoMin: d.duracaoPadraoMin,
    almoco: { inicio: d.almoco?.inicio ?? '', fim: d.almoco?.fim ?? '' },
    antecedenciaMinHoras: d.antecedenciaMinHoras,
    janelaMaxDias: d.janelaMaxDias,
    fuso: d.fuso,
    regras: d.regras.map((r) => ({
      id: String(r._id),
      diaSemana: r.diaSemana,
      inicio: r.inicio,
      fim: r.fim,
      modalidades: r.modalidades,
      local: r.local,
    })),
    bloqueios: d.bloqueios.map((b) => ({
      id: String(b._id),
      de: new Date(b.de).toISOString(),
      ate: new Date(b.ate).toISOString(),
      motivo: b.motivo,
    })),
    intervalos: serializarFaixas(d.intervalos),
    bloqueiosSemanais: serializarFaixas(d.bloqueiosSemanais),
    reposicoes: serializarFaixas(d.reposicoes),
    conveniosAtendidos: d.conveniosAtendidos,
    atendeParticular: d.atendeParticular,
    atendeSus: d.atendeSus,
  }
}

function paraFaixasDoc(faixas: { diaSemana: number; inicio: string; fim: string; motivo?: string }[]) {
  return faixas.map((f) => ({
    diaSemana: f.diaSemana,
    inicio: f.inicio,
    fim: f.fim,
    motivo: normalizeField(f.motivo ?? '', 160),
  }))
}

/** The doctor's config, created empty on first read so the editor has something. */
export async function getOrCreateDisponibilidade(
  medicoId: string,
): Promise<HydratedDocument<DisponibilidadeDoc>> {
  const existente = await Disponibilidade.findOne({ medicoId })
  if (existente) return existente
  return Disponibilidade.create({ medicoId })
}

/** Shape the pure slot expander expects. */
export function paraConfig(d: DisponibilidadeDoc): ConfigDisponibilidade {
  return {
    ativo: d.ativo,
    duracaoPadraoMin: d.duracaoPadraoMin,
    almoco: { inicio: d.almoco?.inicio ?? '', fim: d.almoco?.fim ?? '' },
    antecedenciaMinHoras: d.antecedenciaMinHoras,
    janelaMaxDias: d.janelaMaxDias,
    fuso: d.fuso,
    regras: d.regras.map((r) => ({
      diaSemana: r.diaSemana,
      inicio: r.inicio,
      fim: r.fim,
      modalidades: r.modalidades,
      local: r.local,
    })),
    bloqueios: d.bloqueios.map((b) => ({ de: new Date(b.de), ate: new Date(b.ate) })),
    intervalos: paraFaixas(d.intervalos),
    bloqueiosSemanais: paraFaixas(d.bloqueiosSemanais),
    reposicoes: paraFaixas(d.reposicoes),
  }
}

function paraFaixas(faixas: FaixaSemanalDoc[] | undefined) {
  return (faixas ?? []).map((f) => ({ diaSemana: f.diaSemana, inicio: f.inicio, fim: f.fim }))
}

/** Appointments that currently hold time on this doctor's calendar. */
export async function ocupadosDoMedico(medicoId: string, de: Date, ate: Date) {
  const agendamentos = await Agendamento.find({
    medicoId,
    status: { $in: STATUS_OCUPAM_SLOT },
    inicio: { $gte: de, $lte: ate },
  })
  return agendamentos.map((a) => ({ inicio: new Date(a.inicio), duracaoMin: a.duracaoMin }))
}

// GET /api/disponibilidade/me — the doctor's own agenda settings.
disponibilidadeRouter.get('/me', requireAuth, requireRole('medico'), async (req, res) => {
  const disp = await getOrCreateDisponibilidade(req.user!.id)
  res.json({ disponibilidade: serialize(disp) })
})

// PUT /api/disponibilidade/me — replace the parts the doctor sent.
disponibilidadeRouter.put('/me', requireAuth, requireRole('medico'), async (req, res) => {
  const parsed = disponibilidadeUpdateSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Confere os horários.' })
    return
  }
  const d = parsed.data
  const disp = await getOrCreateDisponibilidade(req.user!.id)

  if (d.ativo !== undefined) disp.ativo = d.ativo
  if (d.duracaoPadraoMin !== undefined) disp.duracaoPadraoMin = d.duracaoPadraoMin
  if (d.almoco !== undefined) disp.almoco = { inicio: d.almoco.inicio, fim: d.almoco.fim }
  if (d.antecedenciaMinHoras !== undefined) disp.antecedenciaMinHoras = d.antecedenciaMinHoras
  if (d.janelaMaxDias !== undefined) disp.janelaMaxDias = d.janelaMaxDias
  if (d.regras) {
    disp.regras = d.regras.map((r) => ({
      diaSemana: r.diaSemana,
      inicio: r.inicio,
      fim: r.fim,
      modalidades: r.modalidades,
      local: normalizeField(r.local ?? '', 160),
    })) as typeof disp.regras
  }
  if (d.bloqueios) {
    disp.bloqueios = d.bloqueios.map((b) => ({
      de: new Date(b.de),
      ate: new Date(b.ate),
      motivo: normalizeField(b.motivo ?? '', 160),
    })) as typeof disp.bloqueios
  }
  /*
   * As três listas semanais são substituídas em bloco, e não mescladas: a grade
   * manda o estado inteiro da semana a cada salvamento, então mesclar faria um
   * intervalo apagado voltar sozinho no próximo save.
   */
  if (d.intervalos) disp.intervalos = paraFaixasDoc(d.intervalos) as typeof disp.intervalos
  if (d.bloqueiosSemanais) {
    disp.bloqueiosSemanais = paraFaixasDoc(d.bloqueiosSemanais) as typeof disp.bloqueiosSemanais
  }
  if (d.reposicoes) disp.reposicoes = paraFaixasDoc(d.reposicoes) as typeof disp.reposicoes
  if (d.conveniosAtendidos) {
    disp.conveniosAtendidos = d.conveniosAtendidos.map((c) => normalizeField(c, 80)).filter(Boolean)
  }
  if (d.atendeParticular !== undefined) disp.atendeParticular = d.atendeParticular
  if (d.atendeSus !== undefined) disp.atendeSus = d.atendeSus

  await disp.save()
  res.json({ disponibilidade: serialize(disp) })
})

/**
 * GET /api/disponibilidade/:medicoId/slots?de=YYYY-MM-DD&ate=YYYY-MM-DD
 *
 * The free times a family may pick from. Open to any signed-in user — this is
 * the booking surface — and it exposes nothing beyond when the doctor is free.
 */
disponibilidadeRouter.get('/:medicoId/slots', requireAuth, async (req, res) => {
  const medicoId = String(req.params.medicoId)
  const medico = await User.findById(medicoId).catch(() => null)
  if (!medico || medico.papel !== 'medico') {
    res.status(404).json({ error: 'Não encontramos esse profissional.' })
    return
  }

  const disp = await Disponibilidade.findOne({ medicoId })
  if (!disp || !disp.ativo) {
    res.json({ medico: { id: medicoId, nome: medico.nome }, dias: [], agendaOnline: false })
    return
  }

  const hoje = chaveDia(new Date(), disp.fuso)
  const de = partesDaData(String(req.query.de ?? '')) ? String(req.query.de) : hoje
  const atePedido = String(req.query.ate ?? '')
  const ate = partesDaData(atePedido) ? atePedido : somarDias(de, 30)

  // Widen the occupancy lookup by a day on each side so an appointment that
  // straddles midnight still blocks the slot it overlaps.
  const inicioBusca = new Date(`${somarDias(de, -1)}T00:00:00.000Z`)
  const fimBusca = new Date(`${somarDias(ate, 2)}T00:00:00.000Z`)
  const ocupados = await ocupadosDoMedico(medicoId, inicioBusca, fimBusca)

  const dias = expandirSlots(paraConfig(disp), de, ate, ocupados)

  res.json({
    medico: {
      id: medicoId,
      nome: medico.nome,
      especialidade: medico.especialidade,
      conveniosAtendidos: disp.conveniosAtendidos,
      atendeParticular: disp.atendeParticular,
      atendeSus: disp.atendeSus,
    },
    agendaOnline: true,
    duracaoMin: disp.duracaoPadraoMin,
    dias,
  })
})
