import {
  formatarCPF,
  formatarTelefone,
  idadeEm,
  somenteDigitos,
  validarCPF,
  validarTelefone,
} from '@/lib/br-docs'

/**
 * O cadastro da paciente, inteiro, num módulo puro.
 *
 * Três telas mexem nos mesmos dados — a ficha completa do consultório, o
 * cadastro rápido de balcão e o pré-cadastro que a própria paciente preenche no
 * celular. Deixar a validação e as máscaras dentro de qualquer uma delas
 * significaria três versões da regra e duas delas ficando para trás. Aqui não
 * há React: o que este arquivo faz é dizer o que é um cadastro válido e como se
 * escreve cada campo, e isso é testável sem montar tela nenhuma.
 *
 * A validação é gêmea da do servidor (`server/validation.ts`) e existe para dar
 * a resposta **antes** da viagem de rede — o servidor nunca confia nisto.
 */

export type Sexo = '' | 'feminino' | 'masculino' | 'outro'
export type EstadoCivil = '' | 'solteira' | 'casada' | 'uniao-estavel' | 'divorciada' | 'viuva'
export type Momento = 'planejando' | 'gestante' | 'ja-nasceu'

export interface Endereco {
  cep: string
  logradouro: string
  numero: string
  complemento: string
  bairro: string
  cidade: string
  uf: string
}

export interface Filho {
  nome: string
  /** `YYYY-MM-DD`. */
  dataNascimento: string
}

export interface DadosPaciente {
  // ---- 1. Identificação ----
  nome: string
  cpf: string
  rg: string
  /** `YYYY-MM-DD`. */
  dataNascimento: string
  sexo: Sexo
  estadoCivil: EstadoCivil
  profissao: string
  /** Data URL já reduzida no cliente. Vazio quando não há foto. */
  foto: string

  // ---- 2. Momento (o eixo da trilha do Prumo) ----
  momento: Momento
  /** Data provável do parto, quando gestante. */
  dpp: string
  nomeBebe: string
  dataNascimentoBebe: string

  // ---- 3. Contato ----
  telefone: string
  telefoneSecundario: string
  email: string

  // ---- 4. Endereço ----
  endereco: Endereco

  // ---- 5. Convênio ----
  convenio: {
    operadora: string
    plano: string
    carteirinha: string
    /** `MM/AAAA` — é o que vem impresso no cartão. */
    validade: string
  }

  // ---- 6. Contato de emergência ----
  emergencia: {
    nome: string
    parentesco: string
    telefone: string
  }

  // ---- 7. Informações familiares ----
  familia: {
    companheiro: string
    filhos: Filho[]
  }

  // ---- 8. Preferências de horário ----
  preferencias: {
    /** `seg`…`dom` — ver `DIAS_SEMANA`. */
    dias: string[]
    /** `manha` | `tarde` | `noite`. */
    periodos: string[]
    restricoes: string
  }

  observacoes: string
}

export const PACIENTE_VAZIA: DadosPaciente = {
  nome: '',
  cpf: '',
  rg: '',
  dataNascimento: '',
  sexo: 'feminino',
  estadoCivil: '',
  profissao: '',
  foto: '',
  momento: 'gestante',
  dpp: '',
  nomeBebe: '',
  dataNascimentoBebe: '',
  telefone: '',
  telefoneSecundario: '',
  email: '',
  endereco: { cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', uf: '' },
  convenio: { operadora: '', plano: '', carteirinha: '', validade: '' },
  emergencia: { nome: '', parentesco: '', telefone: '' },
  familia: { companheiro: '', filhos: [] },
  preferencias: { dias: [], periodos: [], restricoes: '' },
  observacoes: '',
}

export const SEXOS: { id: Exclude<Sexo, ''>; rotulo: string }[] = [
  { id: 'feminino', rotulo: 'Feminino' },
  { id: 'masculino', rotulo: 'Masculino' },
  { id: 'outro', rotulo: 'Outro' },
]

export const ESTADOS_CIVIS: { id: Exclude<EstadoCivil, ''>; rotulo: string }[] = [
  { id: 'solteira', rotulo: 'Solteira' },
  { id: 'casada', rotulo: 'Casada' },
  { id: 'uniao-estavel', rotulo: 'União estável' },
  { id: 'divorciada', rotulo: 'Divorciada' },
  { id: 'viuva', rotulo: 'Viúva' },
]

export const PARENTESCOS = [
  'Marido/Companheiro',
  'Mãe',
  'Pai',
  'Irmã/Irmão',
  'Filha/Filho',
  'Amiga/Amigo',
  'Outro',
] as const

export const MOMENTOS: { id: Momento; rotulo: string; ajuda: string }[] = [
  { id: 'gestante', rotulo: 'Grávida', ajuda: 'A trilha abre no pré-natal.' },
  { id: 'ja-nasceu', rotulo: 'Bebê já nasceu', ajuda: 'A trilha abre na puericultura.' },
  { id: 'planejando', rotulo: 'Planejando engravidar', ajuda: 'Pré-concepcional.' },
]

export const DIAS_SEMANA = [
  { id: 'seg', rotulo: 'Seg' },
  { id: 'ter', rotulo: 'Ter' },
  { id: 'qua', rotulo: 'Qua' },
  { id: 'qui', rotulo: 'Qui' },
  { id: 'sex', rotulo: 'Sex' },
  { id: 'sab', rotulo: 'Sáb' },
  { id: 'dom', rotulo: 'Dom' },
] as const

export const PERIODOS = [
  { id: 'manha', rotulo: 'Manhã (06h – 12h)' },
  { id: 'tarde', rotulo: 'Tarde (12h – 18h)' },
  { id: 'noite', rotulo: 'Noite (18h – 22h)' },
] as const

/* ------------------------------------------------------------------ máscaras */

export function formatarCEP(valor: string): string {
  const d = somenteDigitos(valor).slice(0, 8)
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d
}

/**
 * RG não tem formato nacional: cada estado emite o seu, com e sem dígito, com e
 * sem letra. Por isso a "máscara" aqui só limpa o que não é caractere de
 * documento — inventar pontuação seria transformar o número de uma paciente do
 * Ceará no de uma paciente de São Paulo.
 */
export function limparRG(valor: string): string {
  return valor.replace(/[^0-9A-Za-z.\-/ ]/g, '').slice(0, 20)
}

/** `MM/AAAA` — a validade impressa no cartão do convênio. */
export function formatarValidade(valor: string): string {
  const d = somenteDigitos(valor).slice(0, 6)
  if (d.length <= 2) return d
  return `${d.slice(0, 2)}/${d.slice(2)}`
}

/** Carteirinha: dígitos e traços, sem inventar grupos. */
export function limparCarteirinha(valor: string): string {
  return valor.replace(/[^0-9A-Za-z.\- ]/g, '').slice(0, 30)
}

/* --------------------------------------------------------------- validação */

export type ErrosPaciente = Record<string, string>

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * As regras.
 *
 * `completo` separa duas situações que só parecem a mesma. Na **ficha completa**
 * (e no pré-cadastro que a paciente preenche com calma) pedimos identificação,
 * nascimento, sexo e um celular: sem CPF o registro não casa com o convênio, sem
 * data de nascimento não há cálculo de risco por idade, sem celular não há
 * lembrete de consulta. No **cadastro rápido de balcão** só o nome é exigido, e
 * isso é decisão de produto, não descuido: um formulário que trava no meio de um
 * atendimento é o que faz o médico anotar no papel e nunca mais voltar.
 *
 * O que nunca muda: campo preenchido é campo conferido. Um CPF errado é errado
 * nos dois modos — o opcional é *informar*, não é *informar errado*.
 */
export function validarPaciente(
  dados: DadosPaciente,
  { completo = true }: { completo?: boolean } = {},
): ErrosPaciente {
  const erros: ErrosPaciente = {}

  const nome = dados.nome.trim()
  if (nome.length < 2) erros.nome = 'Escreva o nome da paciente.'
  else if (completo && nome.split(/\s+/).filter(Boolean).length < 2)
    erros.nome = 'Escreva o nome completo (nome e sobrenome).'

  if (dados.cpf.trim()) {
    if (!validarCPF(dados.cpf)) erros.cpf = 'CPF inválido. Confere os números?'
  } else if (completo) {
    erros.cpf = 'Informe o CPF.'
  }

  if (dados.dataNascimento) {
    const idade = idadeEm(dados.dataNascimento)
    if (idade === null) erros.dataNascimento = 'Data inválida.'
    else if (idade < 0) erros.dataNascimento = 'Essa data está no futuro. Confere pra mim?'
    else if (idade > 120) erros.dataNascimento = 'Confere a data de nascimento?'
  } else if (completo) {
    erros.dataNascimento = 'Informe a data de nascimento.'
  }

  if (completo && !dados.sexo) erros.sexo = 'Selecione o sexo.'

  if (dados.telefone.trim()) {
    if (!validarTelefone(dados.telefone)) erros.telefone = 'Telefone inválido. Use DDD + número.'
  } else if (completo) {
    erros.telefone = 'Informe o celular principal.'
  }

  if (dados.telefoneSecundario.trim() && !validarTelefone(dados.telefoneSecundario))
    erros.telefoneSecundario = 'Telefone inválido. Use DDD + número.'

  if (dados.email.trim() && !EMAIL.test(dados.email.trim()))
    erros.email = 'Esse e-mail parece incompleto. Confere pra mim?'

  if (dados.endereco.cep.trim() && somenteDigitos(dados.endereco.cep).length !== 8)
    erros['endereco.cep'] = 'O CEP tem 8 dígitos.'

  if (dados.endereco.uf.trim() && dados.endereco.uf.trim().length !== 2)
    erros['endereco.uf'] = 'Selecione o estado.'

  if (dados.convenio.validade.trim() && !validadeValida(dados.convenio.validade))
    erros['convenio.validade'] = 'Use mês/ano — por exemplo, 07/2027.'

  if (dados.emergencia.telefone.trim() && !validarTelefone(dados.emergencia.telefone))
    erros['emergencia.telefone'] = 'Telefone inválido. Use DDD + número.'

  /*
   * A DPP fica opcional mesmo na ficha completa: muita paciente ainda não fez a
   * primeira ultrassonografia quando chega ao consultório, e travar o cadastro
   * nisso seria exigir um exame para poder marcar o exame. Quando vem
   * preenchida, precisa ser plausível.
   */
  if (dados.momento === 'gestante' && dados.dpp) {
    const dias = diferencaEmDias(dados.dpp)
    if (dias === null) erros.dpp = 'Data inválida.'
    else if (dias < -60 || dias > 300) erros.dpp = 'Essa data não parece uma DPP. Confere pra mim?'
  }

  if (dados.momento === 'ja-nasceu' && dados.dataNascimentoBebe) {
    const idade = idadeEm(dados.dataNascimentoBebe)
    if (idade === null) erros.dataNascimentoBebe = 'Data inválida.'
    else if (idade < 0) erros.dataNascimentoBebe = 'Essa data está no futuro. Confere pra mim?'
    else if (idade > 18) erros.dataNascimentoBebe = 'A trilha acompanha da gestação aos 18 anos.'
  }

  dados.familia.filhos.forEach((filho, i) => {
    if (!filho.nome.trim() && !filho.dataNascimento) return
    if (filho.nome.trim().length < 2) erros[`filhos.${i}.nome`] = 'Escreva o nome.'
    if (filho.dataNascimento) {
      const idade = idadeEm(filho.dataNascimento)
      if (idade === null || idade < 0) erros[`filhos.${i}.data`] = 'Data inválida.'
    }
  })

  return erros
}

export function temErro(erros: ErrosPaciente): boolean {
  return Object.keys(erros).length > 0
}

function validadeValida(valor: string): boolean {
  const m = /^(\d{2})\/(\d{4})$/.exec(valor.trim())
  if (!m) return false
  const mes = Number(m[1])
  const ano = Number(m[2])
  return mes >= 1 && mes <= 12 && ano >= 2000 && ano <= 2100
}

function diferencaEmDias(dataISO: string, referencia = new Date()): number | null {
  const alvo = new Date(`${dataISO}T00:00:00`)
  if (Number.isNaN(alvo.getTime())) return null
  return Math.round((alvo.getTime() - referencia.getTime()) / 86_400_000)
}

/* ----------------------------------------------------------------- seções */

export type IdSecao =
  | 'identificacao'
  | 'momento'
  | 'contato'
  | 'endereco'
  | 'convenio'
  | 'emergencia'
  | 'familia'
  | 'preferencias'

export interface Secao {
  id: IdSecao
  rotulo: string
  /** Seção que o formulário exige para salvar. */
  obrigatoria: boolean
}

export const SECOES: Secao[] = [
  { id: 'identificacao', rotulo: 'Identificação', obrigatoria: true },
  { id: 'momento', rotulo: 'Momento da jornada', obrigatoria: true },
  { id: 'contato', rotulo: 'Contato', obrigatoria: true },
  { id: 'endereco', rotulo: 'Endereço', obrigatoria: false },
  { id: 'convenio', rotulo: 'Convênio', obrigatoria: false },
  { id: 'emergencia', rotulo: 'Contato de emergência', obrigatoria: false },
  { id: 'familia', rotulo: 'Informações familiares', obrigatoria: false },
  { id: 'preferencias', rotulo: 'Preferências de horário', obrigatoria: false },
]

/**
 * Uma seção "tem conteúdo" quando alguém digitou algo nela.
 *
 * É o que alimenta os pontinhos do índice lateral. Serve para orientar — *o que
 * já preenchi?* — e nunca para cobrar: as seções opcionais podem ficar vazias
 * para sempre sem que nada trave.
 */
export function secoesPreenchidas(dados: DadosPaciente): Record<IdSecao, boolean> {
  const algum = (...valores: string[]) => valores.some((v) => v.trim() !== '')

  return {
    identificacao: algum(dados.nome, dados.cpf, dados.rg, dados.dataNascimento, dados.profissao),
    momento:
      dados.momento === 'gestante'
        ? algum(dados.dpp)
        : dados.momento === 'ja-nasceu'
          ? algum(dados.dataNascimentoBebe, dados.nomeBebe)
          : true,
    contato: algum(dados.telefone, dados.telefoneSecundario, dados.email),
    endereco: algum(dados.endereco.cep, dados.endereco.logradouro, dados.endereco.cidade),
    convenio: algum(dados.convenio.operadora, dados.convenio.plano, dados.convenio.carteirinha),
    emergencia: algum(dados.emergencia.nome, dados.emergencia.telefone),
    familia:
      algum(dados.familia.companheiro) ||
      dados.familia.filhos.some((f) => f.nome.trim() !== ''),
    preferencias:
      dados.preferencias.dias.length > 0 ||
      dados.preferencias.periodos.length > 0 ||
      dados.preferencias.restricoes.trim() !== '',
  }
}

/** Em qual seção mora cada erro — é assim que "ir para o primeiro erro" funciona. */
export function secaoDoErro(campo: string): IdSecao {
  if (campo.startsWith('endereco.')) return 'endereco'
  if (campo.startsWith('convenio.')) return 'convenio'
  if (campo.startsWith('emergencia.')) return 'emergencia'
  if (campo.startsWith('filhos.')) return 'familia'
  if (['telefone', 'telefoneSecundario', 'email'].includes(campo)) return 'contato'
  if (['dpp', 'dataNascimentoBebe', 'nomeBebe', 'momento'].includes(campo)) return 'momento'
  return 'identificacao'
}

/* ------------------------------------------------------------- ida e volta */

/** O corpo que `POST /api/pacientes` e `PATCH /api/pacientes/:id` esperam. */
export function paraApi(dados: DadosPaciente) {
  const limpo = (v: string) => v.trim()

  return {
    nome: limpo(dados.nome).replace(/\s+/g, ' '),
    cpf: somenteDigitos(dados.cpf),
    rg: limpo(dados.rg),
    dataNascimento: dados.dataNascimento,
    sexo: dados.sexo,
    estadoCivil: dados.estadoCivil,
    profissao: limpo(dados.profissao),
    foto: dados.foto,
    momento: dados.momento,
    dpp: dados.momento === 'gestante' ? dados.dpp : '',
    nomeBebe: limpo(dados.nomeBebe),
    dataNascimentoBebe: dados.momento === 'ja-nasceu' ? dados.dataNascimentoBebe : '',
    telefone: somenteDigitos(dados.telefone),
    telefoneSecundario: somenteDigitos(dados.telefoneSecundario),
    email: limpo(dados.email).toLowerCase(),
    endereco: {
      cep: somenteDigitos(dados.endereco.cep),
      logradouro: limpo(dados.endereco.logradouro),
      numero: limpo(dados.endereco.numero),
      complemento: limpo(dados.endereco.complemento),
      bairro: limpo(dados.endereco.bairro),
      cidade: limpo(dados.endereco.cidade),
      uf: limpo(dados.endereco.uf).toUpperCase(),
    },
    convenio: {
      operadora: limpo(dados.convenio.operadora),
      plano: limpo(dados.convenio.plano),
      carteirinha: limpo(dados.convenio.carteirinha),
      validade: limpo(dados.convenio.validade),
    },
    emergencia: {
      nome: limpo(dados.emergencia.nome),
      parentesco: limpo(dados.emergencia.parentesco),
      telefone: somenteDigitos(dados.emergencia.telefone),
    },
    familia: {
      companheiro: limpo(dados.familia.companheiro),
      // Uma linha em branco que a pessoa abriu e não preencheu não é um filho.
      filhos: dados.familia.filhos
        .filter((f) => f.nome.trim() !== '')
        .map((f) => ({ nome: limpo(f.nome), dataNascimento: f.dataNascimento })),
    },
    preferencias: {
      dias: dados.preferencias.dias,
      periodos: dados.preferencias.periodos,
      restricoes: limpo(dados.preferencias.restricoes),
    },
    observacoes: limpo(dados.observacoes),
  }
}

/** A forma que o servidor devolve em `paciente.titular` (ver `serialize`). */
export interface TitularApi {
  nome?: string
  cpf?: string
  rg?: string
  dataNascimento?: string | null
  sexo?: string
  estadoCivil?: string
  profissao?: string
  foto?: string
  telefone?: string
  telefoneSecundario?: string
  email?: string
  observacoes?: string
  endereco?: Partial<Endereco>
  emergencia?: { nome?: string; parentesco?: string; telefone?: string }
  familia?: { companheiro?: string; filhos?: { nome?: string; dataNascimento?: string | null }[] }
  preferencias?: { dias?: string[]; periodos?: string[]; restricoes?: string }
}

export interface PacienteApi {
  nome: string
  nomeBebe?: string
  momento?: Momento
  dpp?: string | null
  dataNascimento?: string | null
  titular?: TitularApi
  convenio?: { operadora?: string; plano?: string; carteirinha?: string; validade?: string | null }
}

/** Só a data — o `<input type="date">` recusa o ISO com hora. */
function soData(valor: string | null | undefined): string {
  return valor ? String(valor).slice(0, 10) : ''
}

/**
 * A validade do convênio, sempre como `MM/AAAA`.
 *
 * O servidor já devolve nesse formato (ver `dataParaValidade`), mas aceitar
 * também o ISO não é zelo desnecessário: é o mesmo campo lido de um documento
 * antigo, de um import ou de uma rota que ainda não passou pelo serializador. O
 * formulário não pode ficar em branco por causa de qual das duas formas chegou.
 */
function validadeDaApi(valor: string | null | undefined): string {
  const bruto = (valor ?? '').trim()
  if (!bruto) return ''
  if (/^\d{2}\/\d{4}$/.test(bruto)) return bruto

  const [ano, mes] = bruto.slice(0, 10).split('-')
  return mes && ano && ano.length === 4 ? `${mes}/${ano}` : ''
}

/** Traz o cadastro gravado de volta para o formulário. */
export function daApi(paciente: PacienteApi): DadosPaciente {
  const t = paciente.titular ?? {}
  const c = paciente.convenio ?? {}

  return {
    ...PACIENTE_VAZIA,
    nome: t.nome || paciente.nome || '',
    cpf: t.cpf ? formatarCPF(t.cpf) : '',
    rg: t.rg ?? '',
    dataNascimento: soData(t.dataNascimento),
    sexo: (t.sexo as Sexo) || 'feminino',
    estadoCivil: (t.estadoCivil as EstadoCivil) || '',
    profissao: t.profissao ?? '',
    foto: t.foto ?? '',
    momento: paciente.momento ?? 'gestante',
    dpp: soData(paciente.dpp),
    nomeBebe: paciente.nomeBebe ?? '',
    dataNascimentoBebe: soData(paciente.dataNascimento),
    telefone: t.telefone ? formatarTelefone(t.telefone) : '',
    telefoneSecundario: t.telefoneSecundario ? formatarTelefone(t.telefoneSecundario) : '',
    email: t.email ?? '',
    endereco: {
      ...PACIENTE_VAZIA.endereco,
      ...(t.endereco ?? {}),
      cep: t.endereco?.cep ? formatarCEP(t.endereco.cep) : '',
    },
    convenio: {
      operadora: c.operadora ?? '',
      plano: c.plano ?? '',
      carteirinha: c.carteirinha ?? '',
      validade: validadeDaApi(c.validade),
    },
    emergencia: {
      nome: t.emergencia?.nome ?? '',
      parentesco: t.emergencia?.parentesco ?? '',
      telefone: t.emergencia?.telefone ? formatarTelefone(t.emergencia.telefone) : '',
    },
    familia: {
      companheiro: t.familia?.companheiro ?? '',
      filhos: (t.familia?.filhos ?? []).map((f) => ({
        nome: f.nome ?? '',
        dataNascimento: soData(f.dataNascimento),
      })),
    },
    preferencias: {
      dias: t.preferencias?.dias ?? [],
      periodos: t.preferencias?.periodos ?? [],
      restricoes: t.preferencias?.restricoes ?? '',
    },
    observacoes: t.observacoes ?? '',
  }
}
