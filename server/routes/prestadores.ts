import { Router } from 'express'
import { requireAuth } from '../auth.js'
import { Prestador } from '../models/Prestador.js'
import type { PrestadorDoc } from '../models/Prestador.js'
import type { HydratedDocument } from 'mongoose'
import { ensurePrestadoresSeed } from '../seed/prestadores.js'
import { distanciaKm } from '../geo.js'
import { Disponibilidade } from '../models/Disponibilidade.js'
import { User } from '../models/User.js'

export const prestadoresRouter = Router()

/**
 * Which specialties serve which need. The product has a single `medico` role
 * differentiated by a free-text `especialidade`, so matching is by keyword.
 */
const ESPECIALIDADES_POR_OBJETIVO: Record<string, RegExp> = {
  'consulta-gestante': /obstetr|ginec|obstetra|enfermagem obst/i,
  'consulta-crianca': /pediatr|neonat|puericult/i,
  'pre-concepcional': /obstetr|ginec|reprodu/i,
}

/**
 * GET /api/prestadores/medicos?objetivo=&convenio=
 *
 * Registered doctors who have opened an online agenda. This is what makes the
 * hybrid booking model work: these can be booked into a real slot, while the
 * seeded listings below only take a proposed time.
 *
 * Returns strictly what a patient needs to choose — never CPF or e-mail.
 */
prestadoresRouter.get('/medicos', requireAuth, async (req, res) => {
  const objetivo = String(req.query.objetivo ?? '')
  const convenio = String(req.query.convenio ?? '')

  const disponibilidades = await Disponibilidade.find({ ativo: true }).limit(200)
  if (disponibilidades.length === 0) {
    res.json({ medicos: [] })
    return
  }

  const porMedico = new Map(disponibilidades.map((d) => [d.medicoId, d]))
  const medicos = await User.find({
    _id: { $in: [...porMedico.keys()] },
    papel: 'medico',
  }).limit(200)

  const filtroEspecialidade = ESPECIALIDADES_POR_OBJETIVO[objetivo]

  const lista = medicos
    .filter((m) => !filtroEspecialidade || filtroEspecialidade.test(m.especialidade ?? ''))
    .map((m) => {
      const disp = porMedico.get(String(m._id))!
      return {
        id: String(m._id),
        nome: m.nome,
        especialidade: m.especialidade,
        crm: m.crm,
        crmUf: m.crmUf,
        verificacaoStatus: m.verificacaoStatus,
        agendaOnline: true,
        duracaoMin: disp.duracaoPadraoMin,
        modalidades: [...new Set(disp.regras.flatMap((r) => r.modalidades))],
        convenios: disp.conveniosAtendidos,
        atendeParticular: disp.atendeParticular,
        atendeSus: disp.atendeSus,
      }
    })
    .filter((m) => !convenio || atendeConvenio(m, convenio))

  res.json({ medicos: lista })
})

/** A listing serves a plan when it names it, or when it takes private/SUS. */
function atendeConvenio(
  alvo: { convenios: string[]; atendeParticular?: boolean; atendeSus?: boolean },
  convenio: string,
): boolean {
  const buscado = convenio.trim().toLowerCase()
  if (!buscado) return true
  if (buscado === 'particular') return alvo.atendeParticular !== false
  if (buscado === 'sus') return alvo.atendeSus === true
  return alvo.convenios.some((c) => {
    const nome = c.toLowerCase()
    return nome === buscado || nome === 'vários' || nome === 'varios'
  })
}

type Serialized = ReturnType<typeof serialize>

function serialize(p: HydratedDocument<PrestadorDoc>, distancia: number | null) {
  return {
    id: String(p._id),
    nome: p.nome,
    tipo: p.tipo,
    especialidade: p.especialidade,
    servicos: p.servicos,
    atende: p.atende,
    aceitaDomiciliar: p.aceitaDomiciliar,
    cidade: p.cidade,
    uf: p.uf,
    endereco: p.endereco,
    lat: p.lat,
    lng: p.lng,
    bio: p.bio,
    convenios: p.convenios,
    atendeParticular: p.atendeParticular,
    atendeSus: p.atendeSus,
    distanciaKm: distancia,
  }
}

/**
 * GET /api/prestadores?objetivo=&modalidade=&domiciliar=&lat=&lng=
 * Filters the marketplace by what the family wants (exam vs consultation for the
 * mother vs the child) and by modality, and — when the browser shares a location —
 * sorts the results by distance so the nearest options come first.
 */
prestadoresRouter.get('/', requireAuth, async (req, res) => {
  await ensurePrestadoresSeed()

  const objetivo = String(req.query.objetivo ?? '')
  const modalidade = String(req.query.modalidade ?? '')
  const convenio = String(req.query.convenio ?? '')
  const domiciliar = String(req.query.domiciliar ?? '') === 'true'
  const lat = Number(req.query.lat)
  const lng = Number(req.query.lng)
  const temLocal = Number.isFinite(lat) && Number.isFinite(lng)

  const filtro: Record<string, unknown> = {}
  if (objetivo) filtro.servicos = objetivo
  if (modalidade === 'domiciliar') filtro.aceitaDomiciliar = true
  else if (modalidade) filtro.atende = modalidade
  if (domiciliar) filtro.aceitaDomiciliar = true

  const prestadores = await Prestador.find(filtro).limit(60)

  let lista: Serialized[] = prestadores
    .map((p) => serialize(p, temLocal ? distanciaKm(lat, lng, p.lat, p.lng) : null))
    .filter((p) => !convenio || atendeConvenio(p, convenio))

  if (temLocal) {
    lista = lista.sort((a, b) => (a.distanciaKm ?? 1e9) - (b.distanciaKm ?? 1e9))
  }

  res.json({ prestadores: lista })
})
