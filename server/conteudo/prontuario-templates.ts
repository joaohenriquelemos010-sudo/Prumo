/**
 * Os formulários de prontuário — o que a médica de fato preenche, por tipo de
 * consulta.
 *
 * ## Por que isto existe
 *
 * Até aqui a primeira consulta e a décima segunda mostravam os mesmos quatro
 * campos SOAP. Mas não é assim que consultório funciona: na primeira você
 * pergunta tudo — antecedentes, gestações anteriores, cirurgias, história
 * familiar — e da segunda em diante você **não pergunta de novo**, você olha o
 * que já respondeu e registra o que mudou.
 *
 * Repetir a anamnese a cada retorno não é só desperdício de tempo. É o que faz
 * o médico parar de preencher — e um prontuário preenchido pela metade vale
 * menos que um caderno.
 *
 * ## A forma
 *
 * Conteúdo puro, sem lógica. Um template é `{chave, versao, secoes[campos]}`, e
 * `versao` é o que garante que editar este arquivo **nunca** reescreve o que uma
 * paciente já respondeu: a consulta guarda a versão que ela viu.
 *
 * `natureza` é o que liga a peça ao mapa do fluxo:
 *  - `primeira` — a anamnese completa, uma vez por jornada;
 *  - `retorno`  — o acompanhamento, que herda as respostas da primeira;
 *  - `generico` — quando não se sabe (ou não importa) qual das duas é.
 *
 * ## Sobre o conteúdo clínico
 *
 * Os campos seguem o que o Ministério da Saúde e a FEBRASGO/SBP pedem no
 * pré-natal e na puericultura — G/P/A, DUM, tipagem, altura uterina, BCF,
 * marcos do desenvolvimento. Não é um formulário genérico com rótulo de
 * obstetrícia: é a consulta que essas especialidades realmente fazem.
 */

export type TipoCampo =
  | 'texto'
  | 'texto-longo'
  | 'numero'
  | 'data'
  | 'selecao'
  | 'booleano'

export interface Campo {
  id: string
  rotulo: string
  tipo: TipoCampo
  unidade?: string
  opcoes?: string[]
  dica?: string
  /**
   * Campos que descrevem fatos que não mudam (tipo sanguíneo, menarca, cirurgia
   * prévia). São os que o retorno mostra em vez de perguntar.
   */
  permanente?: boolean
}

export interface Secao {
  id: string
  rotulo: string
  /** Uma linha explicando para que serve — aparece pequena, abaixo do título. */
  resumo?: string
  campos: Campo[]
}

export interface ProntuarioTemplate {
  chave: string
  versao: number
  programa: string
  rotulo: string
  natureza: 'primeira' | 'retorno' | 'generico'
  /** Uma frase dizendo quando usar este formulário. */
  quando: string
  secoes: Secao[]
}

const SIM_NAO = ['Sim', 'Não', 'Não sei']

/* ------------------------------------------------------------------ *
 * Pré-natal
 * ------------------------------------------------------------------ */

const preNatalPrimeira: ProntuarioTemplate = {
  chave: 'pre-natal-primeira',
  versao: 1,
  programa: 'materno-infantil',
  rotulo: 'Pré-natal — primeira consulta',
  natureza: 'primeira',
  quando: 'A anamnese completa da gestação. Preenchida uma vez, lida em todas as outras.',
  secoes: [
    {
      id: 'gestacao-atual',
      rotulo: 'Gestação atual',
      resumo: 'O que data a gravidez e o que já foi decidido sobre ela.',
      campos: [
        /*
         * Id próprio, e não `dum`: a DUM que **data esta gestação** é fixa até o
         * parto, enquanto a DUM ginecológica muda todo mês. Com o mesmo id, o
         * retorno de pré-natal herdaria a última menstruação registrada numa
         * consulta ginecológica de dois anos atrás e a exibiria como o marco da
         * gravidez. Um teste guarda essa regra.
         */
        { id: 'dumGestacional', rotulo: 'DUM desta gestação', tipo: 'data', permanente: true },
        {
          id: 'dppMetodo',
          rotulo: 'DPP calculada por',
          tipo: 'selecao',
          opcoes: ['DUM', 'Ultrassom 1º trimestre', 'Ultrassom 2º trimestre'],
          dica: 'O ultrassom precoce manda quando há divergência maior que 7 dias.',
          permanente: true,
        },
        { id: 'planejada', rotulo: 'Gestação planejada', tipo: 'selecao', opcoes: SIM_NAO, permanente: true },
        { id: 'acidoFolico', rotulo: 'Ácido fólico antes de engravidar', tipo: 'selecao', opcoes: SIM_NAO, permanente: true },
        { id: 'queixasIniciais', rotulo: 'Queixas', tipo: 'texto-longo' },
      ],
    },
    {
      id: 'obstetricos',
      rotulo: 'Antecedentes obstétricos',
      resumo: 'O que já aconteceu antes muda a vigilância desta gestação inteira.',
      campos: [
        { id: 'gesta', rotulo: 'Gestações (G)', tipo: 'numero', permanente: true },
        { id: 'para', rotulo: 'Partos (P)', tipo: 'numero', permanente: true },
        { id: 'abortos', rotulo: 'Abortos (A)', tipo: 'numero', permanente: true },
        { id: 'cesareas', rotulo: 'Cesáreas anteriores', tipo: 'numero', permanente: true },
        {
          id: 'intercorrenciasPrevias',
          rotulo: 'Intercorrências em gestações anteriores',
          tipo: 'texto-longo',
          dica: 'Pré-eclâmpsia, diabetes gestacional, prematuridade, óbito fetal, hemorragia.',
          permanente: true,
        },
        { id: 'menorIntervalo', rotulo: 'Intervalo desde o último parto (meses)', tipo: 'numero', permanente: true },
      ],
    },
    {
      id: 'clinicos',
      rotulo: 'Antecedentes clínicos e familiares',
      campos: [
        { id: 'tipoSanguineo', rotulo: 'Tipo sanguíneo e fator Rh', tipo: 'texto', permanente: true },
        { id: 'comorbidades', rotulo: 'Doenças prévias', tipo: 'texto-longo', dica: 'HAS, diabetes, tireoide, trombofilia, cardiopatia, epilepsia.', permanente: true },
        { id: 'cirurgias', rotulo: 'Cirurgias', tipo: 'texto-longo', permanente: true },
        { id: 'alergias', rotulo: 'Alergias', tipo: 'texto', permanente: true },
        { id: 'medicacoes', rotulo: 'Medicações em uso', tipo: 'texto-longo' },
        { id: 'familiares', rotulo: 'História familiar', tipo: 'texto-longo', dica: 'Gemelaridade, malformação, diabetes, hipertensão, pré-eclâmpsia.', permanente: true },
        { id: 'tabagismo', rotulo: 'Tabagismo, álcool ou outras substâncias', tipo: 'texto', },
        { id: 'violencia', rotulo: 'Situação de vulnerabilidade ou violência', tipo: 'texto', dica: 'Pergunta do MS no pré-natal. Registrar com cuidado — costuma ir em nota privada.' },
      ],
    },
    {
      id: 'exame-inicial',
      rotulo: 'Exame físico inicial',
      campos: [
        { id: 'pesoPreGestacional', rotulo: 'Peso antes de engravidar', tipo: 'numero', unidade: 'kg', permanente: true },
        { id: 'alturaCm', rotulo: 'Altura', tipo: 'numero', unidade: 'cm', permanente: true },
        { id: 'exameGeral', rotulo: 'Exame geral', tipo: 'texto-longo' },
        { id: 'exameGineco', rotulo: 'Exame ginecológico e mamas', tipo: 'texto-longo' },
      ],
    },
  ],
}

const preNatalRetorno: ProntuarioTemplate = {
  chave: 'pre-natal-retorno',
  versao: 1,
  programa: 'materno-infantil',
  rotulo: 'Pré-natal — retorno',
  natureza: 'retorno',
  quando: 'O acompanhamento. Não repete a anamnese — mostra o que já foi respondido.',
  secoes: [
    {
      id: 'desde-a-ultima',
      rotulo: 'Desde a última consulta',
      campos: [
        { id: 'queixas', rotulo: 'Queixas', tipo: 'texto-longo' },
        { id: 'movimentosFetais', rotulo: 'Movimentação fetal', tipo: 'selecao', opcoes: ['Presente e normal', 'Diminuída', 'Ausente', 'Ainda não percebe'] },
        { id: 'contracoes', rotulo: 'Contrações', tipo: 'selecao', opcoes: ['Ausentes', 'Esporádicas', 'Regulares'] },
        { id: 'perdas', rotulo: 'Perdas vaginais', tipo: 'selecao', opcoes: ['Ausentes', 'Corrimento', 'Sangramento', 'Líquido'] },
        {
          id: 'sinaisAlarme',
          rotulo: 'Sinais de alarme',
          tipo: 'texto',
          dica: 'Cefaleia, escotomas, epigastralgia, edema súbito — os de pré-eclâmpsia.',
        },
      ],
    },
    {
      id: 'exames',
      rotulo: 'Exames e condutas',
      campos: [
        { id: 'examesResultados', rotulo: 'Resultados desde a última consulta', tipo: 'texto-longo' },
        { id: 'examesSolicitados', rotulo: 'Exames solicitados hoje', tipo: 'texto-longo' },
        { id: 'suplementacao', rotulo: 'Suplementação', tipo: 'texto', dica: 'Ácido fólico até 12s, ferro a partir de 20s, cálcio se risco de pré-eclâmpsia.' },
        { id: 'vacinas', rotulo: 'Vacinas', tipo: 'texto', dica: 'dTpa a partir de 20s, influenza, hepatite B, COVID conforme calendário.' },
      ],
    },
  ],
}

/* ------------------------------------------------------------------ *
 * Puericultura
 * ------------------------------------------------------------------ */

const puericulturaPrimeira: ProntuarioTemplate = {
  chave: 'puericultura-primeira',
  versao: 1,
  programa: 'materno-infantil',
  rotulo: 'Puericultura — primeira consulta',
  natureza: 'primeira',
  quando: 'A anamnese do recém-nascido. Puxa o que a obstetrícia já registrou.',
  secoes: [
    {
      id: 'nascimento',
      rotulo: 'Gestação e nascimento',
      resumo: 'Se o resumo de nascimento já foi preenchido pela obstetra, confira em vez de redigitar.',
      campos: [
        { id: 'igNascimento', rotulo: 'Idade gestacional ao nascer', tipo: 'texto', unidade: 'semanas', permanente: true },
        { id: 'tipoParto', rotulo: 'Tipo de parto', tipo: 'selecao', opcoes: ['Vaginal', 'Cesárea', 'Fórceps'], permanente: true },
        { id: 'apgar', rotulo: 'Apgar 1º/5º minuto', tipo: 'texto', permanente: true },
        { id: 'intercorrenciasNeonatais', rotulo: 'Intercorrências neonatais', tipo: 'texto-longo', dica: 'UTI neonatal, icterícia, hipoglicemia, sepse.', permanente: true },
        { id: 'triagens', rotulo: 'Triagens neonatais', tipo: 'texto', dica: 'Pezinho, orelhinha, olhinho, coraçãozinho, linguinha.', permanente: true },
      ],
    },
    {
      id: 'alimentacao',
      rotulo: 'Alimentação',
      campos: [
        { id: 'aleitamento', rotulo: 'Aleitamento', tipo: 'selecao', opcoes: ['Materno exclusivo', 'Materno predominante', 'Misto', 'Fórmula'] },
        { id: 'dificuldadesMamada', rotulo: 'Dificuldades na mamada', tipo: 'texto-longo', dica: 'Pega, fissura, dor, ganho de peso.' },
      ],
    },
    {
      id: 'familia',
      rotulo: 'Família e ambiente',
      campos: [
        { id: 'antecedentesFamiliares', rotulo: 'Antecedentes familiares', tipo: 'texto-longo', permanente: true },
        { id: 'irmaos', rotulo: 'Irmãos', tipo: 'texto', permanente: true },
        { id: 'cuidadores', rotulo: 'Quem cuida no dia a dia', tipo: 'texto' },
        { id: 'ambiente', rotulo: 'Ambiente', tipo: 'texto', dica: 'Tabagismo em casa, animais, creche, saneamento.' },
      ],
    },
  ],
}

const puericulturaRetorno: ProntuarioTemplate = {
  chave: 'puericultura-retorno',
  versao: 1,
  programa: 'materno-infantil',
  rotulo: 'Puericultura — retorno',
  natureza: 'retorno',
  quando: 'Crescimento, desenvolvimento e o que mudou desde a última.',
  secoes: [
    {
      id: 'desde-a-ultima',
      rotulo: 'Desde a última consulta',
      campos: [
        { id: 'queixas', rotulo: 'Queixas', tipo: 'texto-longo' },
        { id: 'alimentacao', rotulo: 'Alimentação hoje', tipo: 'texto-longo' },
        { id: 'sono', rotulo: 'Sono', tipo: 'texto' },
        { id: 'evacuacoes', rotulo: 'Evacuações e diurese', tipo: 'texto' },
        { id: 'intercorrencias', rotulo: 'Intercorrências', tipo: 'texto-longo', dica: 'Febre, internação, uso de antibiótico.' },
      ],
    },
    {
      id: 'desenvolvimento',
      rotulo: 'Desenvolvimento',
      resumo: 'Os marcos da Caderneta da Criança para a idade.',
      campos: [
        { id: 'marcos', rotulo: 'Marcos alcançados', tipo: 'texto-longo' },
        { id: 'alertaDesenvolvimento', rotulo: 'Sinal de alerta', tipo: 'texto', dica: 'Ausência de marco esperado para a faixa etária.' },
      ],
    },
    {
      id: 'orientacoes',
      rotulo: 'Orientações',
      campos: [
        { id: 'vacinas', rotulo: 'Vacinas', tipo: 'texto' },
        { id: 'orientacoes', rotulo: 'Orientações dadas', tipo: 'texto-longo', dica: 'Sono seguro, acidentes, introdução alimentar, tela.' },
      ],
    },
  ],
}

/* ------------------------------------------------------------------ *
 * Ginecologia — o terceiro cliente do produto, e o que faltava
 * ------------------------------------------------------------------ */

const ginecologiaPrimeira: ProntuarioTemplate = {
  chave: 'ginecologia-primeira',
  versao: 1,
  programa: 'materno-infantil',
  rotulo: 'Ginecologia — primeira consulta',
  natureza: 'primeira',
  quando: 'A anamnese ginecológica completa.',
  secoes: [
    {
      id: 'ciclo',
      rotulo: 'Ciclo menstrual',
      campos: [
        { id: 'menarca', rotulo: 'Menarca (idade)', tipo: 'numero', unidade: 'anos', permanente: true },
        { id: 'dum', rotulo: 'Data da última menstruação', tipo: 'data' },
        { id: 'cicloPadrao', rotulo: 'Padrão do ciclo', tipo: 'texto', dica: 'Ex.: 28/5, regular.' },
        { id: 'dismenorreia', rotulo: 'Dismenorreia', tipo: 'selecao', opcoes: ['Ausente', 'Leve', 'Moderada', 'Incapacitante'] },
        { id: 'sangramento', rotulo: 'Volume do sangramento', tipo: 'selecao', opcoes: ['Normal', 'Aumentado', 'Reduzido'] },
      ],
    },
    {
      id: 'sexual-reprodutiva',
      rotulo: 'Saúde sexual e reprodutiva',
      campos: [
        { id: 'sexarca', rotulo: 'Sexarca (idade)', tipo: 'numero', unidade: 'anos', permanente: true },
        { id: 'contracepcao', rotulo: 'Método contraceptivo', tipo: 'texto' },
        { id: 'dispareunia', rotulo: 'Dispareunia', tipo: 'selecao', opcoes: SIM_NAO },
        { id: 'gestacoes', rotulo: 'Gestações / partos / abortos', tipo: 'texto', permanente: true },
        { id: 'desejoGestacional', rotulo: 'Desejo de engravidar', tipo: 'selecao', opcoes: ['Não', 'Sim, agora', 'Sim, no futuro'] },
      ],
    },
    {
      id: 'rastreio',
      rotulo: 'Rastreio',
      campos: [
        { id: 'citologia', rotulo: 'Última citologia (data e resultado)', tipo: 'texto' },
        { id: 'mamografia', rotulo: 'Última mamografia', tipo: 'texto' },
        { id: 'ist', rotulo: 'Sorologias / IST', tipo: 'texto' },
      ],
    },
    {
      id: 'antecedentes',
      rotulo: 'Antecedentes',
      campos: [
        { id: 'comorbidades', rotulo: 'Doenças prévias', tipo: 'texto-longo', permanente: true },
        { id: 'cirurgias', rotulo: 'Cirurgias', tipo: 'texto-longo', permanente: true },
        { id: 'alergias', rotulo: 'Alergias', tipo: 'texto', permanente: true },
        { id: 'medicacoes', rotulo: 'Medicações em uso', tipo: 'texto-longo' },
        { id: 'familiares', rotulo: 'História familiar', tipo: 'texto-longo', dica: 'Câncer de mama, ovário e colo; trombose.', permanente: true },
      ],
    },
  ],
}

const ginecologiaRetorno: ProntuarioTemplate = {
  chave: 'ginecologia-retorno',
  versao: 1,
  programa: 'materno-infantil',
  rotulo: 'Ginecologia — retorno',
  natureza: 'retorno',
  quando: 'O acompanhamento, sem repetir a anamnese.',
  secoes: [
    {
      id: 'desde-a-ultima',
      rotulo: 'Desde a última consulta',
      campos: [
        { id: 'queixas', rotulo: 'Queixas', tipo: 'texto-longo' },
        { id: 'dum', rotulo: 'Data da última menstruação', tipo: 'data' },
        { id: 'contracepcao', rotulo: 'Método contraceptivo', tipo: 'texto' },
        { id: 'examesResultados', rotulo: 'Resultados desde a última consulta', tipo: 'texto-longo' },
        { id: 'examesSolicitados', rotulo: 'Exames solicitados hoje', tipo: 'texto-longo' },
      ],
    },
  ],
}

const soapGenerico: ProntuarioTemplate = {
  chave: 'soap-generico',
  versao: 1,
  programa: 'materno-infantil',
  rotulo: 'Consulta livre',
  natureza: 'generico',
  quando: 'Quando nenhum formulário específico serve. Só o SOAP.',
  secoes: [],
}

export const TEMPLATES: ProntuarioTemplate[] = [
  preNatalPrimeira,
  preNatalRetorno,
  puericulturaPrimeira,
  puericulturaRetorno,
  ginecologiaPrimeira,
  ginecologiaRetorno,
  soapGenerico,
]

const PORCHAVE = new Map(TEMPLATES.map((t) => [t.chave, t]))

/** Nunca falha: chave desconhecida cai no SOAP livre. */
export function templatePorChave(chave: string | null | undefined): ProntuarioTemplate {
  return PORCHAVE.get(String(chave ?? '')) ?? soapGenerico
}

/** Todos os ids de campo de um template, na ordem em que aparecem. */
export function camposDe(template: ProntuarioTemplate): Campo[] {
  return template.secoes.flatMap((s) => s.campos)
}

/**
 * O par (primeira, retorno) de uma mesma linha de cuidado.
 *
 * É o que permite a pergunta que o produto precisa responder sozinho: "esta
 * paciente já teve a primeira consulta comigo?". Se não teve, o formulário
 * completo; se teve, o de acompanhamento — sem o médico ter que escolher.
 */
export const LINHAS: { id: string; rotulo: string; primeira: string; retorno: string }[] = [
  { id: 'pre-natal', rotulo: 'Pré-natal', primeira: 'pre-natal-primeira', retorno: 'pre-natal-retorno' },
  { id: 'puericultura', rotulo: 'Puericultura', primeira: 'puericultura-primeira', retorno: 'puericultura-retorno' },
  { id: 'ginecologia', rotulo: 'Ginecologia', primeira: 'ginecologia-primeira', retorno: 'ginecologia-retorno' },
]

export function linhaDoTemplate(chave: string): (typeof LINHAS)[number] | null {
  return LINHAS.find((l) => l.primeira === chave || l.retorno === chave) ?? null
}
