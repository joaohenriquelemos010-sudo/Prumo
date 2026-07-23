import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { Check, Lock, Star } from 'lucide-react'
import { useTrilha } from '@/lib/stores/trilha'
import { FASES } from './data'
import type { TrilhaNode } from './types'
import { NodeDetail } from './NodeDetail'
import { cn } from '@/lib/cn'

/**
 * The Trilha — the product. A vertical serpentine path the family walks, from
 * pré-natal to the first year. Nodes alternate side to side; the path fills with
 * the brand gradient as progress advances. Tapping a node expands it in place —
 * no navigation. Concluded / current / locked is legible without reading.
 */
export function TrilhaPath() {
  const nodes = useTrilha((s) => s.nodes)
  const openNodeId = useTrilha((s) => s.openNodeId)
  const progress = useTrilha((s) => s.progress())

  return (
    <div className="relative mx-auto max-w-xl">
      {/* The spine: a muted rail with a gradient fill sized to progress. */}
      <div
        className="absolute left-1/2 top-6 bottom-6 w-1.5 -translate-x-1/2 rounded-pill bg-paper-3"
        aria-hidden="true"
      >
        <div
          className="w-full rounded-pill [background-image:var(--grad-brand)] transition-[height] duration-[var(--dur-slow)] ease-out"
          style={{ height: `${progress}%` }}
        />
      </div>

      <ol className="relative flex flex-col gap-3">
        {nodes.map((node, index) => {
          const side: 'left' | 'right' = index % 2 === 0 ? 'left' : 'right'
          const faseChanged = index === 0 || node.fase !== nodes[index - 1].fase
          const faseNome = FASES.find((f) => f.fase === node.fase)?.nome

          return (
            <li key={node.id} className="relative">
              {faseChanged && (
                <div className="relative z-10 mb-1 mt-lg flex justify-center first:mt-0">
                  <span className="rounded-pill bg-paper px-4 py-1 font-display text-sm font-semibold text-indigo shadow-soft ring-1 ring-line">
                    {faseNome}
                  </span>
                </div>
              )}

              <TrilhaNodeRow node={node} side={side} open={openNodeId === node.id} />
            </li>
          )
        })}
      </ol>
    </div>
  )
}

interface RowProps {
  node: TrilhaNode
  side: 'left' | 'right'
  open: boolean
}

function TrilhaNodeRow({ node, side, open }: RowProps) {
  const openNode = useTrilha((s) => s.openNode)
  const Icon = node.icon
  const isDone = node.status === 'concluido'
  const isAtual = node.status === 'atual'
  const isLocked = node.status === 'bloqueado'

  const statusLabel = isDone ? 'Concluído' : isAtual ? 'Etapa atual' : 'Bloqueada'

  return (
    <div>
      <div className={cn('relative z-10 flex items-center gap-3', side === 'right' && 'flex-row-reverse')}>
        {/* The node button */}
      <div className={cn('flex w-1/2 shrink-0', side === 'left' ? 'justify-end' : 'justify-start')}>
        <button
          type="button"
          onClick={() => !isLocked && openNode(node.id)}
          disabled={isLocked}
          aria-expanded={open}
          aria-label={`${node.titulo} — ${statusLabel}`}
          className={cn(
            'group relative grid place-items-center rounded-full transition-transform duration-[var(--dur-fast)] ease-out',
            node.marco ? 'size-[4.5rem]' : 'size-14',
            !isLocked && 'hover:scale-105 active:scale-95 cursor-pointer',
            isLocked && 'cursor-not-allowed',
            isAtual && 'u-node-pulse',
          )}
        >
          {/* ring for milestones */}
          {node.marco && !isLocked && (
            <span className="absolute inset-0 rounded-full ring-2 ring-[var(--color-lilas)] ring-offset-2 ring-offset-[var(--color-paper)]" />
          )}
          <span
            className={cn(
              'grid size-full place-items-center rounded-full shadow-soft transition-colors',
              isDone && '[background-image:var(--grad-brand)] text-white',
              isAtual && 'bg-paper text-indigo ring-2 ring-[var(--color-azul)]',
              isLocked && 'bg-paper-3 text-ink-mute',
            )}
          >
            {isDone ? (
              <Check className="size-6" aria-hidden />
            ) : isLocked ? (
              <Lock className="size-5" aria-hidden />
            ) : (
              <Icon className={cn(node.marco ? 'size-7' : 'size-6')} aria-hidden />
            )}
          </span>
          {node.marco && (
            <Star
              className="absolute -right-1 -top-1 size-5 fill-[var(--color-lilas)] text-[var(--color-lilas)]"
              aria-hidden
            />
          )}
        </button>
      </div>

      {/* The label */}
      <div className={cn('w-1/2', side === 'right' ? 'text-right' : 'text-left')}>
        <button
          type="button"
          onClick={() => !isLocked && openNode(node.id)}
          disabled={isLocked}
          tabIndex={-1}
          className={cn('max-w-full', isLocked && 'cursor-not-allowed')}
        >
          <span className={cn('block font-display font-semibold leading-tight', isLocked ? 'text-ink-mute' : 'text-ink')}>
            {node.titulo}
          </span>
          <span className="block text-sm text-ink-mute">{node.resumo}</span>
        </button>
      </div>

      </div>

      {/* In-place expansion — CSS grid-rows collapse. Animating grid-template-rows
          (0fr↔1fr) never re-measures or re-wraps the inner content, so there is no
          flicker on close (unlike an animated height:auto). Reflows the path. */}
      <CollapsibleDetail open={open}>
        <NodeDetail node={node} />
      </CollapsibleDetail>
    </div>
  )
}

/**
 * Flicker-free collapse. The inner content keeps its final layout at all times;
 * the grid track clips it. Closed content is removed from the a11y tree and tab
 * order via `inert`. Under reduced motion the transition is disabled globally.
 */
function CollapsibleDetail({ open, children }: { open: boolean; children: ReactNode }) {
  const innerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = innerRef.current
    if (el) el.inert = !open
  }, [open])

  return (
    <div
      className="relative z-20 grid transition-[grid-template-rows] duration-[var(--dur-base)] ease-out motion-reduce:transition-none"
      style={{ gridTemplateRows: open ? '1fr' : '0fr' }}
    >
      <div ref={innerRef} aria-hidden={!open} className="overflow-hidden">
        {children}
      </div>
    </div>
  )
}
