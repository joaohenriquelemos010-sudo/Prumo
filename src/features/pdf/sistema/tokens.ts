/**
 * A paleta do Prumo em hex, para o PDF.
 *
 * PDF é sempre claro: um documento que a pessoa imprime ou guarda não tem tema.
 * Por isso estes valores espelham só o tema **claro** de `src/styles/tokens.css`,
 * convertidos de OKLCH para sRGB.
 *
 * A conversão é feita à mão de propósito — pôr um conversor OKLCH no chunk do
 * PDF custaria mais do que uma tabela de doze constantes que muda uma vez por
 * ano. `sistema/tokens.test.ts` guarda a correspondência: se `tokens.css` mudar
 * uma cor de marca sem que esta tabela mude junto, o teste cai.
 */
export const TOKENS = {
  /* Marca */
  lilas: '#b58bfd',
  lilasSoft: '#dcc9fe',
  azul: '#5b81fb',
  azulSoft: '#c2d0fd',
  indigo: '#36408c',

  /* Superfícies */
  paper: '#fdfcff',
  paper2: '#f6f4fc',
  paper3: '#eae6f6',

  /* Texto */
  ink: '#2d3363',
  inkSoft: '#4b5080',
  inkMute: '#6b6f96',

  /* Linhas e sinais */
  line: '#e4e2f2',
  success: '#3f9a6a',
  successInk: '#2f7350',
  warn: '#b8791f',
  warnInk: '#8c5a14',
} as const

/** Escala tipográfica do documento. Menor que a da tela: papel lê de mais perto. */
export const TIPO = {
  capaTitulo: 30,
  titulo: 18,
  secao: 12.5,
  corpo: 10.5,
  pequeno: 9,
  micro: 7.5,
} as const

/**
 * Tracking por tamanho, mesma disciplina da tela: aperta o texto grande, deixa o
 * corpo em zero, abre um pouco no micro. Em pt, porque o react-pdf não tem `em`.
 */
export const TRACKING = {
  capaTitulo: -0.9,
  titulo: -0.4,
  corpo: 0,
  micro: 0.2,
} as const

export const ESPACO = {
  xs: 4,
  sm: 7,
  md: 12,
  lg: 20,
  xl: 32,
} as const

/** Margens da página. O rodapé fixo mora dentro do `paddingBottom`. */
export const PAGINA = {
  margemH: 44,
  margemTopo: 40,
  margemBase: 56,
} as const
