import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, CalendarDays, Route, Syringe, ShieldQuestion, Stethoscope, FlaskConical, NotebookPen, X, Sparkles } from 'lucide-react'
import { useAuth } from '@/lib/stores/auth'
import { useTrilha } from '@/lib/stores/trilha'
import { usePerfil } from '@/lib/stores/perfil'
import { api } from '@/lib/api/client'
import { Blob } from '@/components/Blob'
import { Skeleton } from '@/components/Skeleton'
import { PainelClinico } from '@/features/painel/PainelClinico'

const ATALHOS = [
  { to: '/app/trilha', label: 'Continuar a trilha', icon: Route },
  { to: '/app/agenda', label: 'Ver a agenda', icon: CalendarDays },
  { to: '/app/vacinas', label: 'Carteira de vacinas', icon: Syringe },
]

export default function AppHome() {
  const papel = useAuth((s) => s.user?.papel)
  return papel === 'medico' ? <MedicoHome /> : <PacienteHome />
}

function PacienteHome() {
  const user = useAuth((s) => s.user)
  const hydrate = useTrilha((s) => s.hydrate)
  const progress = useTrilha((s) => s.progress())
  const nodes = useTrilha((s) => s.nodes)
  const perfil = usePerfil((s) => s.perfil)
  const loadPerfil = usePerfil((s) => s.load)
  const perfilLoaded = usePerfil((s) => s.loaded)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    if (!perfilLoaded) void loadPerfil()
    api
      .get<{ etapasConcluidas: string[] }>('/trilha')
      .then((data) => {
        if (active) hydrate(data.etapasConcluidas)
      })
      .catch(() => {
        /* friendly failure — the trilha simply stays at its last known state */
      })
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [hydrate, loadPerfil, perfilLoaded])

  const atual = nodes.find((n) => n.status === 'atual')
  const primeiroNome = user?.nome?.split(' ')[0] ?? 'por aqui'
  const proximo = calcularProximoPasso(perfil, atual?.titulo)

  return (
    <div className="relative flex flex-col gap-lg">
      <Blob variant="a" intensity={0.3} className="-right-16 -top-10 size-80" />

      <header className="flex flex-col gap-1">
        <p className="u-eyebrow">Sua área</p>
        <h1 className="text-3xl sm:text-4xl">Oi, {primeiroNome}</h1>
        <p className="text-ink-soft">Bom te ver. Veja por onde continuar hoje.</p>
      </header>

      <OrientacaoInicial />

      {/* One clear next step — the single most useful action, front and centre. */}
      <Link
        to={proximo.to}
        className="group relative flex items-center gap-4 overflow-hidden rounded-2xl [background-image:var(--grad-brand)] p-lg text-white shadow-lift"
      >
        <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-white/20">
          <proximo.icon className="size-7" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-white/85">Seu próximo passo</span>
          <span className="block font-display text-xl font-bold">{proximo.titulo}</span>
          <span className="block text-sm text-white/85">{proximo.desc}</span>
        </span>
        <ArrowRight className="size-6 shrink-0 transition-transform group-hover:translate-x-1" aria-hidden />
      </Link>

      {/* Progress card */}
      <div className="rounded-2xl border border-line bg-paper p-lg shadow-soft">
        {loading ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-3 w-full" />
          </div>
        ) : (
          <>
            <div className="flex items-end justify-between gap-md">
              <div>
                <p className="font-display text-sm font-semibold text-indigo">Sua trilha</p>
                <p className="font-display text-2xl font-bold text-ink">
                  {nodes.filter((n) => n.status === 'concluido').length} de {nodes.length} etapas
                </p>
              </div>
              <span className="u-gradient-text font-display text-3xl font-extrabold">{progress}%</span>
            </div>
            <div className="mt-3 h-2.5 overflow-hidden rounded-pill bg-paper-3">
              <div
                className="h-full rounded-pill [background-image:var(--grad-brand)] transition-[width] duration-[var(--dur-slow)] ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
            {atual && (
              <Link
                to="/app/trilha"
                className="mt-md inline-flex items-center gap-2 font-display font-semibold text-indigo hover:text-azul"
              >
                Próximo: {atual.titulo}
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            )}
          </>
        )}
      </div>

      {/* Quick actions */}
      <div className="grid gap-md sm:grid-cols-3">
        {ATALHOS.map((a) => {
          const Icon = a.icon
          return (
            <Link
              key={a.to}
              to={a.to}
              className="group flex items-center gap-3 rounded-2xl border border-line bg-paper p-md shadow-soft transition-[transform,box-shadow] duration-[var(--dur-base)] hover:-translate-y-0.5 hover:shadow-lift"
            >
              <span className="grid size-11 place-items-center rounded-xl [background-image:var(--grad-brand-soft)] text-indigo">
                <Icon className="size-5" aria-hidden />
              </span>
              <span className="font-display font-semibold text-ink">{a.label}</span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

/** The doctor's home is clinical, not a journey: patient snapshot + quick jumps. */
function MedicoHome() {
  const user = useAuth((s) => s.user)
  const primeiroNome = user?.nome?.split(' ')[0] ?? 'doutor(a)'

  return (
    <div className="relative flex flex-col gap-lg">
      <Blob variant="c" intensity={0.25} className="-right-16 -top-10 size-80" />

      <header className="flex flex-col gap-1">
        <p className="u-eyebrow">Painel clínico</p>
        <h1 className="text-3xl sm:text-4xl">Olá, Dr(a). {primeiroNome}</h1>
        <p className="text-ink-soft">O panorama do seu paciente, da gestação à pediatria, num relance.</p>
      </header>

      <VerificacaoBanner />

      <PainelClinico />

      <div className="grid gap-md sm:grid-cols-3">
        <MedicoAtalho to="/app/consultas" label="Registrar consulta" icon={Stethoscope} />
        <MedicoAtalho to="/app/exames" label="Ver exames" icon={FlaskConical} />
        <MedicoAtalho to="/app/vacinas" label="Vacinas do paciente" icon={Syringe} />
      </div>
    </div>
  )
}

function MedicoAtalho({ to, label, icon: Icon }: { to: string; label: string; icon: typeof Syringe }) {
  return (
    <Link
      to={to}
      className="group flex items-center gap-3 rounded-2xl border border-line bg-paper p-md shadow-soft transition-[transform,box-shadow] duration-[var(--dur-base)] hover:-translate-y-0.5 hover:shadow-lift"
    >
      <span className="grid size-11 place-items-center rounded-xl [background-image:var(--grad-brand-soft)] text-indigo">
        <Icon className="size-5" aria-hidden />
      </span>
      <span className="font-display font-semibold text-ink">{label}</span>
    </Link>
  )
}

/** Shown while the doctor's CRM has not been verified. */
function VerificacaoBanner() {
  const status = useAuth((s) => s.user?.verificacaoStatus)
  const crm = useAuth((s) => s.user?.crm)
  const crmUf = useAuth((s) => s.user?.crmUf)
  if (status !== 'pendente') return null

  return (
    <div className="flex items-start gap-3 rounded-2xl border border-[var(--color-warn)] bg-[oklch(0.97_0.04_65)] p-md">
      <ShieldQuestion className="mt-0.5 size-5 shrink-0 text-warn" aria-hidden />
      <div>
        <p className="font-display font-semibold text-ink">CRM em verificação</p>
        <p className="text-sm text-ink-soft">
          Recebemos seu CRM{crm ? ` ${crm}${crmUf ? `/${crmUf}` : ''}` : ''}. Enquanto a
          verificação não conclui, você navega em modo demonstração com um paciente de exemplo.
        </p>
      </div>
    </div>
  )
}

interface ProximoPasso {
  titulo: string
  desc: string
  to: string
  icon: typeof Route
}

/** The single most useful next action for a patient, based on where they are. */
function calcularProximoPasso(
  perfil: { dataNascimento: string | null; dpp: string | null } | null,
  atualTitulo?: string,
): ProximoPasso {
  if (perfil && !perfil.dataNascimento && !perfil.dpp) {
    return {
      titulo: 'Complete os dados do bebê',
      desc: 'Assim montamos sua agenda e as vacinas certinhas.',
      to: '/app/agenda',
      icon: CalendarDays,
    }
  }
  if (atualTitulo) {
    return { titulo: atualTitulo, desc: 'Toque para ver o que fazer nesta etapa.', to: '/app/trilha', icon: Route }
  }
  return {
    titulo: 'Você está em dia!',
    desc: 'Que tal anotar uma dúvida para a próxima consulta?',
    to: '/app/caderninho',
    icon: NotebookPen,
  }
}

/** Dismissible first-run orientation. The dismissal flag is a UI preference. */
function OrientacaoInicial() {
  const KEY = 'prumo.orientacao.v1'
  const [visivel, setVisivel] = useState(() => {
    try {
      return localStorage.getItem(KEY) !== 'ok'
    } catch {
      return true
    }
  })
  if (!visivel) return null
  function dispensar() {
    try {
      localStorage.setItem(KEY, 'ok')
    } catch {
      /* storage off — it just shows again next time */
    }
    setVisivel(false)
  }

  return (
    <div className="relative rounded-2xl border border-line bg-paper-2 p-lg">
      <button
        type="button"
        onClick={dispensar}
        aria-label="Dispensar orientação"
        className="absolute right-3 top-3 grid size-8 place-items-center rounded-lg text-ink-mute hover:bg-paper"
      >
        <X className="size-4" aria-hidden />
      </button>
      <p className="u-eyebrow inline-flex items-center gap-2">
        <Sparkles className="size-4" aria-hidden /> Bem-vinda à Prumo
      </p>
      <h2 className="mt-1 text-lg">Como usar, rapidinho</h2>
      <ul className="mt-md grid gap-2 text-sm text-ink-soft sm:grid-cols-2">
        <li>🧭 <strong className="text-ink">Trilha</strong> — seu caminho, passo a passo.</li>
        <li>🧪 <strong className="text-ink">Exames</strong> — guarde e mostre ao médico.</li>
        <li>📓 <strong className="text-ink">Caderninho</strong> — anote dúvidas para a consulta.</li>
        <li>📍 <strong className="text-ink">Agendar</strong> — médicos e clínicas perto de você.</li>
      </ul>
      <button type="button" onClick={dispensar} className="mt-md text-sm font-semibold text-indigo underline underline-offset-4">
        Entendi
      </button>
    </div>
  )
}
