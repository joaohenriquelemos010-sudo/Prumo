import { Router } from 'express'
import { isValidObjectId } from 'mongoose'
import { requireAuth, requireRole } from '../auth.js'
import { resolveJornada } from '../services/jornada.js'
import { Consulta } from '../models/Consulta.js'
import { Agendamento } from '../models/Agendamento.js'
import { Prontuario } from '../models/Prontuario.js'
import { Duvida } from '../models/Duvida.js'
import { Alerta } from '../models/Alerta.js'
import { MedidaFetal } from '../models/MedidaFetal.js'
import {
  consultaIniciarSchema,
  consultaPatchSchema,
  consultaFinalizarSchema,
} from '../validation.js'
import { normalizeTexto } from '../sanitize.js'
import { avaliarAntropometria } from '../services/alertas.js'
import { registrar } from '../services/evolucao.js'
import { aoFinalizarConsulta } from '../services/lembretes/programar.js'
import { serializeConsulta } from './consultas.js'
import { serializeProntuario } from './prontuario.js'
import type { SessionUser } from '../types.js'

export const atendimentoRouter = Router()

/**
 * O atendimento — o que acontece enquanto a médica está com a paciente na frente.
 *
 * Separado de `routes/consultas.ts` de propósito: aquele arquivo é o registro
 * (ler, listar, apagar), este é o **ato**. Eles têm ritmos diferentes — um
 * responde a uma tela de leitura, o outro a alguém digitando com uma pessoa
 * esperando — e misturá-los foi o que deixou o fluxo espalhado por cinco telas.
 */

/**
 * O agendamento que representa "chegou agora e vai ser atendido".
 *
 * Reaproveita um confirmado das últimas horas se já houver: quem marcou pela
 * manhã e foi atendido à tarde não deve virar dois atendimentos no relatório do
 * mês. Fora dessa janela, cria um novo já `confirmado`, porque a paciente está
 * na sala — pendente descreveria uma dúvida que não existe.
 */
async function abrirAgendamentoDeBalcao(jornadaId: string, medico: SessionUser) {
  if (!isValidObjectId(jornadaId)) return null

  const jornada = await resolveJornada(medico, jornadaId)
  if (!jornada) return null

  const agora = new Date()
  const existente = await Agendamento.findOne({
    crianca: jornada._id,
    medicoId: medico.id,
    status: { $in: ['pendente', 'confirmado'] },
    inicio: { $gte: new Date(agora.getTime() - JANELA_BALCAO_MS), $lte: new Date(agora.getTime() + JANELA_BALCAO_MS) },
  }).sort({ inicio: 1 })
  if (existente) {
    if (existente.status === 'pendente') {
      existente.status = 'confirmado'
      await existente.save()
    }
    return existente
  }

  return Agendamento.create({
    crianca: jornada._id,
    pacienteId: jornada.responsavel ? String(jornada.responsavel) : '',
    pacienteNome: jornada.titular?.nome ?? jornada.nome ?? '',
    medicoId: medico.id,
    medicoNome: medico.nome,
    origem: 'medico',
    objetivo: jornada.momento === 'ja-nasceu' ? 'consulta-crianca' : jornada.momento === 'planejando' ? 'pre-concepcional' : 'consulta-gestante',
    modalidade: 'presencial',
    inicio: agora,
    duracaoMin: 30,
    status: 'confirmado',
    mensagem: 'Atendimento sem hora marcada.',
  })
}

/** Meia hora para os dois lados: o atraso normal de um consultório. */
const JANELA_BALCAO_MS = 30 * 60 * 1000

/** Só o autor mexe no próprio rascunho. Nem outro médico vinculado. */
async function rascunhoDoAutorOr404(id: string, autorId: string) {
  if (!isValidObjectId(id)) return null
  const consulta = await Consulta.findById(id)
  if (!consulta || consulta.autorId !== autorId) return null
  return consulta
}

/**
 * POST /api/atendimento/iniciar
 *
 * Abre o rascunho e devolve **o cockpit inteiro numa resposta só**: consulta,
 * resumo do prontuário, últimas medidas, alertas abertos, dúvidas sem resposta.
 * Um round trip, porque cada requisição extra aqui é a médica esperando na
 * frente da paciente.
 *
 * Idempotente: chamar de novo no mesmo agendamento devolve o mesmo rascunho, e
 * não um segundo. Fechar a aba sem querer não pode custar o que já foi digitado.
 */
atendimentoRouter.post('/iniciar', requireAuth, requireRole('medico'), async (req, res) => {
  const parsed = consultaIniciarSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Confere os dados.' })
    return
  }
  const { agendamentoId, jornadaId } = parsed.data

  /*
   * O caminho de balcão termina com um `Agendamento` como qualquer outro, e é
   * essa a decisão: em vez de uma consulta órfã com um `if` em cada tela adiante,
   * o atendimento sem hora marcada **cria** o agendamento correspondente e segue
   * pelo mesmo trilho. Agenda, financeiro, receituário e teleconsulta continuam
   * lendo uma coisa só — nenhum deles precisa saber que esta paciente entrou sem
   * marcar.
   */
  const agendamento = jornadaId
    ? await abrirAgendamentoDeBalcao(jornadaId, req.user!)
    : await Agendamento.findById(isValidObjectId(agendamentoId ?? '') ? agendamentoId : null)

  if (!agendamento) {
    res.status(404).json({ error: 'Não encontramos essa paciente.' })
    return
  }
  // Quem atende é quem foi agendado. Um vínculo com a paciente dá acesso ao
  // registro, não o direito de assumir a consulta de outra pessoa.
  if (agendamento.medicoId !== req.user!.id) {
    res.status(403).json({ error: 'Esse atendimento está agendado com outro profissional.' })
    return
  }
  if (agendamento.status === 'cancelado' || agendamento.status === 'recusado') {
    res.status(409).json({ error: 'Esse agendamento foi cancelado.' })
    return
  }

  const jornada = await resolveJornada(req.user!, String(agendamento.crianca))
  if (!jornada) {
    res.status(403).json({ error: 'Você não tem acesso a essa paciente.' })
    return
  }

  const tipo =
    agendamento.objetivo === 'consulta-gestante'
      ? 'pre-natal'
      : agendamento.objetivo === 'pre-concepcional'
        ? 'pre-concepcional'
        : 'pediatrica'

  let consulta = await Consulta.findOne({
    agendamento: agendamento._id,
    autorId: req.user!.id,
    status: 'rascunho',
  })

  if (!consulta) {
    consulta = await Consulta.create({
      crianca: jornada._id,
      autorId: req.user!.id,
      autorNome: req.user!.nome,
      agendamento: agendamento._id,
      tipo,
      data: agendamento.inicio,
      status: 'rascunho',
      iniciadaEm: new Date(),
    })
    agendamento.consulta = consulta._id
    await agendamento.save()
  }

  const [prontuario, duvidas, alertas, medidasFetais] = await Promise.all([
    Prontuario.findOne({ crianca: jornada._id }),
    Duvida.find({ crianca: jornada._id, respondida: false, compartilhada: true })
      .sort({ createdAt: -1 })
      .limit(10),
    Alerta.find({ crianca: jornada._id, resolvido: false }).sort({ createdAt: -1 }).limit(10),
    MedidaFetal.find({ crianca: jornada._id }).sort({ semana: -1 }).limit(3),
  ])

  // As 3 últimas consultas fechadas dão a tendência sem custar uma segunda tela.
  const anteriores = await Consulta.find({
    crianca: jornada._id,
    status: 'finalizada',
    _id: { $ne: consulta._id },
  })
    .sort({ data: -1 })
    .limit(3)

  res.json({
    consulta: serializeConsulta(consulta, req.user!),
    agendamento: {
      id: String(agendamento._id),
      inicio: new Date(agendamento.inicio).toISOString(),
      duracaoMin: agendamento.duracaoMin,
      modalidade: agendamento.modalidade,
      objetivo: agendamento.objetivo,
      local: agendamento.local,
      status: agendamento.status,
    },
    paciente: {
      id: String(jornada._id),
      nome: jornada.nome,
      momento: jornada.momento,
      programa: jornada.programa,
      dpp: jornada.dpp ? new Date(jornada.dpp).toISOString() : null,
      dataNascimento: jornada.dataNascimento
        ? new Date(jornada.dataNascimento).toISOString()
        : null,
    },
    prontuario: prontuario ? serializeProntuario(prontuario) : null,
    consultasAnteriores: anteriores.map((c) => serializeConsulta(c, req.user!)),
    medidasFetais: medidasFetais.map((m) => ({
      semana: m.semana,
      pfeG: m.pfeG,
      percentis: m.percentis ?? {},
    })),
    // O médico vê o alerta completo; a mensagem da família é outra coisa.
    alertas: alertas.map((a) => ({
      id: String(a._id),
      severidade: a.severidade,
      titulo: a.titulo,
      detalhe: a.detalhe,
      condutaSugerida: a.condutaSugerida,
    })),
    duvidas: duvidas.map((d) => ({ id: String(d._id), texto: d.texto })),
  })
})

/**
 * PATCH /api/atendimento/:id — autosave.
 *
 * Só campos enviados são tocados, e só enquanto a consulta é rascunho: depois de
 * finalizada, o registro clínico não se edita por um autosave silencioso.
 */
atendimentoRouter.patch('/:id', requireAuth, requireRole('medico'), async (req, res) => {
  const parsed = consultaPatchSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Confere os dados.' })
    return
  }

  const consulta = await rascunhoDoAutorOr404(req.params.id, req.user!.id)
  if (!consulta) {
    res.status(404).json({ error: 'Não encontramos esse atendimento.' })
    return
  }
  if (consulta.status !== 'rascunho') {
    res.status(409).json({ error: 'Esse atendimento já foi finalizado.' })
    return
  }

  const d = parsed.data
  const textos = ['subjetivo', 'objetivo', 'avaliacao', 'plano', 'notasPrivadas'] as const
  for (const campo of textos) {
    if (d[campo] !== undefined) consulta[campo] = normalizeTexto(d[campo] ?? '', 3000)
  }
  if (d.resumoParaFamilia !== undefined) {
    consulta.resumoParaFamilia = normalizeTexto(d.resumoParaFamilia, 2000)
  }
  if (d.avaliacaoPrivada !== undefined) consulta.avaliacaoPrivada = d.avaliacaoPrivada
  if (d.igSemanas !== undefined) consulta.igSemanas = d.igSemanas
  if (d.igDias !== undefined) consulta.igDias = d.igDias
  if (d.medidas !== undefined) consulta.medidas = { ...consulta.medidas, ...d.medidas }
  if (d.checklist !== undefined) {
    // `set` em vez de atribuição direta: `checklist` é um DocumentArray do
    // Mongoose, e trocar por um array simples não casa com o tipo nem marca o
    // caminho como modificado.
    consulta.set(
      'checklist',
      d.checklist.map((i) => ({
        id: i.id,
        feito: i.feito,
        observacao: (i.observacao ?? '').slice(0, 300),
      })),
    )
  }

  await consulta.save()
  res.json({ consulta: serializeConsulta(consulta, req.user!), salvoEm: new Date().toISOString() })
})

/**
 * POST /api/atendimento/:id/finalizar
 *
 * Fecha o atendimento: vira `finalizada`, marca o agendamento como realizado,
 * grava a duração e roda a checagem de antropometria.
 *
 * A checagem roda aqui, e não no autosave, porque disparar alerta a cada tecla
 * digitada encheria a caixa da médica de ruído sobre um número que ela ainda
 * está corrigindo.
 */
atendimentoRouter.post('/:id/finalizar', requireAuth, requireRole('medico'), async (req, res) => {
  const parsed = consultaFinalizarSchema.safeParse(req.body ?? {})
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Confere os dados.' })
    return
  }

  const consulta = await rascunhoDoAutorOr404(req.params.id, req.user!.id)
  if (!consulta) {
    res.status(404).json({ error: 'Não encontramos esse atendimento.' })
    return
  }
  // Finalizar duas vezes devolve sucesso em vez de erro: o segundo clique de um
  // botão que demorou não é uma falha, e mostrar erro aqui assustaria à toa.
  if (consulta.status === 'finalizada') {
    res.json({ consulta: serializeConsulta(consulta, req.user!) })
    return
  }

  const agora = new Date()
  consulta.status = 'finalizada'
  consulta.finalizadaEm = agora
  if (consulta.iniciadaEm) {
    consulta.duracaoSegundos = Math.round((agora.getTime() - consulta.iniciadaEm.getTime()) / 1000)
  }
  if (parsed.data.enviarResumo && consulta.resumoParaFamilia) {
    // Por ora "enviar" é publicar para a família na própria tela dela. O e-mail
    // entra na fase de lembretes, e este carimbo é o que vai alimentá-la.
    consulta.resumoEnviadoEm = agora
  }

  // Espelha os campos legados para que as telas antigas não fiquem em branco.
  const m = consulta.medidas ?? {}
  consulta.peso = m.pesoKg ? `${m.pesoKg} kg` : m.pesoG ? `${m.pesoG} g` : consulta.peso
  consulta.altura = m.alturaCm
    ? `${m.alturaCm} cm`
    : m.comprimentoCm
      ? `${m.comprimentoCm} cm`
      : consulta.altura
  consulta.pressao =
    m.paSistolica && m.paDiastolica ? `${m.paSistolica}/${m.paDiastolica}` : consulta.pressao

  await consulta.save()

  if (consulta.agendamento) {
    /**
     * Escreve `realizado` direto, sem passar pela tabela de transições de
     * `routes/agendamentos.ts` — e isso é intencional.
     *
     * Aquela tabela só permite `confirmado → realizado`, mas acontece de a
     * médica atender alguém cujo agendamento ficou `pendente` (encaixe, ela
     * esqueceu de confirmar, a paciente chegou assim mesmo). O atendimento
     * aconteceu; travar o registro por causa de burocracia de status seria
     * deixar o sistema discordar da realidade. Os dois estados terminais de
     * verdade — cancelado e recusado — continuam protegidos pelo `$nin`.
     */
    await Agendamento.updateOne(
      { _id: consulta.agendamento, status: { $nin: ['cancelado', 'recusado'] } },
      { $set: { status: 'realizado', consulta: consulta._id } },
    )
  }

  const jornada = await resolveJornada(req.user!, String(consulta.crianca))
  if (jornada) {
    /**
     * A consulta entra na história clínica como uma evolução encadeada.
     *
     * É isso que faz a linha do tempo do prontuário ser UMA query em vez de
     * costurar consultas, anotações e marcos em memória — e é o que faz o
     * atendimento contar para a cadeia de integridade em vez de viver fora dela.
     *
     * `visibilidade: 'equipe'` quando a avaliação é privada: a entrada inteira
     * carrega a impressão diagnóstica, então publicá-la contornaria a escolha
     * que a médica acabou de fazer na tela.
     */
    await registrar(jornada._id, {
      tipo: 'consulta',
      consulta: consulta._id,
      autorId: req.user!.id,
      autorNome: req.user!.nome,
      autorPapel: req.user!.papel,
      em: consulta.data ? new Date(consulta.data) : agora,
      texto: [
        consulta.subjetivo && `S: ${consulta.subjetivo}`,
        consulta.objetivo && `O: ${consulta.objetivo}`,
        !consulta.avaliacaoPrivada && consulta.avaliacao && `A: ${consulta.avaliacao}`,
        consulta.plano && `P: ${consulta.plano}`,
      ]
        .filter(Boolean)
        .join('\n'),
      estruturado: {
        tipo: consulta.tipo,
        igSemanas: consulta.igSemanas,
        igDias: consulta.igDias,
        medidas: consulta.medidas ?? {},
        checklist: consulta.checklist ?? [],
      },
      visibilidade: consulta.avaliacaoPrivada ? 'equipe' : 'familia',
    }).catch(() => {
      /* a história é importante, mas não a ponto de custar o registro da consulta */
    })

    await avaliarAntropometria(consulta, jornada).catch(() => {
      /* um alerta que falha nunca pode custar o registro da consulta */
    })

    /**
     * O aviso de que há um resumo para ler.
     *
     * Só quando a médica de fato marcou "enviar resumo" e escreveu alguma coisa
     * — avisar sobre um resumo vazio é o tipo de lembrete que ensina a paciente
     * a ignorar os próximos.
     */
    if (consulta.resumoEnviadoEm) {
      await aoFinalizarConsulta({
        consultaId: String(consulta._id),
        jornada: jornada._id,
        pacienteId: String(jornada.responsavel),
      }).catch(() => {
        /* fila de lembrete não é motivo para falhar o fim de um atendimento */
      })
    }
  }

  res.json({ consulta: serializeConsulta(consulta, req.user!) })
})

/**
 * DELETE /api/atendimento/:id — descarta um rascunho.
 *
 * Só rascunho, e só do autor. Consulta finalizada some por `DELETE
 * /api/consultas/:id`, que é a porta que já existia e tem outro peso.
 */
atendimentoRouter.delete('/:id', requireAuth, requireRole('medico'), async (req, res) => {
  const consulta = await rascunhoDoAutorOr404(req.params.id, req.user!.id)
  if (!consulta) {
    res.status(404).json({ error: 'Não encontramos esse atendimento.' })
    return
  }
  if (consulta.status !== 'rascunho') {
    res.status(409).json({ error: 'Esse atendimento já foi finalizado.' })
    return
  }
  if (consulta.agendamento) {
    await Agendamento.updateOne({ _id: consulta.agendamento }, { $set: { consulta: null } })
  }
  await consulta.deleteOne()
  res.status(204).end()
})
