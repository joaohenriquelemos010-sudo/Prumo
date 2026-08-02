import type { ComponentPropsWithoutRef, ElementType, ReactNode } from 'react'
import { cn } from '@/lib/cn'

/**
 * Um **cartão** de vidro — a superfície do fluxo de acesso e cadastro.
 *
 * Irmão do `Material`, e a divisão entre os dois é proposital: `Material` é
 * chrome (nav, toolbar, folha) e por isso tem só a aresta de cima e cantos que
 * seguem o container; `Vidro` é uma peça que flutua sobre o fundo ambiente, com
 * anel completo, raio próprio e sombra que dá altura.
 *
 * As regras de material que os dois obedecem:
 *
 * - **Nunca empilhe dois vidros claros.** A legibilidade colapsa. Dentro de um
 *   `Vidro`, a camada interna é sólida (`peso="interno"` cuida disso).
 * - **Superfície maior lê como mais espessa** — mais blur e sombra mais funda
 *   que um chip pequeno. É o que faz a hierarquia parecer física.
 * - **Cor vai em camada sólida**, nunca no primeiro plano translúcido.
 * - A opacidade sai de `--vidro-opacidade`, que `prefers-reduced-transparency` e
 *   `prefers-contrast` levam a 100% em `index.css`. Uma variável desliga a
 *   translucidez do produto inteiro.
 */
interface VidroProps extends Omit<ComponentPropsWithoutRef<'div'>, 'children'> {
  children: ReactNode
  className?: string
  peso?: Peso
  as?: ElementType
}

type Peso = 'leve' | 'medio' | 'denso' | 'interno'

const PESOS: Record<Peso, string> = {
  /** Chips e pílulas — pouco blur, sombra rasa. */
  leve: 'backdrop-blur-[14px] backdrop-saturate-150 shadow-soft',
  /** Cartões de escolha, listas de benefício. */
  medio: 'backdrop-blur-[28px] backdrop-saturate-[1.7] shadow-soft',
  /** A folha principal da tela. Superfície grande → mais espessa. */
  denso: 'backdrop-blur-[44px] backdrop-saturate-[1.8] shadow-lift',
  /**
   * Camada **sólida** para o que vive dentro de outro vidro. Não é um vidro —
   * existe justamente para que ninguém precise empilhar dois.
   */
  interno: 'bg-paper shadow-soft',
}

/** Aresta clara em cima e anel tênue: é a luz pegando na borda do material. */
const ARESTA =
  'border border-[color-mix(in_oklab,var(--color-paper)_45%,transparent)] ' +
  'border-t-[color-mix(in_oklab,var(--color-paper)_78%,transparent)]'

export function Vidro({ children, className, peso = 'denso', as: Tag = 'div', ...resto }: VidroProps) {
  const translucido = peso !== 'interno'

  return (
    <Tag
      {...resto}
      className={cn(
        'relative isolate rounded-2xl',
        translucido && 'bg-[color-mix(in_oklab,var(--color-paper)_var(--vidro-opacidade,62%),transparent)]',
        PESOS[peso],
        translucido && ARESTA,
        !translucido && 'border border-line',
        // Sem suporte a backdrop-filter o fundo vira sólido, em vez de
        // translúcido e ilegível.
        translucido && 'supports-[not_(backdrop-filter:blur(1px))]:bg-paper',
        className,
      )}
    >
      {children}
    </Tag>
  )
}

/**
 * O halo circular que abre cada passo do fluxo — o ícone do perfil no mockup.
 * Cor em camada sólida (o gradiente de marca suave), com um brilho difuso atrás
 * para dar a impressão de luz atravessando o vidro.
 */
export function HaloIcone({
  children,
  className,
  tom = 'marca',
  tamanho = 'md',
}: {
  children: ReactNode
  className?: string
  /** `marca` é o violeta do produto; os outros marcam o perfil escolhido. */
  tom?: 'marca' | 'rosa' | 'azul' | 'verde'
  /** `lg` é a chegada — a única tela do fluxo em que algo acontece a favor. */
  tamanho?: 'md' | 'lg'
}) {
  // Uma medida só: o brilho de trás e o disco da frente precisam coincidir, e
  // deixar o tamanho vir por `className` desalinharia os dois em silêncio.
  const medida = tamanho === 'lg' ? 'size-20' : 'size-16'

  return (
    <span className={cn('relative grid shrink-0 place-items-center', medida, className)}>
      <span
        aria-hidden
        className={cn('absolute inset-0 -z-10 rounded-full opacity-70 blur-xl', TONS[tom].brilho)}
      />
      <span className={cn('grid place-items-center rounded-full', medida, TONS[tom].fundo, TONS[tom].tinta)}>
        {children}
      </span>
    </span>
  )
}

const TONS = {
  marca: {
    fundo: '[background-image:var(--grad-brand-soft)]',
    tinta: 'text-indigo',
    brilho: '[background-image:var(--grad-brand)]',
  },
  rosa: {
    fundo: 'bg-[color-mix(in_oklab,oklch(0.72_0.17_350)_18%,var(--color-paper))]',
    tinta: 'text-[oklch(0.55_0.18_350)] dark:text-[oklch(0.82_0.13_350)]',
    brilho: 'bg-[oklch(0.72_0.17_350)]',
  },
  azul: {
    fundo: 'bg-[color-mix(in_oklab,var(--color-azul)_18%,var(--color-paper))]',
    tinta: 'text-azul dark:text-[oklch(0.84_0.11_265)]',
    brilho: 'bg-[var(--color-azul)]',
  },
  verde: {
    fundo: 'bg-[color-mix(in_oklab,var(--color-success)_18%,var(--color-paper))]',
    tinta: 'text-success-ink',
    brilho: 'bg-[var(--color-success)]',
  },
} as const

export type TomHalo = keyof typeof TONS
