import type { ReactNode } from 'react'
import { Check, Loader2 } from 'lucide-react'
import { Material } from '@/components/Material'
import { cn } from '@/lib/cn'

export type EstadoSalvamento = 'parado' | 'sujo' | 'salvando' | 'salvo'

/**
 * A barra de ações da configuração — as ações à esquerda, o estado à direita.
 *
 * Flutua no rodapé em vez de morar no cabeçalho por um motivo prático: a semana
 * é alta, e um botão de salvar que sai da tela ao rolar até domingo é um botão
 * que a médica procura de volta. Fica na superfície translúcida do produto
 * (`Material`), então o conteúdo passa por baixo em vez de ceder uma faixa fixa.
 *
 * O estado à direita é literal: ele diz o que **de fato** aconteceu com as
 * mudanças. Um "salvo automaticamente" decorativo numa tela que só salva ao
 * clicar seria a pior mentira que uma agenda pode contar.
 */
export function BarraAcoes({
  children,
  estado = 'parado',
  aviso,
}: {
  /** Os botões, na ordem: primário primeiro. */
  children: ReactNode
  estado?: EstadoSalvamento
  /** Substitui o estado quando há algo mais urgente a dizer (uma faixa inválida). */
  aviso?: ReactNode
}) {
  return (
    <Material
      peso="medio"
      className={cn(
        'sticky bottom-[calc(var(--nav-h)+0.5rem)] z-20 md:bottom-4',
        'flex flex-wrap items-center gap-3 rounded-2xl border border-line px-4 py-3 shadow-lift',
      )}
    >
      <div className="flex flex-wrap items-center gap-2">{children}</div>
      <div className="ml-auto">{aviso ?? <Estado estado={estado} />}</div>
    </Material>
  )
}

function Estado({ estado }: { estado: EstadoSalvamento }) {
  if (estado === 'parado') return null

  if (estado === 'salvando') {
    return (
      <span className="inline-flex items-center gap-2 text-sm text-ink-soft" role="status">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        Salvando…
      </span>
    )
  }

  if (estado === 'sujo') {
    return (
      <span className="inline-flex items-center gap-2 text-sm text-ink-soft">
        <span className="size-2 shrink-0 rounded-pill bg-warn" aria-hidden />
        Alterações não salvas
      </span>
    )
  }

  return (
    <span
      className="inline-flex items-center gap-2 text-sm font-semibold text-success-ink"
      role="status"
    >
      Tudo salvo
      <span className="grid size-6 shrink-0 place-items-center rounded-pill u-chip-success" aria-hidden>
        <Check className="size-3.5" />
      </span>
    </span>
  )
}
