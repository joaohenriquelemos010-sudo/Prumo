import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  FlaskConical,
  HeartPulse,
  Baby,
  MapPin,
  Navigation,
  Video,
  Home as HomeIcon,
  Check,
  ArrowLeft,
  Send,
} from 'lucide-react'
import { api } from '@/lib/api/client'
import { googleMapsUrl, wazeUrl, obterLocalizacao } from '@/lib/mapa'
import { Button } from '@/components/Button'
import { EmptyState } from '@/components/EmptyState'
import { cn } from '@/lib/cn'

type Objetivo = 'exame' | 'consulta-gestante' | 'consulta-crianca'
type Etapa = 'objetivo' | 'buscando' | 'resultados'

interface Prestador {
  id: string
  nome: string
  tipo: 'medico' | 'enfermeiro' | 'clinica' | 'hospital'
  especialidade: string
  servicos: string[]
  atende: string[]
  aceitaDomiciliar: boolean
  cidade: string
  uf: string
  endereco: string
  lat: number
  lng: number
  bio: string
  distanciaKm: number | null
}

const OBJETIVOS: { value: Objetivo; titulo: string; sub: string; icon: typeof FlaskConical }[] = [
  { value: 'exame', titulo: 'Agendar um exame', sub: 'Clínicas e laboratórios perto de você', icon: FlaskConical },
  { value: 'consulta-gestante', titulo: 'Consulta para você', sub: 'Gestante ou planejando — obstetra e enfermagem', icon: HeartPulse },
  { value: 'consulta-crianca', titulo: 'Consulta para seu bebê', sub: 'Pediatra e cuidados da criança', icon: Baby },
]

const OBJ_LABEL: Record<Objetivo, string> = {
  exame: 'exame',
  'consulta-gestante': 'consulta para você',
  'consulta-crianca': 'consulta para seu bebê',
}

export default function AppProfissionais() {
  const [params, setParams] = useSearchParams()
  const objetivoParam = params.get('objetivo') as Objetivo | null

  const [etapa, setEtapa] = useState<Etapa>(objetivoParam ? 'buscando' : 'objetivo')
  const [objetivo, setObjetivo] = useState<Objetivo | null>(objetivoParam)
  const [prestadores, setPrestadores] = useState<Prestador[]>([])
  const [temLocal, setTemLocal] = useState(false)

  async function buscar(obj: Objetivo) {
    setObjetivo(obj)
    setEtapa('buscando')
    const inicio = Date.now()
    const loc = await obterLocalizacao()
    setTemLocal(Boolean(loc))
    const query = new URLSearchParams({ objetivo: obj })
    if (loc) {
      query.set('lat', String(loc.lat))
      query.set('lng', String(loc.lng))
    }
    try {
      const { prestadores: lista } = await api.get<{ prestadores: Prestador[] }>(`/prestadores?${query}`)
      // Hold the animation a beat so the search feels intentional, not janky.
      const espera = Math.max(0, 1200 - (Date.now() - inicio))
      setTimeout(() => {
        setPrestadores(lista)
        setEtapa('resultados')
      }, espera)
    } catch {
      setPrestadores([])
      setEtapa('resultados')
    }
  }

  // Deep-linked (e.g. "contate um pediatra") → search immediately, once.
  useEffect(() => {
    if (objetivoParam) void buscar(objetivoParam)
    // run once for the incoming param
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function reset() {
    setEtapa('objetivo')
    setObjetivo(null)
    setPrestadores([])
    if (objetivoParam) setParams({}, { replace: true })
  }

  return (
    <div className="flex flex-col gap-lg">
      <header className="flex flex-col gap-1">
        <p className="u-eyebrow">Profissionais e clínicas</p>
        <h1 className="text-3xl sm:text-4xl">Encontre e agende, pertinho de você</h1>
        <p className="text-ink-soft">A Prumo faz a ponte com médicos, enfermeiras, clínicas e hospitais cadastrados.</p>
      </header>

      <AnimatePresence mode="wait">
        {etapa === 'objetivo' && (
          <motion.div key="obj" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
            <p className="mb-3 font-display font-semibold text-ink">O que você precisa hoje?</p>
            <div className="grid gap-3 sm:grid-cols-3">
              {OBJETIVOS.map((o) => {
                const Icon = o.icon
                return (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => buscar(o.value)}
                    className="flex flex-col items-start gap-3 rounded-2xl border-2 border-transparent bg-paper p-lg text-left shadow-soft transition-[transform,border-color,box-shadow] duration-[var(--dur-fast)] hover:-translate-y-0.5 hover:border-[var(--color-lilas-soft)] hover:shadow-lift"
                  >
                    <span className="grid size-12 place-items-center rounded-xl [background-image:var(--grad-brand-soft)] text-indigo">
                      <Icon className="size-6" aria-hidden />
                    </span>
                    <span className="font-display text-lg font-semibold text-ink">{o.titulo}</span>
                    <span className="text-sm text-ink-soft">{o.sub}</span>
                  </button>
                )
              })}
            </div>
          </motion.div>
        )}

        {etapa === 'buscando' && (
          <motion.div key="busca" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <RadarBuscando objetivo={objetivo} />
          </motion.div>
        )}

        {etapa === 'resultados' && objetivo && (
          <motion.div key="res" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-md">
            <div className="flex items-center gap-2">
              <button type="button" onClick={reset} className="inline-flex items-center gap-1 rounded-pill px-3 py-1.5 text-sm font-semibold text-indigo hover:bg-paper-2">
                <ArrowLeft className="size-4" aria-hidden /> Trocar
              </button>
              <p className="text-sm text-ink-soft">
                {prestadores.length} resultado(s) para <strong>{OBJ_LABEL[objetivo]}</strong>
                {temLocal ? ' · ordenado por distância' : ''}
              </p>
            </div>

            {prestadores.length === 0 ? (
              <EmptyState
                titulo="Nada por aqui ainda"
                descricao="Não encontramos profissionais para essa busca agora. Tente outra opção."
                icon={<MapPin className="size-7" aria-hidden />}
              />
            ) : (
              <ul className="flex flex-col gap-3">
                {prestadores.map((p) => (
                  <PrestadorCard key={p.id} prestador={p} objetivo={objetivo} />
                ))}
              </ul>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function RadarBuscando({ objetivo }: { objetivo: Objetivo | null }) {
  return (
    <div className="grid place-items-center rounded-2xl border border-line bg-paper py-2xl text-center shadow-soft">
      <div className="relative grid size-40 place-items-center">
        {[0, 0.6, 1.2].map((delay) => (
          <span
            key={delay}
            className="absolute size-40 rounded-full border-2 border-[var(--color-lilas)] motion-reduce:hidden"
            style={{ animation: `radar-ping 1.8s ${delay}s var(--ease-out) infinite` }}
          />
        ))}
        <span className="grid size-16 place-items-center rounded-full [background-image:var(--grad-brand)] text-white shadow-lift">
          <MapPin className="size-8" aria-hidden />
        </span>
        {[
          { top: '6%', left: '18%', d: '0.1s' },
          { top: '20%', left: '78%', d: '0.4s' },
          { top: '74%', left: '30%', d: '0.7s' },
        ].map((pin) => (
          <span
            key={pin.d}
            className="absolute text-[var(--color-azul)] motion-reduce:opacity-100"
            style={{ top: pin.top, left: pin.left, animation: `pin-pop 0.5s ${pin.d} var(--ease-out) both` }}
          >
            <MapPin className="size-5 fill-[var(--color-azul)]" aria-hidden />
          </span>
        ))}
      </div>
      <p className="mt-md font-display text-lg font-semibold text-indigo" aria-live="polite">
        Buscando perto de você…
      </p>
      <p className="text-sm text-ink-mute">
        {objetivo === 'exame' ? 'Clínicas e laboratórios' : 'Profissionais'} na sua região
      </p>
    </div>
  )
}

function PrestadorCard({ prestador, objetivo }: { prestador: Prestador; objetivo: Objetivo }) {
  const [abrir, setAbrir] = useState(false)
  const [modalidade, setModalidade] = useState<'presencial' | 'teleconsulta' | 'domiciliar'>(
    prestador.aceitaDomiciliar ? 'domiciliar' : prestador.atende.includes('presencial') ? 'presencial' : 'teleconsulta',
  )
  const [enviado, setEnviado] = useState(false)
  const [enviando, setEnviando] = useState(false)

  const modalidades = useMemo(() => {
    const list: { value: 'presencial' | 'teleconsulta' | 'domiciliar'; label: string; icon: typeof MapPin }[] = []
    if (prestador.atende.includes('presencial')) list.push({ value: 'presencial', label: 'Presencial', icon: MapPin })
    if (prestador.atende.includes('teleconsulta')) list.push({ value: 'teleconsulta', label: 'Teleconsulta', icon: Video })
    if (prestador.aceitaDomiciliar) list.push({ value: 'domiciliar', label: 'Em casa', icon: HomeIcon })
    return list
  }, [prestador])

  const temEndereco = prestador.lat !== 0 && prestador.lng !== 0

  async function solicitar() {
    setEnviando(true)
    try {
      await api.post('/solicitacoes', { prestadorId: prestador.id, objetivo, modalidade })
      setEnviado(true)
      setAbrir(false)
    } catch {
      /* keep the form open */
    } finally {
      setEnviando(false)
    }
  }

  return (
    <li className="rounded-2xl border border-line bg-paper p-md shadow-soft">
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl [background-image:var(--grad-brand-soft)] text-indigo">
          {prestador.tipo === 'clinica' || prestador.tipo === 'hospital' ? (
            <FlaskConical className="size-5" aria-hidden />
          ) : (
            <HeartPulse className="size-5" aria-hidden />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display font-semibold text-ink">{prestador.nome}</p>
          <p className="text-xs text-ink-mute">
            {prestador.especialidade}
            {prestador.distanciaKm != null ? ` · ${prestador.distanciaKm} km` : ''}
          </p>
          {prestador.bio && <p className="mt-1 text-sm text-ink-soft">{prestador.bio}</p>}

          <div className="mt-2 flex flex-wrap gap-1.5">
            {modalidades.map((m) => {
              const Icon = m.icon
              return (
                <span key={m.value} className="inline-flex items-center gap-1 rounded-pill bg-paper-2 px-2.5 py-1 text-xs font-semibold text-indigo">
                  <Icon className="size-3" aria-hidden />
                  {m.label}
                </span>
              )
            })}
          </div>

          {temEndereco && (
            <p className="mt-2 text-xs text-ink-mute">{prestador.endereco} · {prestador.cidade}/{prestador.uf}</p>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            {temEndereco && (
              <>
                <a href={googleMapsUrl(prestador.lat, prestador.lng, prestador.nome)} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-pill border border-line px-3 text-sm font-semibold text-indigo hover:bg-paper-2">
                  <Navigation className="size-3.5" aria-hidden /> Google Maps
                </a>
                <a href={wazeUrl(prestador.lat, prestador.lng)} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-pill border border-line px-3 text-sm font-semibold text-indigo hover:bg-paper-2">
                  <Navigation className="size-3.5" aria-hidden /> Waze
                </a>
              </>
            )}
            {enviado ? (
              <span className="inline-flex h-9 items-center gap-1.5 rounded-pill px-3 text-sm font-semibold text-success">
                <Check className="size-4" aria-hidden /> Solicitação enviada
              </span>
            ) : (
              <button type="button" onClick={() => setAbrir((v) => !v)} className="inline-flex h-9 items-center gap-1.5 rounded-pill px-4 text-sm font-semibold text-white [background-image:var(--grad-brand)]">
                Solicitar / agendar
              </button>
            )}
          </div>

          {abrir && !enviado && (
            <div className="mt-3 rounded-xl bg-paper-2 p-3">
              <p className="mb-2 text-sm font-semibold text-ink">Como você prefere?</p>
              <div className="flex flex-wrap gap-2">
                {modalidades.map((m) => (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => setModalidade(m.value)}
                    aria-pressed={modalidade === m.value}
                    className={cn(
                      'rounded-pill border px-3 py-1.5 text-sm font-semibold',
                      modalidade === m.value ? 'border-transparent [background-image:var(--grad-brand)] text-white' : 'border-line bg-paper text-ink-soft',
                    )}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
              <div className="mt-3">
                <Button size="md" loading={enviando} iconLeft={<Send className="size-4" aria-hidden />} onClick={solicitar}>
                  Confirmar solicitação
                </Button>
              </div>
              <p className="mt-2 text-xs text-ink-mute">A Prumo registra seu pedido e faz a ponte. A confirmação vem em seguida.</p>
            </div>
          )}
        </div>
      </div>
    </li>
  )
}
