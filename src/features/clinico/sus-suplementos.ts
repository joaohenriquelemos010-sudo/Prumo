/**
 * Suplementação recomendada (SUS). Fonte: Ministério da Saúde — Caderneta da
 * Gestante, Caderneta da Criança e programas de suplementação. Informativo — a
 * prescrição e as doses são sempre definidas pelo profissional de saúde.
 */

export const REFERENCIA_SUPLEMENTOS =
  'Ministério da Saúde — Cadernetas da Gestante e da Criança e programas nacionais de suplementação.'

export interface Suplemento {
  id: string
  nome: string
  publico: 'gestante' | 'crianca'
  quando: string
  para: string
}

export const SUPLEMENTOS: Suplemento[] = [
  {
    id: 'acido-folico',
    nome: 'Ácido fólico',
    publico: 'gestante',
    quando: 'Idealmente antes de engravidar e no 1º trimestre',
    para: 'Reduz o risco de defeitos no tubo neural do bebê',
  },
  {
    id: 'sulfato-ferroso-gestante',
    nome: 'Sulfato ferroso (ferro)',
    publico: 'gestante',
    quando: 'Durante a gestação e no pós-parto, conforme orientação',
    para: 'Previne e trata anemia por falta de ferro',
  },
  {
    id: 'vitamina-d',
    nome: 'Vitamina D',
    publico: 'crianca',
    quando: 'Desde os primeiros dias, conforme orientação',
    para: 'Ajuda na formação dos ossos',
  },
  {
    id: 'vitamina-a',
    nome: 'Vitamina A',
    publico: 'crianca',
    quando: 'A partir dos 6 meses, em regiões e situações definidas',
    para: 'Fortalece a imunidade e a visão',
  },
  {
    id: 'sulfato-ferroso-crianca',
    nome: 'Ferro profilático',
    publico: 'crianca',
    quando: 'A partir dos 3 a 6 meses, conforme orientação',
    para: 'Previne anemia por falta de ferro',
  },
]

export const NOTA_SUPLEMENTOS =
  'As doses e o período certo são definidos pelo seu profissional de saúde. A Prumo mostra a referência — quem prescreve é a sua equipe.'
