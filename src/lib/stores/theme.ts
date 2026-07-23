import { create } from 'zustand'

/**
 * Theme is a UI preference, not health data, so it may persist to localStorage.
 * The initial value is read early by an inline script in index.html (to avoid a
 * flash of the wrong theme); this store keeps React in sync and drives the toggle.
 */

export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'prumo.theme'

function currentTheme(): Theme {
  const attr = document.documentElement.dataset.theme
  return attr === 'dark' ? 'dark' : 'light'
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
