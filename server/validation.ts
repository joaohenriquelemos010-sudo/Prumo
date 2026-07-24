import { z } from 'zod'
import { PAPEIS } from './models/User.js'
import { CATEGORIAS_EXAME } from './models/Exame.js'
import { CATEGORIAS_POST } from './models/Post.js'
import { validarCPF, somenteDigitos, UFS } from './br-docs.js'

/**
 * Server-side validation. The client validates too, but the server never trusts
 * the client — every request body is parsed here before it touches the database.
 */

export const registerSchema = z
  .object({
    nome: z
      .string()
      .trim()
      .min(2, 'Conta pra gente como podemos te chamar.')
      .max(80, 'Esse nome ficou longo demais.')
      .regex(/^[\p{L}\s'.-]+$/u, 'Use só letras, por favor.'),
    email: z.string().trim().toLowerCase().email('Esse e-mail parece incompleto.'),
    senha: z
      .string()
      .min(8, 'Sua senha precisa de pelo menos 8 caracteres.')
      .max(100, 'Senha longa demais.'),
    papel: z.enum(PAPEIS),
    // Doctor-only fields (validated conditionally below).
    cpf: z.string().trim().optional(),
    crm: z.string().trim().optional(),
    crmUf: z.string().trim().toUpperCase().optional(),
    especialidade: z.string().trim().max(60).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.papel !== 'medico') return
    // CPF is validated (real check digits) + name required; CRM is optional and
    // stored as-is for now (no official verification yet).
    if (!data.cpf || !validarCPF(data.cpf)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['cpf'], message: 'CPF inválido. Confere os números?' })
    }
    // Specialty is required for doctors (used in doctor-to-doctor sharing).
    if (!data.especialidade || data.especialidade.length < 2) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['especialidade'], message: 'Informe sua especialidade.' })
    }
  })
  .transform((data) => ({
    ...data,
    cpf: data.cpf ? somenteDigitos(data.cpf) : undefined,
    crm: data.crm ? somenteDigitos(data.crm) : undefined,
    crmUf: data.crmUf && (UFS as readonly string[]).includes(data.crmUf) ? data.crmUf : undefined,
  }))

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Confere o e-mail pra mim?'),
  senha: z.string().min(1, 'Digite sua senha.'),
})

export const trilhaProgressSchema = z.object({
  etapaId: z.string().trim().min(1).max(60),
  concluida: z.boolean(),
})

// Accepts an ISO datetime, a plain YYYY-MM-DD date, or null.
const dataOpcional = z
  .string()
  .refine((v) => !Number.isNaN(Date.parse(v)), 'Data inválida.')
  .nullable()
  .optional()

export const perfilCriancaSchema = z.object({
  nome: z.string().trim().max(80).optional(),
  momento: z.enum(['planejando', 'gestante', 'ja-nasceu']).optional(),
  dpp: dataOpcional,
  dataNascimento: dataOpcional,
})

export const vacinaToggleSchema = z.object({
  vacinaId: z.string().trim().min(1).max(60),
  aplicada: z.boolean(),
})

export const prontuarioUpdateSchema = z.object({
  tipoSanguineo: z.string().trim().max(8).optional(),
  alergias: z.string().trim().max(500).optional(),
  resumoGestacional: z.string().trim().max(2000).optional(),
  condicoes: z.array(z.string().trim().max(120)).max(30).optional(),
})

export const prontuarioEventoSchema = z.object({
  texto: z.string().trim().min(2, 'Escreva a anotação.').max(2000),
})

export const duvidaCreateSchema = z.object({
  texto: z.string().trim().min(2, 'Escreva sua dúvida.').max(1000, 'Dúvida longa demais.'),
  compartilhada: z.boolean().optional(),
})

export const duvidaUpdateSchema = z.object({
  texto: z.string().trim().min(2, 'Escreva sua dúvida.').max(1000).optional(),
  compartilhada: z.boolean().optional(),
})

export const respostaSchema = z.object({
  texto: z.string().trim().min(2, 'Escreva a resposta.').max(1000),
})

export const solicitacaoCreateSchema = z.object({
  prestadorId: z.string().trim().min(1),
  objetivo: z.enum(['exame', 'consulta-gestante', 'consulta-crianca']),
  modalidade: z.enum(['teleconsulta', 'presencial', 'domiciliar']).default('presencial'),
  mensagem: z.string().trim().max(500).optional(),
})

export const esqueciSenhaSchema = z.object({
  email: z.string().trim().toLowerCase().email('Digite um e-mail válido.'),
})

export const compartilhamentoCreateSchema = z.object({
  criancaId: z.string().trim().min(1, 'Escolha o paciente.'),
  email: z.string().trim().toLowerCase().email('Informe o e-mail do outro médico.'),
})

const campoLongo = z.string().trim().max(3000).optional()

export const consultaCreateSchema = z.object({
  tipo: z.enum(['pre-natal', 'pediatrica']).default('pediatrica'),
  subjetivo: campoLongo,
  objetivo: campoLongo,
  avaliacao: campoLongo,
  plano: campoLongo,
  peso: z.string().trim().max(20).optional(),
  altura: z.string().trim().max(20).optional(),
  pressao: z.string().trim().max(20).optional(),
})

export const exameCreateSchema = z.object({
  nome: z.string().trim().min(2, 'Dê um nome ao exame.').max(120),
  categoria: z.enum(CATEGORIAS_EXAME).default('outro'),
  dataExame: z
    .string()
    .refine((v) => !Number.isNaN(Date.parse(v)), 'Data inválida.')
    .optional(),
  observacoes: z.string().trim().max(1000).optional(),
})

export const postCreateSchema = z.object({
  texto: z.string().trim().min(2, 'Escreva algo para compartilhar.').max(1000, 'Ficou longo — resuma um pouco?'),
  categoria: z.enum(CATEGORIAS_POST).default('maternidade'),
  anonimo: z.boolean().optional(),
})

export const comentarioCreateSchema = z.object({
  texto: z.string().trim().min(1, 'Escreva um comentário.').max(500),
})

export type RegisterInput = z.infer<typeof registerSchema>
export type LoginInput = z.infer<typeof loginSchema>
