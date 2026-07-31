import type { PontoInfantil, CurvasInfantis } from '@/features/bebe/CrescimentoInfantil'

/**
 * O contrato de `GET /api/bebe`, num lugar só.
 *
 * Estava dentro da página, que também importava dela — `RegistrarMedidas`
 * puxava `MedidaFetal` de `@/pages/app/AppBebe`, um componente de feature
 * dependendo de uma página. Com a página quebrada em partes isso viraria um
 * ciclo; aqui não tem para onde ciclar, porque este arquivo não importa
 * nenhuma delas.
 */

export type Fase = 'planejando' | 'gestacao' | 'pos-natal'

export interface MedidaFetal {
  id: string
  semana: number
  data: string
  autorNome: string
  dbpMm: number | null
  ccMm: number | null
  caMm: number | null
  cfMm: number | null
  pfeG: number | null
  ilaCm: number | null
  apresentacao: string
  placenta: string
  observacao: string
  /** Leitura clínica: só chega para a equipe. */
  percentis?: Record<string, number | null>
  notasPrivadas?: string
}

/** Um batimento por consulta. `bcfBpm` já era coletado e não tinha para onde ir. */
export interface PontoBatimento {
  semana: number
  data: string
  bpm: number
  autorNome: string
}

export interface Checkin {
  periodo: number
  fase: Fase | 'gestacao' | 'pos-natal'
  em: string
  notaFamilia: string
}

export interface RespostaBebe {
  fase: Fase
  idadeMeses: number | null
  medidas: MedidaFetal[]
  curva: { semana: number; faixa: { p3: number; p10: number; p50: number; p90: number; p97: number } }[]
  medidasInfantis: PontoInfantil[]
  curvasInfantis: CurvasInfantis | null
  batimentos: PontoBatimento[]
  checkins: Checkin[]
}

export interface PerfilJornada {
  nome: string
  dpp: string | null
  dataNascimento: string | null
}

/** Um exame, como a lista de anexos precisa dele. */
export interface ExameResumo {
  id: string
  nome: string
  categoria: string
  dataExame: string
  temArquivo: boolean
  arquivoNome: string
  mimeType: string
}

/**
 * A faixa em que o coração do bebê costuma bater.
 *
 * Viaja com o número de propósito. "142 bpm" sozinho é um dado que a pessoa vai
 * pesquisar no Google às duas da manhã; "142 bpm, e o normal é entre 110 e 160"
 * é a mesma informação chegando tranquila.
 */
export const BPM_NORMAL = { min: 110, max: 160 } as const
