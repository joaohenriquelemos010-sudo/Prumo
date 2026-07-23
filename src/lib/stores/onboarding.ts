import { create } from 'zustand'
import { emitAuditEvent } from '@/lib/audit'

/** The fork at the top of onboarding decides tone and destination. */
export type Perfil = 'gestante' | 'mae' | 'medico'

export type MomentoGestacao = 'planejando' | 'gestante' | 'ja-nasceu'

interface OnboardingStore {
  step: number
  perfil: Perfil | null
  momento: MomentoGestacao | null
  nome: string
  start: () => void
  setPerfil: (perfil: Perfil) => void
  setMomento: (momento: MomentoGestacao) => void
  setNome: (nome: string) => void
  next: () => void
  back: () => void
  complete: () => void
  reset: () => void
}

/**
 * Onboarding answers are held in memory for the length of the flow only. The
 * name is lightly personal, so it never touches persistent storage from here —
 * on submit it would go to the backend over the isolated API layer.
 */
export const useOnboarding = create<OnboardingStore>((set, get) => ({
  step: 0,
  perfil: null,
  momento: null,
  nome: '',

  start: () => {
    emitAuditEvent('onboarding.started')
    set({ step: 0 })
  },

  setPerfil: (perfil) => {
    emitAuditEvent('onboarding.role_selected', { perfil })
    set({ perfil })
  },

  setMomento: (momento) => set({ momento }),
  setNome: (nome) => set({ nome }),

  next: () => set({ step: Math.min(get().step + 1, 2) }),
  back: () => set({ step: Math.max(get().step - 1, 0) }),

  complete: () => {
    const { perfil } = get()
    emitAuditEvent('onboarding.completed', { perfil: perfil ?? 'desconhecido' })
  },

  reset: () => set({ step: 0, perfil: null, momento: null, nome: '' }),
}))
