/**
 * Pré-natal — o que a obstetra registra a cada consulta, e em que ritmo.
 *
 * Fonte: Ministério da Saúde (Caderno de Atenção Básica nº 32 e Caderneta da
 * Gestante) e FEBRASGO (Manual de Assistência Pré-natal).
 *
 * Os exames por trimestre já vivem em `sus-exames.ts`, as vacinas da gestação em
 * `sus-vacinas.ts` e a suplementação em `sus-suplementos.ts` — este módulo é o
 * roteiro da consulta em si, que faltava: o que medir, o que perguntar, o que
 * combinar. É o que alimenta o checklist do prontuário.
 */

export const REFERENCIA_PRENATAL_CONSULTA =
  'Ministério da Saúde — Caderno de Atenção Básica nº 32 e Caderneta da Gestante; FEBRASGO — Manual de Assistência Pré-natal.'

/* ------------------------------ ritmo ------------------------------ */

export interface JanelaConsulta {
  ate: number
  intervalo: string
}

/**
 * Ritmo mínimo recomendado. Seis consultas é o piso do Ministério da Saúde;
 * o intervalo aperta conforme a gestação avança porque é quando as
 * intercorrências aparecem mais depressa.
 */
export const RITMO_CONSULTAS: JanelaConsulta[] = [
  { ate: 28, intervalo: 'Mensal' },
  { ate: 36, intervalo: 'Quinzenal' },
  { ate: 42, intervalo: 'Semanal' },
]

export const MINIMO_CONSULTAS = 6

export function intervaloRecomendado(semanas: number): string {
  return RITMO_CONSULTAS.find((j) => semanas <= j.ate)?.intervalo ?? 'Semanal'
}

/* --------------------------- roteiro da consulta --------------------------- */

export interface ItemChecklist {
  id: string
  titulo: string
  /** O que registrar, em uma linha. */
  detalhe: string
  /**
   * `true` quando o achado é técnico e assusta sem contexto. Não esconde nada da
   * família — só marca o que a médica deve explicar em vez de deixar como número
   * solto no prontuário.
   */
  exigeExplicacao?: boolean
  /** Só aparece a partir desta semana. */
  desdeSemana?: number
  /** Só aparece até esta semana. */
  ateSemana?: number
}

export interface BlocoChecklist {
  id: string
  titulo: string
  itens: ItemChecklist[]
}

export const ROTEIRO_PRENATAL: BlocoChecklist[] = [
  {
    id: 'identificacao',
    titulo: 'Idade gestacional',
    itens: [
      {
        id: 'ig-dum',
        titulo: 'IG pela DUM',
        detalhe: 'Data da última menstruação e idade gestacional em semanas e dias.',
      },
      {
        id: 'ig-usg',
        titulo: 'IG pela ultrassonografia',
        detalhe: 'USG do 1º trimestre é o parâmetro mais confiável; redatar quando divergir da DUM.',
        ateSemana: 22,
      },
      {
        id: 'dpp',
        titulo: 'Data provável do parto',
        detalhe: 'Confirmar a DPP e registrar qualquer redatação.',
      },
    ],
  },
  {
    id: 'materno',
    titulo: 'Avaliação materna',
    itens: [
      {
        id: 'pressao',
        titulo: 'Pressão arterial',
        detalhe: 'PA em mmHg. ≥140/90 exige investigação de pré-eclâmpsia.',
      },
      {
        id: 'peso-imc',
        titulo: 'Peso e ganho ponderal',
        detalhe: 'Peso atual, IMC pré-gestacional e ganho acumulado versus a curva esperada.',
      },
      {
        id: 'edema',
        titulo: 'Edema',
        detalhe: 'Presença, localização e evolução.',
      },
      {
        id: 'queixas',
        titulo: 'Queixas do período',
        detalhe: 'Náuseas, azia, dor lombar, corrimento, sintomas urinários, sono, humor.',
      },
      {
        id: 'sinais-alerta',
        titulo: 'Sinais de alerta revisados',
        detalhe: 'Sangramento, perda de líquido, dor abdominal intensa, cefaleia, alteração visual, febre.',
      },
    ],
  },
  {
    id: 'fetal',
    titulo: 'Avaliação fetal',
    itens: [
      {
        id: 'altura-uterina',
        titulo: 'Altura uterina',
        detalhe: 'Em centímetros, comparada com a curva para a idade gestacional.',
        desdeSemana: 12,
      },
      {
        id: 'bcf',
        titulo: 'Batimentos cardíacos fetais',
        detalhe: 'BCF em bpm — normal entre 110 e 160.',
        desdeSemana: 10,
      },
      {
        id: 'movimentacao',
        titulo: 'Movimentação fetal',
        detalhe: 'Percepção materna e padrão habitual.',
        desdeSemana: 20,
      },
      {
        id: 'apresentacao',
        titulo: 'Apresentação',
        detalhe: 'Cefálica, pélvica ou córmica — relevante a partir de 36 semanas.',
        desdeSemana: 34,
      },
      {
        id: 'biometria',
        titulo: 'Biometria fetal',
        detalhe: 'DBP, CC, CA, CF e peso fetal estimado, com o percentil correspondente.',
        exigeExplicacao: true,
        desdeSemana: 12,
      },
    ],
  },
  {
    id: 'conduta',
    titulo: 'Conduta e combinados',
    itens: [
      {
        id: 'exames-trimestre',
        titulo: 'Exames do trimestre',
        detalhe: 'Solicitar e revisar os exames da janela atual.',
      },
      {
        id: 'suplementacao',
        titulo: 'Suplementação',
        detalhe: 'Ácido fólico e sulfato ferroso conforme a fase e o hemograma.',
      },
      {
        id: 'vacinas-gestante',
        titulo: 'Vacinas',
        detalhe: 'dTpa a partir de 20 semanas, influenza na campanha, hepatite B se esquema incompleto.',
      },
      {
        id: 'plano-de-parto',
        titulo: 'Plano de parto',
        detalhe: 'Conversar sobre preferências, local do parto e rede de apoio.',
        desdeSemana: 28,
      },
      {
        id: 'aleitamento',
        titulo: 'Preparo para o aleitamento',
        detalhe: 'Orientação sobre amamentação e avaliação das mamas.',
        desdeSemana: 28,
      },
      {
        id: 'proxima-consulta',
        titulo: 'Próxima consulta',
        detalhe: 'Agendar conforme o ritmo recomendado para a idade gestacional.',
      },
    ],
  },
]

/** O roteiro filtrado para a idade gestacional da consulta. */
export function roteiroParaSemana(semanas: number): BlocoChecklist[] {
  return ROTEIRO_PRENATAL.map((bloco) => ({
    ...bloco,
    itens: bloco.itens.filter(
      (i) => (i.desdeSemana ?? 0) <= semanas && semanas <= (i.ateSemana ?? 99),
    ),
  })).filter((bloco) => bloco.itens.length > 0)
}

/* ----------------------------- sinais de alerta ---------------------------- */

export const SINAIS_DE_ALERTA = [
  'Sangramento vaginal',
  'Perda de líquido pela vagina',
  'Dor abdominal forte ou contrações antes de 37 semanas',
  'Dor de cabeça forte e persistente, com alteração visual',
  'Febre',
  'Redução ou ausência dos movimentos do bebê',
  'Inchaço súbito no rosto e nas mãos',
  'Vômitos que impedem se alimentar',
]
