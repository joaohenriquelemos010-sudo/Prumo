/** Espelha o `serialize` de `server/routes/pacientes.ts`. */
export interface Paciente {
  id: string
  nome: string
  nomeBebe: string
  momento: 'planejando' | 'gestante' | 'ja-nasceu'
  dpp: string | null
  dataNascimento: string | null
  temConta: boolean
  titular: {
    nome: string
    dataNascimento: string | null
    telefone: string
    email: string
    observacoes: string
  }
  vinculacao: {
    /** Vazio quando não há código válido — expirado nunca chega aqui. */
    codigo: string
    expiraEm: string | null
    vinculadaEm: string | null
  }
}
