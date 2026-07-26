import type { Convenio } from '@/lib/stores/perfil'

/**
 * Coverage guidance for the routine items the app already schedules.
 *
 * Two public systems answer this question in Brazil and they answer it
 * differently: the SUS covers the whole low-risk prenatal protocol and the PNI
 * vaccine calendar at no cost, while private plans owe whatever sits in the ANS
 * Rol de Procedimentos. Both are stable enough to state plainly.
 *
 * This is orientation, never a guarantee — coverage varies by contract, carência
 * and region, and the UI says so next to every chip. It exists so nobody
 * discovers at the counter that they should have asked first.
 */

export type ItemCoberto = 'exame-prenatal' | 'consulta-prenatal' | 'vacina' | 'consulta-pediatrica'

export type NivelCobertura = 'coberto' | 'confirmar' | 'particular'

export interface Cobertura {
  nivel: NivelCobertura
  rotulo: string
  detalhe: string
}

const PELO_SUS: Record<ItemCoberto, Cobertura> = {
  'exame-prenatal': {
    nivel: 'coberto',
    rotulo: 'Coberto pelo SUS',
    detalhe: 'Exames do pré-natal de baixo risco são oferecidos pela rede pública, sem custo.',
  },
  'consulta-prenatal': {
    nivel: 'coberto',
    rotulo: 'Coberto pelo SUS',
    detalhe: 'O pré-natal completo é garantido na atenção básica, sem custo.',
  },
  vacina: {
    nivel: 'coberto',
    rotulo: 'Gratuita no SUS',
    detalhe: 'As vacinas do calendário nacional são gratuitas nas unidades básicas de saúde.',
  },
  'consulta-pediatrica': {
    nivel: 'coberto',
    rotulo: 'Coberto pelo SUS',
    detalhe: 'O acompanhamento de puericultura é garantido na atenção básica.',
  },
}

const POR_CONVENIO: Record<ItemCoberto, Cobertura> = {
  'exame-prenatal': {
    nivel: 'confirmar',
    rotulo: 'Cobertura ANS',
    detalhe:
      'Os exames de rotina do pré-natal constam do Rol da ANS. Confirme carência e rede credenciada com sua operadora.',
  },
  'consulta-prenatal': {
    nivel: 'confirmar',
    rotulo: 'Cobertura ANS',
    detalhe:
      'Consultas obstétricas constam do Rol da ANS. Confirme carência e rede credenciada com sua operadora.',
  },
  vacina: {
    nivel: 'particular',
    rotulo: 'Gratuita no SUS',
    detalhe:
      'Planos em geral não cobrem vacinas de rotina — mas elas são gratuitas na rede pública.',
  },
  'consulta-pediatrica': {
    nivel: 'confirmar',
    rotulo: 'Cobertura ANS',
    detalhe: 'Consultas pediátricas constam do Rol da ANS. Confirme a rede credenciada.',
  },
}

const PARTICULAR: Record<ItemCoberto, Cobertura> = {
  'exame-prenatal': {
    nivel: 'particular',
    rotulo: 'Particular ou SUS',
    detalhe: 'Sem plano, esses exames são gratuitos na rede pública ou pagos na rede privada.',
  },
  'consulta-prenatal': {
    nivel: 'particular',
    rotulo: 'Particular ou SUS',
    detalhe: 'O pré-natal completo é gratuito na atenção básica.',
  },
  vacina: {
    nivel: 'particular',
    rotulo: 'Gratuita no SUS',
    detalhe: 'As vacinas do calendário nacional são gratuitas nas unidades básicas de saúde.',
  },
  'consulta-pediatrica': {
    nivel: 'particular',
    rotulo: 'Particular ou SUS',
    detalhe: 'A puericultura é gratuita na atenção básica.',
  },
}

/** Coverage for an item, given the journey's plan (or none yet). */
export function coberturaDe(item: ItemCoberto, convenio: Convenio | null): Cobertura {
  if (!convenio) return PARTICULAR[item]
  if (convenio.tipo === 'sus') return PELO_SUS[item]
  if (convenio.tipo === 'convenio') return POR_CONVENIO[item]
  return PARTICULAR[item]
}

export const AVISO_COBERTURA =
  'Orientação informativa. A cobertura muda conforme contrato, carência e região — confirme com sua operadora ou unidade de saúde.'
