import type { Request, Response, NextFunction } from 'express'
import mongoose from 'mongoose'
import { Limite } from './models/Limite.js'

/**
 * Rate limit compartilhado entre instâncias.
 *
 * A assinatura é a mesma de antes de propósito: os quatro call sites
 * (`register`, `login`, `esqueci-senha`, `agendamento`) não mudam uma linha. O
 * que mudou é onde o contador mora — saiu de um `Map` do processo, que cada
 * cold start zerava, para um documento com TTL no MongoDB.
 *
 * ## A decisão que importa: falha aberta
 *
 * Se o banco não responde, a requisição **passa**. É o oposto do endpoint de
 * cron, que fecha sem segredo configurado, e a diferença não é inconsistência:
 * lá o custo de abrir é um estranho disparando e-mail para as pacientes; aqui o
 * custo de fechar é o Prumo inteiro fora do ar por causa de um contador. Um
 * limitador é lombada, não muro — a defesa de verdade é a autenticação.
 */

interface Opcoes {
  key: string
  limit?: number
  windowMs?: number
}

function identificar(req: Request): string {
  // `req.ip` respeita `trust proxy`; o socket é o fallback para quando não há
  // proxy na frente. `desconhecido` agrupa todo mundo num balde só, o que é
  // conservador na direção certa.
  return req.ip ?? req.socket.remoteAddress ?? 'desconhecido'
}

export function rateLimit(options: Opcoes) {
  const { key, limit = 10, windowMs = 60_000 } = options

  return (req: Request, res: Response, next: NextFunction): void => {
    // Sem conexão não há contador — e não há motivo para segurar a requisição.
    if (mongoose.connection.readyState !== 1) {
      next()
      return
    }

    const id = `${key}:${identificar(req)}`
    const agora = new Date()
    const expiraEm = new Date(agora.getTime() + windowMs)

    /**
     * Uma ida ao banco resolve as duas metades:
     *
     * - `$inc` incrementa se o balde existe;
     * - `$setOnInsert` grava o fim da janela **só na criação**, e é isso que
     *   torna a janela fixa em vez de deslizante. Se `expiraEm` fosse escrito a
     *   cada requisição, quem batesse sem parar empurraria o próprio vencimento
     *   para sempre — e o balde nunca zeraria.
     */
    Limite.findOneAndUpdate(
      { _id: id },
      { $inc: { contador: 1 }, $setOnInsert: { expiraEm } },
      { upsert: true, returnDocument: 'after' },
    )
      .then((balde) => {
        // O TTL do Mongo varre em background, com atraso de até um minuto. Um
        // balde já vencido que ainda está lá é tratado como novo aqui, em vez
        // de punir alguém por causa da latência do coletor.
        const vencido = balde && new Date(balde.expiraEm).getTime() <= agora.getTime()
        if (vencido) {
          return Limite.updateOne({ _id: id }, { $set: { contador: 1, expiraEm } }).then(() =>
            next(),
          )
        }

        if (balde && balde.contador > limit) {
          const restam = Math.max(
            1,
            Math.ceil((new Date(balde.expiraEm).getTime() - agora.getTime()) / 1000),
          )
          res.setHeader('Retry-After', String(restam))
          res.status(429).json({
            error: 'Muitas tentativas em pouco tempo. Respira e tenta de novo em instantes.',
          })
          return undefined
        }

        next()
        return undefined
      })
      .catch(() => {
        // Falha aberta. Ver o comentário do topo.
        next()
      })
  }
}
