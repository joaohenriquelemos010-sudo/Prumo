/** Espelha o `serialize` de `server/routes/pacientes.ts`. */
export interface Paciente {
  id: string
  nome: string
  nomeBebe: string
  momento: 'planejando' | 'gestante' | 'ja-nasceu'
  dpp: string | null
  dataNascimento: string | null
  temConta: boolean
  /** Quanto da ficha administrativa está preenchido, de 0 a 100. */
  completude: number
  /**
   * A ficha veio da paciente pelo link de pré-cadastro? `revisadoEm` nulo com
   * `recebidoEm` preenchido significa **declarado, ainda não conferido**.
   */
  preCadastro: {
    recebidoEm: string | null
    revisadoEm: string | null
  }
  titular: {
    nome: string
    dataNascimento: string | null
    /** Só vem na leitura de uma ficha — a lista nunca carrega documento. */
    cpf: string
    rg: string
    sexo: string
    estadoCivil: string
    profissao: string
    /** Data URL reduzida no cliente (ver `lib/imagem.ts`). Vazio quando não há. */
    foto: string
    telefone: string
    telefoneSecundario: string
    email: string
    observacoes: string
    endereco: {
      cep: string
      logradouro: string
      numero: string
      complemento: string
      bairro: string
      cidade: string
      uf: string
    }
    emergencia: {
      nome: string
      parentesco: string
      telefone: string
    }
    familia: {
      companheiro: string
      filhos: { nome: string; dataNascimento: string | null }[]
    }
    preferencias: {
      dias: string[]
      periodos: string[]
      restricoes: string
    }
  }
  convenio: {
    tipo: string
    operadora: string
    plano: string
    carteirinha: string
    /** `MM/AAAA`, como está impresso no cartão. */
    validade: string
  }
  vinculacao: {
    /** Vazio quando não há código válido — expirado nunca chega aqui. */
    codigo: string
    expiraEm: string | null
    vinculadaEm: string | null
  }
}
