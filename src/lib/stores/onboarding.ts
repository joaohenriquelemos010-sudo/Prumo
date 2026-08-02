import { create } from 'zustand'
import { emitAuditEvent } from '@/lib/audit'

/**
 * A máquina de passos do acesso.
 *
 * A primeira bifurcação é **médico ou paciente**, e ela vem antes de qualquer
 * campo por um motivo: as duas contas pedem coisas diferentes, e perguntar o
 * perfil no meio do formulário obrigaria a redesenhar o formulário embaixo de
 * quem já estava digitando.
 *
 * `perfil` é o passo que os dois caminhos compartilham na posição, não no
 * conteúdo — para quem é médico ele é a tela de boas-vindas (a conta já está
 * decidida), e para quem é paciente é a escolha entre mãe, pai e gestante.
 */
export type Acesso = 'medico' | 'paciente'

export type Perfil = 'gestante' | 'mae' | 'pai' | 'medico'

export type MomentoGestacao = 'planejando' | 'gestante' | 'ja-nasceu'

export const PASSOS = ['acesso', 'perfil', 'dados', 'seguranca', 'sucesso'] as const
export type Passo = (typeof PASSOS)[number]

/** Os passos que contam para a barra de progresso — `sucesso` já é a chegada. */
const PASSOS_CONTADOS = PASSOS.length - 1

interface OnboardingStore {
  passo: Passo
  acesso: Acesso | null
  perfil: Perfil | null
  start: () => void
  escolherAcesso: (acesso: Acesso) => void
  escolherPerfil: (perfil: Perfil) => void
  irPara: (passo: Passo) => void
  avancar: () => void
  voltar: () => void
  complete: () => void
  reset: () => void
}

function indice(passo: Passo): number {
  return PASSOS.indexOf(passo)
}

/**
 * As respostas do onboarding ficam em memória só enquanto o fluxo dura. Os dados
 * do formulário **não moram aqui** de propósito: nome, CPF e telefone são dados
 * pessoais, e uma store global é exatamente o lugar onde eles sobreviveriam à
 * tela que os pediu. Eles vivem no estado da página e vão direto para a API.
 */
export const useOnboarding = create<OnboardingStore>((set, get) => ({
  passo: 'acesso',
  acesso: null,
  perfil: null,

  start: () => {
    emitAuditEvent('onboarding.started')
    set({ passo: 'acesso' })
  },

  escolherAcesso: (acesso) => {
    // Quem é médico já respondeu qual é o perfil ao escolher o caminho.
    set({ acesso, perfil: acesso === 'medico' ? 'medico' : null, passo: 'perfil' })
    if (acesso === 'medico') emitAuditEvent('onboarding.role_selected', { perfil: 'medico' })
  },

  escolherPerfil: (perfil) => {
    emitAuditEvent('onboarding.role_selected', { perfil })
    set({ perfil, passo: 'dados' })
  },

  irPara: (passo) => set({ passo }),

  avancar: () => set({ passo: PASSOS[Math.min(indice(get().passo) + 1, PASSOS.length - 1)] }),

  voltar: () => set({ passo: PASSOS[Math.max(indice(get().passo) - 1, 0)] }),

  complete: () => {
    const { perfil } = get()
    emitAuditEvent('onboarding.completed', { perfil: perfil ?? 'desconhecido' })
    set({ passo: 'sucesso' })
  },

  reset: () => set({ passo: 'acesso', acesso: null, perfil: null }),
}))

/** 0–100. `sucesso` fecha a barra. */
export function progressoDe(passo: Passo): number {
  return Math.round((Math.min(indice(passo) + 1, PASSOS_CONTADOS) / PASSOS_CONTADOS) * 100)
}

/** O momento da jornada que cada perfil implica por padrão. */
export function momentoPadrao(perfil: Perfil): MomentoGestacao {
  return perfil === 'gestante' ? 'gestante' : 'ja-nasceu'
}
