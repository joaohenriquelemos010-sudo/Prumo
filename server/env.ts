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

  /** Base pública, usada nos links dos e-mails. */
  APP_URL: process.env.APP_URL ?? 'http://localhost:5173',

  /**
   * Segredo do agendador externo (cron-job.org). **Sem ele o endpoint de cron
   * fica fechado**, não aberto — o padrão inseguro seria um agendador anônimo
   * conseguindo disparar e-mail para as pacientes.
   */
  CRON_SECRET: process.env.CRON_SECRET ?? '',

  /**
   * SMTP. Enquanto `SMTP_HOST` estiver vazio o envio fica **encostado**: as
   * mensagens são montadas, passam pela política e são registradas, mas não
   * saem. Ligar é preencher estas variáveis — nenhuma linha de código muda.
   */
  SMTP_HOST: process.env.SMTP_HOST ?? '',
  SMTP_PORT: Number(process.env.SMTP_PORT ?? 587),
  SMTP_USER: process.env.SMTP_USER ?? '',
  SMTP_PASS: process.env.SMTP_PASS ?? '',
  SMTP_FROM: process.env.SMTP_FROM ?? 'Prumo <nao-responda@prumo.app>',

  /**
   * A conta de administrador. A senha **não tem fallback de produção** de
   * propósito: sem `ADMIN_SENHA_INICIAL` a conta simplesmente não é criada lá.
   * Um admin faltando se resolve definindo a variável; um admin com senha
   * conhecida numa plataforma de saúde não se resolve, porque não dá para saber
   * quem entrou. Ver `services/seedAdmin.ts`.
   */
  ADMIN_EMAIL: process.env.ADMIN_EMAIL ?? 'admin@prumo.com',
  ADMIN_SENHA_INICIAL: process.env.ADMIN_SENHA_INICIAL ?? '',

  /**
   * Chave de criptografia de campo (AES-256-GCM), em hex de 64 caracteres.
   * Ausente, os campos sensíveis são gravados em claro e o servidor avisa uma
   * vez no boot — o produto continua de pé, e a lacuna fica visível em vez de
   * silenciosa.
   *
   * Gere: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   *
   * ⚠️ Rotacionar esta chave sem re-cifrar os dados torna ilegível o que já foi
   * gravado. Ver `security/cripto.ts`.
   */
  CAMPO_CHAVE: process.env.CAMPO_CHAVE ?? '',
}
