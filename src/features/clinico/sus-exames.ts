/**
 * Exames do pré-natal (SUS). Fonte: Ministério da Saúde — Caderneta da Gestante e
 * protocolo de pré-natal de baixo risco. Conteúdo informativo; a solicitação e a
 * interpretação são sempre da equipe que acompanha a gestação.
 */

export const REFERENCIA_PRENATAL =
  'Ministério da Saúde — Caderneta da Gestante e protocolo de atenção ao pré-natal de baixo risco.'

export interface ExamePrenatal {
  nome: string
  motivo: string
}

export interface TrimestrePrenatal {
  trimestre: 1 | 2 | 3
  titulo: string
  janela: string
  exames: ExamePrenatal[]
}

export const EXAMES_PRENATAL: TrimestrePrenatal[] = [
  {
    trimestre: 1,
    titulo: '1º trimestre',
    janela: 'Até a 13ª semana',
    exames: [
      { nome: 'Hemograma completo', motivo: 'Avalia anemia e a saúde geral do sangue' },
      { nome: 'Tipagem sanguínea e fator Rh', motivo: 'Identifica risco de incompatibilidade sanguínea' },
      { nome: 'Glicemia de jejum', motivo: 'Rastreia diabetes' },
      { nome: 'Sífilis (teste rápido / VDRL)', motivo: 'Detecta e trata a sífilis cedo' },
      { nome: 'HIV (teste rápido / sorologia)', motivo: 'Permite prevenção da transmissão ao bebê' },
      { nome: 'Hepatite B (HBsAg)', motivo: 'Orienta a proteção do recém-nascido' },
      { nome: 'Toxoplasmose (IgG e IgM)', motivo: 'Avalia imunidade e infecção recente' },
      { nome: 'Urina tipo I (EAS) e urocultura', motivo: 'Rastreia infecção urinária' },
      { nome: 'Ultrassonografia obstétrica', motivo: 'Confirma idade gestacional e vitalidade' },
    ],
  },
  {
    trimestre: 2,
    titulo: '2º trimestre',
    janela: 'Da 14ª à 27ª semana',
    exames: [
      { nome: 'Teste de tolerância à glicose (TOTG 75g)', motivo: 'Rastreia diabetes gestacional, entre 24 e 28 semanas' },
      { nome: 'Coombs indireto (se Rh negativo)', motivo: 'Acompanha a incompatibilidade Rh' },
      { nome: 'Ultrassonografia morfológica', motivo: 'Avalia a formação do bebê com detalhe' },
      { nome: 'Repetir sorologias conforme risco', motivo: 'Sífilis, HIV e toxoplasmose, quando indicado' },
    ],
  },
  {
    trimestre: 3,
    titulo: '3º trimestre',
    janela: 'Da 28ª semana ao parto',
    exames: [
      { nome: 'Hemograma completo', motivo: 'Reavalia anemia perto do parto' },
      { nome: 'Sífilis (VDRL) e HIV', motivo: 'Rastreio próximo ao nascimento' },
      { nome: 'Hepatite B (HBsAg)', motivo: 'Planeja a proteção do recém-nascido' },
      { nome: 'Estreptococo do grupo B', motivo: 'Cultura entre 35 e 37 semanas' },
    ],
  },
]
