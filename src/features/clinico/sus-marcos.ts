/**
 * Marcos do desenvolvimento infantil. Fonte: Ministério da Saúde — Caderneta da
 * Criança (instrumento de vigilância do desenvolvimento). Cada criança tem seu
 * ritmo; as faixas são referência, não cobrança. Sinais de alerta devem ser
 * avaliados pelo pediatra.
 */

export const REFERENCIA_MARCOS =
  'Ministério da Saúde — Caderneta da Criança (vigilância do desenvolvimento).'

export interface MarcoDesenvolvimento {
  idadeMeses: number
  faixa: string
  itens: string[]
}

export const MARCOS: MarcoDesenvolvimento[] = [
  { idadeMeses: 1, faixa: '1 mês', itens: ['Eleva a cabeça por instantes', 'Fixa o olhar no rosto', 'Reage a sons'] },
  { idadeMeses: 2, faixa: '2 meses', itens: ['Sorriso social (sorri de volta)', 'Acompanha objeto na linha média', 'Emite sons (arrulhos)'] },
  { idadeMeses: 4, faixa: '4 meses', itens: ['Sustenta a cabeça firme', 'Segue objetos de um lado a outro', 'Segura objetos e ri alto'] },
  { idadeMeses: 6, faixa: '6 meses', itens: ['Senta com apoio', 'Leva objetos à boca', 'Vira em direção a sons e balbucia'] },
  { idadeMeses: 9, faixa: '9 meses', itens: ['Senta sem apoio', 'Passa objetos de uma mão para a outra', 'Brinca de esconde-achou; sílabas como “mama”'] },
  { idadeMeses: 12, faixa: '12 meses', itens: ['Fica em pé e dá os primeiros passos com apoio', 'Faz pinça (polegar e indicador)', 'Fala 1 a 2 palavras e aponta o que quer'] },
]

export const NOTA_MARCOS =
  'Cada bebê no seu tempo. Se algum marco demorar bem mais que o esperado, converse com o pediatra — quanto antes, melhor.'
