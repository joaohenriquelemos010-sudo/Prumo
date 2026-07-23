import type { Papel } from './models/User.js'

/** The authenticated session payload attached by requireAuth. */
export interface SessionUser {
  id: string
  papel: Papel
  nome: string
}

declare global {
  namespace Express {
    interface Request {
      user?: SessionUser
    }
  }
}

export {}
