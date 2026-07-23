import 'express-async-errors' // forwards async route rejections to the error handler
import express from 'express'
import type { Request, Response, NextFunction } from 'express'
import cookieParser from 'cookie-parser'
import { connectDB } from './db'
import { authRouter } from './routes/auth'
import { trilhaRouter } from './routes/trilha'
import { perfilRouter } from './routes/perfil'
import { vacinasRouter } from './routes/vacinas'
import { prontuarioRouter } from './routes/prontuario'
import { caderninhoRouter } from './routes/caderninho'
import { consultasRouter } from './routes/consultas'
import { examesRouter } from './routes/exames'
import { prestadoresRouter } from './routes/prestadores'
import { solicitacoesRouter } from './routes/solicitacoes'
import { vinculosRouter } from './routes/vinculos'
import { MulterError } from 'multer'
import { env } from './env'

/**
 * Builds the Express app. Used both by the local dev server (server/index.ts)
 * and by the Vercel serverless function (api/index.ts) — one codebase, two hosts.
 */
export function createApp() {
  const app = express()

  app.set('trust proxy', 1)
  app.use(express.json({ limit: '64kb' }))
  app.use(cookieParser())

  // Security headers (mirror of vite.config.ts / production proxy).
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('X-Frame-Options', 'DENY')
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
    if (env.isProd) {
      res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload')
    }
    next()
  })

  // Ensure the database is connected before any route runs (cached — cheap).
  app.use(async (_req, res, next) => {
    try {
      await connectDB()
      next()
    } catch {
      res.status(503).json({ error: 'Estamos com uma instabilidade momentânea. Tenta de novo em instantes?' })
    }
  })

  app.get('/api/health', (_req, res) => res.json({ ok: true }))
  app.use('/api/auth', authRouter)
  app.use('/api/trilha', trilhaRouter)
  app.use('/api/perfil', perfilRouter)
  app.use('/api/vacinas', vacinasRouter)
  app.use('/api/prontuario', prontuarioRouter)
  app.use('/api/caderninho', caderninhoRouter)
  app.use('/api/consultas', consultasRouter)
  app.use('/api/exames', examesRouter)
  app.use('/api/prestadores', prestadoresRouter)
  app.use('/api/solicitacoes', solicitacoesRouter)
  app.use('/api/vinculos', vinculosRouter)

  // 404 for unknown API routes.
  app.use('/api', (_req, res) => res.status(404).json({ error: 'Não encontramos o que você procurava.' }))

  // Error handler — never leak a stack trace to the client.
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof MulterError) {
      const msg =
        err.code === 'LIMIT_FILE_SIZE'
          ? 'O arquivo é grande demais. O limite é 5 MB.'
          : 'Não consegui receber esse arquivo. Tenta outro?'
      res.status(413).json({ error: msg })
      return
    }
    if (!env.isProd) {
      console.error('[api error]', err)
    }
    res.status(500).json({ error: 'Algo não funcionou do nosso lado. Já estamos vendo isso — tenta de novo?' })
  })

  return app
}
