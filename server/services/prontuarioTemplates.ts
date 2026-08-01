import type { Types } from 'mongoose'
import { Consulta } from '../models/Consulta.js'
import {
  camposDe,
  templatePorChave,
  linhaDoTemplate,
  TEMPLATES,
} from '../conteudo/prontuario-templates.js'
import type { ProntuarioTemplate } from '../conteudo/prontuario-templates.js'

/**
 * A regra que faz a segunda consulta não repetir a primeira.
 *
 * É o pedido central do fluxo: *"na 2ª já não pergunta porque já tem as
 * informações da 1ª"*. Duas coisas precisam acontecer para isso ser verdade, e
 * as duas moram aqui:
 *
 * 1. **Escolher o formulário certo sozinho.** Se a jornada nunca teve uma
 *    primeira consulta desta linha de cuidado, abre a anamnese completa. Se
 *    teve, abre o acompanhamento. O médico não escolhe — ele corrige, se
 *    quiser.
 * 2. **Trazer o que já foi respondido.** O formulário de retorno mostra os
 *    valores permanentes da anamnese como contexto de leitura, não como campo
 *    para preencher de novo.
 *
 * Puro no que dá para ser puro (`herdar`), e com uma única consulta ao banco no
 * resto — este código roda com a paciente sentada na frente do médico.
 */

export interface RespostaHerdada {
  campoId: string
  rotulo: string
  valor: string
  /** De quando é a resposta — "isto foi dito há 8 meses" muda como se lê. */
  em: string
  unidade?: string
}

/** O que o cockpit precisa saber sobre o formulário de hoje. */
export interface FormularioDoAtendimento {
  template: ProntuarioTemplate
  /** Já respondido antes, e por isso não perguntado de novo. */
  herdado: RespostaHerdada[]
  /** Verdadeiro quando é a anamnese completa — muda o tom da tela. */
  primeiraVez: boolean
}

/** Os valores estruturados de uma consulta, como vêm do banco. */
type Estruturado = Record<string, unknown>

function texto(valor: unknown): string {
  if (valor === null || valor === undefined) return ''
  if (typeof valor === 'boolean') return valor ? 'Sim' : 'Não'
  return String(valor).trim()
}

/**
 * Junta as respostas de consultas passadas, da mais recente para a mais antiga.
 *
 * Puro de propósito: a ordem de precedência ("a resposta mais recente ganha") é
 * exatamente o tipo de regra que se quebra em silêncio numa refatoração, e um
 * teste que precisa de banco não é rodado.
 *
 * Só campos `permanente` são herdados. Uma queixa da consulta passada
 * pré-preenchida na de hoje seria pior que campo vazio: o médico assinaria um
 * registro dizendo que a paciente relatou hoje o que ela relatou em março.
 */
export function herdar(
  template: ProntuarioTemplate,
  anteriores: { estruturado: Estruturado; template: string; em: Date }[],
): RespostaHerdada[] {
  const permanentes = new Map(
    TEMPLATES.flatMap((t) => camposDe(t))
      .filter((c) => c.permanente)
      .map((c) => [c.id, c]),
  )

  // Os campos que ESTE formulário já cobre não são herdados: ele vai perguntar.
  const perguntadosHoje = new Set(camposDe(template).map((c) => c.id))

  const vistos = new Set<string>()
  const saida: RespostaHerdada[] = []

  // Da mais recente para a mais antiga — a primeira que responder, vence.
  const ordenadas = [...anteriores].sort((a, b) => b.em.getTime() - a.em.getTime())

  for (const consulta of ordenadas) {
    for (const [campoId, valor] of Object.entries(consulta.estruturado ?? {})) {
      if (vistos.has(campoId)) continue
      if (perguntadosHoje.has(campoId)) continue
      const campo = permanentes.get(campoId)
      if (!campo) continue
      const v = texto(valor)
      if (!v) continue

      vistos.add(campoId)
      saida.push({
        campoId,
        rotulo: campo.rotulo,
        valor: v,
        em: consulta.em.toISOString(),
        unidade: campo.unidade,
      })
    }
  }

  return saida
}

/**
 * Já houve uma primeira consulta desta linha de cuidado nesta jornada?
 *
 * A pergunta é por **linha** (pré-natal, puericultura, ginecologia) e não por
 * jornada: a mesma mulher pode ter feito a anamnese ginecológica no ano passado
 * e estar hoje na primeira consulta de pré-natal. Tratar as duas como "já é
 * paciente antiga" pularia a anamnese obstétrica inteira.
 */
export async function jaTevePrimeira(jornada: Types.ObjectId, chaveTemplate: string): Promise<boolean> {
  const linha = linhaDoTemplate(chaveTemplate)
  if (!linha) return false
  return Boolean(
    await Consulta.exists({
      crianca: jornada,
      status: 'finalizada',
      'template.chave': linha.primeira,
    }),
  )
}

/**
 * O formulário para o atendimento de hoje, já resolvido.
 *
 * `chavePedida` é o que o tipo de atendimento aponta. Se ele aponta para a
 * anamnese e ela já foi feita, trocamos pelo retorno — porque um médico que
 * marcou "primeira consulta" por hábito não quer redigitar a anamnese, quer ver
 * o que já existe.
 */
export async function formularioPara(
  jornada: Types.ObjectId,
  chavePedida: string,
): Promise<FormularioDoAtendimento> {
  const pedido = templatePorChave(chavePedida)
  const linha = linhaDoTemplate(pedido.chave)

  let template = pedido
  if (linha && pedido.natureza === 'primeira' && (await jaTevePrimeira(jornada, pedido.chave))) {
    template = templatePorChave(linha.retorno)
  }

  const anteriores = await Consulta.find({
    crianca: jornada,
    status: 'finalizada',
  })
    .sort({ data: -1 })
    .limit(30)
    .select('estruturado template data')

  const herdado = herdar(
    template,
    anteriores.map((c) => ({
      estruturado: (c.estruturado ?? {}) as Estruturado,
      template: c.template?.chave ?? '',
      em: c.data ?? c.get('createdAt') ?? new Date(),
    })),
  )

  return { template, herdado, primeiraVez: template.natureza === 'primeira' }
}
