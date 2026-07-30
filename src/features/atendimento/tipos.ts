export type TipoConsulta = 'pre-concepcional' | 'pre-natal' | 'pediatrica'
export type CampoSOAP = 'subjetivo' | 'objetivo' | 'avaliacao' | 'plano'

export interface Medidas {
  pesoKg?: number | null
  alturaCm?: number | null
  imc?: number | null
  paSistolica?: number | null
  paDiastolica?: number | null
  alturaUterinaCm?: number | null
  bcfBpm?: number | null
  pesoG?: number | null
  comprimentoCm?: number | null
  perimetroCefalicoCm?: number | null
}

export interface ItemChecklist {
  id: string
  feito: boolean
  observacao?: string
}

export interface Consulta {
  id: string
  autorId: string
  autorNome: string
  data: string
  tipo: TipoConsulta
  subjetivo: string
  objetivo: string
  avaliacao: string
  avaliacaoOculta?: boolean
  avaliacaoPrivada?: boolean
  plano: string
  notasPrivadas?: string
  resumoParaFamilia?: string
  resumoEnviadoEm?: string | null
  igSemanas: number | null
  igDias: number | null
  medidas: Medidas
  checklist: ItemChecklist[]
  status: 'rascunho' | 'finalizada'
  iniciadaEm: string | null
  finalizadaEm: string | null
  duracaoSegundos: number | null
}

export interface AlertaAberto {
  id: string
  severidade: 'info' | 'atencao' | 'urgente'
  titulo: string
  detalhe: string
  condutaSugerida: string
}

export interface PacienteDoAtendimento {
  id: string
  nome: string
  momento: 'planejando' | 'gestante' | 'ja-nasceu'
  programa: string
  dpp: string | null
  dataNascimento: string | null
}

export interface ProntuarioResumo {
  tipoSanguineo?: string
  alergias?: string
  resumoGestacional?: string
  condicoes?: string[]
  eventos?: { id: string; data: string; autorNome?: string; texto: string }[]
}

/** Tudo que o cockpit precisa, numa resposta só. */
export interface Cockpit {
  consulta: Consulta
  agendamento: {
    id: string
    inicio: string
    duracaoMin: number
    modalidade: 'teleconsulta' | 'presencial' | 'domiciliar'
    objetivo: string
    local: string
    status: string
  }
  paciente: PacienteDoAtendimento
  prontuario: ProntuarioResumo | null
  consultasAnteriores: Consulta[]
  medidasFetais: { semana: number; pfeG: number | null; percentis: Record<string, number> }[]
  alertas: AlertaAberto[]
  duvidas: { id: string; texto: string }[]
}
