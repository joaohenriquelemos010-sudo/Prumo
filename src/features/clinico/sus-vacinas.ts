/**
 * Calendário Nacional de Vacinação — Programa Nacional de Imunizações (PNI).
 * Fonte: Ministério da Saúde — PNI / Caderneta da Criança e Caderneta da Gestante.
 *
 * Conteúdo informativo. Campanhas (Influenza, COVID-19) variam por período e não
 * têm idade fixa; ver nota. Sempre confirme com a sua unidade de saúde.
 */

export const REFERENCIA_PNI =
  'Ministério da Saúde — Programa Nacional de Imunizações (PNI), Calendário Nacional de Vacinação.'

export interface VacinaPNI {
  id: string
  nome: string
  /** Idade recomendada, em meses (0 = ao nascer). */
  idadeMeses: number
  /** Rótulo legível da idade/etapa. */
  idadeLabel: string
  dose: string
  protege: string
}

/** Calendário da criança (0 aos 4 anos). */
export const VACINAS_CRIANCA: VacinaPNI[] = [
  { id: 'bcg', nome: 'BCG', idadeMeses: 0, idadeLabel: 'Ao nascer', dose: 'Dose única', protege: 'Formas graves de tuberculose' },
  { id: 'hepb-nascer', nome: 'Hepatite B', idadeMeses: 0, idadeLabel: 'Ao nascer', dose: 'Ao nascer', protege: 'Hepatite B' },

  { id: 'penta-1', nome: 'Pentavalente (DTP+Hib+HepB)', idadeMeses: 2, idadeLabel: '2 meses', dose: '1ª dose', protege: 'Difteria, tétano, coqueluche, Hib e hepatite B' },
  { id: 'vip-1', nome: 'Poliomielite (VIP)', idadeMeses: 2, idadeLabel: '2 meses', dose: '1ª dose', protege: 'Poliomielite' },
  { id: 'pneumo-1', nome: 'Pneumocócica 10-valente', idadeMeses: 2, idadeLabel: '2 meses', dose: '1ª dose', protege: 'Pneumonia, meningite e otite por pneumococo' },
  { id: 'rota-1', nome: 'Rotavírus', idadeMeses: 2, idadeLabel: '2 meses', dose: '1ª dose', protege: 'Diarreia por rotavírus' },

  { id: 'meningo-1', nome: 'Meningocócica C', idadeMeses: 3, idadeLabel: '3 meses', dose: '1ª dose', protege: 'Doença meningocócica C' },

  { id: 'penta-2', nome: 'Pentavalente (DTP+Hib+HepB)', idadeMeses: 4, idadeLabel: '4 meses', dose: '2ª dose', protege: 'Difteria, tétano, coqueluche, Hib e hepatite B' },
  { id: 'vip-2', nome: 'Poliomielite (VIP)', idadeMeses: 4, idadeLabel: '4 meses', dose: '2ª dose', protege: 'Poliomielite' },
  { id: 'pneumo-2', nome: 'Pneumocócica 10-valente', idadeMeses: 4, idadeLabel: '4 meses', dose: '2ª dose', protege: 'Pneumonia, meningite e otite por pneumococo' },
  { id: 'rota-2', nome: 'Rotavírus', idadeMeses: 4, idadeLabel: '4 meses', dose: '2ª dose', protege: 'Diarreia por rotavírus' },

  { id: 'meningo-2', nome: 'Meningocócica C', idadeMeses: 5, idadeLabel: '5 meses', dose: '2ª dose', protege: 'Doença meningocócica C' },

  { id: 'penta-3', nome: 'Pentavalente (DTP+Hib+HepB)', idadeMeses: 6, idadeLabel: '6 meses', dose: '3ª dose', protege: 'Difteria, tétano, coqueluche, Hib e hepatite B' },
  { id: 'vip-3', nome: 'Poliomielite (VIP)', idadeMeses: 6, idadeLabel: '6 meses', dose: '3ª dose', protege: 'Poliomielite' },

  { id: 'febre-amarela', nome: 'Febre amarela', idadeMeses: 9, idadeLabel: '9 meses', dose: 'Dose inicial', protege: 'Febre amarela' },

  { id: 'triplice-viral-1', nome: 'Tríplice viral (SCR)', idadeMeses: 12, idadeLabel: '12 meses', dose: '1ª dose', protege: 'Sarampo, caxumba e rubéola' },
  { id: 'pneumo-ref', nome: 'Pneumocócica 10-valente', idadeMeses: 12, idadeLabel: '12 meses', dose: 'Reforço', protege: 'Pneumonia, meningite e otite por pneumococo' },
  { id: 'meningo-ref', nome: 'Meningocócica C', idadeMeses: 12, idadeLabel: '12 meses', dose: 'Reforço', protege: 'Doença meningocócica C' },

  { id: 'dtp-ref1', nome: 'DTP (tríplice bacteriana)', idadeMeses: 15, idadeLabel: '15 meses', dose: '1º reforço', protege: 'Difteria, tétano e coqueluche' },
  { id: 'vop-ref1', nome: 'Poliomielite (VOP)', idadeMeses: 15, idadeLabel: '15 meses', dose: '1º reforço', protege: 'Poliomielite' },
  { id: 'hepa', nome: 'Hepatite A', idadeMeses: 15, idadeLabel: '15 meses', dose: 'Dose única', protege: 'Hepatite A' },
  { id: 'tetra-viral', nome: 'Tetra viral (SCR + varicela)', idadeMeses: 15, idadeLabel: '15 meses', dose: 'Dose única', protege: 'Sarampo, caxumba, rubéola e varicela' },

  { id: 'dtp-ref2', nome: 'DTP (tríplice bacteriana)', idadeMeses: 48, idadeLabel: '4 anos', dose: '2º reforço', protege: 'Difteria, tétano e coqueluche' },
  { id: 'vop-ref2', nome: 'Poliomielite (VOP)', idadeMeses: 48, idadeLabel: '4 anos', dose: '2º reforço', protege: 'Poliomielite' },
  { id: 'febre-amarela-ref', nome: 'Febre amarela', idadeMeses: 48, idadeLabel: '4 anos', dose: 'Reforço', protege: 'Febre amarela' },
  { id: 'varicela-2', nome: 'Varicela', idadeMeses: 48, idadeLabel: '4 anos', dose: '2ª dose', protege: 'Varicela (catapora)' },
]

export interface VacinaGestante {
  id: string
  nome: string
  quando: string
  protege: string
}

/** Vacinas recomendadas na gestação (PNI). */
export const VACINAS_GESTANTE: VacinaGestante[] = [
  { id: 'dtpa', nome: 'dTpa (difteria, tétano e coqueluche)', quando: 'A cada gestação, a partir da 20ª semana', protege: 'Protege o bebê contra coqueluche nos primeiros meses' },
  { id: 'dt-hepb', nome: 'Hepatite B', quando: 'Conforme situação vacinal (esquema de 3 doses se não vacinada)', protege: 'Hepatite B' },
  { id: 'influenza-gest', nome: 'Influenza (gripe)', quando: 'Dose anual, durante a campanha', protege: 'Gripe e suas complicações' },
]

export const NOTA_CAMPANHAS =
  'Vacinas de campanha, como Influenza e COVID-19, seguem as recomendações e os períodos definidos pelo Ministério da Saúde. Confirme sempre com a sua unidade de saúde.'
