import { Router } from 'express'
import type { Request, Response, NextFunction } from 'express'
import { timingSafeEqual } from 'node:crypto'
import { env } from '../env.js'
import { despacharLembretes } from '../services/lembretes/despachar.js'

export const cronRouter = Router()

/**
 * As tarefas periódicas, disparadas por um agendador **externo**
 * (cron-job.org), e não pelo Vercel Cron.
 *
 * A consequência prática dessa escolha: o gatilho é uma requisição HTTP vinda
 * da internet aberta, então a autenticação é responsabilidade nossa. O
 * cron-job.org permite configurar cabeçalhos, e é assim que deve ser feito —
 * `Authorization: Bearer <CRON_SECRET>`.
 *
 * O segredo também é aceito em `?token=`, porque alguns agendadores só sabem
 * chamar uma URL. Mas isso é a saída pior: query string vaza em log de
 * servidor, em histórico de proxy e no `Referer`. Se der para usar cabeçalho,
 * use cabeçalho.
 */
function compararSegredo(recebido: string, esperado: string): boolean {
  const a = Buffer.from(recebido)
  const b = Buffer.from(esperado)
  // Comprimentos diferentes já não batem; `timingSafeEqual` exige tamanho igual.
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

function exigirSegredo(req: Request, res: Response, next: NextFunction): void {
  /**
   * Sem `CRON_SECRET` configurado o endpoint fica **fechado**, e não aberto.
   * O padrão inseguro aqui seria um agendador anônimo conseguindo disparar
   * envio de e-mail para as pacientes.
   */
  if (!env.CRON_SECRET) {
    res.status(503).json({ error: 'Agendador não configurado.' })
    return
  }

  const cabecalho = req.get('authorization') ?? ''
  const doCabecalho = cabecalho.startsWith('Bearer ') ? cabecalho.slice(7) : ''
  const daQuery = typeof req.query.token === 'string' ? req.query.token : ''
  const recebido = doCabecalho || daQuery

  if (!recebido || !compararSegredo(recebido, env.CRON_SECRET)) {
    res.status(401).json({ error: 'Não autorizado.' })
    return
  }

  next()
}

/**
 * GET|POST /api/cron/lembretes — uma rodada de despacho.
 *
 * Aceita os dois verbos porque agendadores externos diferem: alguns só fazem
 * GET. A operação é idempotente na prática — cada lembrete é reivindicado com
 * lease, então chamar duas vezes seguidas não manda nada em dobro.
 *
 * Enquanto o SMTP não estiver configurado, a resposta traz `envioAtivo: false`
 * e nenhum e-mail sai — mas a fila, a política e os limites rodam de verdade.
 */
async function rodar(_req: Request, res: Response): Promise<void> {
  const resultado = await despacharLembretes()
  res.json({ ok: true, ...resultado })
}

cronRouter.get('/lembretes', exigirSegredo, rodar)
cronRouter.post('/lembretes', exigirSegredo, rodar)

/**
 * GET /api/cron/saude — o agendador precisa de um alvo que responda 200 sem
 * efeito colateral, para dizer se está vivo antes de a fila existir.
 */
cronRouter.get('/saude', exigirSegredo, (_req, res) => {
  res.json({ ok: true, em: new Date().toISOString() })
})
