/**
 * Server configuration. Secrets come only from the environment (Atlas URI, JWT
 * secret) — never from the repo. In production a missing secret is fatal; in
 * development we fall back to safe local defaults so the app runs with no setup.
 */

const NODE_ENV = process.env.NODE_ENV ?? 'development'
const isProd = NODE_ENV === 'production'

function requireInProd(name: string, value: string | undefined, devFallback: string): string {
  if (value && value.length > 0) return value
  if (isProd) {
    throw new Error(`Variável de ambiente obrigatória ausente em produção: ${name}`)
  }
  return devFallback
}

export const env = {
  NODE_ENV,
  isProd,
  /** Empty in dev → server spins up an in-memory MongoDB automatically. */
  MONGODB_URI: process.env.MONGODB_URI ?? '',
  JWT_SECRET: requireInProd(
    'JWT_SECRET',
    process.env.JWT_SECRET,
    'prumo-dev-insecure-secret-do-not-use-in-prod',
  ),
  PORT: Number(process.env.PORT ?? 3001),
}
