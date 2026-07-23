import { create } from 'zustand'

/**
 * Which connected patient a doctor is currently viewing. `null` means the
 * doctor's own example patient (default). Clinical pages append `?crianca=<id>`
 * to their API calls when a connected patient is selected, so the same pages
 * serve both the demo patient and any linked real patient.
 */
interface MedicoContext {
  criancaAtiva: string | null
  nomeAtivo: string | null
  setPaciente: (criancaId: string | null, nome: string | null) => void
}

export const useMedicoContext = create<MedicoContext>((set) => ({
  criancaAtiva: null,
  nomeAtivo: null,
  setPaciente: (criancaAtiva, nomeAtivo) => set({ criancaAtiva, nomeAtivo }),
}))

/** Query suffix for the active patient, or '' for the doctor's own journey. */
export function criancaQuery(criancaAtiva: string | null): string {
  return criancaAtiva ? `?crianca=${encodeURIComponent(criancaAtiva)}` : ''
}
