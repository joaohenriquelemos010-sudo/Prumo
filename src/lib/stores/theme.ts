import { create } from 'zustand'

/**
 * Theme is a UI preference, not health data, so it may persist to localStorage.
 * The initial value is resolved before first paint by `public/theme-init.js`
 * (saved choice → OS preference → light); this store keeps React in sync and
 * drives the toggle. Until someone toggles explicitly, we keep following the OS.
 */

export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'prumo.theme'

function currentTheme(): Theme {
  const attr = document.documentElement.dataset.theme
  return attr === 'dark' ? 'dark' : 'light'
}

function escolheuExplicitamente(): boolean {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved === 'dark' || saved === 'light'
  } catch {
    return false
  }
}

function apply(theme: Theme): void {
  document.documentElement.dataset.theme = theme
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    /* storage disabled — the choice just won't persist */
  }
}

interface ThemeStore {
  theme: Theme
  toggle: () => void
  setTheme: (theme: Theme) => void
}

export const useTheme = create<ThemeStore>((set, get) => ({
  theme: currentTheme(),
  toggle: () => {
    const next: Theme = get().theme === 'dark' ? 'light' : 'dark'
    apply(next)
    set({ theme: next })
  },
  setTheme: (theme) => {
    apply(theme)
    set({ theme })
  },
}))

// Follow the system until the person makes a choice of their own. Once they
// toggle, `apply()` writes to storage and this stops overriding them.
if (typeof window !== 'undefined' && window.matchMedia) {
  const mq = window.matchMedia('(prefers-color-scheme: dark)')
  mq.addEventListener('change', (e) => {
    if (escolheuExplicitamente()) return
    const theme: Theme = e.matches ? 'dark' : 'light'
    document.documentElement.dataset.theme = theme
    useTheme.setState({ theme })
  })
}
