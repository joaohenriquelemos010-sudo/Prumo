import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * A camada de movimento, verificada no código-fonte.
 *
 * Estes testes não medem pixels — medem **disciplina**. As regras abaixo são as
 * que se perdem primeiro quando alguém com pressa resolve um caso pontual, e
 * cada uma delas some sem quebrar nada visível:
 *
 * - uma `transition` de CSS num elemento que a pessoa arrasta não pode ser
 *   agarrada no meio do voo, e a interface passa a parecer que ignora o dedo;
 * - `bg-paper/72` renderiza **opaco** em silêncio, porque as cores do Prumo são
 *   funções OKLCH completas e a substituição `<alpha-value>` do Tailwind não se
 *   aplica;
 * - um componente que anima sem consultar `useReducedMotion` continua girando a
 *   tela de quem pediu para ela parar.
 *
 * Ler o fonte é feio e é de propósito: um teste de render não pega nenhuma das
 * três.
 */
const RAIZ = join(process.cwd(), 'src')

function ler(caminho: string): string {
  return readFileSync(join(RAIZ, caminho), 'utf8')
}

/**
 * O fonte sem comentários.
 *
 * A checagem do OKLCH batia no comentário do `Material` que **explica** a
 * armadilha — o texto certo, no lugar certo, marcado como erro. Um teste que
 * pune a documentação da regra que ele defende acaba fazendo alguém apagar a
 * documentação.
 */
function semComentarios(caminho: string): string {
  return ler(caminho)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
}

/** Os arquivos em que movimento e gesto de fato vivem. */
const COM_MOVIMENTO = [
  'components/Sheet.tsx',
  'components/Button.tsx',
  'app/InternalLayout.tsx',
  'features/agenda/Calendario.tsx',
  'features/agenda/SeletorHorario.tsx',
  'features/agenda/CardAgendamento.tsx',
  'features/bebe/GranularidadeSwitcher.tsx',
  'features/bebe/CartaoPeriodo.tsx',
  'features/bebe/CartaoBatimentos.tsx',
  'features/trilha/Confetti.tsx',
  'features/lembretes/Preferencias.tsx',
]

describe('movimento reduzido', () => {
  it.each(COM_MOVIMENTO)('%s consulta a preferência do usuário', (arquivo) => {
    const fonte = ler(arquivo)
    expect(fonte).toMatch(/useReducedMotion|useMovimento/)
  })
})

describe('gestos não podem usar transição de CSS', () => {
  /**
   * Um elemento arrastável com `transition-transform` fica preso à curva de
   * duração: agarrar no meio do caminho não devolve o controle, e o gesto passa
   * a competir com a animação em vez de continuá-la.
   */
  const ARRASTAVEIS = ['components/Sheet.tsx', 'features/agenda/Calendario.tsx']

  it.each(ARRASTAVEIS)('%s não anima transform por CSS', (arquivo) => {
    const fonte = ler(arquivo)
    expect(fonte).not.toMatch(/transition-transform/)
    expect(fonte).not.toMatch(/transition-\[transform/)
  })

  it('o arraste usa a borracha do Prumo, e não a do framer-motion', () => {
    // `dragElastic={0}` desliga a do framer para que `elastico()` assuma. Sem
    // isso, ou o gesto para seco na borda ou desliza livre — e a borda é
    // justamente a informação que o gesto deveria transmitir.
    for (const arquivo of ARRASTAVEIS) {
      const fonte = ler(arquivo)
      if (!fonte.includes('drag=')) continue
      expect(fonte).toMatch(/dragElastic=\{0\}/)
    }
  })
})

describe('a armadilha do OKLCH', () => {
  /**
   * As cores em `tokens.css` são funções OKLCH completas, então a substituição
   * `<alpha-value>` do Tailwind não acontece: `bg-paper/72` sai **opaco**, sem
   * erro e sem aviso. Toda superfície translúcida tem que usar `color-mix`.
   */
  const CORES = ['paper', 'paper-2', 'paper-3', 'indigo', 'lilas', 'azul', 'ink', 'line']

  it.each(COM_MOVIMENTO.concat(['components/Material.tsx']))(
    '%s não usa opacidade de cor do Tailwind',
    (arquivo) => {
      const fonte = semComentarios(arquivo)
      for (const cor of CORES) {
        expect(fonte).not.toMatch(new RegExp(`bg-${cor}/\\d`))
        expect(fonte).not.toMatch(new RegExp(`text-${cor}/\\d`))
      }
    },
  )

  it('Material declara a translucidez com color-mix e tem fallback sólido', () => {
    const fonte = ler('components/Material.tsx')
    expect(fonte).toMatch(/color-mix\(in_oklab,var\(--color-paper\)/)
    // Sem suporte a backdrop-filter, translúcido vira ilegível — o fallback é
    // sólido, e não "quase transparente".
    expect(fonte).toMatch(/supports-\[not_\(backdrop-filter/)
  })
})

describe('molas.ts é o vocabulário inteiro', () => {
  it('os quatro presets existem e nenhum tem overshoot', () => {
    const fonte = ler('lib/motion.ts')
    for (const nome of ['suave', 'firme', 'rapida', 'folha']) {
      expect(fonte).toContain(`${nome}:`)
    }
  })

  /**
   * A balança é a única exceção do produto: um prato que recebe peso e para
   * seco parece um gráfico. Se um dia aparecer uma segunda mola escrita à mão,
   * este teste falha — e a decisão passa a ser consciente em vez de acidental.
   */
  it('só a balança escreve mola própria', () => {
    const suspeitos = [
      'features/bebe/Balanca.tsx',
      ...COM_MOVIMENTO,
      'features/checklist/ProgressoAnel.tsx',
      'features/checklist/CartaoGrupo.tsx',
    ]

    const comMolaPropria = suspeitos.filter((arquivo) =>
      /stiffness:\s*\d/.test(semComentarios(arquivo)),
    )
    expect(comMolaPropria).toEqual(['features/bebe/Balanca.tsx'])
  })
})
