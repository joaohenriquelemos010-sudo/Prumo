import { Router } from 'express'
import { isValidObjectId } from 'mongoose'
import { requireAuth } from '../auth.js'
import { Agendamento } from '../models/Agendamento.js'
import { Sinal } from '../models/Sinal.js'
import { sinalSchema } from '../validation.js'
import { env } from '../env.js'
import { registrar, origem } from '../services/auditoria.js'

export const teleconsultaRouter = Router()

/** Quanto antes do horário a sala abre, e quanto depois ela fecha. */
const ABRE_ANTES_MIN = 15
const FECHA_DEPOIS_MIN = 30

/** Um sinal vale cinco minutos. Ver o comentário em `models/Sinal.ts`. */
const VIDA_SINAL_MS = 5 * 60 * 1000

/**
 * A teleconsulta do Prumo — **ponto a ponto, sem servidor de mídia**.
 *
 * O `Agendamento` já tinha `modalidade: 'teleconsulta'` e isso não significava
 * nada: era uma lacuna visível para quem usa. O que faltava não era um provedor
 * de vídeo, era a costura.
 *
 * ## A decisão de custo
 *
 * Áudio e vídeo vão direto de um navegador ao outro. O servidor só apresenta os
 * dois — meia dúzia de mensagens de sinalização — e sai de cena. Provedores como
 * Daily ou 100ms cobram por minuto porque **retransmitem mídia**; aqui não há
 * mídia para retransmitir, e o custo fica em zero.
 *
 * O preço dessa escolha é honesto e vale dizer: numa parcela das redes (NAT
 * simétrico, algumas corporativas e operadoras móveis) o ponto a ponto não
 * fecha, e a conexão precisa de um relay TURN. Sem TURN configurado, essas
 * chamadas falham — e a tela diz isso e oferece o telefone, em vez de girar um
 * spinner para sempre. `TURN_URL` liga o relay quando fizer sentido pagar por
 * ele; a maioria das chamadas nunca vai precisar.
 *
 * ## Sem gravação
 *
 * Deliberado, e não uma limitação. Gravar uma consulta dispara deveres pesados
 * de retenção do CFM e obrigações de dado sensível da LGPD, por valor marginal.
 * O que fica registrado é o **atendimento**, no prontuário, como em qualquer
 * consulta presencial.
 */

/** Os dois lados da consulta, e nada além deles. */
function participantes(a: { pacienteId: string; medicoId: string }): string[] {
  return [a.pacienteId, a.medicoId].filter(Boolean)
}

function janela(inicio: Date, duracaoMin: number) {
  return {
    abre: new Date(inicio.getTime() - ABRE_ANTES_MIN * 60_000),
    fecha: new Date(inicio.getTime() + (duracaoMin + FECHA_DEPOIS_MIN) * 60_000),
  }
}

/**
 * Resolve o agendamento **e** o direito de estar nele.
 *
 * Um id de agendamento não é segredo, e a sala é identificada por ele. Sem esta
 * checagem, conhecer o id seria suficiente para entrar numa consulta alheia — o
 * pior defeito possível num produto de saúde.
 */
async function salaOr403(req: Parameters<typeof requireAuth>[0], res: Parameters<typeof requireAuth>[1]) {
  const id = req.params.agendamentoId
  if (!isValidObjectId(id)) {
    res.status(404).json({ error: 'Não encontramos essa consulta.' })
    return null
  }

  const agendamento = await Agendamento.findById(id)
  if (!agendamento) {
    res.status(404).json({ error: 'Não encontramos essa consulta.' })
    return null
  }

  if (!participantes(agendamento).includes(req.user!.id)) {
    res.status(403).json({ error: 'Esta consulta não é sua.' })
    return null
  }

  if (agendamento.modalidade !== 'teleconsulta') {
    res.status(409).json({ error: 'Esta consulta é presencial.' })
    return null
  }

  return agendamento
}

/**
 * POST /api/teleconsulta/:agendamentoId/entrar
 *
 * Devolve com quem falar e por onde. A configuração de ICE vem do servidor, e
 * não do bundle, porque a credencial do TURN é temporária e não pode ficar
 * compilada no JavaScript de todo mundo.
 */
teleconsultaRouter.post('/:agendamentoId/entrar', requireAuth, async (req, res) => {
  const agendamento = await salaOr403(req, res)
  if (!agendamento) return

  if (agendamento.status !== 'confirmado') {
    res.status(409).json({ error: 'A consulta precisa estar confirmada para a sala abrir.' })
    return
  }

  const agora = new Date()
  const { abre, fecha } = janela(new Date(agendamento.inicio), agendamento.duracaoMin)

  if (agora < abre) {
    res.status(425).json({
      error: `A sala abre ${ABRE_ANTES_MIN} minutos antes do horário.`,
      abreEm: abre.toISOString(),
    })
    return
  }
  if (agora > fecha) {
    res.status(410).json({ error: 'Esta sala já fechou.' })
    return
  }

  const eu = req.user!.id
  const outro = participantes(agendamento).find((p) => p !== eu) ?? ''

  registrar({
    acao: 'consulta.iniciar',
    atorId: eu,
    atorPapel: req.user!.papel,
    recurso: { colecao: 'agendamentos', id: String(agendamento._id) },
    jornada: agendamento.crianca,
    ...origem(req),
    metadados: { modalidade: 'teleconsulta' },
  })

  res.json({
    eu,
    outro,
    /**
     * O médico faz a oferta. Alguém precisa começar, e deixar os dois lados
     * ofertando ao mesmo tempo é o clássico *glare* do WebRTC — as duas ofertas
     * colidem e a negociação reinicia em loop. A regra é fixa e não depende de
     * quem entrou primeiro, que seria uma corrida.
     */
    iniciador: eu === agendamento.medicoId,
    fechaEm: fecha.toISOString(),
    iceServers: iceServers(),
  })
})

/**
 * A configuração de ICE.
 *
 * STUN público do Google como padrão: ele só responde "qual é o seu IP visto de
 * fora", não vê mídia nenhuma, e é gratuito. TURN entra por configuração, para o
 * dia em que valer a pena pagar pelo relay das chamadas que o ponto a ponto não
 * fecha.
 */
function iceServers() {
  const servidores: { urls: string | string[]; username?: string; credential?: string }[] = [
    { urls: env.STUN_URLS.split(',').map((u) => u.trim()).filter(Boolean) },
  ]

  if (env.TURN_URL) {
    servidores.push({
      urls: env.TURN_URL,
      username: env.TURN_USUARIO,
      credential: env.TURN_SENHA,
    })
  }

  return servidores
}

/**
 * POST /api/teleconsulta/:agendamentoId/sinal — deixa uma mensagem para o outro.
 *
 * O servidor não interpreta a carga: encaminha. É por isso que uma mudança na
 * negociação do WebRTC não exige deploy de backend.
 */
teleconsultaRouter.post('/:agendamentoId/sinal', requireAuth, async (req, res) => {
  const agendamento = await salaOr403(req, res)
  if (!agendamento) return

  const parsed = sinalSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Sinal inválido.' })
    return
  }

  const eu = req.user!.id
  const para = participantes(agendamento).find((p) => p !== eu)
  if (!para) {
    res.status(409).json({ error: 'Esta consulta ainda não tem os dois participantes.' })
    return
  }

  await Sinal.create({
    agendamento: agendamento._id,
    de: eu,
    para,
    tipo: parsed.data.tipo,
    carga: parsed.data.carga ?? null,
    criadoEm: new Date(),
    expiraEm: new Date(Date.now() + VIDA_SINAL_MS),
  })

  res.status(201).json({ ok: true })
})

/**
 * GET /api/teleconsulta/:agendamentoId/sinais?desde=<iso>
 *
 * O que chegou para mim. Consumir **apaga**: um candidato ICE entregue duas
 * vezes faz a negociação reiniciar, e um `tchau` reentregue derruba a chamada
 * seguinte. `desde` é a rede de segurança para quando a exclusão não confirmar.
 */
teleconsultaRouter.get('/:agendamentoId/sinais', requireAuth, async (req, res) => {
  const agendamento = await salaOr403(req, res)
  if (!agendamento) return

  const desdeBruto = String(req.query.desde ?? '')
  const desde = desdeBruto && !Number.isNaN(Date.parse(desdeBruto)) ? new Date(desdeBruto) : null

  const filtro: Record<string, unknown> = { agendamento: agendamento._id, para: req.user!.id }
  if (desde) filtro.criadoEm = { $gt: desde }

  const sinais = await Sinal.find(filtro).sort({ criadoEm: 1 }).limit(50)

  if (sinais.length > 0) {
    await Sinal.deleteMany({ _id: { $in: sinais.map((s) => s._id) } })
  }

  res.json({
    agora: new Date().toISOString(),
    sinais: sinais.map((s) => ({
      tipo: s.tipo,
      carga: s.carga,
      em: new Date(s.criadoEm).toISOString(),
    })),
  })
})

/**
 * POST /api/teleconsulta/:agendamentoId/sair
 *
 * Avisa o outro lado e limpa a caixa. Sem isso, quem fecha a aba deixa o outro
 * olhando para uma tela congelada até o timeout do ICE — que demora, e nesse
 * tempo a pessoa acha que é a internet dela.
 */
teleconsultaRouter.post('/:agendamentoId/sair', requireAuth, async (req, res) => {
  const agendamento = await salaOr403(req, res)
  if (!agendamento) return

  const eu = req.user!.id
  const para = participantes(agendamento).find((p) => p !== eu)

  if (para) {
    await Sinal.create({
      agendamento: agendamento._id,
      de: eu,
      para,
      tipo: 'tchau',
      criadoEm: new Date(),
      expiraEm: new Date(Date.now() + VIDA_SINAL_MS),
    })
  }

  // Só os meus: os do outro lado ainda podem não ter sido lidos por mim, mas os
  // que eu deixei para ele já não valem — ele vai receber o `tchau`.
  await Sinal.deleteMany({ agendamento: agendamento._id, de: eu, tipo: { $ne: 'tchau' } })

  res.json({ ok: true })
})
