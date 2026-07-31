import type { Types } from 'mongoose'
import { Lembrete } from '../../models/Lembrete.js'
import type { TipoLembrete } from '../../models/Lembrete.js'

/**
 * Quem cria os lembretes.
 *
 * Toda função aqui é **idempotente por `chaveDedup`**: chamar duas vezes atualiza
 * a mesma linha em vez de criar uma segunda. É o que permite chamar os hooks sem
 * medo — de um webhook que repete, de um usuário que clica duas vezes, de uma
 * remarcação que dispara o mesmo caminho.
 *
 * Num sistema de lembretes, duplicar é o defeito que faz a pessoa desligar tudo.
 */

interface Agendar {
  jornada?: Types.ObjectId | null
  destinatarioId: string
  canal?: 'email' | 'inapp' | 'push'
  tipo: TipoLembrete
  prioridade?: number
  referencia?: { colecao: string; id: string }
  agendadoPara: Date
  chaveDedup: string
  carga?: Record<string, unknown>
}

/** Cria ou reagenda. Um lembrete já enviado não volta atrás. */
export async function agendar(dados: Agendar): Promise<void> {
  // No passado não faz sentido: dispara na próxima rodada em vez de ficar
  // eternamente "devido" e furar a ordem de prioridade.
  const quando = dados.agendadoPara.getTime() < Date.now() ? new Date() : dados.agendadoPara

  await Lembrete.updateOne(
    { chaveDedup: dados.chaveDedup },
    {
      $set: {
        jornada: dados.jornada ?? null,
        destinatarioId: dados.destinatarioId,
        canal: dados.canal ?? 'email',
        tipo: dados.tipo,
        prioridade: dados.prioridade ?? 3,
        referencia: dados.referencia ?? { colecao: '', id: '' },
        agendadoPara: quando,
        carga: dados.carga ?? null,
      },
      // Só na criação: reagendar não pode ressuscitar um já enviado nem zerar
      // o contador de tentativas de um que está falhando.
      $setOnInsert: { estado: 'agendado', tentativas: 0, travadoAte: new Date(0) },
    },
    { upsert: true },
  )
}

/** Cancela o que ainda não saiu. Usado quando o fato que motivou o lembrete some. */
export async function cancelar(prefixoChave: string): Promise<void> {
  await Lembrete.updateMany(
    { chaveDedup: new RegExp(`^${prefixoChave.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`), estado: 'agendado' },
    { $set: { estado: 'cancelado' } },
  )
}

/* --------------------------------- Hooks --------------------------------- */

/**
 * Consulta confirmada → avisos em T-24h e T-2h.
 *
 * Dois toques, não três: um na véspera, para dar tempo de remarcar, e um no dia,
 * para lembrar de sair de casa. Um terceiro seria a pessoa aprendendo a ignorar.
 */
export async function aoConfirmarAgendamento(dados: {
  agendamentoId: string
  jornada: Types.ObjectId
  pacienteId: string
  inicio: Date
  profissionalNome: string
}): Promise<void> {
  const base = `agendamento:${dados.agendamentoId}`
  const carga = {
    inicio: dados.inicio.toISOString(),
    profissionalNome: dados.profissionalNome,
  }

  await agendar({
    jornada: dados.jornada,
    destinatarioId: dados.pacienteId,
    tipo: 'consulta',
    prioridade: 1,
    referencia: { colecao: 'agendamentos', id: dados.agendamentoId },
    agendadoPara: new Date(dados.inicio.getTime() - 24 * 60 * 60 * 1000),
    chaveDedup: `${base}:t24`,
    carga,
  })

  await agendar({
    jornada: dados.jornada,
    destinatarioId: dados.pacienteId,
    tipo: 'consulta',
    prioridade: 1,
    referencia: { colecao: 'agendamentos', id: dados.agendamentoId },
    agendadoPara: new Date(dados.inicio.getTime() - 2 * 60 * 60 * 1000),
    chaveDedup: `${base}:t2`,
    carga,
  })
}

/** Agendamento cancelado ou recusado → nada mais é enviado sobre ele. */
export async function aoCancelarAgendamento(agendamentoId: string): Promise<void> {
  await cancelar(`agendamento:${agendamentoId}`)
}

/** Consulta finalizada com resumo → a paciente é avisada de que há algo para ler. */
export async function aoFinalizarConsulta(dados: {
  consultaId: string
  jornada: Types.ObjectId
  pacienteId: string
}): Promise<void> {
  await agendar({
    jornada: dados.jornada,
    destinatarioId: dados.pacienteId,
    tipo: 'resumo',
    prioridade: 2,
    referencia: { colecao: 'consultas', id: dados.consultaId },
    agendadoPara: new Date(),
    chaveDedup: `consulta:${dados.consultaId}:resumo`,
  })
}

/**
 * Checklist atribuído → um lembrete por grupo, na abertura da janela.
 *
 * Prioridade 4: é o tipo de coisa que espera, e que o colapso em digest junta
 * com outras sem prejuízo.
 */
export async function aoAtribuirChecklist(dados: {
  jornada: Types.ObjectId
  destinatarioId: string
  chave: string
  grupos: {
    id: string
    titulo: string
    porqueImporta?: string
    /** O canal que o próprio conteúdo pediu. `inapp` é o default do template. */
    canal?: 'email' | 'inapp'
    quando: Date | null
  }[]
}): Promise<void> {
  for (const grupo of dados.grupos) {
    if (!grupo.quando) continue
    await agendar({
      jornada: dados.jornada,
      destinatarioId: dados.destinatarioId,
      canal: grupo.canal ?? 'inapp',
      tipo: 'checklist',
      prioridade: 4,
      referencia: { colecao: 'checklists', id: `${dados.chave}:${grupo.id}` },
      agendadoPara: grupo.quando,
      chaveDedup: `checklist:${dados.jornada}:${dados.chave}:${grupo.id}`,
      carga: { titulo: grupo.titulo, porqueImporta: grupo.porqueImporta ?? '' },
    })
  }
}
