import { CalendarDays, Lock, RefreshCw, UtensilsCrossed } from 'lucide-react'
import { doDia, faixaInvalida } from './semana'
import type { FaixaSemanal, SemanaConfig } from './semana'

/**
 * O vocabulário da semana — os sete dias, as quatro perguntas, e como cada
 * célula se resume em uma linha.
 *
 * Mora fora dos componentes porque a grade do desktop, a lista do celular e a
 * folha de edição mostram **a mesma semana** em três formatos. Se cada uma
 * tivesse a própria tabela de rótulos, bastaria renomear "Bloqueios" num lugar
 * para a médica ler dois nomes para a mesma coisa em duas telas.
 */

export const DIAS = [
  { n: 1, curto: 'SEG', longo: 'Segunda-feira' },
  { n: 2, curto: 'TER', longo: 'Terça-feira' },
  { n: 3, curto: 'QUA', longo: 'Quarta-feira' },
  { n: 4, curto: 'QUI', longo: 'Quinta-feira' },
  { n: 5, curto: 'SEX', longo: 'Sexta-feira' },
  { n: 6, curto: 'SÁB', longo: 'Sábado' },
  { n: 0, curto: 'DOM', longo: 'Domingo' },
] as const

export type Dia = (typeof DIAS)[number]

/** As quatro listas de faixas que compõem um dia. */
export type ListaFaixa = 'periodos' | 'intervalos' | 'bloqueios' | 'reposicoes'

/** O que a maioria dos consultórios usa. Ponto de partida, não regra. */
export const PERIODO_PADRAO = { inicio: '08:00', fim: '18:00' }
const INTERVALO_PADRAO = { inicio: '12:00', fim: '13:00' }
const BLOQUEIO_PADRAO = { inicio: '16:00', fim: '16:20' }
const REPOSICAO_PADRAO = { inicio: '19:00', fim: '19:30' }

export interface Linha {
  id: ListaFaixa
  titulo: string
  /** Segunda linha do rótulo — o exemplo que dispensa a explicação. */
  detalhe?: string
  /** Uma frase, dentro da folha, sobre o que esta lista faz com a agenda. */
  ajuda: string
  icone: typeof CalendarDays
  padrao: { inicio: string; fim: string }
  textoAdicionar: string
  /** O que a célula diz quando o dia está ligado e a lista está vazia. */
  vazio: { principal: string; secundario: string }
  /** "+2 intervalos" — o resto que não coube na primeira linha. */
  extras: (n: number) => string
}

export const LINHAS: Linha[] = [
  {
    id: 'periodos',
    titulo: 'Período de atendimento',
    detalhe: 'quando você atende',
    ajuda: 'É daqui que saem os horários que suas pacientes veem para marcar.',
    icone: CalendarDays,
    padrao: PERIODO_PADRAO,
    textoAdicionar: 'Adicionar período',
    vazio: { principal: 'Sem período', secundario: 'Defina o horário' },
    extras: (n) => `+${n} período${n > 1 ? 's' : ''}`,
  },
  {
    id: 'intervalos',
    titulo: 'Intervalos',
    detalhe: 'almoço, pausas',
    ajuda: 'Pausas dentro do período. Fecham horário sem encurtar o seu dia.',
    icone: UtensilsCrossed,
    padrao: INTERVALO_PADRAO,
    textoAdicionar: 'Adicionar intervalo',
    vazio: { principal: 'Sem pausa', secundario: 'Dia corrido' },
    extras: (n) => `+${n} intervalo${n > 1 ? 's' : ''}`,
  },
  {
    id: 'bloqueios',
    titulo: 'Bloqueios',
    detalhe: 'compromissos fixos',
    ajuda: 'O que volta toda semana: a reunião de segunda, a manhã de cirurgia.',
    icone: Lock,
    padrao: BLOQUEIO_PADRAO,
    textoAdicionar: 'Adicionar bloqueio',
    vazio: { principal: 'Nenhum', secundario: '0 bloqueios' },
    extras: (n) => `+${n} bloqueio${n > 1 ? 's' : ''}`,
  },
  {
    id: 'reposicoes',
    titulo: 'Intervalos de reposição',
    detalhe: 'janelas extras',
    ajuda: 'O contrário dos outros: horários fora do período, para remarcar quem perdeu a consulta.',
    icone: RefreshCw,
    padrao: REPOSICAO_PADRAO,
    textoAdicionar: 'Adicionar janela',
    vazio: { principal: 'Nenhuma', secundario: 'Sem reposição' },
    extras: (n) => `+${n} janela${n > 1 ? 's' : ''}`,
  },
]

export type Tom = 'ok' | 'mute' | 'warn'

export interface Resumo {
  principal: string
  secundario: string
  tom: Tom
}

/** Meia-risca, não hífen: é um intervalo, e o hífen já é o separador da hora. */
export function faixaLegivel(f: FaixaSemanal): string {
  return `${f.inicio} – ${f.fim}`
}

/**
 * Uma célula da grade em duas linhas: o valor e o estado.
 *
 * A grade antiga mostrava campos de hora editáveis nas 28 células ao mesmo
 * tempo. Ler a própria semana virava ler 56 caixinhas — e a pergunta que se faz
 * de verdade ("a quarta está como a terça?") não tinha resposta visual. Aqui a
 * célula **diz** o que está configurado; editar é um clique adiante.
 */
export function resumoCelula(faixas: FaixaSemanal[], linha: Linha): Resumo {
  if (faixas.length === 0) return { ...linha.vazio, tom: 'mute' }
  if (faixas.some(faixaInvalida)) {
    return { principal: faixaLegivel(faixas[0]), secundario: 'Horário inválido', tom: 'warn' }
  }
  return {
    principal: faixaLegivel(faixas[0]),
    secundario: faixas.length > 1 ? linha.extras(faixas.length - 1) : 'Ativo',
    tom: 'ok',
  }
}

/**
 * O dia inteiro em uma linha — "08:00 – 18:00 · 1 pausa".
 *
 * É o que o cartão do celular mostra no lugar da grade: sete colunas espremidas
 * num telefone devolveriam o formulário sequencial que esta tela veio substituir.
 */
export function resumoDia(valor: SemanaConfig, dia: number): string {
  const periodos = doDia(valor.periodos, dia)
  if (periodos.length === 0) return 'Sem atendimento'

  const partes = [periodos.map(faixaLegivel).join(' · ')]
  const contagens: [ListaFaixa, string, string][] = [
    ['intervalos', 'pausa', 'pausas'],
    ['bloqueios', 'bloqueio', 'bloqueios'],
    ['reposicoes', 'reposição', 'reposições'],
  ]
  for (const [lista, singular, plural] of contagens) {
    const n = doDia(valor[lista], dia).length
    if (n > 0) partes.push(`${n} ${n === 1 ? singular : plural}`)
  }
  return partes.join(' · ')
}
