import { AssinaturaPush } from '../../models/AssinaturaPush.js'
import { env } from '../../env.js'

/**
 * Web Push — o canal `push` do `Lembrete`.
 *
 * Mesmo desenho do e-mail, e pelo mesmo motivo: **encostado até a chave
 * existir**. Sem `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` o transporte é `noop`,
 * o lembrete é marcado como enviado e a fila continua se exercitando de verdade.
 * Quando as chaves entrarem, o comportamento já é o observado.
 *
 * O `web-push` é importado sob demanda: ele carrega criptografia e um cliente
 * HTTP, e num cold start serverless em que nenhum push vai sair isso é tempo
 * cobrado de quem está só abrindo a agenda.
 */

export interface CargaPush {
  titulo: string
  corpo: string
  url?: string
  /** Mesma tag substitui a notificação anterior em vez de empilhar. */
  tag?: string
}

export interface ResultadoPush {
  entregue: boolean
  transporte: 'web-push' | 'noop'
  /** Aparelhos que receberam. Zero não é erro: pode não haver nenhum inscrito. */
  aparelhos: number
  erro?: string
}

export function pushAtivo(): boolean {
  return Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY)
}

/** A chave pública, que o navegador precisa para se inscrever. */
export function chavePublica(): string {
  return env.VAPID_PUBLIC_KEY
}

type ModuloWebPush = typeof import('web-push')
let webPushCache: ModuloWebPush | null = null

async function carregarWebPush(): Promise<ModuloWebPush> {
  if (webPushCache) return webPushCache
  const mod = await import('web-push')
  const webPush = (mod.default ?? mod) as ModuloWebPush
  webPush.setVapidDetails(
    // `mailto:` é o que a especificação pede: um jeito de o serviço de push
    // falar com quem envia quando algo dá errado do lado deles.
    `mailto:${env.VAPID_CONTATO}`,
    env.VAPID_PUBLIC_KEY,
    env.VAPID_PRIVATE_KEY,
  )
  webPushCache = webPush
  return webPush
}

/**
 * Manda para **todos** os aparelhos da pessoa.
 *
 * Um endpoint morto responde 404 ou 410, e a inscrição é apagada na hora — sem
 * isso a coleção vira um cemitério de endereços que custam uma requisição HTTP
 * cada, para sempre. Qualquer outro erro deixa a inscrição em paz: uma falha
 * temporária do serviço de push não é motivo para desinscrever ninguém.
 */
export async function enviarPush(userId: string, carga: CargaPush): Promise<ResultadoPush> {
  const assinaturas = await AssinaturaPush.find({ userId })
  if (assinaturas.length === 0) {
    return { entregue: false, transporte: pushAtivo() ? 'web-push' : 'noop', aparelhos: 0 }
  }

  if (!pushAtivo()) {
    console.info(
      `[push] encostado (sem VAPID). Seriam ${assinaturas.length} aparelho(s): ${carga.titulo}`,
    )
    return { entregue: false, transporte: 'noop', aparelhos: assinaturas.length }
  }

  const webPush = await carregarWebPush()
  const corpo = JSON.stringify(carga)

  let entregues = 0
  let ultimoErro = ''

  for (const a of assinaturas) {
    try {
      await webPush.sendNotification(
        { endpoint: a.endpoint, keys: { p256dh: a.p256dh, auth: a.auth } },
        corpo,
        { TTL: 24 * 60 * 60 },
      )
      entregues++
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode
      if (status === 404 || status === 410) {
        await AssinaturaPush.deleteOne({ _id: a._id })
      } else {
        ultimoErro = err instanceof Error ? err.message : String(err)
      }
    }
  }

  if (entregues > 0) {
    await AssinaturaPush.updateMany({ userId }, { $set: { ultimoEnvioEm: new Date() } })
  }

  return {
    entregue: entregues > 0,
    transporte: 'web-push',
    aparelhos: entregues,
    erro: entregues === 0 ? ultimoErro : undefined,
  }
}
