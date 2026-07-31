import mongoose, { Schema } from 'mongoose'
import type { InferSchemaType } from 'mongoose'

/**
 * Uma prescrição.
 *
 * ## A decisão de projeto mudou, e vale registrar por quê
 *
 * O plano original previa integração com a Memed, guardando **apenas a
 * referência** — id da prescrição lá, nunca o conteúdo — porque nesse desenho a
 * Memed é a custodiante legal do documento.
 *
 * Sem essa integração (que exige parceria comercial), o custodiante somos nós. E
 * isso inverte a regra: o conteúdo **precisa** ficar aqui, e precisa entrar na
 * história clínica como qualquer outro ato — encadeado por hash em `Evolucao`, e
 * dentro do pacote de transferência. Uma receita que a médica emitiu e o Prumo
 * não guarda é um buraco no prontuário.
 *
 * Se a Memed entrar um dia, `memedId` já existe: o conteúdo passa a ser dela, e
 * este documento vira o índice local.
 *
 * ## Sobre validade jurídica
 *
 * Este modelo guarda a receita; ele **não a assina**. A Lei 14.063/2020 e a
 * Res. CFM 2.299/2021 exigem assinatura digital qualificada (ICP-Brasil) para
 * dispensação sem presença física. O PDF gerado traz o bloco de assinatura e
 * declara, em letra visível, que é uma via não assinada digitalmente até que a
 * médica a assine — no papel, ou com o certificado dela por fora (o assinador
 * do gov.br é gratuito). Fingir validade que não existe seria o defeito mais
 * caro que este arquivo poderia ter.
 */
export const TIPOS_PRESCRICAO = ['simples', 'antimicrobiano', 'especial'] as const
export type TipoPrescricao = (typeof TIPOS_PRESCRICAO)[number]

/**
 * Quantas vias a receita exige.
 *
 * Não é enfeite de layout: antimicrobiano exige duas vias pela RDC 20/2011 (uma
 * fica retida na farmácia), e receita de controle especial exige duas pela
 * Portaria 344/1998. Emitir uma via só faz a farmácia recusar — e quem descobre
 * isso é a paciente, no balcão.
 */
export const VIAS_POR_TIPO: Record<TipoPrescricao, number> = {
  simples: 1,
  antimicrobiano: 2,
  especial: 2,
}

const itemSchema = new Schema(
  {
    /** Como a médica escreveu. Princípio ativo ou marca — a escolha é dela. */
    medicamento: { type: String, required: true, maxlength: 200 },
    /** "1 comprimido", "10 mL", "1 aplicação". */
    dose: { type: String, default: '', maxlength: 120 },
    /** "de 8 em 8 horas", "à noite", "em jejum". */
    posologia: { type: String, default: '', maxlength: 200 },
    /** "por 7 dias", "uso contínuo". */
    duracao: { type: String, default: '', maxlength: 120 },
    /** Quantidade a dispensar — o que a farmácia lê. */
    quantidade: { type: String, default: '', maxlength: 80 },
    observacao: { type: String, default: '', maxlength: 300 },
  },
  { _id: false },
)

const prescricaoSchema = new Schema(
  {
    jornada: { type: Schema.Types.ObjectId, ref: 'Crianca', required: true, index: true },
    consulta: { type: Schema.Types.ObjectId, ref: 'Consulta', default: null, index: true },

    /** Quem prescreveu. CRM e UF ficam copiados: o documento é do momento. */
    medicoId: { type: String, required: true, index: true },
    medicoNome: { type: String, default: '' },
    medicoCrm: { type: String, default: '' },
    medicoCrmUf: { type: String, default: '' },
    medicoEspecialidade: { type: String, default: '' },

    /** Para quem, como estava escrito na hora. */
    pacienteNome: { type: String, default: '' },

    tipo: { type: String, enum: TIPOS_PRESCRICAO, default: 'simples' },
    itens: { type: [itemSchema], default: [] },
    orientacoes: { type: String, default: '', maxlength: 1000 },

    emitidaEm: { type: Date, default: Date.now, index: true },
    /**
     * Depois disso a farmácia recusa. 30 dias é o padrão de receita simples;
     * antimicrobiano tem 10 pela RDC 20/2011. Guardado em vez de calculado
     * porque a regra pode mudar e a receita emitida ontem continua valendo pelo
     * prazo de ontem.
     */
    validaAte: { type: Date, required: true },

    /**
     * Cancelada não some — ela existiu, e o prontuário é append-only. O que muda
     * é que ela para de ser oferecida e o PDF sai carimbado.
     */
    canceladaEm: { type: Date, default: null },
    motivoCancelamento: { type: String, default: '', maxlength: 300 },

    /** Reservado. Ver o comentário do topo. */
    memedId: { type: String, default: '' },
  },
  { timestamps: true },
)

prescricaoSchema.index({ jornada: 1, emitidaEm: -1 })

export type PrescricaoDoc = InferSchemaType<typeof prescricaoSchema> & {
  _id: mongoose.Types.ObjectId
}

export const Prescricao: mongoose.Model<PrescricaoDoc> =
  (mongoose.models.Prescricao as mongoose.Model<PrescricaoDoc>) ??
  mongoose.model<PrescricaoDoc>('Prescricao', prescricaoSchema)
