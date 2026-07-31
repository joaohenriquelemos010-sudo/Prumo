import type { Types } from 'mongoose'
import { Checklist } from '../models/Checklist.js'
import { ChecklistTemplate } from '../models/ChecklistTemplate.js'
import type { ChecklistTemplateDoc } from '../models/ChecklistTemplate.js'
import { TEMPLATES } from './seedConteudo.js'

/**
 * Junta conteúdo (template) com estado (instância) para a tela.
 *
 * O cliente nunca recebe as duas coisas separadas e monta sozinho: se um grupo
 * existe no template e não na instância, ele volta como pendente; se existe na
 * instância e sumiu do template, ele simplesmente não aparece. É esse cuidado
 * que permite editar conteúdo publicado sem quebrar a tela de ninguém.
 */

/** A versão publicada mais recente de uma chave. */
export async function templateAtual(chave: string): Promise<ChecklistTemplateDoc | null> {
  return ChecklistTemplate.findOne({ chave }).sort({ versao: -1 })
}

/** Filtro de janela: o grupo faz sentido para esta semana/mês? */
function dentroDaJanela(
  janela: { desdeSemana?: number | null; ateSemana?: number | null; desdeMes?: number | null; ateMes?: number | null } | undefined,
  semana: number | null,
  mes: number | null,
): boolean {
  if (!janela) return true
  if (semana !== null) {
    if (janela.desdeSemana != null && semana < janela.desdeSemana) return false
    if (janela.ateSemana != null && semana > janela.ateSemana) return false
  }
  if (mes !== null) {
    if (janela.desdeMes != null && mes < janela.desdeMes) return false
    if (janela.ateMes != null && mes > janela.ateMes) return false
  }
  return true
}

export interface ContextoTemporal {
  /** Semana gestacional, ou null se não estiver grávida. */
  semana: number | null
  /** Meses de vida, ou null se ainda não nasceu. */
  mes: number | null
}

/**
 * Monta o checklist para a tela.
 *
 * `foraDaJanela` não some — vem marcado. Esconder o que ainda não chegou tira da
 * gestante a visão do caminho inteiro, que é justamente o que faz a trilha
 * funcionar; e esconder o que já passou apagaria a sensação de progresso.
 */
export async function montarChecklist(
  jornada: Types.ObjectId,
  chave: string,
  contexto: ContextoTemporal,
) {
  const template = await templateAtual(chave)
  if (!template) return null

  const instancia = await Checklist.findOne({ jornada, templateChave: chave })
  const estadoDe = (id: string) => instancia?.grupos.find((g) => g.id === id)

  const grupos = template.grupos.map((g) => {
    const estado = estadoDe(g.id)
    const passosFeitos = new Set(
      (estado?.passos ?? []).filter((p) => p.feito).map((p) => p.id),
    )
    const passos = g.passos.map((p) => ({
      id: p.id,
      titulo: p.titulo,
      explicacaoLeiga: p.explicacaoLeiga,
      dica: p.dica,
      opcional: p.opcional,
      feito: passosFeitos.has(p.id),
    }))

    // O progresso ignora os opcionais: eles não podem impedir alguém de
    // completar um grupo que, para ela, está completo.
    const obrigatorios = passos.filter((p) => !p.opcional)
    const feitos = obrigatorios.filter((p) => p.feito).length

    return {
      id: g.id,
      titulo: g.titulo,
      resumo: g.resumo,
      explicacaoLeiga: g.explicacaoLeiga,
      porqueImporta: g.porqueImporta,
      fonte: g.fonte,
      icone: g.icone,
      janela: g.janela ?? {},
      estado: estado?.estado ?? 'pendente',
      nota: estado?.nota ?? '',
      feitoEm: estado?.feitoEm ? new Date(estado.feitoEm).toISOString() : null,
      passos,
      total: obrigatorios.length,
      feitos,
      /** Marcado, não escondido — a gestante enxerga o caminho inteiro. */
      foraDaJanela: !dentroDaJanela(g.janela, contexto.semana, contexto.mes),
    }
  })

  const totalGrupos = grupos.length
  const gruposFeitos = grupos.filter(
    (g) => g.estado === 'feito' || g.estado === 'nao-se-aplica',
  ).length

  return {
    chave: template.chave,
    versao: template.versao,
    titulo: template.titulo,
    descricao: template.descricao,
    icone: template.icone,
    publico: template.publico,
    atribuidoPorNome: instancia?.atribuidoPorNome ?? '',
    sequenciaDias: instancia?.sequenciaDias ?? 0,
    grupos,
    progresso: totalGrupos === 0 ? 0 : Math.round((gruposFeitos / totalGrupos) * 100),
  }
}

/**
 * Garante que a instância existe. Chamada em toda escrita, para que a primeira
 * marcação de uma gestante não precise de um passo de "criar checklist".
 */
export async function garantirInstancia(
  jornada: Types.ObjectId,
  chave: string,
  atribuidoPor = '',
  atribuidoPorNome = '',
) {
  const existente = await Checklist.findOne({ jornada, templateChave: chave })
  if (existente) return existente

  const template = await templateAtual(chave)
  if (!template) return null

  try {
    return await Checklist.create({
      jornada,
      templateChave: chave,
      templateVersao: template.versao,
      atribuidoPor,
      atribuidoPorNome,
      grupos: [],
    })
  } catch (err) {
    // Índice único: outra requisição criou primeiro. Devolve a dela.
    if ((err as { code?: number }).code === 11000) {
      return Checklist.findOne({ jornada, templateChave: chave })
    }
    throw err
  }
}

/**
 * Atualiza a sequência de dias.
 *
 * Conta dias-calendário e não horas: alguém que marca às 23h e de novo às 8h do
 * dia seguinte fez duas visitas em dois dias, e é assim que a pessoa entende.
 * Um intervalo maior que um dia zera — mas a sequência aqui nunca é cobrada, só
 * exibida.
 */
export function proximaSequencia(
  anterior: number,
  ultimoToque: Date | null | undefined,
  agora = new Date(),
) {
  if (!ultimoToque) return 1

  const dia = (d: Date) => Math.floor(new Date(d).setHours(0, 0, 0, 0) / 86_400_000)
  const diferenca = dia(agora) - dia(ultimoToque)

  if (diferenca === 0) return anterior || 1
  if (diferenca === 1) return anterior + 1
  return 1
}

/** As chaves de checklist que um programa entrega por padrão. */
export function chavesDoPrograma(programaId: string): string[] {
  return TEMPLATES.filter((t) => t.programa === programaId).map((t) => t.chave)
}
