import { Router } from 'express'
import { requireAuth } from '../auth.js'
import { AssinaturaPush } from '../models/AssinaturaPush.js'
import { PreferenciasNotificacao } from '../models/PreferenciasNotificacao.js'
import { chavePublica, pushAtivo } from '../services/push/index.js'
import { assinaturaPushSchema } from '../validation.js'
import { normalizeField } from '../sanitize.js'

export const pushRouter = Router()

/**
 * GET /api/push/chave — a chave pública VAPID.
 *
 * Pública é literal: ela vai para dentro do JavaScript de qualquer navegador
 * que se inscreva. `ativo: false` é a resposta honesta enquanto as chaves não
 * existem — o cliente esconde o botão em vez de pedir uma permissão que não vai
 * levar a nada, e uma permissão negada por engano é difícil de recuperar
 * (o navegador passa a bloquear o pedido em silêncio).
 */
pushRouter.get('/chave', requireAuth, (_req, res) => {
  res.json({ ativo: pushAtivo(), chave: chavePublica() })
})

/**
 * POST /api/push/assinar — este aparelho quer receber.
 *
 * Idempotente pelo `endpoint`: reabrir o app não cria uma segunda inscrição
 * para o mesmo navegador. Assinar também **liga o canal** nas preferências — a
 * pessoa acabou de conceder a permissão do sistema, que é um consentimento
 * bem mais explícito do que um interruptor, e obrigá-la a um segundo passo
 * seria fazê-la achar que não funcionou.
 */
pushRouter.post('/assinar', requireAuth, async (req, res) => {
  const parsed = assinaturaPushSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Inscrição inválida.' })
    return
  }
  const { endpoint, keys } = parsed.data

  await AssinaturaPush.updateOne(
    { endpoint },
    {
      $set: {
        userId: req.user!.id,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
        agente: normalizeField(req.get('user-agent') ?? '', 300),
      },
    },
    { upsert: true },
  )

  await PreferenciasNotificacao.updateOne(
    { userId: req.user!.id },
    { $set: { 'canais.push': true } },
    { upsert: true },
  )

  res.status(201).json({ ok: true })
})

/**
 * POST /api/push/cancelar — este aparelho não quer mais.
 *
 * Desliga o canal só quando **nenhum** aparelho sobra. Tirar o notebook não
 * pode calar o celular, e é exatamente esse o erro que faz a pessoa achar que o
 * produto perdeu a configuração dela.
 */
pushRouter.post('/cancelar', requireAuth, async (req, res) => {
  const endpoint = typeof req.body?.endpoint === 'string' ? req.body.endpoint : ''

  if (endpoint) {
    // Escopado ao dono: um endpoint não é segredo, e sem isso alguém poderia
    // desinscrever o aparelho de outra pessoa só por conhecê-lo.
    await AssinaturaPush.deleteOne({ endpoint, userId: req.user!.id })
  } else {
    await AssinaturaPush.deleteMany({ userId: req.user!.id })
  }

  const restam = await AssinaturaPush.countDocuments({ userId: req.user!.id })
  if (restam === 0) {
    await PreferenciasNotificacao.updateOne(
      { userId: req.user!.id },
      { $set: { 'canais.push': false } },
    )
  }

  res.json({ ok: true, aparelhos: restam })
})
