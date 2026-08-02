import { idadeEm, somenteDigitos, validarCPF, validarCRM, validarTelefone } from '@/lib/br-docs'
import { senhaAceitavel } from '@/lib/senha'
import { momentoPadrao } from '@/lib/stores/onboarding'
import type { MomentoGestacao, Perfil } from '@/lib/stores/onboarding'
import type { RegisterInput } from '@/lib/stores/auth'

/**
 * O formulário de cadastro, inteiro, num tipo só.
 *
 * O cadastro pede bem mais do que nome/e-mail/senha, e cada campo obrigatório
 * está aqui porque alguma tela depende dele: sem telefone não há lembrete de
 * consulta, sem data de nascimento não há cálculo de risco por idade, sem CPF o
 * registro não casa com o convênio nem com o cadastro que a clínica já tem. Um
 * campo que nenhuma tela usa não deveria estar sendo pedido.
 *
 * A validação daqui é gêmea da do servidor (`server/validation.ts`) e existe
 * para dar a resposta **antes** da viagem de rede — não para substituí-la. O
 * servidor nunca confia nisto.
 */
export interface DadosCadastro {
  // ---- Identidade e contato (todos os perfis) ----
  nome: string
  email: string
  telefone: string
  cpf: string
  /** `YYYY-MM-DD` do titular da conta. */
  dataNascimento: string

  // ---- Acesso ----
  senha: string
  confirmarSenha: string

  // ---- Só médico ----
  crm: string
  crmUf: string
  especialidade: string

  // ---- Só família ----
  momento: MomentoGestacao
  /** Data provável do parto. */
  dpp: string
  nomeBebe: string
  dataNascimentoBebe: string

  // ---- Consentimento ----
  aceiteTermos: boolean
  aceiteComunicacoes: boolean
}

export const DADOS_VAZIOS: DadosCadastro = {
  nome: '',
  email: '',
  telefone: '',
  cpf: '',
  dataNascimento: '',
  senha: '',
  confirmarSenha: '',
  crm: '',
  crmUf: '',
  especialidade: '',
  momento: 'gestante',
  dpp: '',
  nomeBebe: '',
  dataNascimentoBebe: '',
  aceiteTermos: false,
  aceiteComunicacoes: false,
}

export type Erros = Partial<Record<keyof DadosCadastro, string>>

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Passo 1 — quem é a pessoa e como falamos com ela. Igual para todo perfil. */
export function validarIdentidade(dados: DadosCadastro): Erros {
  const erros: Erros = {}

  const partes = dados.nome.trim().split(/\s+/).filter(Boolean)
  if (partes.length < 2) erros.nome = 'Escreva seu nome completo (nome e sobrenome).'
  else if (!/^[\p{L}\s'.-]+$/u.test(dados.nome.trim())) erros.nome = 'Use só letras, por favor.'

  if (!EMAIL.test(dados.email.trim())) erros.email = 'Esse e-mail parece incompleto. Confere pra mim?'
  if (!validarTelefone(dados.telefone)) erros.telefone = 'Telefone inválido. Use DDD + número.'
  if (!validarCPF(dados.cpf)) erros.cpf = 'CPF inválido. Confere os números?'

  const idade = idadeEm(dados.dataNascimento)
  if (idade === null) erros.dataNascimento = 'Informe sua data de nascimento.'
  else if (idade < 0 || idade > 120) erros.dataNascimento = 'Confere a data de nascimento?'
  else if (idade < 16) erros.dataNascimento = 'Para criar uma conta é preciso ter 16 anos ou mais.'

  return erros
}

/**
 * Passo 2 — a senha, o que é específico do perfil, e o aceite.
 *
 * A confirmação de senha só é checada aqui, e não a cada tecla: acusar
 * "as senhas não conferem" no primeiro caractere do segundo campo é reclamar de
 * algo que a pessoa ainda está fazendo.
 */
export function validarSeguranca(dados: DadosCadastro, perfil: Perfil): Erros {
  const erros: Erros = {}

  if (!senhaAceitavel(dados.senha))
    erros.senha = 'Use 8 caracteres ou mais, com pelo menos uma letra e um número.'
  else if (dados.senha !== dados.confirmarSenha) erros.confirmarSenha = 'As senhas não conferem.'

  if (perfil === 'medico') {
    if (!validarCRM(dados.crm, dados.crmUf)) erros.crm = 'Informe seu CRM (4 a 6 dígitos) e a UF de registro.'
    if (dados.especialidade.trim().length < 2) erros.especialidade = 'Escolha ou informe sua especialidade.'
  } else {
    if (dados.momento === 'ja-nasceu') {
      const idade = idadeEm(dados.dataNascimentoBebe)
      if (idade === null) erros.dataNascimentoBebe = 'Informe a data de nascimento do bebê.'
      else if (idade < 0) erros.dataNascimentoBebe = 'Essa data está no futuro. Confere pra mim?'
      else if (idade > 18) erros.dataNascimentoBebe = 'A trilha acompanha da gestação aos 18 anos.'
    }
    // A DPP fica opcional: muita gente ainda não fez a primeira ultrassonografia
    // quando cria a conta, e travar o cadastro nisso seria exigir um exame para
    // poder marcar o exame. Quando vem preenchida, precisa ser plausível.
    if (dados.momento === 'gestante' && dados.dpp) {
      const diasAteOParto = diferencaEmDias(dados.dpp)
      if (diasAteOParto === null) erros.dpp = 'Data inválida.'
      else if (diasAteOParto < -60 || diasAteOParto > 300)
        erros.dpp = 'Essa data não parece uma DPP. Confere pra mim?'
    }
  }

  if (!dados.aceiteTermos) {
    erros.aceiteTermos = 'Para criar a conta, é preciso aceitar os termos e a política de privacidade.'
  }

  return erros
}

export function temErro(erros: Erros): boolean {
  return Object.keys(erros).length > 0
}

/** Traduz o formulário para o corpo que `POST /auth/register` espera. */
export function paraRegistro(dados: DadosCadastro, perfil: Perfil): RegisterInput {
  const comum = {
    nome: dados.nome.trim().replace(/\s+/g, ' '),
    email: dados.email.trim(),
    senha: dados.senha,
    papel: perfil,
    cpf: somenteDigitos(dados.cpf),
    telefone: somenteDigitos(dados.telefone),
    dataNascimento: dados.dataNascimento,
    aceiteTermos: true as const,
    aceiteComunicacoes: dados.aceiteComunicacoes,
  }

  if (perfil === 'medico') {
    return {
      ...comum,
      crm: somenteDigitos(dados.crm),
      crmUf: dados.crmUf,
      especialidade: dados.especialidade.trim(),
    }
  }

  return {
    ...comum,
    momento: dados.momento,
    dpp: dados.momento === 'gestante' && dados.dpp ? dados.dpp : undefined,
    nomeBebe: dados.nomeBebe.trim() || undefined,
    dataNascimentoBebe:
      dados.momento === 'ja-nasceu' && dados.dataNascimentoBebe ? dados.dataNascimentoBebe : undefined,
  }
}

/** O `momento` que o perfil implica — o formulário abre já no ponto certo. */
export function dadosParaPerfil(dados: DadosCadastro, perfil: Perfil): DadosCadastro {
  if (perfil === 'medico') return dados
  return { ...dados, momento: momentoPadrao(perfil) }
}

function diferencaEmDias(dataISO: string, referencia = new Date()): number | null {
  const alvo = new Date(`${dataISO}T00:00:00`)
  if (Number.isNaN(alvo.getTime())) return null
  return Math.round((alvo.getTime() - referencia.getTime()) / 86_400_000)
}
