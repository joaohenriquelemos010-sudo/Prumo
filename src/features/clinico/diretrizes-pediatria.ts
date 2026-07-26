import type { BlocoChecklist } from './diretrizes-prenatal'

/**
 * Puericultura — o calendário de acompanhamento da criança e o que se registra
 * em cada consulta.
 *
 * Fonte: Sociedade Brasileira de Pediatria (Manual de Puericultura) e Ministério
 * da Saúde (Caderneta da Criança).
 *
 * As vacinas já vivem em `sus-vacinas.ts` e os marcos do desenvolvimento em
 * `sus-marcos.ts`; aqui ficam o ritmo das consultas, as triagens neonatais e o
 * roteiro do encontro — a continuação natural do roteiro de pré-natal.
 */

export const REFERENCIA_PEDIATRIA =
  'Sociedade Brasileira de Pediatria — Manual de Puericultura; Ministério da Saúde — Caderneta da Criança.'

/* ---------------------------- ritmo de consultas --------------------------- */

export interface ConsultaPuericultura {
  id: string
  idadeMeses: number
  idadeLabel: string
  foco: string
}

/** Calendário mínimo de puericultura no primeiro biênio. */
export const CONSULTAS_PUERICULTURA: ConsultaPuericultura[] = [
  { id: 'primeira-semana', idadeMeses: 0, idadeLabel: 'Até 7 dias', foco: 'Primeira consulta: peso, icterícia, pega e triagens neonatais.' },
  { id: '1-mes', idadeMeses: 1, idadeLabel: '1 mês', foco: 'Ganho de peso, aleitamento, coto umbilical, sono seguro.' },
  { id: '2-meses', idadeMeses: 2, idadeLabel: '2 meses', foco: 'Vacinas, sorriso social, crescimento.' },
  { id: '4-meses', idadeMeses: 4, idadeLabel: '4 meses', foco: 'Sustento cervical, vacinas, curva de crescimento.' },
  { id: '6-meses', idadeMeses: 6, idadeLabel: '6 meses', foco: 'Introdução alimentar, senta com apoio, suplementação de ferro.' },
  { id: '9-meses', idadeMeses: 9, idadeLabel: '9 meses', foco: 'Engatinhar, alimentação complementar, prevenção de acidentes.' },
  { id: '12-meses', idadeMeses: 12, idadeLabel: '12 meses', foco: 'Primeiros passos, primeiras palavras, vacinas do primeiro ano.' },
  { id: '18-meses', idadeMeses: 18, idadeLabel: '18 meses', foco: 'Marcha firme, linguagem, rastreio do desenvolvimento.' },
  { id: '24-meses', idadeMeses: 24, idadeLabel: '2 anos', foco: 'Frases de duas palavras, alimentação da família, saúde bucal.' },
]

/** Depois dos 2 anos, o acompanhamento passa a ser anual. */
export const RITMO_APOS_DOIS_ANOS = 'Anual'

/* ------------------------------ triagens ------------------------------ */

export interface TriagemNeonatal {
  id: string
  nome: string
  popular: string
  janela: string
  detecta: string
}

export const TRIAGENS_NEONATAIS: TriagemNeonatal[] = [
  {
    id: 'pezinho',
    nome: 'Triagem neonatal biológica',
    popular: 'Teste do pezinho',
    janela: 'Entre 3 e 5 dias de vida',
    detecta: 'Hipotireoidismo congênito, fenilcetonúria, fibrose cística, anemia falciforme e outras.',
  },
  {
    id: 'orelhinha',
    nome: 'Triagem auditiva neonatal',
    popular: 'Teste da orelhinha',
    janela: 'Ainda na maternidade, até 1 mês',
    detecta: 'Perda auditiva — quanto antes detectada, melhor o desenvolvimento da linguagem.',
  },
  {
    id: 'olhinho',
    nome: 'Teste do reflexo vermelho',
    popular: 'Teste do olhinho',
    janela: 'Na maternidade e repetido nas consultas do 1º ano',
    detecta: 'Catarata congênita, glaucoma e retinoblastoma.',
  },
  {
    id: 'coracaozinho',
    nome: 'Triagem para cardiopatia congênita crítica',
    popular: 'Teste do coraçãozinho',
    janela: 'Entre 24 e 48 horas de vida',
    detecta: 'Cardiopatias congênitas críticas, pela oximetria de pulso.',
  },
  {
    id: 'linguinha',
    nome: 'Avaliação do frênulo lingual',
    popular: 'Teste da linguinha',
    janela: 'Na maternidade',
    detecta: 'Anquiloglossia, que pode dificultar a pega na amamentação.',
  },
]

/* --------------------------- suplementação --------------------------- */

export interface Suplemento {
  id: string
  nome: string
  dose: string
  periodo: string
  porque: string
}

export const SUPLEMENTACAO_INFANTIL: Suplemento[] = [
  {
    id: 'vitamina-d',
    nome: 'Vitamina D',
    dose: '400 UI/dia',
    periodo: 'Da primeira semana aos 12 meses',
    porque: 'Prevenção de raquitismo; o leite materno sozinho não supre a necessidade.',
  },
  {
    id: 'vitamina-d-2',
    nome: 'Vitamina D',
    dose: '600 UI/dia',
    periodo: 'Dos 12 aos 24 meses',
    porque: 'Manutenção durante o crescimento rápido.',
  },
  {
    id: 'ferro',
    nome: 'Ferro profilático',
    dose: '1 mg/kg/dia',
    periodo: 'Dos 3 aos 24 meses (antes, se prematuro ou baixo peso)',
    porque: 'Prevenção de anemia ferropriva, a carência nutricional mais comum na infância.',
  },
]

/* --------------------------- roteiro da consulta --------------------------- */

export const ROTEIRO_PEDIATRICO: BlocoChecklist[] = [
  {
    id: 'antropometria',
    titulo: 'Antropometria',
    itens: [
      { id: 'peso', titulo: 'Peso', detalhe: 'Em gramas, com o percentil e o escore-z para a idade.' },
      {
        id: 'comprimento',
        titulo: 'Comprimento / estatura',
        detalhe: 'Em centímetros, deitado até 2 anos e em pé depois.',
      },
      {
        id: 'perimetro-cefalico',
        titulo: 'Perímetro cefálico',
        detalhe: 'Em centímetros, com o percentil — desvios podem indicar micro ou macrocefalia.',
        exigeExplicacao: true,
        ateSemana: 9999,
      },
      { id: 'imc', titulo: 'IMC', detalhe: 'Calculado e comparado à curva da OMS.' },
    ],
  },
  {
    id: 'alimentacao',
    titulo: 'Alimentação',
    itens: [
      {
        id: 'aleitamento',
        titulo: 'Aleitamento',
        detalhe: 'Exclusivo até 6 meses; complementado até 2 anos ou mais. Avaliar pega e dificuldades.',
      },
      {
        id: 'introducao-alimentar',
        titulo: 'Introdução alimentar',
        detalhe: 'A partir de 6 meses, com alimentos in natura e sem açúcar até os 2 anos.',
      },
      {
        id: 'suplementacao-infantil',
        titulo: 'Suplementação',
        detalhe: 'Vitamina D desde a primeira semana e ferro profilático a partir dos 3 meses.',
      },
    ],
  },
  {
    id: 'desenvolvimento',
    titulo: 'Desenvolvimento',
    itens: [
      {
        id: 'marcos',
        titulo: 'Marcos do desenvolvimento',
        detalhe: 'Comparar com a faixa esperada para a idade; atraso persistente merece investigação.',
        exigeExplicacao: true,
      },
      { id: 'triagens', titulo: 'Triagens neonatais', detalhe: 'Conferir pezinho, orelhinha, olhinho, coraçãozinho e linguinha.' },
      { id: 'vacinas-crianca', titulo: 'Vacinas', detalhe: 'Conferir a caderneta e atualizar o que estiver pendente.' },
    ],
  },
  {
    id: 'orientacoes',
    titulo: 'Orientações',
    itens: [
      { id: 'sono-seguro', titulo: 'Sono seguro', detalhe: 'De barriga para cima, no próprio berço, sem objetos soltos.' },
      { id: 'prevencao-acidentes', titulo: 'Prevenção de acidentes', detalhe: 'Adequada à fase motora da criança.' },
      { id: 'saude-bucal-infantil', titulo: 'Saúde bucal', detalhe: 'Higiene desde o primeiro dente, com creme dental fluoretado.' },
      { id: 'proxima-puericultura', titulo: 'Próxima consulta', detalhe: 'Agendar conforme o calendário de puericultura.' },
    ],
  },
]

/** A próxima consulta de puericultura a partir da idade em meses. */
export function proximaPuericultura(idadeMeses: number): ConsultaPuericultura | null {
  return CONSULTAS_PUERICULTURA.find((c) => c.idadeMeses > idadeMeses) ?? null
}
