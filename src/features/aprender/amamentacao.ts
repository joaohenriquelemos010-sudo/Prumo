/**
 * Conteúdo educativo de amamentação — cards curados, acolhedores e informativos,
 * com fonte. Baseado em Ministério da Saúde, IBFAN Brasil e Sociedade Brasileira
 * de Pediatria. Não substitui a orientação da sua equipe de saúde.
 */

export interface CardAmamentacao {
  titulo: string
  texto: string
  fonte: string
}

export const CARDS_AMAMENTACAO: CardAmamentacao[] = [
  {
    titulo: 'Não existe formato "certo" de mama',
    texto:
      'Mamas grandes, pequenas, mamilos planos ou invertidos — todas amamentam. O segredo está na pega correta e no esvaziamento, não no formato.',
    fonte: 'Ministério da Saúde / IBFAN Brasil',
  },
  {
    titulo: 'Hidratação e pega contam mais',
    texto:
      'Beber água ao longo do dia apoia a produção de leite. E uma boa pega — boca bem aberta, abocanhando a aréola, não só o mamilo — evita dor e garante que o bebê mame bem.',
    fonte: 'Ministério da Saúde — Caderneta da Gestante',
  },
  {
    titulo: 'Protetor de mamilo (o "rolinho") pode ajudar',
    texto:
      'A concha/protetor de amamentação ajuda a proteger o mamilo sensível ou machucado e pode facilitar a pega em mamilos planos ou invertidos. Use com orientação.',
    fonte: 'Sociedade Brasileira de Pediatria (SBP)',
  },
  {
    titulo: 'Dor forte é sinal de ajuste, não de fraqueza',
    texto:
      'Rachaduras e dor intensa costumam vir de pega incorreta — e têm solução. Procure apoio: enfermeira obstétrica, banco de leite ou o posto de saúde.',
    fonte: 'Ministério da Saúde',
  },
  {
    titulo: 'Livre demanda: no ritmo do bebê',
    texto:
      'Ofereça o peito sempre que o bebê quiser, sem relógio. Quanto mais ele mama, mais leite o corpo produz. Não existe leite fraco.',
    fonte: 'IBFAN Brasil / SBP',
  },
  {
    titulo: 'Exclusivo até os 6 meses',
    texto:
      'Até os 6 meses, só o leite materno — sem água, chá ou outros alimentos. Depois, entra a alimentação junto com o leite, até 2 anos ou mais.',
    fonte: 'OMS / Ministério da Saúde',
  },
]

export const NOTA_AMAMENTACAO =
  'Conteúdo informativo, baseado em fontes públicas de saúde. Cada dupla mãe-bebê é única — procure apoio (banco de leite, unidade de saúde, enfermeira obstétrica) sempre que precisar.'
