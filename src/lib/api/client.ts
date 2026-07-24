/**
 * Isolated API layer.
 *
 * Everything the app knows about the network lives behind this seam:
 *  - a hard timeout on every request (no hanging spinners),
 *  - retry with exponential backoff for idempotent reads,
 *  - errors that surface a warm, human message and never a stack trace or
 *    server detail. The raw cause is kept for logging only.
 *
 * Session lives in an httpOnly cookie set by the backend (see SECURITY.md), so
 * `credentials: 'include'` is all the client needs — no token handling here,
 * and nothing sensitive touches JavaScript-readable storage.
 */

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api'
const DEFAULT_TIMEOUT = 10_000

/** User-facing error. `.message` is always safe to render. */
export class ApiError extends Error {
  readonly status: number
  readonly cause?: unknown

  constructor(message: string, status: number, cause?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.cause = cause
  }
}

const FRIENDLY_MESSAGE: Record<number, string> = {
  0: 'Não conseguimos falar com o servidor agora. Confira sua conexão e tente de novo.',
  400: 'Alguns dados não passaram na conferência. Dá uma olhada e tenta de novo?',
  401: 'Sua sessão expirou. Entre de novo para continuar com segurança.',
  403: 'Isso aqui não está liberado para o seu acesso.',
  404: 'Não encontramos o que você procurava.',
  429: 'Muitas tentativas em pouco tempo. Respira e tenta de novo em instantes.',
  500: 'Algo não funcionou do nosso lado. Já estamos vendo isso — tenta de novo?',
}

function friendly(status: number): string {
  return FRIENDLY_MESSAGE[status] ?? FRIENDLY_MESSAGE[500]
}

/**
 * Fires when the server says the session is gone on a call that assumed one.
 * The auth store registers here (a callback, not an import, so this layer stays
 * free of store dependencies) and drops the stale session — otherwise the
 * person reads "sua sessão expirou" on a screen that offers no way back in.
 */
let onSessionExpired: (() => void) | null = null

export function setSessionExpiredHandler(handler: () => void): void {
  onSessionExpired = handler
}

/**
 * On these, 401 is a normal answer ("wrong password", "not signed in yet"), not
 * an expired session — they must never trigger the handler.
 */
const AUTH_ENDPOINTS = ['/auth/login', '/auth/register', '/auth/me', '/auth/esqueci-senha']

function isExpiredSession(status: number, path: string): boolean {
  return status === 401 && !AUTH_ENDPOINTS.some((endpoint) => path.startsWith(endpoint))
}

/**
 * Prefer the server's own `error` message when present — every server error is
 * authored to be user-safe and specific (e.g. "e-mail já existe", "arquivo grande
 * demais"). Fall back to the generic map when there's no usable body.
 */
async function messageFor(response: Response): Promise<string> {
  try {
    const data = (await response.clone().json()) as { error?: unknown }
    if (typeof data?.error === 'string' && data.error.trim().length > 0) {
      return data.error
    }
  } catch {
    /* not JSON — use the generic message */
  }
  return friendly(response.status)
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown
  timeoutMs?: number
  /** Retries for GET/idempotent calls. Mutations default to 0. */
  retries?: number
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const {
    body,
    timeoutMs = DEFAULT_TIMEOUT,
    retries = options.method && options.method !== 'GET' ? 0 : 2,
    headers,
    ...rest
  } = options

  let attempt = 0
  let lastError: unknown

  while (attempt <= retries) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const response = await fetch(`${BASE_URL}${path}`, {
        ...rest,
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        credentials: 'include',
        signal: controller.signal,
        body: body === undefined ? undefined : JSON.stringify(body),
      })
      clearTimeout(timer)

      if (!response.ok) {
        // Retry only transient server errors on idempotent calls.
        if (response.status >= 500 && attempt < retries) {
          lastError = new ApiError(friendly(response.status), response.status)
          await backoff(attempt)
          attempt += 1
          continue
        }
        if (isExpiredSession(response.status, path)) onSessionExpired?.()
        throw new ApiError(await messageFor(response), response.status)
      }

      if (response.status === 204) return undefined as T
      return (await response.json()) as T
    } catch (error) {
      clearTimeout(timer)
      if (error instanceof ApiError) throw error

      lastError = error
      if (attempt < retries) {
        await backoff(attempt)
        attempt += 1
        continue
      }
      // Network failure / abort — never leak the raw reason to the UI.
      throw new ApiError(friendly(0), 0, error)
    }
  }

  throw new ApiError(friendly(0), 0, lastError)
}

function backoff(attempt: number): Promise<void> {
  const delay = Math.min(1000 * 2 ** attempt, 4000) + Math.random() * 200
  return new Promise((resolve) => setTimeout(resolve, delay))
}

/**
 * Multipart upload. Kept separate from `request` because FormData must NOT be
 * JSON-stringified and the browser must set the multipart Content-Type (with its
 * boundary) itself. Uses the same friendly-error handling and credentials. Works
 * in a Capacitor WebView too — same fetch + FormData.
 */
async function upload<T>(path: string, formData: FormData, timeoutMs = 30_000): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      credentials: 'include',
      body: formData,
      signal: controller.signal,
    })
    clearTimeout(timer)
    if (!response.ok) {
      if (isExpiredSession(response.status, path)) onSessionExpired?.()
      throw new ApiError(await messageFor(response), response.status)
    }
    if (response.status === 204) return undefined as T
    return (await response.json()) as T
  } catch (error) {
    clearTimeout(timer)
    if (error instanceof ApiError) throw error
    throw new ApiError(friendly(0), 0, error)
  }
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'POST', body }),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'PUT', body }),
  del: <T>(path: string, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'DELETE' }),
  upload,
}
