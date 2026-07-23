import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import type { Request, Response, NextFunction } from 'express'
import { env } from './env.js'
import type { Papel } from './models/User.js'
import type { SessionUser } from './types.js'

const COOKIE_NAME = 'prumo_session'
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

export function hashPassword(senha: string): Promise<string> {
  return bcrypt.hash(senha, 12)
}

export function verifyPassword(senha: string, hash: string): Promise<boolean> {
  return bcrypt.compare(senha, hash)
}

/** Sets the session as an httpOnly cookie. Secure + SameSite=Strict in prod. */
export function issueSession(res: Response, user: SessionUser): void {
  const token = jwt.sign(user, env.JWT_SECRET, { expiresIn: '7d' })
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: env.isProd,
    maxAge: MAX_AGE_MS,
    path: '/',
  })
}

export function clearSession(res: Response): void {
  res.clearCookie(COOKIE_NAME, { path: '/' })
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = req.cookies?.[COOKIE_NAME]
  if (!token) {
    res.status(401).json({ error: 'Você precisa entrar para continuar.' })
    return
  }
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as SessionUser
    req.user = payload
    next()
  } catch {
    res.status(401).json({ error: 'Sua sessão expirou. Entre de novo para continuar com segurança.' })
  }
}

export function requireRole(...roles: Papel[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.papel)) {
      res.status(403).json({ error: 'Isso aqui não está liberado para o seu acesso.' })
      return
    }
    next()
  }
}
