import { create } from 'zustand'
import { api, ApiError, setSessionExpiredHandler } from '@/lib/api/client'
import { emitAuditEvent } from '@/lib/audit'
import { gerarMeusDadosPdfBlob } from '@/features/pdf/meusDados'
import type { MeusDadosExport } from '@/features/pdf/documents'

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
  /**
   * HTTP status of the failure, so screens can offer the right way out
   * (e.g. 409 on register means "this e-mail already has an account" → send
   * the person to sign in instead of leaving them stuck).
   */
  status?: number
}

interface AuthStore {
  user: AuthUser | null
  status: Status
  /** True when the session dropped mid-use, so the sign-in page can explain why. */
  sessaoExpirada: boolean
  /** Clears the notice above once it has been seen. */
  limparAvisoSessao: () => void
  /** Loads the session once (from the httpOnly cookie). Safe to call repeatedly. */
  bootstrap: () => Promise<void>
  register: (input: RegisterInput) => Promise<Result>
  login: (email: string, senha: string) => Promise<Result>
  logout: () => Promise<void>
  /** Downloads a PDF with everything Prumo holds for this account. */
  exportarDados: () => Promise<Result>
  /** Permanently deletes the account and all its data. Irreversible. */
  excluirConta: () => Promise<Result>
}

function friendly(error: unknown): string {
  if (error instanceof ApiError) return error.message
  return 'Algo não funcionou aqui. Tenta de novo?'
}

function statusOf(error: unknown): number | undefined {
  return error instanceof ApiError ? error.status : undefined
}

export const useAuth = create<AuthStore>((set, get) => ({
  user: null,
  status: 'idle',
  sessaoExpirada: false,

  limparAvisoSessao: () => set({ sessaoExpirada: false }),

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
      return { ok: false, error: friendly(error), status: statusOf(error) }
    }
  },

  login: async (email, senha) => {
    try {
      const { user } = await api.post<{ user: AuthUser }>('/auth/login', { email, senha })
      set({ user, status: 'authed', sessaoExpirada: false })
      return { ok: true }
    } catch (error) {
      return { ok: false, error: friendly(error), status: statusOf(error) }
    }
  },

  logout: async () => {
    try {
      await api.post('/auth/logout')
    } catch {
      /* even if the network call fails, drop the local session */
    }
    set({ user: null, status: 'guest', sessaoExpirada: false })
  },

  exportarDados: async () => {
    try {
      const dados = await api.get<MeusDadosExport>('/auth/exportar')
      const blob = await gerarMeusDadosPdfBlob(dados)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'prumo-meus-dados.pdf'
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
      emitAuditEvent('privacy.data_export_requested')
      return { ok: true }
    } catch (error) {
      return { ok: false, error: friendly(error) }
    }
  },

  excluirConta: async () => {
    try {
      await api.del('/auth/me')
      emitAuditEvent('privacy.account_deletion_requested')
      set({ user: null, status: 'guest' })
      return { ok: true }
    } catch (error) {
      return { ok: false, error: friendly(error) }
    }
  },
}))

/**
 * A session that dies mid-use drops us back to guest, which makes ProtectedRoute
 * route the person to sign-in with an explanation — instead of stranding them on
 * a screen whose only feedback is "sua sessão expirou".
 */
setSessionExpiredHandler(() => {
  if (useAuth.getState().status !== 'authed') return
  useAuth.setState({ user: null, status: 'guest', sessaoExpirada: true })
})
