import { Check } from 'lucide-react'
import type { BlocoChecklist } from '@/features/clinico/diretrizes-prenatal'
import type { ItemChecklist } from './tipos'
import { cn } from '@/lib/cn'

/**
 * O roteiro da diretriz, colapsado a uma linha por item.
 *
 * A versão anterior abria cada item com título, descrição e fonte — correto para
 * ler, péssimo para consultar durante um atendimento, porque empurrava o SOAP
 * para fora da tela. Aqui cada item é uma linha clicável, e a explicação aparece
 * no `title` para quem parar em cima.
 */
export function RoteiroLateral({
  blocos,
  marcados,
  onToggle,
}: {
  blocos: BlocoChecklist[]
  marcados: ItemChecklist[]
  onToggle: (id: string, feito: boolean) => void
}) {
  const estaFeito = (id: string) => marcados.find((m) => m.id === id)?.feito ?? false
  const total = blocos.reduce((n, b) => n + b.itens.length, 0)
  const feitos = blocos.reduce((n, b) => n + b.itens.filter((i) => estaFeito(i.id)).length, 0)

  if (total === 0) return null

  return (
    <div className="flex flex-col gap-md">
      <header>
        <h3 className="u-eyebrow">Roteiro da diretriz</h3>
        <p className="mt-1 text-xs text-ink-mute">
          {feitos} de {total} — é lembrete, não obrigação.
        </p>
      </header>

      {blocos.map((bloco) => (
        <section key={bloco.id}>
          <h4 className="font-display text-sm font-semibold tracking-title text-ink">
            {bloco.titulo}
          </h4>
          <ul className="mt-1.5 flex flex-col gap-1">
            {bloco.itens.map((item) => {
              const feito = estaFeito(item.id)
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => onToggle(item.id, !feito)}
                    title={item.detalhe}
                    aria-pressed={feito}
                    className={cn(
                      'flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors',
                      'hover:bg-paper-2',
                      feito ? 'text-ink-mute line-through' : 'text-ink-soft',
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        'mt-0.5 grid size-4 shrink-0 place-items-center rounded border',
                        feito ? 'border-transparent bg-[var(--color-lilas)]' : 'border-line',
                      )}
                    >
                      {feito && <Check className="size-3 text-white" />}
                    </span>
                    <span className="min-w-0">{item.titulo}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}
