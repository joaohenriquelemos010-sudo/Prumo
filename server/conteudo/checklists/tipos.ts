/**
 * A forma do conteúdo de checklist antes de virar documento no banco.
 *
 * É um tipo próprio, e não o do Mongoose, para que escrever conteúdo seja
 * escrever conteúdo: sem `_id`, sem `default`, sem nada de persistência. O seed
 * traduz para o schema.
 */

export interface PassoSemente {
  id: string
  titulo: string
  explicacaoLeiga?: string
  dica?: string
  /** Não conta no progresso — nem toda gestante precisa. */
  opcional?: boolean
}

export interface GrupoSemente {
  id: string
  titulo: string
  resumo?: string
  icone?: string
  /** Obrigatória: um grupo sem explicação em linguagem leiga não entra. */
  explicacaoLeiga: string
  porqueImporta?: string
  fonte?: string
  janela?: {
    desdeSemana?: number
    ateSemana?: number
    desdeMes?: number
    ateMes?: number
  }
  /** Lido pela fase de lembretes. Nada é enviado ainda. */
  lembrete?: {
    antecedenciaDias?: number
    canal?: 'email' | 'inapp'
    repetirDias?: number
  }
  /** Exatamente um nível abaixo. Passos não têm filhos. */
  passos: PassoSemente[]
}

export interface TemplateSemente {
  chave: string
  versao: number
  programa: string
  publico: 'gestante' | 'familia' | 'medico'
  fase?: string
  titulo: string
  descricao?: string
  icone?: string
  grupos: GrupoSemente[]
}
