/**
 * Espelho cliente do descritor de programa (ver server/programas/).
 *
 * Duplicado de propósito, e não compartilhado por uma pasta comum: o split entre
 * `tsconfig.app` e `tsconfig.server`, mais os sufixos `.js` que o ESM do servidor
 * exige nos imports relativos, tornam o compartilhamento mais caro do que copiar
 * ~100 linhas de dado puro. O que protege contra divergência não é a estrutura —
 * é o teste em `programas.test.ts`, que falha se os dois registros deixarem de
 * ter as mesmas chaves.
 *
 * O cliente só precisa da parte que vira interface: vocabulário, fases e quais
 * conteúdos carregar. Ele não replica os predicados clínicos.
 */

export interface VocabularioPrograma {
  paciente: string
  jornada: string
  unidadeTempo: 'semana' | 'mes' | 'sessao' | 'consulta'
  iniciarAtendimento: string
}

export interface FasePrograma {
  id: string
  rotulo: string
}

export interface Programa {
  id: string
  rotulo: string
  especialidades: string[]
  vocabulario: VocabularioPrograma
  fases: FasePrograma[]
  templatesProntuario: string[]
  templatesChecklist: string[]
  medidas: string[]
  curvas: 'fetal-hadlock' | 'oms-infantil' | null
  painel: string[]
}

export const maternoInfantil: Programa = {
  id: 'materno-infantil',
  rotulo: 'Materno-infantil',
  especialidades: ['obstetricia', 'ginecologia', 'pediatria'],
  vocabulario: {
    paciente: 'gestante',
    jornada: 'jornada',
    unidadeTempo: 'semana',
    iniciarAtendimento: 'Iniciar atendimento',
  },
  fases: [
    { id: 'planejando', rotulo: 'Planejando' },
    { id: 'gestacao', rotulo: 'Gestação' },
    { id: 'pos-natal', rotulo: 'Primeiro ano' },
  ],
  templatesProntuario: ['soap-generico', 'pre-natal-v1', 'puericultura-v1'],
  templatesChecklist: ['gestante-completo', 'puericultura-completo'],
  medidas: [
    'pesoKg',
    'alturaCm',
    'imc',
    'paSistolica',
    'paDiastolica',
    'alturaUterinaCm',
    'bcfBpm',
    'pesoG',
    'comprimentoCm',
    'perimetroCefalicoCm',
  ],
  curvas: 'fetal-hadlock',
  painel: ['proximos-atendimentos', 'precisa-de-voce', 'alertas', 'duvidas'],
}

export const REGISTRO: Record<string, Programa> = {
  [maternoInfantil.id]: maternoInfantil,
}

export const PROGRAMA_PADRAO = maternoInfantil.id

/** Sempre devolve um programa — id desconhecido cai no padrão em vez de quebrar. */
export function programaPorId(id?: string | null): Programa {
  return REGISTRO[id ?? ''] ?? REGISTRO[PROGRAMA_PADRAO]!
}
