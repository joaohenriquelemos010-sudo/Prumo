import {
  HeartPulse,
  Stethoscope,
  Baby,
  Syringe,
  Ruler,
  Moon,
  Milk,
  Sparkles,
  CalendarHeart,
  Footprints,
  Scan,
  ClipboardList,
} from 'lucide-react'
import type { FaseMeta, TrilhaNode } from './types'

export const FASES: FaseMeta[] = [
  {
    fase: 'gestacao',
    nome: 'Gestação',
    descricao: 'Do primeiro exame ao últimos preparativos para a chegada.',
  },
  {
    fase: 'parto',
    nome: 'Parto',
    descricao: 'O grande dia e os primeiros cuidados com o recém-nascido.',
  },
  {
    fase: 'puerperio',
    nome: 'Puerpério',
    descricao: 'As primeiras semanas — de você e do bebê, juntos.',
  },
  {
    fase: 'primeiro-ano',
    nome: 'Primeiro ano',
    descricao: 'Vacinas, marcos e o desenvolvimento mês a mês.',
  },
]

/**
 * Mocked but clinically plausible track. The status values here are what a
 * ~4-month-postpartum family would see: gestação and parto concluded, puerpério
 * done, and the first-year track in progress.
 */
export const TRILHA_NODES: TrilhaNode[] = [
  {
    id: 'pre-natal-inicio',
    fase: 'gestacao',
    titulo: 'Primeira consulta de pré-natal',
    resumo: 'O começo da trilha',
    descricao:
      'Aqui a gente registra seu histórico, calcula a idade gestacional e combina o ritmo das próximas consultas. É o marco zero — tudo que vier depois se apoia neste dia.',
    passos: [
      'Levar documentos e carteirinha do plano, se tiver',
      'Anotar dúvidas para a primeira conversa',
      'Fazer os exames de sangue iniciais pedidos',
    ],
    esperar:
      'Uma consulta mais longa e cheia de perguntas. É normal — é assim que montamos o seu retrato completo.',
    status: 'concluido',
    marco: true,
    icon: HeartPulse,
  },
  {
    id: 'primeiro-ultrassom',
    fase: 'gestacao',
    titulo: 'Primeiro ultrassom',
    resumo: 'A primeira imagem',
    descricao:
      'O ultrassom morfológico do primeiro trimestre confirma a idade gestacional e os primeiros sinais de que está tudo se formando no tempo certo.',
    passos: ['Agendar entre a 11ª e a 14ª semana', 'Ir com a bexiga cheia, se orientado'],
    esperar: 'Um coraçãozinho batendo na tela. Muita gente chora aqui — pode chorar.',
    status: 'concluido',
    marco: true,
    icon: Scan,
  },
  {
    id: 'exames-segundo-tri',
    fase: 'gestacao',
    titulo: 'Exames do segundo trimestre',
    resumo: 'Acompanhamento',
    descricao:
      'Glicemia, hemograma e o ultrassom morfológico detalhado. É quando checamos o desenvolvimento com mais calma e, se você quiser, dá pra saber o sexo.',
    passos: ['Fazer o teste de tolerância à glicose', 'Repetir o hemograma'],
    esperar: 'Resultados que, na grande maioria das vezes, só confirmam que está tudo bem.',
    status: 'concluido',
    icon: ClipboardList,
  },
  {
    id: 'reta-final',
    fase: 'gestacao',
    titulo: 'Reta final e plano de parto',
    resumo: 'Quase lá',
    descricao:
      'Consultas mais próximas, monitoramento dos movimentos do bebê e a conversa sobre como você quer que o parto seja.',
    passos: ['Montar a mala da maternidade', 'Conversar sobre o plano de parto', 'Confirmar a maternidade'],
    esperar: 'Ansiedade e empolgação na mesma medida. A trilha te lembra do que falta.',
    status: 'concluido',
    icon: CalendarHeart,
  },
  {
    id: 'nascimento',
    fase: 'parto',
    titulo: 'Nascimento',
    resumo: 'O grande dia',
    descricao:
      'O momento em que a trilha da gestação encontra a trilha do bebê. Tudo que veio antes — cada exame, cada conduta — segue com a criança a partir daqui, sem se perder.',
    passos: ['Contato pele a pele na primeira hora', 'Primeira amamentação', 'Registro do recém-nascido'],
    esperar: 'A transição mais importante de todas. Aqui a obstetrícia passa o bastão para a pediatria — sem soltar o histórico.',
    status: 'concluido',
    marco: true,
    icon: Baby,
  },
  {
    id: 'triagem-neonatal',
    fase: 'parto',
    titulo: 'Testes do pezinho, orelhinha e olhinho',
    resumo: 'Triagem neonatal',
    descricao:
      'As triagens dos primeiros dias detectam cedo condições que se tratam melhor quando pegas no início. Rápidas, seguras e essenciais.',
    passos: ['Teste do pezinho entre o 3º e o 5º dia', 'Teste da orelhinha antes da alta', 'Teste do olhinho'],
    esperar: 'Picadinhas rápidas e checagens indolores. Os resultados entram direto na trilha do bebê.',
    status: 'concluido',
    icon: Stethoscope,
  },
  {
    id: 'primeira-semana',
    fase: 'puerperio',
    titulo: 'Primeira consulta do bebê',
    resumo: 'Bem-vindo ao mundo',
    descricao:
      'Na primeira semana, o pediatra confere peso, icterícia e a amamentação. E olha o histórico da gestação inteiro — porque agora ele importa mais do que nunca.',
    passos: ['Pesar o bebê', 'Avaliar a pega da amamentação', 'Tirar as primeiras dúvidas'],
    esperar: 'Perguntas sobre sono, xixi, cocô e mamadas. Nada é pergunta boba aqui.',
    status: 'concluido',
    icon: Milk,
  },
  {
    id: 'puerperio-mae',
    fase: 'puerperio',
    titulo: 'Consulta de revisão da mãe',
    resumo: 'O cuidado com você',
    descricao:
      'A trilha não esquece de você. A revisão puerperal cuida da sua recuperação, do seu emocional e do planejamento do que vem a seguir.',
    passos: ['Avaliar recuperação física', 'Conversar sobre o emocional', 'Falar sobre contracepção, se fizer sentido'],
    esperar: 'Um espaço só seu. Ser mãe começa por você estar bem.',
    status: 'concluido',
    marco: true,
    icon: Moon,
  },
  {
    id: 'vacinas-2m',
    fase: 'primeiro-ano',
    titulo: 'Primeiras vacinas (2 meses)',
    resumo: 'Proteção começa',
    descricao:
      'Aos 2 meses entram as vacinas que protegem contra várias doenças de uma vez. A trilha te avisa antes e guarda o registro certinho.',
    passos: ['Pentavalente e VIP', 'Pneumocócica 10', 'Rotavírus'],
    esperar: 'Pode dar uma febrinha e um choro extra no dia. É esperado e passa rápido.',
    status: 'atual',
    marco: true,
    icon: Syringe,
  },
  {
    id: 'marcos-4m',
    fase: 'primeiro-ano',
    titulo: 'Marcos dos 4 meses',
    resumo: 'Descobrindo o mundo',
    descricao:
      'Sustentar a cabeça, sorrir de volta, seguir objetos com o olhar. Cada marco é uma janelinha do desenvolvimento — e a trilha mostra o que observar.',
    passos: ['Observar o sustento da cabeça', 'Notar sorriso social', 'Registrar as reações a sons'],
    esperar: 'Cada bebê no seu tempo. A trilha mostra a faixa esperada, sem pressão.',
    status: 'bloqueado',
    icon: Ruler,
  },
  {
    id: 'introducao-alimentar',
    fase: 'primeiro-ano',
    titulo: 'Introdução alimentar (6 meses)',
    resumo: 'Novos sabores',
    descricao:
      'A partir dos 6 meses, a comida entra em cena ao lado do leite. A trilha te dá o passo a passo sem complicar.',
    passos: ['Começar com frutas e legumes amassados', 'Oferecer água', 'Ir com calma e observar reações'],
    esperar: 'Muita bagunça e caretas engraçadas. Faz parte — e rende ótimas fotos.',
    status: 'bloqueado',
    icon: Sparkles,
  },
  {
    id: 'primeiros-passos',
    fase: 'primeiro-ano',
    titulo: 'Primeiros passos (por volta de 1 ano)',
    resumo: 'Um ano de trilha',
    descricao:
      'O fim do primeiro ano e o começo de tantos outros. Um retrato completo do caminho percorrido, da vida intrauterina até aqui.',
    passos: ['Comemorar o primeiro aninho', 'Revisar o calendário vacinal', 'Ver a linha do tempo completa'],
    esperar: 'Orgulho puro. E a certeza de que nada do caminho se perdeu.',
    status: 'bloqueado',
    marco: true,
    icon: Footprints,
  },
]
