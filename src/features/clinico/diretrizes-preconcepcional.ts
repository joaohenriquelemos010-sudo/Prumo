/**
 * Cuidado pré-concepcional — o que fazer ANTES de engravidar.
 *
 * Fonte: Ministério da Saúde (Caderno de Atenção Básica nº 32 — Atenção ao
 * Pré-natal de Baixo Risco) e FEBRASGO (Manual de Assistência Pré-natal).
 * Conteúdo informativo: a conduta é sempre da equipe que acompanha.
 *
 * É a etapa que o app não cobria — a trilha começava no primeiro pré-natal, com
 * a gestação já em curso. Boa parte do que mais reduz risco (ácido fólico,
 * controle de crônicas, imunização) só funciona se acontecer antes.
 */

export const REFERENCIA_PRECONCEPCIONAL =
  'Ministério da Saúde — Caderno de Atenção Básica nº 32, e FEBRASGO — Manual de Assistência Pré-natal.'

export interface PassoPreConcepcional {
  id: string
  titulo: string
  /** Por que isso importa, na voz de quem explica para a paciente. */
  porque: string
  /** O que efetivamente se faz. */
  comoFazer: string[]
  /** Quando começar, em relação à tentativa de engravidar. */
  quando: string
  /** Quem conduz. */
  responsavel: 'voce' | 'equipe'
}

export const PASSOS_PRECONCEPCIONAIS: PassoPreConcepcional[] = [
  {
    id: 'consulta-preconcepcional',
    titulo: 'Consulta pré-concepcional',
    porque:
      'É a porta de entrada. A consulta monta seu retrato antes da gestação — histórico, condições crônicas, medicações em uso, vacinas, histórico familiar e obstétrico — e é a partir dela que todo o resto é planejado.',
    comoFazer: [
      'Agendar com obstetra, ginecologista ou enfermagem obstétrica',
      'Levar carteira de vacinação e exames recentes, se tiver',
      'Listar todos os medicamentos que você usa, inclusive fitoterápicos',
      'Anotar o histórico de gestações anteriores, se houver',
    ],
    quando: 'Idealmente 3 meses antes de começar a tentar',
    responsavel: 'equipe',
  },
  {
    id: 'revisao-anticoncepcional',
    titulo: 'Revisão do método anticoncepcional',
    porque:
      'Cada método tem um tempo próprio de retorno da fertilidade. Saber disso evita tanto a frustração de tentar cedo demais quanto a surpresa de engravidar antes do planejado.',
    comoFazer: [
      'DIU (de cobre ou hormonal): a fertilidade volta logo após a retirada — que é feita em consulta',
      'Pílula, anel ou adesivo: a ovulação costuma voltar já no primeiro ou segundo ciclo',
      'Implante subdérmico: retorno rápido após a retirada',
      'Injetável trimestral: pode levar de 6 a 12 meses para o ciclo se regularizar — é o método que exige mais antecedência',
    ],
    quando: 'Converse na consulta pré-concepcional; o injetável pede planejar antes',
    responsavel: 'equipe',
  },
  {
    id: 'acido-folico',
    titulo: 'Ácido fólico',
    porque:
      'Reduz de forma comprovada o risco de defeitos do tubo neural, que se fecha até a 4ª semana — muitas vezes antes de a gestação ser descoberta. Por isso começa antes, não depois.',
    comoFazer: [
      'Dose habitual: 400 microgramas por dia',
      'Dose alta (5 mg/dia) quando houver histórico de defeito do tubo neural, uso de anticonvulsivantes, diabetes ou obesidade — sempre por indicação médica',
      'Manter pelo menos até o fim do primeiro trimestre',
    ],
    quando: 'Começar no mínimo 30 dias antes de engravidar',
    responsavel: 'voce',
  },
  {
    id: 'acompanhar-ciclo',
    titulo: 'Acompanhar o ciclo menstrual',
    porque:
      'Conhecer o seu ciclo mostra a janela fértil e, depois, dá a data da última menstruação (DUM) — que é a base do cálculo da idade gestacional e da data provável do parto.',
    comoFazer: [
      'Anotar o primeiro dia de cada menstruação',
      'Observar sinais de ovulação: muco cervical mais elástico, leve dor pélvica',
      'A janela fértil costuma ficar em torno de 14 dias antes da próxima menstruação',
      'Ciclos muito irregulares merecem ser levados à consulta',
    ],
    quando: 'A partir de agora, por pelo menos 3 ciclos',
    responsavel: 'voce',
  },
  {
    id: 'exames-preconcepcionais',
    titulo: 'Exames e sorologias',
    porque:
      'Identificar e tratar antes da gestação é sempre mais simples e mais seguro — para você e para o bebê.',
    comoFazer: [
      'Hemograma, glicemia de jejum, tipagem sanguínea e fator Rh',
      'Sorologias: HIV, sífilis, hepatites B e C, toxoplasmose e rubéola',
      'Avaliação da tireoide (TSH), quando indicado',
      'Citopatológico do colo do útero em dia',
    ],
    quando: 'Na consulta pré-concepcional',
    responsavel: 'equipe',
  },
  {
    id: 'vacinas',
    titulo: 'Atualizar as vacinas',
    porque:
      'Vacinas de vírus vivo, como a tríplice viral, não podem ser aplicadas durante a gestação. Estar imunizada antes protege você e o bebê.',
    comoFazer: [
      'Tríplice viral (sarampo, caxumba, rubéola): evitar engravidar por 30 dias depois',
      'Hepatite B: esquema completo de 3 doses',
      'dTpa (difteria, tétano e coqueluche): reforço conforme a caderneta',
      'Influenza: na campanha anual',
    ],
    quando: 'Pelo menos 30 dias antes de começar a tentar',
    responsavel: 'equipe',
  },
  {
    id: 'condicoes-cronicas',
    titulo: 'Controlar condições crônicas',
    porque:
      'Diabetes, hipertensão, tireoidopatias e epilepsia mudam o risco da gestação — e algumas medicações precisam ser trocadas por opções seguras antes da concepção, não depois.',
    comoFazer: [
      'Diabetes: buscar bom controle glicêmico antes de engravidar',
      'Hipertensão: revisar a medicação — alguns anti-hipertensivos são contraindicados na gestação',
      'Tireoide: ajustar a dose de levotiroxina',
      'Epilepsia: revisar anticonvulsivantes com o neurologista',
      'Nunca suspender medicação por conta própria',
    ],
    quando: 'Antes de começar a tentar',
    responsavel: 'equipe',
  },
  {
    id: 'peso-e-habitos',
    titulo: 'Peso, alimentação e hábitos',
    porque:
      'O IMC antes da gestação define a meta de ganho de peso no pré-natal. E não existe quantidade segura de álcool ou tabaco na gravidez.',
    comoFazer: [
      'Calcular o IMC e conversar sobre a faixa de peso adequada',
      'Interromper álcool, tabaco e outras drogas',
      'Atividade física regular, conforme orientação',
      'Reduzir cafeína',
    ],
    quando: 'Quanto antes, melhor',
    responsavel: 'voce',
  },
  {
    id: 'saude-bucal',
    titulo: 'Avaliação odontológica',
    porque:
      'Doença periodontal está associada a parto prematuro e baixo peso ao nascer. Tratar antes evita procedimentos durante a gestação.',
    comoFazer: ['Consulta odontológica com avaliação periodontal', 'Tratar cáries e gengivite'],
    quando: 'Antes de engravidar',
    responsavel: 'equipe',
  },
]
