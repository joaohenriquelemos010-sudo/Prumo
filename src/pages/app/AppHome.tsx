import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, CalendarDays, Route, Syringe, ShieldQuestion, Stethoscope, FlaskConical } from 'lucide-react'
import { useAuth } from '@/lib/stores/auth'
import { useTrilha } from '@/lib/stores/trilha'
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
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
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
  }, [hydrate])

  const atual = nodes.find((n) => n.status === 'atual')
  const primeiroNome = user?.nome?.split(' ')[0] ?? 'por aqui'

  return (
    <div className="relative flex flex-col gap-lg">
      <Blob variant="a" intensity={0.3} className="-right-16 -top-10 size-80" />

      <header className="flex flex-col gap-1">
        <p className="u-eyebrow">Sua área</p>
        <h1 className="text-3xl sm:text-4xl">Oi, {primeiroNome}</h1>
        <p className="text-ink-soft">Bom te ver. Veja por onde continuar hoje.</p>
      </header>

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
