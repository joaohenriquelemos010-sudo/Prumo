import { Router } from 'express'
import { requireAuth } from '../auth'
import { Prestador } from '../models/Prestador'
import type { PrestadorDoc } from '../models/Prestador'
import type { HydratedDocument } from 'mongoose'
import { ensurePrestadoresSeed } from '../seed/prestadores'
import { distanciaKm } from '../geo'

export const prestadoresRouter = Router()

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

  let lista: Serialized[] = prestadores.map((p) =>
    serialize(p, temLocal ? distanciaKm(lat, lng, p.lat, p.lng) : null),
  )

  if (temLocal) {
    lista = lista.sort((a, b) => (a.distanciaKm ?? 1e9) - (b.distanciaKm ?? 1e9))
  }

  res.json({ prestadores: lista })
})
