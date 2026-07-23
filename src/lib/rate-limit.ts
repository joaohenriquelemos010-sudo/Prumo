/**
 * Client-side rate limiting. This is anti-spam and double-submit protection,
 * not a security boundary — the server must enforce its own limits. We keep the
 * window in memory (never localStorage) so it resets on reload and leaks nothing.
 */

interface Bucket {
  count: number
  windowStart: number
}

const buckets = new Map<string, Bucket>()

export interface RateLimitResult {
  allowed: boolean
  /** Seconds until the caller may retry, when blocked. */
  retryAfter: number
}

/**
 * @param key      A stable identifier for the action (e.g. 'onboarding-submit').
 * @param limit    Max attempts allowed inside the window.
 * @param windowMs Window length in milliseconds.
 */
export function checkRateLimit(
  key: string,
  limit = 5,
  windowMs = 60_000,
): RateLimitResult {
  const now = Date.now()
  const bucket = buckets.get(key)

  if (!bucket || now - bucket.windowStart > windowMs) {
    buckets.set(key, { count: 1, windowStart: now })
    return { allowed: true, retryAfter: 0 }
  }

  if (bucket.count >= limit) {
    const retryAfter = Math.ceil((windowMs - (now - bucket.windowStart)) / 1000)
    return { allowed: false, retryAfter }
  }

  bucket.count += 1
  return { allowed: true, retryAfter: 0 }
}

export function resetRateLimit(key: string): void {
  buckets.delete(key)
}
