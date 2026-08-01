import mongoose, { Schema } from 'mongoose'
import type { InferSchemaType } from 'mongoose'

/**
 * As áreas de atendimento que **esta** médica oferece — Gestação, Ginecologia,
 * Mastologia, Telemedicina.
 *
 * É um andar acima do `TipoAtendimento`. Aquele descreve *o horário*: quantos
 * minutos ocupa na agenda e qual formulário de prontuário abre. Este descreve
 * *a área de atuação*: sob qual guarda-chuva o atendimento acontece. Uma médica
 * de GO tem duas ou três categorias e uma dúzia de tipos dentro delas — misturar
 * os dois num modelo só obrigaria "Gestação" a ter uma duração em minutos, que
 * é uma pergunta sem resposta.
 *
 * Por isso são coleções separadas, e por isso esta não tem cor nem duração: o
 * que ela precisa carregar é nome, uma frase de descrição e se está no ar.
 */
const categoriaAtendimentoSchema = new Schema(
  {
    medicoId: { type: String, required: true, index: true },
    nome: { type: String, required: true, trim: true, maxlength: 60 },
    /** Uma frase sobre o que entra nesta área. Aparece na lista, abaixo do nome. */
    descricao: { type: String, default: '', trim: true, maxlength: 200 },
    /**
     * Some do agendamento sem sumir do histórico — atendimentos antigos apontam
     * para cá, e uma categoria apagada deixaria consultas do ano passado sem
     * dizer de que área foram.
     */
    ativo: { type: Boolean, default: true },
    ordem: { type: Number, default: 0 },
  },
  { timestamps: true },
)

// Duas categorias com o mesmo nome no mesmo consultório seriam indistinguíveis
// na hora de escolher — que é o único momento em que elas são lidas.
categoriaAtendimentoSchema.index({ medicoId: 1, nome: 1 }, { unique: true })

export type CategoriaAtendimentoDoc = InferSchemaType<typeof categoriaAtendimentoSchema> & {
  _id: mongoose.Types.ObjectId
}

export const CategoriaAtendimento: mongoose.Model<CategoriaAtendimentoDoc> =
  (mongoose.models.CategoriaAtendimento as mongoose.Model<CategoriaAtendimentoDoc>) ??
  mongoose.model<CategoriaAtendimentoDoc>('CategoriaAtendimento', categoriaAtendimentoSchema)
