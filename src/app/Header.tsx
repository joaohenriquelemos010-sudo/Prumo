import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { LayoutDashboard, Menu, Moon, Sun, X } from 'lucide-react'
import { Logo } from '@/components/Logo'
import { useTheme } from '@/lib/stores/theme'
import { useAuth } from '@/lib/stores/auth'
import { cn } from '@/lib/cn'

const LINKS = [
  { to: '/trilha', label: 'A Trilha' },
  { to: '/gestantes', label: 'Para você' },
  { to: '/medicos', label: 'Para médicos' },
  { to: '/seguranca', label: 'Segurança' },
]

/**
 * Nav archetype N5 (floating-ish, shrinks on scroll). Header condenses after a
 * short scroll, mobile opens a full-height sheet. One primary CTA, always.
 */
export function Header() {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)
  const location = useLocation()
  const authStatus = useAuth((s) => s.status)
  const bootstrap = useAuth((s) => s.bootstrap)
  const isAuthed = authStatus === 'authed'

  useEffect(() => {
    void bootstrap()
  }, [bootstrap])

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    setOpen(false)
  }, [location.pathname])

  return (
    <header
      className={cn(
        'sticky top-0 z-40 transition-[padding,background,box-shadow] duration-[var(--dur-base)] ease-out',
        scrolled
          ? 'bg-[color-mix(in_oklab,var(--color-paper)_82%,transparent)] py-2 shadow-soft backdrop-blur-md'
          : 'bg-transparent py-3',
      )}
    >
      <div className="u-shell flex items-center justify-between gap-md">
        <Link to="/" aria-label="Prumo — início" className="shrink-0">
          <Logo
            variant="full"
            className={cn('transition-all duration-[var(--dur-base)] ease-out', scrolled ? 'h-8' : 'h-10')}
          />
        </Link>

        <nav aria-label="Principal" className="hidden items-center gap-1 md:flex">
          {LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                cn(
                  'rounded-pill px-4 py-2 text-sm font-semibold text-ink-soft transition-colors duration-[var(--dur-fast)] hover:text-indigo hover:bg-paper-2',
                  isActive && 'text-indigo bg-paper-2',
                )
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <ThemeToggle />
          {isAuthed ? (
            <Link
              to="/app"
              className="inline-flex h-11 items-center gap-2 rounded-pill px-5 font-display text-sm font-semibold text-white shadow-soft [background-image:var(--grad-brand)] transition-[filter,box-shadow] duration-[var(--dur-fast)] hover:shadow-lift hover:brightness-[1.04]"
            >
              <LayoutDashboard className="size-4" aria-hidden />
              Minha área
            </Link>
          ) : (
            <>
              <Link
                to="/entrar"
                className="inline-flex h-11 items-center rounded-pill px-4 font-display text-sm font-semibold text-indigo hover:bg-paper-2"
              >
                Entrar
              </Link>
              <Link
                to="/onboarding"
                className="inline-flex h-11 items-center rounded-pill px-5 font-display text-sm font-semibold text-white shadow-soft [background-image:var(--grad-brand)] transition-[filter,box-shadow] duration-[var(--dur-fast)] hover:shadow-lift hover:brightness-[1.04]"
              >
                Começar a trilha
              </Link>
            </>
          )}
        </div>

        <div className="flex items-center gap-1 md:hidden">
          <ThemeToggle />
          <button
            type="button"
            className="grid size-11 place-items-center rounded-pill text-indigo hover:bg-paper-2"
          aria-expanded={open}
          aria-controls="menu-mobile"
          aria-label={open ? 'Fechar menu' : 'Abrir menu'}
          onClick={() => setOpen((v) => !v)}
        >
            {open ? <X aria-hidden /> : <Menu aria-hidden />}
          </button>
        </div>
      </div>

      {open && (
        <div
          id="menu-mobile"
          className="u-shell flex flex-col gap-1 pb-md pt-sm md:hidden"
        >
          {LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                cn(
                  'rounded-lg px-4 py-3 text-base font-semibold text-ink-soft hover:bg-paper-2',
                  isActive && 'text-indigo bg-paper-2',
                )
              }
            >
              {link.label}
            </NavLink>
          ))}
          {isAuthed ? (
            <Link
              to="/app"
              className="mt-xs rounded-pill px-4 py-3 text-center font-display font-semibold text-white [background-image:var(--grad-brand)]"
            >
              Minha área
            </Link>
          ) : (
            <>
              <Link
                to="/entrar"
                className="rounded-lg px-4 py-3 text-center text-base font-semibold text-indigo hover:bg-paper-2"
              >
                Entrar
              </Link>
              <Link
                to="/onboarding"
                className="mt-xs rounded-pill px-4 py-3 text-center font-display font-semibold text-white [background-image:var(--grad-brand)]"
              >
                Começar a trilha
              </Link>
            </>
          )}
        </div>
      )}
    </header>
  )
}

/** Light/dark toggle. Light is the brand default; dark keeps the acolhedor soul. */
function ThemeToggle() {
  const theme = useTheme((s) => s.theme)
  const toggle = useTheme((s) => s.toggle)
  const isDark = theme === 'dark'
  const label = isDark ? 'Ativar tema claro' : 'Ativar tema escuro'

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      aria-pressed={isDark}
      title={label}
      className="grid size-11 place-items-center rounded-pill text-indigo transition-colors duration-[var(--dur-fast)] hover:bg-paper-2"
    >
      {isDark ? <Sun className="size-5" aria-hidden /> : <Moon className="size-5" aria-hidden />}
    </button>
  )
}
