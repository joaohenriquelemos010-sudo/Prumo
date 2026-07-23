import { Suspense } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Home, Route, CalendarDays, FileHeart, Syringe, LogOut, Activity, NotebookPen, FlaskConical, Stethoscope, MapPin, Link2 } from 'lucide-react'
import { Logo } from '@/components/Logo'
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
const NAV_PACIENTE: NavItem[] = [
  { to: '/app', label: 'Início', icon: Home },
  { to: '/app/trilha', label: 'Trilha', icon: Route },
  { to: '/app/profissionais', label: 'Agendar', icon: MapPin },
  { to: '/app/exames', label: 'Exames', icon: FlaskConical },
  { to: '/app/caderninho', label: 'Caderninho', icon: NotebookPen },
  { to: '/app/agenda', label: 'Agenda', icon: CalendarDays },
  { to: '/app/vacinas', label: 'Vacinas', icon: Syringe },
  { to: '/app/compartilhar', label: 'Conectar', icon: Link2 },
]

const NAV_MEDICO: NavItem[] = [
  { to: '/app', label: 'Painel', icon: Activity },
  { to: '/app/prontuario', label: 'Prontuário', icon: FileHeart },
  { to: '/app/consultas', label: 'Consultas', icon: Stethoscope },
  { to: '/app/exames', label: 'Exames', icon: FlaskConical },
  { to: '/app/compartilhar', label: 'Pacientes', icon: Link2 },
  { to: '/app/caderninho', label: 'Dúvidas', icon: NotebookPen },
]

function navFor(papel: Papel | undefined): NavItem[] {
  return papel === 'medico' ? NAV_MEDICO : NAV_PACIENTE
}

/**
 * The authenticated shell. Duolingo-like: a soft side rail on desktop, a thumb-
 * friendly bottom bar on mobile. One clear place for everything.
 */
export function InternalLayout() {
  const user = useAuth((s) => s.user)
  const logout = useAuth((s) => s.logout)
  const resetDemo = useTrilha((s) => s.resetDemo)
  const navigate = useNavigate()
  const location = useLocation()

  const items = navFor(user?.papel)

  async function handleLogout() {
    await logout()
    resetDemo()
    navigate('/')
  }

  return (
    <div className="min-h-screen bg-paper-2 md:grid md:grid-cols-[248px_1fr]">
      {/* Desktop side rail */}
      <aside className="sticky top-0 hidden h-screen flex-col gap-lg border-r border-line bg-paper p-lg md:flex">
        <NavLink to="/" aria-label="Prumo — início">
          <Logo variant="full" className="h-9" />
        </NavLink>

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
            <span className="grid size-8 place-items-center rounded-full [background-image:var(--grad-brand-soft)] text-indigo">
              {user?.nome?.charAt(0).toUpperCase() ?? '?'}
            </span>
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

      {/* Content */}
      <div className="pb-24 md:pb-0">
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
        className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-around border-t border-line bg-paper/95 px-1 py-1.5 backdrop-blur-md md:hidden"
      >
        {items.slice(0, 4).map((item) => (
          <BottomLink key={item.to} item={item} />
        ))}
        <BottomLink item={{ to: '/app/perfil', label: 'Perfil', icon: Home }} perfil />
      </nav>
    </div>
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

function BottomLink({ item, perfil }: { item: NavItem; perfil?: boolean }) {
  const user = useAuth((s) => s.user)
  const Icon = item.icon
  return (
    <NavLink
      to={item.to}
      end={item.to === '/app'}
      className={({ isActive }) =>
        cn(
          'flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-lg px-1 py-1.5 text-[0.68rem] font-semibold text-ink-mute',
          isActive && 'text-indigo',
        )
      }
    >
      {perfil ? (
        <span className="grid size-6 place-items-center rounded-full [background-image:var(--grad-brand-soft)] text-[0.6rem] text-indigo">
          {user?.nome?.charAt(0).toUpperCase() ?? '?'}
        </span>
      ) : (
        <Icon className="size-5" aria-hidden />
      )}
      <span className="truncate">{item.label}</span>
    </NavLink>
  )
}
