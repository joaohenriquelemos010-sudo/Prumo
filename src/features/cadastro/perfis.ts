import {
  Activity,
  BabyIcon,
  BarChart3,
  BookOpen,
  CalendarDays,
  HeartPulse,
  MessageCircle,
  ShieldCheck,
  Stethoscope,
  UserRound,
  Video,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { Perfil } from '@/lib/stores/onboarding'
import type { TomHalo } from '@/components/Vidro'

/**
 * O texto de cada conta.
 *
 * Está tudo num lugar só porque o tom é o produto aqui: a mesma tela muda de
 * "acompanhe sua gestação" para "cuide de quem você mais ama" dependendo de uma
 * escolha feita dois passos antes, e espalhar isso por ternários dentro do JSX
 * é como esse tipo de texto acaba inconsistente.
 *
 * As frases são específicas de propósito ("Pré-natal", não "Serviços"): rótulo
 * genérico não cria previsibilidade nenhuma sobre o que há do outro lado.
 */
export interface Beneficio {
  icone: LucideIcon
  texto: string
}

export interface CopiaPerfil {
  /** Título do cartão de cadastro. */
  titulo: string
  subtitulo: string
  icone: LucideIcon
  tom: TomHalo
  beneficios: Beneficio[]
  sucesso: {
    saudacao: string
    texto: string
  }
  /** Rótulo do botão que fecha o cadastro. */
  acao: string
}

const BENEFICIOS_FAMILIA = (primeiro: Beneficio): Beneficio[] => [
  primeiro,
  { icone: Video, texto: 'Consultas online' },
  { icone: BookOpen, texto: 'Conteúdos' },
  { icone: Activity, texto: 'Acompanhamento' },
]

export const PERFIS: Record<Perfil, CopiaPerfil> = {
  medico: {
    titulo: 'Conta para médicos',
    subtitulo: 'Crie sua conta para oferecer o melhor cuidado para suas pacientes.',
    icone: Stethoscope,
    tom: 'marca',
    beneficios: [
      { icone: CalendarDays, texto: 'Gerencie suas consultas' },
      { icone: MessageCircle, texto: 'Converse com pacientes' },
      { icone: BarChart3, texto: 'Acompanhe sua agenda' },
      { icone: ShieldCheck, texto: 'Seus dados sempre seguros' },
    ],
    sucesso: {
      saudacao: 'Bem-vindo(a) à Prumo 💜',
      texto: 'Sua agenda e suas pacientes já estão esperando por você.',
    },
    acao: 'Criar minha conta',
  },
  mae: {
    titulo: 'Conta para mães',
    subtitulo: 'Conecte-se com médicos e receba cuidado para você e seu filho.',
    icone: BabyIcon,
    tom: 'rosa',
    beneficios: BENEFICIOS_FAMILIA({ icone: HeartPulse, texto: 'Pediatras' }),
    sucesso: {
      saudacao: 'Bem-vinda à Prumo 💜',
      texto: 'Você já pode explorar tudo que preparamos para você e seu filho.',
    },
    acao: 'Criar minha conta',
  },
  pai: {
    titulo: 'Conta para pais',
    subtitulo: 'Acompanhe, participe e cuide da saúde de quem você mais ama.',
    icone: UserRound,
    tom: 'azul',
    beneficios: BENEFICIOS_FAMILIA({ icone: HeartPulse, texto: 'Pediatras' }),
    sucesso: {
      saudacao: 'Bem-vindo à Prumo 💙',
      texto: 'Você já pode explorar tudo que preparamos para você e sua família.',
    },
    acao: 'Criar minha conta',
  },
  gestante: {
    titulo: 'Conta para gestantes',
    subtitulo: 'Acompanhe sua gestação com segurança e apoio de especialistas.',
    icone: HeartPulse,
    tom: 'verde',
    beneficios: BENEFICIOS_FAMILIA({ icone: Stethoscope, texto: 'Pré-natal' }),
    sucesso: {
      saudacao: 'Bem-vinda à Prumo 💚',
      texto: 'Você já pode iniciar seu pré-natal e acompanhar cada etapa da sua gestação.',
    },
    acao: 'Criar minha conta',
  },
}

/** As três contas de família, na ordem em que aparecem na escolha. */
export const PERFIS_FAMILIA: Array<{ perfil: Perfil; titulo: string; nota: string; icone: LucideIcon }> = [
  { perfil: 'mae', titulo: 'Sou mãe', nota: 'Já tenho filhos', icone: BabyIcon },
  { perfil: 'pai', titulo: 'Sou pai', nota: 'Quero cuidar e participar mais', icone: UserRound },
  { perfil: 'gestante', titulo: 'Sou gestante', nota: 'Estou esperando meu bebê', icone: HeartPulse },
]

/** Especialidades comuns no cadastro médico, mais uma saída livre. */
export const ESPECIALIDADES = [
  'Pediatria',
  'Obstetrícia',
  'Ginecologia',
  'Ginecologia e Obstetrícia',
  'Neonatologia',
  'Clínica Geral',
  'Medicina de Família',
  'Enfermagem Obstétrica',
  'Nutrição',
  'Outra',
] as const
