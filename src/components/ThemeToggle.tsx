import { Moon, Sun } from 'lucide-react'
import { useTheme } from '@/lib/stores/theme'
import { cn } from '@/lib/cn'

interface ThemeToggleProps {
  /** `icone` for the header rail; `linha` for menus, where it sits among links. */
  variant?: 'icone' | 'linha'
  className?: string
}

/**
 * Light/dark toggle. Light is the brand default; dark keeps the acolhedor soul.
 * Lives in a component of its own because it belongs everywhere navigation does —
 * the public header, the authenticated side rail, and the mobile sheet.
 */
export function ThemeToggle({ variant = 'icone', className }: ThemeToggleProps) {
  const theme = useTheme((s) => s.theme)
  const toggle = useTheme((s) => s.toggle)
  const isDark = theme === 'dark'
  const label = isDark ? 'Ativar tema claro' : 'Ativar tema escuro'
  const Icon = isDark ? Sun : Moon

  if (variant === 'linha') {
    return (
      <button
        type="button"
        onClick={toggle}
        aria-pressed={isDark}
        className={cn(
          'flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-ink-soft hover:bg-paper-2',
          className,
        )}
      >
        <Icon className="size-5 shrink-0" aria-hidden />
        {isDark ? 'Tema claro' : 'Tema escuro'}
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      aria-pressed={isDark}
      title={label}
      className={cn(
        'grid size-11 place-items-center rounded-pill text-indigo transition-colors duration-[var(--dur-fast)] hover:bg-paper-2',
        className,
      )}
    >
      <Icon className="size-5" aria-hidden />
    </button>
  )
}
