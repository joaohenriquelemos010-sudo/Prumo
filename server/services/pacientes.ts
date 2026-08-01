import { randomInt } from 'node:crypto'
import type { Types } from 'mongoose'
import { Jornada } from '../models/Jornada.js'
import { Agendamento } from '../models/Agendamento.js'
import { Consulta } from '../models/Consulta.js'
import { Exame } from '../models/Exame.js'
import { Evolucao } from '../models/Evolucao.js'
import { MedidaFetal } from '../models/MedidaFetal.js'
import { Duvida } from '../models/Duvida.js'
import { Prontuario } from '../models/Prontuario.js'

/**
 * Pacientes sem conta — o atendimento que acontece antes do cadastro.
 *
 * A regra do consultório é essa: chega alguém, é atendido, e o registro tem que
 * existir na hora. Exigir que a pessoa baixe um app e crie uma conta para poder
 * ser atendida inverte quem trabalha para quem. Então a jornada nasce sem dono,
 * tutelada pelo médico, e ganha dono depois — se e quando a paciente quiser.
 */

/**
 * Alfabeto sem `0/O`, `1/I/L` e `5/S`. O código é ditado em voz alta no balcão e
 * digitado por outra pessoa depois; os pares que se confundem custam uma ligação
 * cada vez que aparecem.
 */
const ALFABETO = 'ABCDEFGHJKMNPQRTUVWXYZ2346789'

/** Sete dias: tempo de sair do consultório e instalar o app com calma. */
const VALIDADE_CODIGO_MS = 7 * 24 * 60 * 60 * 1000

/**
 * `randomInt` e não `Math.random()`: o código é a única prova de que quem
 * reivindica a jornada é quem esteve na consulta. Um gerador previsível o
 * transformaria em um prontuário adivinhável.
 */
export function gerarCodigo(tamanho = 8): string {
  let saida = ''
  for (let i = 0; i < tamanho; i++) saida += ALFABETO[randomInt(ALFABETO.length)]
  return saida
}

/** `ABCD-2468` — lido em dois blocos, que é como as pessoas ditam. */
export function formatarCodigo(codigo: string): string {
  return codigo.length === 8 ? `${codigo.slice(0, 4)}-${codigo.slice(4)}` : codigo
}

/** Aceita com hífen, minúsculo, com espaço — quem digita não deve se preocupar. */
export function normalizarCodigo(entrada: unknown): string {
  return String(entrada ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
}

export function codigoNovo(): { codigo: string; geradoEm: Date; expiraEm: Date } {
  const agora = new Date()
  return {
    codigo: gerarCodigo(),
    geradoEm: agora,
    expiraEm: new Date(agora.getTime() + VALIDADE_CODIGO_MS),
  }
}

export function codigoValido(
  vinculacao: { codigo?: string | null; expiraEm?: Date | null } | null | undefined,
  agora = new Date(),
): boolean {
  if (!vinculacao?.codigo) return false
  if (!vinculacao.expiraEm) return false
  return new Date(vinculacao.expiraEm).getTime() > agora.getTime()
}

/**
 * Uma jornada "vazia" é a que o cadastro cria sozinho e ninguém usou.
 *
 * A pergunta importa porque a vinculação **descarta** a jornada automática da
 * conta recém-criada para adotar a do consultório, que tem o histórico. Descartar
 * algo com conteúdo dentro seria perder dado de saúde — então a checagem olha
 * todas as coleções que penduram registro numa jornada, e não só as duas óbvias.
 * Errar para o lado de "não está vazia" custa uma mensagem; errar para o outro
 * custa um prontuário.
 */
export async function jornadaVazia(id: Types.ObjectId): Promise<boolean> {
  const jornada = await Jornada.findById(id)
  if (!jornada) return true

  // Check-in e vacina moram na própria jornada: são uso, mesmo sem outra coleção.
  if ((jornada.checkins ?? []).length > 0) return false
  if ((jornada.vacinasAplicadas ?? []).length > 0) return false
  if ((jornada.etapasConcluidas ?? []).length > 0) return false

  const contagens = await Promise.all([
    Agendamento.exists({ crianca: id }),
    Consulta.exists({ crianca: id }),
    Exame.exists({ crianca: id }),
    Evolucao.exists({ jornada: id }),
    MedidaFetal.exists({ crianca: id }),
    Duvida.exists({ crianca: id }),
  ])
  if (contagens.some(Boolean)) return false

  // Um prontuário criado e nunca preenchido não conta como uso.
  const prontuario = await Prontuario.findOne({ crianca: id })
  if (prontuario && (prontuario.eventos ?? []).length > 0) return false

  return true
}

/** Sem `responsavel`, a jornada é de arquivo: existe, e ainda não tem dono. */
export function semConta(jornada: { responsavel?: unknown }): boolean {
  return !jornada.responsavel
}
