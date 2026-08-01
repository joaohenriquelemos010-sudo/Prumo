import { create } from 'zustand'
import { api } from '@/lib/api/client'

/**
 * O médico já configurou a agenda?
 *
 * Vive num store porque a resposta é consultada em três lugares — o gate de
 * rota, o aviso da home e o rodapé do calendário — e três consultas separadas
 * ao servidor para a mesma pergunta piscariam três estados diferentes na mesma
 * tela.
 *
 * `null` significa "ainda não sei", e é deliberadamente diferente de `false`:
 * redirecionar alguém para o onboarding enquanto a resposta não chegou tiraria
 * da tela um médico que já está configurado, toda vez que ele recarregasse.
 */
interface EstadoConfiguracao {
  configurada: boolean | null
  carregando: boolean
  verificar: () => Promise<void>
  /** Chamado ao terminar o onboarding — evita reconsultar para saber o óbvio. */
  marcarConfigurada: () => void
}

export const useConfiguracao = create<EstadoConfiguracao>((set, get) => ({
  configurada: null,
  carregando: false,

  verificar: async () => {
    if (get().carregando) return
    set({ carregando: true })
    try {
      const d = await api.get<{ disponibilidade: { regras: unknown[] } }>('/disponibilidade/me')
      set({ configurada: (d.disponibilidade?.regras ?? []).length > 0 })
    } catch {
      /*
       * Falha de rede não é "não configurado". Tratá-la como tal empurraria para
       * o onboarding quem já terminou, e o onboarding é justamente a tela que
       * não se quer ver duas vezes.
       */
      set({ configurada: true })
    } finally {
      set({ carregando: false })
    }
  },

  marcarConfigurada: () => set({ configurada: true }),
}))
