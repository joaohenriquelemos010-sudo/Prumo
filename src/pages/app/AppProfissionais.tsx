import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  FlaskConical,
  HeartPulse,
  Baby,
  MapPin,
  Navigation,
  Video,
  Home as HomeIcon,
  ArrowLeft,
  ArrowRight,
  CalendarCheck,
  Check,
  Sparkles,
  ShieldCheck,
  Stethoscope,
} from 'lucide-react'
import { api } from '@/lib/api/client'
import { googleMapsUrl, wazeUrl, obterLocalizacao } from '@/lib/mapa'
import { Button } from '@/components/Button'
import { EmptyState } from '@/components/EmptyState'
import { AlertaErro } from '@/components/AlertaErro'
import { Skeleton } from '@/components/Skeleton'
import { usePerfil } from '@/lib/stores/perfil'
import type { Convenio } from '@/lib/stores/perfil'
import { SeletorHorario } from '@/features/agenda/SeletorHorario'
import { Calendario } from '@/features/agenda/Calendario'
import { paraChaveDia, quandoPorExtenso, MODALIDADE_LABEL } from '@/features/agenda/agenda'
import type { DiaComSlots, ModalidadeAgendamento, ObjetivoAgendamento } from '@/features/agenda/agenda'
import { atendeConvenio, rotuloConvenio, convenioParaTexto } from '@/features/clinico/convenios'
import { cn } from '@/lib/cn'

type Etapa = 'objetivo' | 'buscando' | 'resultados' | 'agendando'

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
  convenios: string[]
  atendeSus?: boolean
  atendeParticular?: boolean
  distanciaKm: number | null
}

interface MedicoAgenda {
  id: string
  nome: string
  especialidade: string
  crm: string
  crmUf: string
  duracaoMin: number
  modalidades: string[]
  convenios: string[]
  atendeParticular: boolean
  atendeSus: boolean
}

/** One card shape for both kinds of professional. */
export interface Opcao {
  chave: string
  nome: string
  subtitulo: string
  agendaOnline: boolean
  modalidades: ModalidadeAgendamento[]
  convenios: string[]
  atendeSus: boolean
  atendeParticular: boolean
  medicoId?: string
  prestadorId?: string
  endereco?: string
  lat?: number
  lng?: number
  distanciaKm?: number | null
  bio?: string
}

const OBJETIVOS: { value: ObjetivoAgendamento; titulo: string; sub: string; icon: typeof FlaskConical }[] = [
  { value: 'consulta-gestante', titulo: 'Consulta para você', sub: 'Obstetra, ginecologista e enfermagem', icon: HeartPulse },
  { value: 'consulta-crianca', titulo: 'Consulta para seu bebê', sub: 'Pediatra e cuidados da criança', icon: Baby },
  { value: 'exame', titulo: 'Agendar um exame', sub: 'Clínicas e laboratórios perto de você', icon: FlaskConical },
  { value: 'pre-concepcional', titulo: 'Estou me preparando', sub: 'Consulta antes de engravidar', icon: Sparkles },
]

const OBJ_LABEL: Record<ObjetivoAgendamento, string> = {
  exame: 'exame',
  'consulta-gestante': 'consulta para você',
  'consulta-crianca': 'consulta para seu bebê',
  'pre-concepcional': 'consulta pré-concepcional',
}

const MODALIDADE_ICONE = { presencial: MapPin, teleconsulta: Video, domiciliar: HomeIcon } as const

export default function AppProfissionais() {
  const [params, setParams] = useSearchParams()
  const objetivoParam = params.get('objetivo') as ObjetivoAgendamento | null

  const [etapa, setEtapa] = useState<Etapa>(objetivoParam ? 'buscando' : 'objetivo')
  const [objetivo, setObjetivo] = useState<ObjetivoAgendamento | null>(objetivoParam)
  const [opcoes, setOpcoes] = useState<Opcao[]>([])
  const [temLocal, setTemLocal] = useState(false)
  const [escolhida, setEscolhida] = useState<Opcao | null>(null)
  const [soMeuPlano, setSoMeuPlano] = useState(false)

  const perfil = usePerfil((s) => s.perfil)
  const loadPerfil = usePerfil((s) => s.load)
  const perfilLoaded = usePerfil((s) => s.loaded)
  useEffect(() => {
    if (!perfilLoaded) void loadPerfil()
  }, [perfilLoaded, loadPerfil])

  const meuConvenio = perfil?.convenio ?? null

  async function buscar(obj: ObjetivoAgendamento) {
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

    const [prestadores, medicos] = await Promise.all([
      api
        .get<{ prestadores: Prestador[] }>(`/prestadores?${query}`)
        .then((d) => d.prestadores)
        .catch(() => [] as Prestador[]),
      api
        .get<{ medicos: MedicoAgenda[] }>(`/prestadores/medicos?objetivo=${obj}`)
        .then((d) => d.medicos)
        .catch(() => [] as MedicoAgenda[]),
    ])

    // Doctors with a live agenda come first: they can be booked into a real slot,
    // which is a materially better outcome than proposing a time and waiting.
    const lista: Opcao[] = [
      ...medicos.map(
        (m): Opcao => ({
          chave: `medico:${m.id}`,
          nome: m.nome,
          subtitulo: [m.especialidade, m.crm && `CRM ${m.crm}${m.crmUf ? `/${m.crmUf}` : ''}`]
            .filter(Boolean)
            .join(' · '),
          agendaOnline: true,
          modalidades: (m.modalidades.length ? m.modalidades : ['presencial']) as ModalidadeAgendamento[],
          convenios: m.convenios,
          atendeSus: m.atendeSus,
          atendeParticular: m.atendeParticular,
          medicoId: m.id,
        }),
      ),
      ...prestadores.map(
        (p): Opcao => ({
          chave: `prestador:${p.id}`,
          nome: p.nome,
          subtitulo: p.especialidade,
          agendaOnline: false,
          modalidades: [
            ...(p.atende.includes('presencial') ? ['presencial' as const] : []),
            ...(p.atende.includes('teleconsulta') ? ['teleconsulta' as const] : []),
            ...(p.aceitaDomiciliar ? ['domiciliar' as const] : []),
          ],
          convenios: p.convenios ?? [],
          atendeSus: p.atendeSus ?? false,
          atendeParticular: p.atendeParticular ?? true,
          prestadorId: p.id,
          endereco: `${p.endereco} · ${p.cidade}/${p.uf}`,
          lat: p.lat,
          lng: p.lng,
          distanciaKm: p.distanciaKm,
          bio: p.bio,
        }),
      ),
    ]

    // Hold the animation a beat so the search reads as intentional, not janky.
    const espera = Math.max(0, 700 - (Date.now() - inicio))
    setTimeout(() => {
      setOpcoes(lista)
      setEtapa('resultados')
    }, espera)
  }

  useEffect(() => {
    if (objetivoParam) void buscar(objetivoParam)
    // run once for the incoming deep link
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const visiveis = useMemo(() => {
    if (!soMeuPlano || !meuConvenio) return opcoes
    return opcoes.filter((o) => atendeConvenio(o, meuConvenio))
  }, [opcoes, soMeuPlano, meuConvenio])

  function reset() {
    setEtapa('objetivo')
    setObjetivo(null)
    setOpcoes([])
    setEscolhida(null)
    if (objetivoParam) setParams({}, { replace: true })
  }

  return (
    <div className="flex flex-col gap-lg">
      <header className="flex flex-col gap-1">
        <p className="u-eyebrow">Profissionais e clínicas</p>
        <h1 className="text-3xl sm:text-4xl">Encontre e marque, pertinho de você</h1>
        <p className="text-ink-soft">
          Escolha o profissional, o dia e a hora. A Prumo faz a ponte e você acompanha tudo na Agenda.
        </p>
      </header>

      <AnimatePresence mode="wait">
        {etapa === 'objetivo' && (
          <motion.div key="obj" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
            <p className="mb-3 font-display font-semibold text-ink">O que você precisa hoje?</p>
            <div className="grid gap-3 sm:grid-cols-2">
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
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={reset}
                className="inline-flex min-h-9 items-center gap-1 rounded-pill px-3 text-sm font-semibold text-indigo hover:bg-paper-2"
              >
                <ArrowLeft className="size-4" aria-hidden /> Trocar
              </button>
              <p className="text-sm text-ink-soft">
                {visiveis.length} resultado(s) para <strong>{OBJ_LABEL[objetivo]}</strong>
                {temLocal ? ' · ordenado por distância' : ''}
              </p>
            </div>

            {meuConvenio && (
              <label className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-pill bg-paper-2 px-3 py-2 text-sm font-semibold text-ink-soft">
                <input
                  type="checkbox"
                  checked={soMeuPlano}
                  onChange={(e) => setSoMeuPlano(e.target.checked)}
                  className="size-4 accent-[var(--color-lilas)]"
                />
                Só quem atende {rotuloConvenio(meuConvenio)}
              </label>
            )}

            {visiveis.length === 0 ? (
              <EmptyState
                titulo="Nada por aqui ainda"
                descricao={
                  soMeuPlano
                    ? 'Ninguém dessa busca atende seu plano. Desmarque o filtro para ver todas as opções.'
                    : 'Não encontramos profissionais para essa busca agora. Tente outra opção.'
                }
                icon={<MapPin className="size-7" aria-hidden />}
              />
            ) : (
              <ul className="flex flex-col gap-3">
                {visiveis.map((o) => (
                  <CardOpcao
                    key={o.chave}
                    opcao={o}
                    meuConvenio={meuConvenio}
                    onAgendar={() => {
                      setEscolhida(o)
                      setEtapa('agendando')
                    }}
                  />
                ))}
              </ul>
            )}
          </motion.div>
        )}

        {etapa === 'agendando' && objetivo && escolhida && (
          <motion.div key="agenda" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <AssistenteAgendamento
              opcao={escolhida}
              objetivo={objetivo}
              convenioPadrao={meuConvenio}
              onVoltar={() => {
                setEscolhida(null)
                setEtapa('resultados')
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ------------------------------ result card ----------------------------- */

function CardOpcao({
  opcao,
  meuConvenio,
  onAgendar,
}: {
  opcao: Opcao
  meuConvenio: Convenio | null
  onAgendar: () => void
}) {
  const temEndereco = Boolean(opcao.lat && opcao.lng)
  const cobre = meuConvenio ? atendeConvenio(opcao, meuConvenio) : null

  return (
    <li className="rounded-2xl border border-line bg-paper p-md shadow-soft">
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl [background-image:var(--grad-brand-soft)] text-indigo">
          {opcao.agendaOnline ? (
            <Stethoscope className="size-5" aria-hidden />
          ) : (
            <FlaskConical className="size-5" aria-hidden />
          )}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-display font-semibold text-ink">{opcao.nome}</p>
            {opcao.agendaOnline && (
              <span className="u-chip-success inline-flex items-center gap-1 rounded-pill px-2.5 py-0.5 text-xs font-semibold">
                <CalendarCheck className="size-3" aria-hidden />
                Agenda online
              </span>
            )}
          </div>
          <p className="text-xs text-ink-mute">
            {opcao.subtitulo}
            {opcao.distanciaKm != null ? ` · ${opcao.distanciaKm} km` : ''}
          </p>
          {opcao.bio && <p className="mt-1 text-sm text-ink-soft">{opcao.bio}</p>}

          <div className="mt-2 flex flex-wrap gap-1.5">
            {opcao.modalidades.map((m) => {
              const Icon = MODALIDADE_ICONE[m]
              return (
                <span
                  key={m}
                  className="inline-flex items-center gap-1 rounded-pill bg-paper-2 px-2.5 py-1 text-xs font-semibold text-indigo"
                >
                  <Icon className="size-3" aria-hidden />
                  {MODALIDADE_LABEL[m]}
                </span>
              )
            })}
            {cobre === true && (
              <span className="u-chip-success inline-flex items-center gap-1 rounded-pill px-2.5 py-1 text-xs font-semibold">
                <ShieldCheck className="size-3" aria-hidden />
                Atende seu plano
              </span>
            )}
          </div>

          {temEndereco && <p className="mt-2 text-xs text-ink-mute">{opcao.endereco}</p>}

          <div className="mt-3 flex flex-wrap gap-2">
            {temEndereco && (
              <>
                <a
                  href={googleMapsUrl(opcao.lat!, opcao.lng!, opcao.nome)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-pill border border-line px-3 text-sm font-semibold text-indigo hover:bg-paper-2"
                >
                  <Navigation className="size-3.5" aria-hidden /> Google Maps
                </a>
                <a
                  href={wazeUrl(opcao.lat!, opcao.lng!)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-pill border border-line px-3 text-sm font-semibold text-indigo hover:bg-paper-2"
                >
                  <Navigation className="size-3.5" aria-hidden /> Waze
                </a>
              </>
            )}
            <button
              type="button"
              onClick={onAgendar}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-pill px-4 text-sm font-semibold text-white shadow-soft [background-image:var(--grad-brand)]"
            >
              {opcao.agendaOnline ? 'Escolher horário' : 'Propor horário'}
              <ArrowRight className="size-4" aria-hidden />
            </button>
          </div>
        </div>
      </div>
    </li>
  )
}

/* --------------------------- booking assistant --------------------------- */

const PASSOS = ['Quando', 'Como', 'Confirmar'] as const

/** Times the family may propose to a listing with no online agenda. */
const HORARIOS_PROPOSTA = Array.from({ length: 24 }, (_, i) => {
  const minutos = 7 * 60 + i * 30
  return `${String(Math.floor(minutos / 60)).padStart(2, '0')}:${String(minutos % 60).padStart(2, '0')}`
})

function AssistenteAgendamento({
  opcao,
  objetivo,
  convenioPadrao,
  onVoltar,
}: {
  opcao: Opcao
  objetivo: ObjetivoAgendamento
  convenioPadrao: Convenio | null
  onVoltar: () => void
}) {
  const navigate = useNavigate()
  const [passo, setPasso] = useState(0)

  const [dias, setDias] = useState<DiaComSlots[]>([])
  const [carregandoSlots, setCarregandoSlots] = useState(opcao.agendaOnline)
  const [dia, setDia] = useState<string | null>(null)
  const [slot, setSlot] = useState<string | null>(null)
  const [hora, setHora] = useState<string | null>(null)

  const [modalidade, setModalidade] = useState<ModalidadeAgendamento>(opcao.modalidades[0] ?? 'presencial')
  const [convenio, setConvenio] = useState(convenioPadrao ? convenioParaTexto(convenioPadrao) : '')
  const [mensagem, setMensagem] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    if (!opcao.agendaOnline || !opcao.medicoId) return
    let ativo = true
    const de = paraChaveDia(new Date())
    const ate = paraChaveDia(new Date(Date.now() + 60 * 86_400_000))
    api
      .get<{ dias: DiaComSlots[] }>(`/disponibilidade/${opcao.medicoId}/slots?de=${de}&ate=${ate}`)
      .then((d) => {
        if (!ativo) return
        setDias(d.dias)
        setDia(d.dias[0]?.dia ?? null)
      })
      .catch(() => ativo && setDias([]))
      .finally(() => ativo && setCarregandoSlots(false))
    return () => {
      ativo = false
    }
  }, [opcao.agendaOnline, opcao.medicoId])

  /** The chosen instant, whichever path produced it. */
  const inicioEscolhido = useMemo(() => {
    if (opcao.agendaOnline) return slot
    if (!dia || !hora) return null
    const [h, m] = hora.split(':').map(Number)
    const d = new Date(`${dia}T00:00:00`)
    d.setHours(h, m, 0, 0)
    return d.toISOString()
  }, [opcao.agendaOnline, slot, dia, hora])

  async function confirmar() {
    if (!inicioEscolhido) return
    setErro(null)
    setEnviando(true)
    try {
      await api.post('/agendamentos', {
        ...(opcao.medicoId ? { medicoId: opcao.medicoId } : { prestadorId: opcao.prestadorId }),
        objetivo,
        modalidade,
        inicio: inicioEscolhido,
        convenio: convenio || undefined,
        mensagem: mensagem || undefined,
      })
      // Land where the result lives, instead of leaving a "sent!" badge behind
      // that vanishes on the next reload.
      navigate('/app/agenda?novo=1')
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui marcar agora.')
      setPasso(0)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="rounded-2xl border border-line bg-paper p-lg shadow-soft">
      <button
        type="button"
        onClick={onVoltar}
        className="inline-flex min-h-9 items-center gap-1 rounded-pill px-2 text-sm font-semibold text-indigo hover:bg-paper-2"
      >
        <ArrowLeft className="size-4" aria-hidden /> Voltar aos resultados
      </button>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="font-display text-lg font-semibold text-ink">{opcao.nome}</p>
          <p className="text-sm text-ink-mute">{opcao.subtitulo}</p>
        </div>
        <span className="text-sm font-semibold text-ink-mute">
          {PASSOS[passo]} · {passo + 1} de {PASSOS.length}
        </span>
      </div>

      <div
        className="mt-3 h-2 overflow-hidden rounded-pill bg-paper-3"
        role="progressbar"
        aria-valuenow={passo + 1}
        aria-valuemin={1}
        aria-valuemax={PASSOS.length}
      >
        <div
          className="h-full rounded-pill [background-image:var(--grad-brand)] transition-[width] duration-[var(--dur-base)] ease-out"
          style={{ width: `${((passo + 1) / PASSOS.length) * 100}%` }}
        />
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={passo}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
          className="mt-md"
        >
          {passo === 0 && (
            <>
              <h2 className="text-lg">Quando fica bom para você?</h2>
              {opcao.agendaOnline ? (
                carregandoSlots ? (
                  <Skeleton className="mt-md h-64" />
                ) : (
                  <div className="mt-md">
                    <SeletorHorario
                      dias={dias}
                      diaSelecionado={dia}
                      onSelecionarDia={(d) => {
                        setDia(d)
                        setSlot(null)
                      }}
                      slotSelecionado={slot}
                      onSelecionarSlot={setSlot}
                    />
                  </div>
                )
              ) : (
                <>
                  <p className="mt-1 text-sm text-ink-soft">
                    Esta clínica ainda não tem agenda online. Escolha o dia e a hora que preferir — a
                    Prumo leva seu pedido e a confirmação aparece aqui.
                  </p>
                  <div className="mt-md flex flex-col gap-md">
                    <Calendario valor={dia} onSelecionar={setDia} />
                    {dia && (
                      <div>
                        <p className="mb-2 font-display text-sm font-semibold text-indigo">Horário preferido</p>
                        <div role="radiogroup" aria-label="Horário preferido" className="flex flex-wrap gap-2">
                          {HORARIOS_PROPOSTA.map((h) => (
                            <button
                              key={h}
                              type="button"
                              role="radio"
                              aria-checked={hora === h}
                              onClick={() => setHora(h)}
                              className={cn(
                                'min-h-11 rounded-pill border px-4 text-sm font-semibold',
                                hora === h
                                  ? 'border-transparent [background-image:var(--grad-brand)] text-white shadow-soft'
                                  : 'border-line bg-paper text-ink-soft hover:border-[var(--color-lilas-soft)] hover:text-indigo',
                              )}
                            >
                              {h}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </>
          )}

          {passo === 1 && (
            <>
              <h2 className="text-lg">Como você prefere ser atendida?</h2>
              <div role="radiogroup" aria-label="Modalidade" className="mt-md flex flex-wrap gap-2">
                {opcao.modalidades.map((m) => {
                  const Icon = MODALIDADE_ICONE[m]
                  return (
                    <button
                      key={m}
                      type="button"
                      role="radio"
                      aria-checked={modalidade === m}
                      onClick={() => setModalidade(m)}
                      className={cn(
                        'inline-flex min-h-11 items-center gap-2 rounded-pill border px-4 text-sm font-semibold',
                        modalidade === m
                          ? 'border-transparent [background-image:var(--grad-brand)] text-white shadow-soft'
                          : 'border-line bg-paper text-ink-soft hover:text-indigo',
                      )}
                    >
                      <Icon className="size-4" aria-hidden />
                      {MODALIDADE_LABEL[m]}
                    </button>
                  )
                })}
              </div>

              <label className="mt-md block text-sm font-semibold text-ink" htmlFor="convenio">
                Plano ou forma de pagamento
              </label>
              <input
                id="convenio"
                value={convenio}
                onChange={(e) => setConvenio(e.target.value)}
                placeholder="Ex.: Unimed, particular, SUS"
                maxLength={80}
                className="input mt-1"
              />
              {(opcao.convenios.length > 0 || opcao.atendeSus) && (
                <p className="mt-1 text-xs text-ink-mute">
                  Atende: {[...opcao.convenios, opcao.atendeSus && 'SUS', opcao.atendeParticular && 'particular']
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              )}

              <label className="mt-md block text-sm font-semibold text-ink" htmlFor="mensagem">
                Quer contar algo antes? (opcional)
              </label>
              <textarea
                id="mensagem"
                value={mensagem}
                onChange={(e) => setMensagem(e.target.value)}
                placeholder="Ex.: é minha primeira consulta, estou de 12 semanas"
                maxLength={500}
                className="input mt-1 min-h-20 resize-y"
              />
            </>
          )}

          {passo === 2 && inicioEscolhido && (
            <>
              <h2 className="text-lg">Confere se está tudo certo</h2>
              <dl className="mt-md flex flex-col gap-3 rounded-xl bg-paper-2 p-md text-sm">
                <Linha termo="Profissional" valor={opcao.nome} />
                <Linha termo="Motivo" valor={OBJ_LABEL[objetivo]} />
                <Linha termo="Quando" valor={quandoPorExtenso(inicioEscolhido)} />
                <Linha termo="Como" valor={MODALIDADE_LABEL[modalidade]} />
                {convenio && <Linha termo="Plano" valor={convenio} />}
                {mensagem && <Linha termo="Recado" valor={mensagem} />}
              </dl>
              <p className="mt-3 text-xs text-ink-mute">
                {opcao.agendaOnline
                  ? 'O profissional recebe seu pedido e confirma. Você acompanha o status na Agenda.'
                  : 'A Prumo leva seu pedido para a clínica. A confirmação aparece na sua Agenda.'}
              </p>
            </>
          )}

          {erro && <AlertaErro>{erro}</AlertaErro>}
        </motion.div>
      </AnimatePresence>

      <div className="mt-lg flex flex-wrap items-center gap-2">
        {passo > 0 && (
          <button
            type="button"
            onClick={() => setPasso((p) => p - 1)}
            className="inline-flex min-h-11 items-center gap-1 rounded-pill px-4 text-sm font-semibold text-ink-soft hover:bg-paper-2"
          >
            <ArrowLeft className="size-4" aria-hidden /> Voltar
          </button>
        )}
        {passo < PASSOS.length - 1 ? (
          <Button
            size="md"
            className="ml-auto"
            disabled={passo === 0 && !inicioEscolhido}
            iconRight={<ArrowRight className="size-4" aria-hidden />}
            onClick={() => setPasso((p) => p + 1)}
          >
            {passo === 0 ? 'Escolher como' : 'Revisar'}
          </Button>
        ) : (
          <Button
            size="md"
            className="ml-auto"
            loading={enviando}
            iconLeft={<Check className="size-4" aria-hidden />}
            onClick={confirmar}
          >
            Marcar consulta
          </Button>
        )}
      </div>
    </div>
  )
}

function Linha({ termo, valor }: { termo: string; valor: string }) {
  return (
    <div className="flex flex-wrap justify-between gap-2">
      <dt className="text-ink-mute">{termo}</dt>
      <dd className="font-semibold text-ink">{valor}</dd>
    </div>
  )
}

function RadarBuscando({ objetivo }: { objetivo: ObjetivoAgendamento | null }) {
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
