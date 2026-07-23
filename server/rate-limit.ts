import type { Request, Response, NextFunction } from 'express'

/**
 * Minimal in-memory rate limiter, keyed by client IP + route. This is basic
 * abuse protection; in a serverless deploy each instance has its own map, so a
 * production-grade limiter (Redis / Upstash) should back this later. It is a
 * speed bump, not a wall — the real defence is auth + Atlas-side controls.
 */

interface Bucket {
  count: number
  windowStart: number
}

const buckets = new Map<string, Bucket>()

export function rateLimit(options: { key: string; limit?: number; windowMs?: number }) {
  const { key, limit = 10, windowMs = 60_000 } = options

  return (req: Request, res: Response, next: NextFunction): void => {
    const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown'
    const bucketKey = `${key}:${ip}`
    const now = Date.now()
    const bucket = buckets.get(bucketKey)

    if (!bucket || now - bucket.windowStart > windowMs) {
      buckets.set(bucketKey, { count: 1, windowStart: now })
      next()
      return
    }

    if (bucket.count >= limit) {
      const retryAfter = Math.ceil((windowMs - (now - bucket.windowStart)) / 1000)
      res.setHeader('Retry-After', String(retryAfter))
      res.status(429).json({
        error: 'Muitas tentativas em pouco tempo. Respira e tenta de novo em instantes.',
      })
      return
    }

    bucket.count += 1
    next()
  }
}
