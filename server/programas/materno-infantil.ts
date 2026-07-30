import type { Programa } from './tipos.js'

/**
 * O programa que o Prumo já é: da preconcepção à pediatria, passando pela
 * gestação e pelo puerpério.
 *
 * Este arquivo não muda comportamento nenhum — ele **descreve** o que o código
 * já faz. É de propósito: a primeira versão de um descritor tem que ser um
 * espelho fiel, senão a generalização começa mentindo.
 */
export const maternoInfantil: Programa = {
  id: 'materno-infantil',
  rotulo: 'Materno-infantil',
  especialidades: ['obstetricia', 'ginecologia', 'pediatria'],

  vocabulario: {
    paciente: 'gestante',
    jornada: 'jornada',
    unidadeTempo: 'semana',
    iniciarAtendimento: 'Iniciar atendimento',
  },

  fases: [
    {
      id: 'planejando',
      rotulo: 'Planejando',
      ativaQuando: (j) => j.momento === 'planejando',
    },
    {
      id: 'gestacao',
      rotulo: 'Gestação',
      ativaQuando: (j) => j.momento === 'gestante',
    },
    {
      id: 'pos-natal',
      rotulo: 'Primeiro ano',
      ativaQuando: (j) => j.momento === 'ja-nasceu',
    },
  ],

  templatesProntuario: ['soap-generico', 'pre-natal-v1', 'puericultura-v1'],
  templatesChecklist: ['gestante-completo', 'puericultura-completo'],

  medidas: [
    // Gestação
    'pesoKg',
    'alturaCm',
    'imc',
    'paSistolica',
    'paDiastolica',
    'alturaUterinaCm',
    'bcfBpm',
    // Pós-natal
    'pesoG',
    'comprimentoCm',
    'perimetroCefalicoCm',
  ],

  // A curva efetiva depende da fase; `fetal-hadlock` é a da fase mais longa.
  // O consumidor resolve pela fase ativa quando precisa da outra.
  curvas: 'fetal-hadlock',

  painel: ['proximos-atendimentos', 'precisa-de-voce', 'alertas', 'duvidas'],
}
