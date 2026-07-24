/**
 * Quizzes "mito × verdade" — desmistificam conceitos de gestação e amamentação de
 * forma leve. Conteúdo informativo, com fonte, alinhado a Ministério da Saúde,
 * IBFAN e Sociedade Brasileira de Pediatria (SBP). Não substitui a equipe de saúde.
 */

export interface QuizItem {
  afirmacao: string
  /** true = é verdade; false = é mito. */
  verdade: boolean
  explicacao: string
  fonte: string
}

export const QUIZ_AMAMENTACAO: QuizItem[] = [
  {
    afirmacao: 'Existe um formato "certo" de mama para amamentar.',
    verdade: false,
    explicacao:
      'Mito. Mamas de todos os formatos e tamanhos amamentam. O que mais importa é a pega correta do bebê e o esvaziamento da mama — não o formato.',
    fonte: 'Ministério da Saúde / IBFAN Brasil',
  },
  {
    afirmacao: 'Beber bastante água ajuda na produção de leite.',
    verdade: true,
    explicacao:
      'Verdade. A hidratação adequada da mãe apoia a produção de leite. Beba água ao longo do dia, especialmente durante as mamadas.',
    fonte: 'Ministério da Saúde — Caderneta da Gestante',
  },
  {
    afirmacao: 'Mamilo plano ou invertido impede a amamentação.',
    verdade: false,
    explicacao:
      'Mito. Com a pega correta e apoio (como o protetor/concha de amamentação, o "rolinho" que protege o mamilo), a maioria consegue amamentar bem.',
    fonte: 'Sociedade Brasileira de Pediatria (SBP)',
  },
  {
    afirmacao: 'Dor forte e rachaduras no mamilo são normais e é só aguentar.',
    verdade: false,
    explicacao:
      'Mito. Dor intensa geralmente indica pega incorreta. Ajustar a pega resolve na maioria dos casos — procure apoio (enfermeira obstétrica, banco de leite) em vez de sofrer.',
    fonte: 'Ministério da Saúde',
  },
  {
    afirmacao: 'O leite materno sozinho basta até os 6 meses.',
    verdade: true,
    explicacao:
      'Verdade. A recomendação é aleitamento materno exclusivo até os 6 meses (sem água, chás ou outros alimentos), e depois complementado até 2 anos ou mais.',
    fonte: 'OMS / Ministério da Saúde / SBP',
  },
  {
    afirmacao: 'Leite "fraco" existe e por isso o bebê fica com fome.',
    verdade: false,
    explicacao:
      'Mito. Não existe leite fraco. O leite do fim da mamada é mais gorduroso e sacia — por isso é importante esvaziar bem uma mama antes de oferecer a outra.',
    fonte: 'IBFAN Brasil / SBP',
  },
]

export const QUIZ_GESTACAO: QuizItem[] = [
  {
    afirmacao: 'Grávida precisa "comer por dois".',
    verdade: false,
    explicacao:
      'Mito. A necessidade extra de energia é pequena. Vale mais a qualidade da alimentação do que a quantidade.',
    fonte: 'Ministério da Saúde — Caderneta da Gestante',
  },
  {
    afirmacao: 'Ácido fólico é importante já no início da gestação.',
    verdade: true,
    explicacao:
      'Verdade. O ácido fólico ajuda a prevenir defeitos do tubo neural do bebê, idealmente desde antes de engravidar e no 1º trimestre.',
    fonte: 'Ministério da Saúde',
  },
  {
    afirmacao: 'Fazer o pré-natal completo reduz riscos para mãe e bebê.',
    verdade: true,
    explicacao:
      'Verdade. O pré-natal permite detectar e tratar cedo condições como anemia, diabetes gestacional e infecções.',
    fonte: 'Ministério da Saúde',
  },
]

export interface Quiz {
  id: string
  titulo: string
  descricao: string
  itens: QuizItem[]
}

export const QUIZZES: Quiz[] = [
  {
    id: 'amamentacao',
    titulo: 'Amamentação: mito ou verdade?',
    descricao: 'Desmistifique os medos mais comuns sobre amamentar.',
    itens: QUIZ_AMAMENTACAO,
  },
  {
    id: 'gestacao',
    titulo: 'Gestação: mito ou verdade?',
    descricao: 'O que é lenda e o que é ciência na gravidez.',
    itens: QUIZ_GESTACAO,
  },
]
