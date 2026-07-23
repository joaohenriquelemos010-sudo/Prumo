import { create } from 'zustand'
import { emitAuditEvent } from '@/lib/audit'
import { api } from '@/lib/api/client'
import { TRILHA_NODES } from '@/features/trilha/data'
import type { NodeStatus, TrilhaNode } from '@/features/trilha/types'

/**
 * The canonical trilha state is the list of concluded step ids. Node statuses
 * (concluído / atual / bloqueado) are *derived* from it, so the same UI serves
 * two modes:
 *  - demo (logged-out): seeded from the sample data, changes stay in memory;
 *  - real (logged-in): hydrated from the backend and every change is persisted.
 * Health data is never written to localStorage — only to the server.
 */

const DEMO_CONCLUIDAS = TRILHA_NODES.filter((n) => n.status === 'concluido').map((n) => n.id)

function deriveNodes(concluidas: string[]): TrilhaNode[] {
  const done = new Set(concluidas)
  let atualPlaced = false
  return TRILHA_NODES.map((node) => {
    if (done.has(node.id)) return { ...node, status: 'concluido' as NodeStatus }
    if (!atualPlaced) {
      atualPlaced = true
      return { ...node, status: 'atual' as NodeStatus }
    }
    return { ...node, status: 'bloqueado' as NodeStatus }
  })
}

interface TrilhaStore {
  concluidas: string[]
  nodes: TrilhaNode[]
  openNodeId: string | null
  celebratingId: string | null
  /** When true, changes are pushed to the backend. */
  syncEnabled: boolean
  openNode: (id: string | null) => void
  completeNode: (id: string) => void
  clearCelebration: () => void
  progress: () => number
  /** Load real progress from the server and turn on persistence. */
  hydrate: (concluidas: string[]) => void
  /** Return to the logged-out demo state (persistence off). */
  resetDemo: () => void
}

export const useTrilha = create<TrilhaStore>((set, get) => ({
  concluidas: DEMO_CONCLUIDAS,
  nodes: deriveNodes(DEMO_CONCLUIDAS),
  openNodeId: null,
  celebratingId: null,
  syncEnabled: false,

  openNode: (id) => {
    if (id) emitAuditEvent('trilha.node_opened', { nodeId: id })
    set((state) => ({ openNodeId: state.openNodeId === id ? null : id }))
  },

  completeNode: (id) => {
    const target = get().nodes.find((n) => n.id === id)
    if (!target || target.status !== 'atual') return

    emitAuditEvent('trilha.node_completed', { nodeId: id, marco: Boolean(target.marco) })

    const concluidas = [...get().concluidas, id]
    set({
      concluidas,
      nodes: deriveNodes(concluidas),
      openNodeId: null,
      celebratingId: target.marco ? id : null,
    })

    if (get().syncEnabled) {
      // Optimistic — the UI already advanced; persist in the background.
      api.post('/trilha', { etapaId: id, concluida: true }).catch(() => {
        /* keep the optimistic state; a background retry lives in the API client */
      })
    }
  },

  clearCelebration: () => set({ celebratingId: null }),

  progress: () => {
    const { nodes } = get()
    const done = nodes.filter((n) => n.status === 'concluido').length
    return Math.round((done / nodes.length) * 100)
  },

  hydrate: (concluidas) => {
    set({ concluidas, nodes: deriveNodes(concluidas), syncEnabled: true, openNodeId: null })
  },

  resetDemo: () => {
    set({
      concluidas: DEMO_CONCLUIDAS,
      nodes: deriveNodes(DEMO_CONCLUIDAS),
      syncEnabled: false,
      openNodeId: null,
      celebratingId: null,
    })
  },
}))
