import mongoose, { Schema } from 'mongoose'
import type { InferSchemaType } from 'mongoose'
import { campoCifrado } from '../security/cripto.js'

export const PAPEIS = ['gestante', 'mae', 'pai', 'medico', 'admin'] as const
export type Papel = (typeof PAPEIS)[number]

/** Roles that represent a family member responsible for a child journey. */
export const PAPEIS_FAMILIA = ['gestante', 'mae', 'pai'] as const

export const VERIFICACAO = ['nao_aplicavel', 'pendente', 'verificado', 'recusado'] as const
export type VerificacaoStatus = (typeof VERIFICACAO)[number]

const userSchema = new Schema(
  {
    nome: { type: String, required: true, trim: true, maxlength: 80 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    senhaHash: { type: String, required: true },
    papel: { type: String, enum: PAPEIS, required: true },

    // Doctor-only. CPF is sensitive PII — stored only for doctors, never returned
    // to the client, and should be encrypted at rest in production (see SECURITY.md).
    /**
     * Cifrado em repouso (AES-256-GCM, ver server/security/cripto.ts). O
     * getter/setter do Mongoose faz a volta, então nenhuma rota muda: quem lê
     * `user.cpf` continua lendo o CPF.
     *
     * `maxlength` sairia errado aqui — o valor gravado é o texto cifrado, e é
     * bem maior que o CPF. O tamanho de entrada é validado no zod, que é onde
     * ele deve ser validado.
     */
    cpf: { type: String, default: '', select: false, ...campoCifrado },
    crm: { type: String, default: '' },
    crmUf: { type: String, default: '' },
    especialidade: { type: String, default: '', maxlength: 60 },
    verificacaoStatus: { type: String, enum: VERIFICACAO, default: 'nao_aplicavel' },

    /**
     * Contato e identidade coletados no cadastro.
     *
     * O telefone é o canal dos lembretes clínicos — a consulta que a pessoa não
     * pode perder não chega por push de navegador. Fica fora de `select: false`
     * porque é o próprio dono que lê o dele no perfil; o que nunca sai daqui é o
     * CPF.
     */
    telefone: { type: String, default: '', trim: true, maxlength: 20 },
    /**
     * Data de nascimento do titular da conta — não confundir com a da criança,
     * que vive na jornada (`Crianca.dataNascimento`). Aqui ela serve para duas
     * coisas: conferir que quem cria a conta tem idade para consentir sozinho, e
     * dar contexto clínico (idade materna é fator de risco gestacional).
     */
    dataNascimento: { type: Date, default: null },

    /**
     * O aceite dos termos, com versão e data.
     *
     * Guardar só `true` não prova nada: os termos mudam, e um aceite sem versão
     * não diz *a que* a pessoa disse sim. A dupla versão+data é o que torna o
     * consentimento auditável, que é o ponto da LGPD.
     */
    aceiteTermos: {
      versao: { type: String, default: '' },
      em: { type: Date, default: null },
    },
    /**
     * Opt-in separado para comunicações de marketing/novidades. Separado de
     * propósito: consentimento agregado não é consentimento — quem aceita os
     * termos para poder usar o produto não aceitou receber e-mail promocional.
     */
    aceiteComunicacoes: { type: Boolean, default: false },

    /**
     * A conta nasceu com senha que outra pessoa escolheu (hoje só a de admin,
     * provisionada). O `/app` empurra para a troca antes de deixar usar
     * qualquer coisa — uma senha inicial que nunca é trocada é uma senha
     * compartilhada.
     */
    trocaSenhaObrigatoria: { type: Boolean, default: false },
  },
  { timestamps: true },
)

export type UserDoc = InferSchemaType<typeof userSchema> & {
  _id: mongoose.Types.ObjectId
}

// Guard against model recompilation on serverless warm invocations.
export const User: mongoose.Model<UserDoc> =
  (mongoose.models.User as mongoose.Model<UserDoc>) ??
  mongoose.model<UserDoc>('User', userSchema)
