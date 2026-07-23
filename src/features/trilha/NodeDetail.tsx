import { CheckCircle2, ListChecks, Sparkle } from 'lucide-react'
import { useTrilha } from '@/lib/stores/trilha'
import { Button } from '@/components/Button'
import type { TrilhaNode } from './types'

/**
 * The panel that opens in place when a node is tapped. Explains what the step
 * is, what to do, and what to expect — in the Prumo voice. The current step
 * carries the one action: concluir.
 */
export function NodeDetail({ node }: { node: TrilhaNode }) {
  const completeNode = useTrilha((s) => s.completeNode)
  const isAtual = node.status === 'atual'
  const isDone = node.status === 'concluido'

  return (
    <div className="mt-3 rounded-2xl border border-line bg-paper p-md shadow-lift sm:p-lg">
      <div className="flex flex-wrap items-center gap-2">
        {node.marco && (
          <span className="rounded-pill [background-image:var(--grad-brand-soft)] px-3 py-1 text-xs font-semibold text-indigo">
            Marco importante
          </span>
        )}
        {isDone && (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-success">
            <CheckCircle2 className="size-4" aria-hidden /> Concluído
          </span>
        )}
      </div>

      <h3 className="mt-2 text-xl">{node.titulo}</h3>
      <p className="mt-2 text-ink-soft">{node.descricao}</p>

      <div className="mt-md grid gap-md sm:grid-cols-2">
        <div className="rounded-xl bg-paper-2 p-md">
          <p className="mb-2 inline-flex items-center gap-2 font-display text-sm font-semibold text-indigo">
            <ListChecks className="size-4" aria-hidden /> O que fazer
          </p>
          <ul className="flex flex-col gap-2">
            {node.passos.map((passo) => (
              <li key={passo} className="flex items-start gap-2 text-sm text-ink-soft">
                <span
                  className="mt-1.5 size-1.5 shrink-0 rounded-full [background-image:var(--grad-brand)]"
                  aria-hidden
                />
                {passo}
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl bg-paper-2 p-md">
          <p className="mb-2 inline-flex items-center gap-2 font-display text-sm font-semibold text-indigo">
            <Sparkle className="size-4" aria-hidden /> O que esperar
          </p>
          <p className="text-sm text-ink-soft">{node.esperar}</p>
        </div>
      </div>

      {isAtual && (
        <div className="mt-md flex justify-end">
          <Button onClick={() => completeNode(node.id)} iconLeft={<CheckCircle2 className="size-5" aria-hidden />}>
            Concluir esta etapa
          </Button>
        </div>
      )}
    </div>
  )
}
