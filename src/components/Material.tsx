import type { ElementType, ReactNode } from 'react'
import { cn } from '@/lib/cn'

interface MaterialProps {
  children: ReactNode
  className?: string
  /**
   * Superfícies grandes leem como mais espessas: mais blur e sombra mais funda
   * que um chip pequeno. É o que faz a hierarquia parecer física em vez de
   * decorada.
   */
  peso?: 'leve' | 'medio' | 'denso'
  as?: ElementType
}

const PESOS = {
  leve: 'backdrop-blur-[12px] backdrop-saturate-150',
  medio: 'backdrop-blur-[24px] backdrop-saturate-[1.8]',
  denso: 'backdrop-blur-[40px] backdrop-saturate-[1.8] shadow-lift',
} as const

/**
 * Uma camada translúcida — nav, toolbar, cabeçalho flutuante, folha.
 *
 * Chrome translúcido dá estrutura sem roubar o foco: o conteúdo rola por baixo em
 * vez de ceder uma faixa fixa da tela. Duas regras que este componente existe
 * para tornar fáceis de obedecer:
 *
 * - **Nunca empilhe dois materiais claros.** A legibilidade colapsa. Se precisar
 *   de duas camadas, a de baixo é sólida.
 * - **Cor vai em camada sólida, nunca no primeiro plano translúcido.**
 *
 * A opacidade sai de `--material-opacidade`, que `prefers-reduced-transparency` e
 * `prefers-contrast` levam a 100% em `index.css`. Uma variável desliga a
 * translucidez do produto inteiro.
 *
 * Nota sobre o `color-mix`: as cores do Prumo são funções OKLCH completas, então
 * a substituição `<alpha-value>` do Tailwind não se aplica — `bg-paper/72`
 * renderiza **opaco**, em silêncio. Daí a forma explícita abaixo.
 */
export function Material({ children, className, peso = 'medio', as: Tag = 'div' }: MaterialProps) {
  return (
    <Tag
      className={cn(
        'bg-[color-mix(in_oklab,var(--color-paper)_var(--material-opacidade,72%),transparent)]',
        PESOS[peso],
        // Aresta superior clara: é a luz pegando no material.
        'border-t border-[color-mix(in_oklab,var(--color-paper)_60%,transparent)]',
        // Sem suporte a backdrop-filter, o fundo vira sólido em vez de translúcido
        // e ilegível.
        'supports-[not_(backdrop-filter:blur(1px))]:bg-paper',
        className,
      )}
    >
      {children}
    </Tag>
  )
}
