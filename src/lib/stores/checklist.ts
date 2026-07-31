import { create } from 'zustand'
import { api } from '@/lib/api/client'
import { criancaQuery } from '@/lib/stores/medico-context'

export interface PassoChecklist {
  id: string
  titulo: string
  explicacaoLeiga?: string
  dica?: string
  opcional?: boolean
  feito: boolean
}

export type EstadoGrupo = 'pendente' | 'em-andamento' | 'feito' | 'nao-se-aplica'

export interface GrupoChecklist {
  id: string
  titulo: string
  resumo?: string
  explicacaoLeiga: string
  porqueImporta?: string
  fonte?: string
  icone?: string
  janela: { desdeSemana?: number | null; ateSemana?: number | null; desdeMes?: number | null; ateMes?: number | null }
  estado: EstadoGrupo
  nota: string
  feitoEm: string | null
  passos: PassoChecklist[]
  total: number
  feitos: number
  foraDaJanela: boolean
}

export interface Checklist {
  chave: string
  versao: number
  titulo: string
  descricao?: string
  icone?: string
  publico: string
  atribuidoPorNome?: string
  sequenciaDias: number
  grupos: GrupoChecklist[]
  progresso: number
}

interface EstadoChecklist {
  checklists: Checklist[]
  carregando: boolean
  erro: string | null
  /** Grupo que acabou de ser concluído — dispara a comemoração, uma vez. */
  comemorando: string | null

  carregar: (crianca: string | null) => Promise<void>
  marcarPasso: (chave: string, grupoId: string, passoId: string, feito: boolean, crianca: string | null) => Promise<void>
  marcarGrupo: (chave: string, grupoId: string, estado: EstadoGrupo, crianca: string | null) => Promise<void>
  limparComemoracao: () => void
}

/** Recalcula o resumo de um grupo local, para o otimista bater com o servidor. */
function recalcular(grupo: GrupoChecklist): GrupoChecklist {
  const obrigatorios = grupo.passos.filter((p) => !p.opcional)
  const feitos = obrigatorios.filter((p) => p.feito).length
  const todos = obrigatorios.length > 0 && feitos === obrigatorios.length

  return {
    ...grupo,
    feitos,
    total: obrigatorios.length,
    estado:
      grupo.estado === 'nao-se-aplica'
        ? 'nao-se-aplica'
        : todos
          ? 'feito'
          : feitos > 0
            ? 'em-andamento'
            : 'pendente',
  }
}

function progressoDe(grupos: GrupoChecklist[]): number {
  if (grupos.length === 0) return 0
  const prontos = grupos.filter((g) => g.estado === 'feito' || g.estado === 'nao-se-aplica').length
  return Math.round((prontos / grupos.length) * 100)
}

/**
 * O checklist da família.
 *
 * Escrita **otimista**, no mesmo padrão de `stores/trilha.ts`: marcar um item
 * responde na hora e o servidor confirma atrás. Duas razões — uma pessoa que
 * marca cinco itens seguidos não pode esperar cinco viagens de rede, e a
 * comemoração precisa acontecer no dedo, não meio segundo depois.
 *
 * Na falha, o estado otimista **fica**. O servidor é a verdade da próxima
 * carga, mas desfazer a marcação na cara de quem acabou de marcar seria pior:
 * ela fez a coisa no mundo real, e ver o item "desmarcar sozinho" faz parecer
 * que o app perdeu o que ela fez.
 */
export const useChecklist = create<EstadoChecklist>((set) => ({
  checklists: [],
  carregando: false,
  erro: null,
  comemorando: null,

  carregar: async (crianca) => {
    set({ carregando: true, erro: null })
    try {
      const d = await api.get<{ checklists: Checklist[] }>(`/checklists${criancaQuery(crianca)}`)
      set({ checklists: d.checklists, carregando: false })
    } catch (e) {
      set({
        carregando: false,
        erro: e instanceof Error ? e.message : 'Não consegui carregar seu checklist.',
      })
    }
  },

  marcarPasso: async (chave, grupoId, passoId, feito, crianca) => {
    let virouCompleto = false

    set((s) => ({
      checklists: s.checklists.map((c) => {
        if (c.chave !== chave) return c
        const grupos = c.grupos.map((g) => {
          if (g.id !== grupoId) return g
          const antes = g.estado
          const atualizado = recalcular({
            ...g,
            passos: g.passos.map((p) => (p.id === passoId ? { ...p, feito } : p)),
          })
          if (antes !== 'feito' && atualizado.estado === 'feito') virouCompleto = true
          return atualizado
        })
        return { ...c, grupos, progresso: progressoDe(grupos) }
      }),
    }))

    if (virouCompleto) set({ comemorando: grupoId })

    try {
      await api.patch(
        `/checklists/${chave}/grupo/${grupoId}/passo/${passoId}${criancaQuery(crianca)}`,
        { feito },
      )
    } catch {
      // O item fica marcado. A próxima carga reconcilia com o servidor.
    }
  },

  marcarGrupo: async (chave, grupoId, estado, crianca) => {
    set((s) => ({
      checklists: s.checklists.map((c) => {
        if (c.chave !== chave) return c
        const grupos = c.grupos.map((g) => (g.id === grupoId ? { ...g, estado } : g))
        return { ...c, grupos, progresso: progressoDe(grupos) }
      }),
    }))

    if (estado === 'feito') set({ comemorando: grupoId })

    try {
      await api.patch(`/checklists/${chave}/grupo/${grupoId}${criancaQuery(crianca)}`, { estado })
    } catch {
      /* mesma regra do passo */
    }
  },

  limparComemoracao: () => set({ comemorando: null }),
}))

/** O grupo que a pessoa deveria olhar agora: o primeiro na janela e não concluído. */
export function proximoGrupo(checklist: Checklist | undefined): GrupoChecklist | null {
  if (!checklist) return null
  return (
    checklist.grupos.find((g) => !g.foraDaJanela && g.estado !== 'feito' && g.estado !== 'nao-se-aplica') ??
    null
  )
}
