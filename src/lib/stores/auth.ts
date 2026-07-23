import { create } from 'zustand'
import { api, ApiError } from '@/lib/api/client'
import { emitAuditEvent } from '@/lib/audit'

export type Papel = 'gestante' | 'mae' | 'medico'
export type VerificacaoStatus = 'nao_aplicavel' | 'pendente' | 'verificado'

export interface AuthUser {
  id: string
  nome: string
  email?: string
  papel: Papel
  crm?: string
  crmUf?: string
  verificacaoStatus?: VerificacaoStatus
}

export interface RegisterInput {
  nome: string
  email: string
  senha: string
  papel: Papel
  /** Doctor-only. */
  cpf?: string
  crm?: string
  crmUf?: string
}

type Status = 'idle' | 'loading' | 'authed' | 'guest'

interface Result {
  ok: boolean
  error?: string
}

interface AuthStore {
  user: AuthUser | null
  status: Status
  /** Loads the session once (from the httpOnly cookie). Safe to call repeatedly. */
  bootstrap: () => Promise<void>
  register: (input: RegisterInput) => Promise<Result>
  login: (email: string, senha: string) => Promise<Result>
  logout: () => Promise<void>
}

function friendly(error: unknown): string {
  if (error instanceof ApiError) return error.message
  return 'Algo não funcionou aqui. Tenta de novo?'
}

export const useAuth = create<AuthStore>((set, get) => ({
  user: null,
  status: 'idle',

  bootstrap: async () => {
    if (get().status !== 'idle') return
    set({ status: 'loading' })
    try {
      const { user } = await api.get<{ user: AuthUser }>('/auth/me')
      set({ user, status: 'authed' })
    } catch {
      set({ user: null, status: 'guest' })
    }
  },

  register: async (input) => {
    try {
      const { user } = await api.post<{ user: AuthUser }>('/auth/register', input)
      emitAuditEvent('form.submitted', { form: 'register', papel: input.papel })
      set({ user, status: 'authed' })
      return { ok: true }
    } catch (error) {
      emitAuditEvent('form.rejected', { form: 'register' })
      return { ok: false, error: friendly(error) }
    }
  },

  login: async (email, senha) => {
    try {
      const { user } = await api.post<{ user: AuthUser }>('/auth/login', { email, senha })
      set({ user, status: 'authed' })
      return { ok: true }
    } catch (error) {
      return { ok: false, error: friendly(error) }
    }
  },

  logout: async () => {
    try {
      await api.post('/auth/logout')
    } catch {
      /* even if the network call fails, drop the local session */
    }
    set({ user: null, status: 'guest' })
  },
}))
