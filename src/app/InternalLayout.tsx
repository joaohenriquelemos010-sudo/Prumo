import { Suspense, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Home,
  Route,
  CalendarDays,
  FileHeart,
  Syringe,
  LogOut,
  Activity,
  NotebookPen,
  FlaskConical,
  Stethoscope,
  MapPin,
  Link2,
  Users,
  ShieldCheck,
  BarChart3,
  MoreHorizontal,
} from 'lucide-react'
import { Logo } from '@/components/Logo'
import { BottomSheet } from '@/components/BottomSheet'
import { ThemeToggle } from '@/components/ThemeToggle'
import { useAuth } from '@/lib/stores/auth'
import type { Papel } from '@/lib/stores/auth'
import { useTrilha } from '@/lib/stores/trilha'
import { PageFallback } from './PageFallback'
import { cn } from '@/lib/cn'

interface NavItem {
  to: string
  label: string
  icon: typeof Home
}

// The family walks a journey; the doctor reads a clinical record. Different jobs,
// different navigation. Both share Vacinas, Agenda and Caderninho.
//
// The first four of each list are the phone's primary tabs — order matters here.
// Everything after them stays one tap away behind "Mais", never out of reach.
const NAV_PACIENTE: NavItem[] = [
  { to: '/app', label: 'Início', icon: Home },
  { to: '/app/trilha', label: 'Trilha', icon: Route },
  { to: '/app/agenda', label: 'Agenda', icon: CalendarDays },
  { to: '/app/profissionais', label: 'Agendar', icon: MapPin },
  { to: '/app/exames', label: 'Exames', icon: FlaskConical },
  { to: '/app/caderninho', label: 'Caderninho', icon: NotebookPen },
  { to: '/app/vacinas', label: 'Vacinas', icon: Syringe },
  { to: '/app/comunidade', label: 'Comunidade', icon: Users },
  { to: '/app/compartilhar', label: 'Conectar', icon: Link2 },
]

const NAV_MEDICO: NavItem[] = [
  { to: '/app', label: 'Painel', icon: Activity },
  { to: '/app/agenda', label: 'Agenda', icon: CalendarDays },
  { to: '/app/prontuario', label: 'Prontuário', icon: FileHeart },
  { to: '/app/consultas', label: 'Consultas', icon: Stethoscope },
  { to: '/app/exames', label: 'Exames', icon: FlaskConical },
  { to: '/app/compartilhar', label: 'Pacientes', icon: Link2 },
  { to: '/app/caderninho', label: 'Dúvidas', icon: NotebookPen },
]

const NAV_ADMIN: NavItem[] = [
  { to: '/app', label: 'Administração', icon: ShieldCheck },
  { to: '/app/admin', label: 'Painel admin', icon: BarChart3 },
]

function navFor(papel: Papel | undefined): NavItem[] {
  if (papel === 'medico') return NAV_MEDICO
  if (papel === 'admin') return NAV_ADMIN
  return NAV_PACIENTE
}

/** How many destinations fit as tabs before "Mais" takes over. */
const TABS_PRIMARIAS = 4

/**
 * The authenticated shell. Duolingo-like: a soft side rail on desktop, a thumb-
 * friendly bottom bar on mobile. One clear place for everything — and everything
 * the rail shows, the phone can reach too.
 */
export function InternalLayout() {
  const user = useAuth((s) => s.user)
  const logout = useAuth((s) => s.logout)
  const resetDemo = useTrilha((s) => s.resetDemo)
  const navigate = useNavigate()
  const location = useLocation()
  const [maisAberto, setMaisAberto] = useState(false)

  const items = navFor(user?.papel)
  const primarias = items.slice(0, TABS_PRIMARIAS)
  const secundarias = items.slice(TABS_PRIMARIAS)
  const temMais = secundarias.length > 0
  const emSecundaria = secundarias.some((i) => location.pathname === i.to)

  async function handleLogout() {
    setMaisAberto(false)
    await logout()
    resetDemo()
    navigate('/')
  }

  return (
    <div className="min-h-screen bg-paper-2 md:grid md:grid-cols-[248px_1fr]">
      {/* Desktop side rail */}
      <aside className="sticky top-0 hidden h-screen flex-col gap-lg border-r border-line bg-paper p-lg md:flex">
        <div className="flex items-center justify-between gap-2">
          <NavLink to="/" aria-label="Prumo — início">
            <Logo variant="full" className="h-9" />
          </NavLink>
          <ThemeToggle className="-mr-2 shrink-0" />
        </div>

        <nav aria-label="Área da plataforma" className="flex flex-1 flex-col gap-1">
          {items.map((item) => (
            <RailLink key={item.to} item={item} />
          ))}
        </nav>

        <div className="flex flex-col gap-1 border-t border-line pt-md">
          <NavLink
            to="/app/perfil"
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-ink-soft hover:bg-paper-2',
                isActive && 'bg-paper-2 text-indigo',
              )
            }
          >
            <Avatar nome={user?.nome} className="size-8 text-sm" />
            <span className="truncate">{user?.nome ?? 'Meu perfil'}</span>
          </NavLink>
          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-ink-soft hover:bg-paper-2"
          >
            <LogOut className="size-5" aria-hidden />
            Sair
          </button>
        </div>
      </aside>

      {/* Content. The bottom padding tracks the real bar height + the home
          indicator, instead of guessing with a magic number. */}
      <div className="[padding-bottom:calc(var(--nav-h)+env(safe-area-inset-bottom))] md:pb-0">
        <AnimatePresence mode="wait">
          <motion.main
            key={location.pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            className="mx-auto max-w-4xl px-md py-lg sm:px-lg sm:py-xl"
          >
            <Suspense fallback={<PageFallback />}>
              <Outlet />
            </Suspense>
          </motion.main>
        </AnimatePresence>
      </div>

      {/* Mobile bottom bar */}
      <nav
        aria-label="Área da plataforma"
        className="fixed inset-x-0 bottom-0 z-40 flex items-stretch justify-around border-t border-line bg-[color-mix(in_oklab,var(--color-paper)_88%,transparent)] px-1 backdrop-blur-md [padding-bottom:env(safe-area-inset-bottom)] md:hidden"
      >
        {primarias.map((item) => (
          <BottomLink key={item.to} item={item} />
        ))}
        {temMais ? (
          <button
            type="button"
            onClick={() => setMaisAberto(true)}
            aria-haspopup="dialog"
            aria-expanded={maisAberto}
            className={cn(
              'flex min-h-[var(--nav-h)] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg px-1 text-[0.7rem] font-semibold',
              emSecundaria || maisAberto ? 'text-indigo' : 'text-ink-soft',
            )}
          >
            <MoreHorizontal className="size-5" aria-hidden />
            <span className="truncate">Mais</span>
          </button>
        ) : (
          <BottomLink item={{ to: '/app/perfil', label: 'Perfil', icon: Home }} perfil />
        )}
      </nav>

      <BottomSheet aberto={maisAberto} onFechar={() => setMaisAberto(false)} titulo="Tudo na Prumo">
        <nav aria-label="Mais destinos" className="flex flex-col gap-1">
          {secundarias.map((item) => (
            <SheetLink key={item.to} item={item} onNavegar={() => setMaisAberto(false)} />
          ))}
        </nav>

        <div className="mt-sm flex flex-col gap-1 border-t border-line pt-sm">
          <NavLink
            to="/app/perfil"
            onClick={() => setMaisAberto(false)}
            className={({ isActive }) =>
              cn(
                'flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-ink-soft hover:bg-paper-2',
                isActive && 'bg-paper-2 text-indigo',
              )
            }
          >
            <Avatar nome={user?.nome} className="size-7 text-xs" />
            <span className="truncate">{user?.nome ?? 'Meu perfil'}</span>
          </NavLink>
          <ThemeToggle variant="linha" />
          <button
            type="button"
            onClick={handleLogout}
            className="flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-ink-soft hover:bg-paper-2"
          >
            <LogOut className="size-5 shrink-0" aria-hidden />
            Sair
          </button>
        </div>
      </BottomSheet>
    </div>
  )
}

function Avatar({ nome, className }: { nome?: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'grid shrink-0 place-items-center rounded-full font-semibold [background-image:var(--grad-brand-soft)] text-indigo',
        className,
      )}
    >
      {nome?.charAt(0).toUpperCase() ?? '?'}
    </span>
  )
}

function RailLink({ item }: { item: NavItem }) {
  const Icon = item.icon
  return (
    <NavLink
      to={item.to}
      end={item.to === '/app'}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-ink-soft transition-colors duration-[var(--dur-fast)] hover:bg-paper-2 hover:text-indigo',
          isActive && 'bg-paper-2 text-indigo',
        )
      }
    >
      <Icon className="size-5" aria-hidden />
      {item.label}
    </NavLink>
  )
}

function SheetLink({ item, onNavegar }: { item: NavItem; onNavegar: () => void }) {
  const Icon = item.icon
  return (
    <NavLink
      to={item.to}
      end={item.to === '/app'}
      onClick={onNavegar}
      className={({ isActive }) =>
        cn(
          'flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-ink-soft hover:bg-paper-2',
          isActive && 'bg-paper-2 text-indigo',
        )
      }
    >
      <Icon className="size-5 shrink-0" aria-hidden />
      {item.label}
    </NavLink>
  )
}

function BottomLink({ item, perfil }: { item: NavItem; perfil?: boolean }) {
  const user = useAuth((s) => s.user)
  const Icon = item.icon
  return (
    <NavLink
      to={item.to}
      end={item.to === '/app'}
      className={({ isActive }) =>
        cn(
          'flex min-h-[var(--nav-h)] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg px-1 text-[0.7rem] font-semibold text-ink-soft',
          isActive && 'text-indigo',
        )
      }
    >
      {perfil ? <Avatar nome={user?.nome} className="size-6 text-[0.65rem]" /> : <Icon className="size-5" aria-hidden />}
      <span className="truncate">{item.label}</span>
    </NavLink>
  )
}
