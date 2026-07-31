import type { Request, Response, NextFunction } from 'express'
import mongoose from 'mongoose'
import { Auditoria } from '../models/Auditoria.js'
import type { AcaoAuditada } from '../models/Auditoria.js'

/**
 * Escrever no log de auditoria.
 *
 * ## Nunca lança para dentro da requisição
 *
 * Esta é a decisão central do arquivo. Um `registrar()` que falha e derruba a
 * requisição transforma o log de auditoria — uma exigência de conformidade — na
 * peça mais frágil do produto: um índice ruim, um pico de latência no Atlas, e a
 * médica não consegue mais abrir o prontuário.
 *
 * A troca é explícita e vale a pena dizer em voz alta: **prefere-se perder uma
 * linha de log a perder um atendimento.** Se um dia a norma exigir o contrário
 * (registro garantido antes da resposta), a mudança é aqui, num lugar só — e
 * será uma decisão consciente, não um efeito colateral.
 */
interface Entrada {
  acao: AcaoAuditada
  atorId?: string
  atorPapel?: string
  recurso?: { colecao: string; id: string }
  jornada?: mongoose.Types.ObjectId | string | null
  ip?: string
  userAgent?: string
  resultado?: 'ok' | 'negado' | 'erro'
  metadados?: Record<string, unknown> | null
}

/** `jornada` é um ref: um id inválido viraria CastError e perderia a linha inteira. */
function jornadaValida(v: Entrada['jornada']): mongoose.Types.ObjectId | string | null {
  if (!v) return null
  return mongoose.isValidObjectId(v) ? v : null
}

export function registrar(entrada: Entrada): void {
  if (mongoose.connection.readyState !== 1) return

  void Auditoria.create({
    em: new Date(),
    atorId: entrada.atorId ?? '',
    atorPapel: entrada.atorPapel ?? '',
    acao: entrada.acao,
    recurso: entrada.recurso ?? { colecao: '', id: '' },
    jornada: jornadaValida(entrada.jornada),
    ip: entrada.ip ?? '',
    userAgent: (entrada.userAgent ?? '').slice(0, 300),
    resultado: entrada.resultado ?? 'ok',
    metadados: entrada.metadados ?? null,
  }).catch((err) => {
    // Visível no log do processo, invisível para quem está usando o produto.
    console.warn('[auditoria] falhou ao registrar', entrada.acao, err?.message ?? err)
  })
}

/** Os dados de origem da requisição, no formato do log. */
export function origem(req: Request): { ip: string; userAgent: string } {
  return {
    ip: req.ip ?? req.socket.remoteAddress ?? '',
    userAgent: req.get('user-agent') ?? '',
  }
}

/**
 * Middleware que registra **depois** de saber o desfecho.
 *
 * Registrar na entrada contaria a intenção; registrar no `finish` conta o que
 * de fato aconteceu — e a diferença entre "tentou ler" e "leu" é justamente o
 * que um log de auditoria existe para guardar. O `res.on('finish')` roda depois
 * da resposta ir embora, então o custo não entra na latência de ninguém.
 */
export function auditar(acao: AcaoAuditada, colecao = '') {
  return (req: Request, res: Response, next: NextFunction): void => {
    res.on('finish', () => {
      const resultado = res.statusCode < 400 ? 'ok' : res.statusCode === 403 ? 'negado' : 'erro'
      registrar({
        acao,
        atorId: req.user?.id,
        atorPapel: req.user?.papel,
        recurso: { colecao, id: String(req.params.id ?? '') },
        jornada:
          typeof req.query.jornada === 'string'
            ? req.query.jornada
            : typeof req.query.crianca === 'string'
              ? req.query.crianca
              : null,
        ...origem(req),
        resultado,
        metadados: { status: res.statusCode, metodo: req.method },
      })
    })
    next()
  }
}
