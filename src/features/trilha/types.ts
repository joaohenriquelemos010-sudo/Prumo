import type { LucideIcon } from 'lucide-react'

export type NodeStatus = 'concluido' | 'atual' | 'bloqueado'

export type TrilhaFase = 'gestacao' | 'parto' | 'puerperio' | 'primeiro-ano'

export interface TrilhaNode {
  id: string
  fase: TrilhaFase
  titulo: string
  /** Short label under the node on the path. */
  resumo: string
  /** Warm, expanded explanation shown in-place when the node opens. */
  descricao: string
  /** "O que fazer" — concrete, tappable next steps. */
  passos: string[]
  /** "O que esperar" — sets expectations, removes anxiety. */
  esperar: string
  status: NodeStatus
  /** Milestone nodes get extra visual weight + a celebration on completion. */
  marco?: boolean
  icon: LucideIcon
}

export interface FaseMeta {
  fase: TrilhaFase
  nome: string
  descricao: string
}
