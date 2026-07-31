import { Router } from 'express'
import { randomBytes } from 'node:crypto'
import { requireAuth } from '../auth.js'
import { Lembrete } from '../models/Lembrete.js'
import { PreferenciasNotificacao, normalizarPreferencias } from '../models/PreferenciasNotificacao.js'
import { preferenciasUpdateSchema } from '../validation.js'
import { envioAtivo } from '../services/email/index.js'

export const lembretesRouter = Router()

/**
 * Copia só as chaves definidas. Os subdocumentos do Mongoose vêm opcionais no
 * tipo inferido, daí o parâmetro frouxo — o schema é quem garante a forma.
 */
function mesclar(alvo: unknown, mudancas: Record<string, unknown>): void {
  if (!alvo || typeof alvo !== 'object') return
  for (const [chave, valor] of Object.entries(mudancas)) {
    if (valor !== undefined) (alvo as Record<string, unknown>)[chave] = valor
  }
}

async function preferenciasDoUsuario(userId: string) {
  const existente = await PreferenciasNotificacao.findOne({ userId })
  if (existente) {
    if (!existente.tokenDescadastro) {
      existente.tokenDescadastro = randomBytes(24).toString('hex')
      await existente.save()
    }
    return existente
  }
  return PreferenciasNotificacao.create({
    userId,
    tokenDescadastro: randomBytes(24).toString('hex'),
  })
}

function serializePrefs(p: Awaited<ReturnType<typeof preferenciasDoUsuario>>) {
  const n = normalizarPreferencias(p)
  return {
    canais: n.canais,
    silencio: n.silencio,
    limites: n.limites,
    tipos: n.tipos,
    pausadoAte: n.pausadoAte ? n.pausadoAte.toISOString() : null,
    /** O token não sai daqui: é credencial portadora, e vive nos e-mails. */
  }
}

/**
 * GET /api/lembretes — o que vem por aí.
 *
 * A área de lembretes existe para responder "o que o Prumo vai me lembrar", e
 * ela também é a resposta honesta a "por que não recebi nada": enquanto o envio
 * estiver desligado, `envioAtivo: false` deixa isso explícito em vez de a pessoa
 * ficar esperando um e-mail que ninguém mandou.
 */
lembretesRouter.get('/', requireAuth, async (req, res) => {
  const [proximos, prefs] = await Promise.all([
    Lembrete.find({ destinatarioId: req.user!.id, estado: { $in: ['agendado', 'enviado'] } })
      .sort({ agendadoPara: 1 })
      .limit(30),
    preferenciasDoUsuario(req.user!.id),
  ])

  res.json({
    envioAtivo: envioAtivo(),
    preferencias: serializePrefs(prefs),
    lembretes: proximos.map((l) => ({
      id: String(l._id),
      tipo: l.tipo,
      canal: l.canal,
      estado: l.estado,
      agendadoPara: new Date(l.agendadoPara).toISOString(),
      enviadoEm: l.enviadoEm ? new Date(l.enviadoEm).toISOString() : null,
      carga: l.carga ?? {},
    })),
  })
})

/** PUT /api/lembretes/preferencias — ajusta canais, tipos, silêncio e limites. */
lembretesRouter.put('/preferencias', requireAuth, async (req, res) => {
  const parsed = preferenciasUpdateSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Confere os dados.' })
    return
  }

  const prefs = await preferenciasDoUsuario(req.user!.id)
  const d = parsed.data

  // Mescla só o que veio definido: espalhar um `undefined` apagaria a escolha
  // anterior da pessoa, e o cliente manda apenas o campo que ela mexeu.
  if (d.canais) mesclar(prefs.canais, d.canais)
  if (d.tipos) mesclar(prefs.tipos, d.tipos)
  if (d.silencio) mesclar(prefs.silencio, d.silencio)
  if (d.limites) mesclar(prefs.limites, d.limites)
  if (d.pausarDias !== undefined) {
    prefs.pausadoAte = d.pausarDias > 0 ? new Date(Date.now() + d.pausarDias * 864e5) : null
  }

  await prefs.save()
  res.json({ preferencias: serializePrefs(prefs) })
})

/** POST /api/lembretes/:id/adiar — "hoje não". */
lembretesRouter.post('/:id/adiar', requireAuth, async (req, res) => {
  const dias = Number(req.body?.dias ?? 1)
  const resultado = await Lembrete.updateOne(
    { _id: req.params.id, destinatarioId: req.user!.id, estado: 'agendado' },
    { $set: { agendadoPara: new Date(Date.now() + Math.min(30, Math.max(1, dias)) * 864e5) } },
  )
  if (resultado.matchedCount === 0) {
    res.status(404).json({ error: 'Não encontramos esse lembrete.' })
    return
  }
  res.json({ ok: true })
})

/** POST /api/lembretes/:id/concluir — "já fiz". */
lembretesRouter.post('/:id/concluir', requireAuth, async (req, res) => {
  const resultado = await Lembrete.updateOne(
    { _id: req.params.id, destinatarioId: req.user!.id, estado: 'agendado' },
    { $set: { estado: 'cancelado' } },
  )
  if (resultado.matchedCount === 0) {
    res.status(404).json({ error: 'Não encontramos esse lembrete.' })
    return
  }
  res.json({ ok: true })
})

/**
 * GET /api/lembretes/descadastrar/:token — **sem login**, de propósito.
 *
 * Quem quer parar de receber não pode esbarrar numa tela de senha: isso
 * transforma "cancelar inscrição" em "marcar como spam", que queima a reputação
 * do domínio para todas as outras pacientes. O token vive nos cabeçalhos
 * `List-Unsubscribe` e no rodapé de cada e-mail.
 *
 * Desliga só o **e-mail** — o in-app continua, porque ele não invade nada e é
 * onde ela vai ver o que perdeu quando voltar.
 */
lembretesRouter.get('/descadastrar/:token', async (req, res) => {
  const prefs = await PreferenciasNotificacao.findOne({ tokenDescadastro: req.params.token })
  if (!prefs) {
    res.status(404).json({ error: 'Esse link não é mais válido.' })
    return
  }

  prefs.set('canais.email', false)
  await prefs.save()

  res.json({
    ok: true,
    mensagem: 'Pronto. Você não vai mais receber e-mails do Prumo.',
  })
})

/** POST /api/lembretes/descadastrar/:token — o mesmo, para `List-Unsubscribe-Post`. */
lembretesRouter.post('/descadastrar/:token', async (req, res) => {
  const prefs = await PreferenciasNotificacao.findOne({ tokenDescadastro: req.params.token })
  if (!prefs) {
    res.status(404).end()
    return
  }
  prefs.set('canais.email', false)
  await prefs.save()
  res.status(200).end()
})

/**
 * GET /api/lembretes/preferencias/:token — a "soneca", sem login.
 *
 * É a alternativa que converte um descadastro definitivo numa pausa: o rodapé
 * do e-mail oferece as duas portas, e a maioria das pessoas que clica só queria
 * silêncio por uma semana.
 */
lembretesRouter.get('/preferencias/:token', async (req, res) => {
  const prefs = await PreferenciasNotificacao.findOne({ tokenDescadastro: req.params.token })
  if (!prefs) {
    res.status(404).json({ error: 'Esse link não é mais válido.' })
    return
  }

  const dias = Number(req.query.pausar ?? 0)
  if (dias > 0) {
    prefs.pausadoAte = new Date(Date.now() + Math.min(90, dias) * 864e5)
    await prefs.save()
    res.json({ ok: true, mensagem: `Pausado por ${Math.min(90, dias)} dias.` })
    return
  }

  const n = normalizarPreferencias(prefs)
  res.json({
    ok: true,
    canais: n.canais,
    pausadoAte: n.pausadoAte ? n.pausadoAte.toISOString() : null,
  })
})
