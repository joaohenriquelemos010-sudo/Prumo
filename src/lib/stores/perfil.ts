import { create } from 'zustand'
import { api } from '@/lib/api/client'

export type Momento = 'planejando' | 'gestante' | 'ja-nasceu'

export interface Perfil {
  nome: string
  momento: Momento
  /** ISO strings or null. */
  dpp: string | null
  dataNascimento: string | null
}

interface PerfilStore {
  perfil: Perfil | null
  loaded: boolean
  load: () => Promise<void>
  update: (patch: Partial<Perfil>) => Promise<{ ok: boolean; error?: string }>
}

/**
 * The journey profile (name, moment, key dates). Fetched from the backend and
 * shared by the agenda, the vaccine card and the dashboard so the SUS schedule is
 * computed from one place. Never persisted to localStorage — it's health-adjacent.
 */
export const usePerfil = create<PerfilStore>((set) => ({
  perfil: null,
  loaded: false,

  load: async () => {
    try {
      const { perfil } = await api.get<{ perfil: Perfil }>('/perfil')
      set({ perfil, loaded: true })
    } catch {
      set({ loaded: true })
    }
  },

  update: async (patch) => {
    try {
      const { perfil } = await api.put<{ perfil: Perfil }>('/perfil', patch)
      set({ perfil, loaded: true })
      return { ok: true }
    } catch {
      return { ok: false, error: 'Não consegui salvar agora. Tenta de novo?' }
    }
  },
}))
