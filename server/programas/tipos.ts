/**
 * Programa — o descritor que diz ao Prumo que tipo de cuidado uma jornada é.
 *
 * É **dado puro**, deliberadamente: nunca uma hierarquia de classes, nunca um
 * carregador de plugins. Adicionar cardiologia em 2027 tem que ser um arquivo
 * novo neste diretório mais um arquivo de conteúdo — zero mudança de model, zero
 * migração de collection.
 *
 * Hoje existe um único programa (`materno-infantil`) e ele descreve exatamente o
 * produto que já está no ar. O valor não é a generalidade agora; é que a
 * generalidade depois custa um arquivo em vez de uma refatoração.
 */

/** Como o programa fala com quem está na tela. Alimenta rótulos de navegação e cabeçalhos. */
export interface VocabularioPrograma {
  /** "gestante", "paciente", "atleta"… */
  paciente: string
  /** "jornada", "gestação", "tratamento"… */
  jornada: string
  /** A régua temporal natural do programa — dirige o seletor de granularidade. */
  unidadeTempo: 'semana' | 'mes' | 'sessao' | 'consulta'
  /** O CTA primário do médico. "Iniciar atendimento" por padrão. */
  iniciarAtendimento: string
}

export interface FasePrograma {
  id: string
  rotulo: string
  /**
   * Predicado sobre a jornada. Recebe o documento já hidratado; mantido frouxo
   * de propósito para que um programa novo possa olhar campos que o
   * materno-infantil não usa.
   */
  ativaQuando: (jornada: Record<string, unknown>) => boolean
}

export interface Programa {
  id: string
  rotulo: string
  /** Especialidades do CFM que atendem por este programa. */
  especialidades: string[]
  vocabulario: VocabularioPrograma
  fases: FasePrograma[]
  /** Chaves em server/conteudo/prontuario-templates. */
  templatesProntuario: string[]
  /** Chaves em server/conteudo/checklists. */
  templatesChecklist: string[]
  /** Quais campos de `Consulta.medidas` fazem sentido aqui. */
  medidas: string[]
  /** Qual motor de curva usar, se algum. */
  curvas: 'fetal-hadlock' | 'oms-infantil' | null
  /** Ids dos widgets do painel do médico, na ordem. */
  painel: string[]
}
