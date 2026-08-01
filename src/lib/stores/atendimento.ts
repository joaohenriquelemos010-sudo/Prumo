import { create } from 'zustand'
import { api } from '@/lib/api/client'
import type { Cockpit, Consulta, Medidas, ItemChecklist, CampoSOAP } from '@/features/atendimento/tipos'

/**
 * O atendimento em curso.
 *
 * Duas regras moldam este arquivo:
 *
 * 1. **O que a médica digitou é a verdade.** A escrita é otimista e o servidor
 *    nunca sobrescreve o campo em edição com a resposta do autosave — uma
 *    resposta que chega tarde não pode apagar a frase que está sendo escrita.
 * 2. **Nada de spinner no caminho de digitação.** O salvamento é debounced e
 *    acontece atrás; o único feedback é o carimbo "salvo há Xs".
 */

type Rascunho = Partial<
  Record<CampoSOAP | 'notasPrivadas' | 'resumoParaFamilia', string>
> & {
  avaliacaoPrivada?: boolean
  medidas?: Medidas
  checklist?: ItemChecklist[]
  igSemanas?: number | null
  igDias?: number | null
  /**
   * As respostas do formulário de prontuário, por id de campo.
   *
   * Acumula em vez de substituir: o servidor mescla, então mandar só o campo que
   * mudou é suficiente — e é o que mantém o autosave barato num formulário de
   * anamnese com trinta campos.
   */
  estruturado?: Record<string, string | number | boolean | null>
}

interface EstadoAtendimento {
  cockpit: Cockpit | null
  carregando: boolean
  erro: string | null
  /** Alterações locais ainda não confirmadas pelo servidor. */
  pendente: Rascunho
  salvando: boolean
  salvoEm: string | null
  finalizando: boolean

  iniciar: (
    alvo: { agendamentoId: string } | { jornadaId: string },
  ) => Promise<{ ok: boolean; consultaId?: string; erro?: string }>
  carregar: (cockpit: Cockpit) => void
  editar: (mudanca: Rascunho) => void
  salvarAgora: () => Promise<void>
  finalizar: (enviarResumo: boolean) => Promise<{ ok: boolean; erro?: string }>
  limpar: () => void
}

const ESPERA_AUTOSAVE_MS = 1500

let timerAutosave: ReturnType<typeof setTimeout> | null = null

export const useAtendimento = create<EstadoAtendimento>((set, get) => ({
  cockpit: null,
  carregando: false,
  erro: null,
  pendente: {},
  salvando: false,
  salvoEm: null,
  finalizando: false,

  iniciar: async (alvo) => {
    set({ carregando: true, erro: null })
    try {
      const cockpit = await api.post<Cockpit>('/atendimento/iniciar', alvo)
      set({ cockpit, carregando: false, pendente: {}, salvoEm: null })
      return { ok: true, consultaId: cockpit.consulta.id }
    } catch (e) {
      const erro = e instanceof Error ? e.message : 'Não foi possível abrir o atendimento.'
      set({ carregando: false, erro })
      return { ok: false, erro }
    }
  },

  carregar: (cockpit) => set({ cockpit, pendente: {}, erro: null }),

  editar: (mudanca) => {
    set((s) => ({
      pendente: {
        ...s.pendente,
        ...mudanca,
        // `estruturado` é o único campo que se acumula em vez de substituir: um
        // spread raso trocaria o objeto inteiro e perderia os campos digitados
        // antes desta tecla.
        ...(mudanca.estruturado
          ? { estruturado: { ...(s.pendente.estruturado ?? {}), ...mudanca.estruturado } }
          : {}),
      },
    }))

    // Debounce: cada tecla reinicia a contagem, e só a pausa dispara a gravação.
    if (timerAutosave) clearTimeout(timerAutosave)
    timerAutosave = setTimeout(() => void get().salvarAgora(), ESPERA_AUTOSAVE_MS)
  },

  salvarAgora: async () => {
    if (timerAutosave) {
      clearTimeout(timerAutosave)
      timerAutosave = null
    }
    const { cockpit, pendente, salvando } = get()
    if (!cockpit || salvando) return
    if (Object.keys(pendente).length === 0) return

    // Esvazia o pendente ANTES do request: o que a médica digitar durante o
    // voo entra num pendente novo e é salvo na próxima rodada, em vez de ser
    // engolido quando a resposta chegar.
    set({ salvando: true, pendente: {} })

    try {
      const { salvoEm } = await api.patch<{ consulta: Consulta; salvoEm: string }>(
        `/atendimento/${cockpit.consulta.id}`,
        pendente,
      )
      set({ salvando: false, salvoEm, erro: null })
    } catch (e) {
      // Devolve o que não salvou para a fila, sem descartar o que foi digitado
      // no meio — o texto da médica nunca é perdido por uma falha de rede.
      set((s) => ({
        salvando: false,
        pendente: { ...pendente, ...s.pendente },
        erro: e instanceof Error ? e.message : 'Não conseguimos salvar agora.',
      }))
    }
  },

  finalizar: async (enviarResumo) => {
    const { cockpit } = get()
    if (!cockpit) return { ok: false, erro: 'Nenhum atendimento aberto.' }

    // Descarrega o que estiver pendente antes de fechar, senão o último
    // parágrafo digitado não entra no registro.
    await get().salvarAgora()

    set({ finalizando: true })
    try {
      const { consulta } = await api.post<{ consulta: Consulta }>(
        `/atendimento/${cockpit.consulta.id}/finalizar`,
        { enviarResumo },
      )
      set((s) => ({
        finalizando: false,
        cockpit: s.cockpit ? { ...s.cockpit, consulta } : null,
      }))
      return { ok: true }
    } catch (e) {
      const erro = e instanceof Error ? e.message : 'Não foi possível finalizar.'
      set({ finalizando: false, erro })
      return { ok: false, erro }
    }
  },

  limpar: () => {
    if (timerAutosave) {
      clearTimeout(timerAutosave)
      timerAutosave = null
    }
    set({ cockpit: null, pendente: {}, salvoEm: null, erro: null, carregando: false })
  },
}))

/**
 * O valor a exibir num campo: o que está pendente, se houver, senão o do
 * servidor. É isso que garante que a resposta de um autosave lento não puxe o
 * cursor de volta.
 */
export function valorDoCampo<K extends keyof Rascunho>(
  pendente: Rascunho,
  consulta: Consulta | null | undefined,
  campo: K,
): NonNullable<Rascunho[K]> | string {
  if (pendente[campo] !== undefined) return pendente[campo] as NonNullable<Rascunho[K]>
  return ((consulta?.[campo as keyof Consulta] as Rascunho[K]) ??
    '') as NonNullable<Rascunho[K]>
}
