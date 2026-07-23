import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

// Security + CSP headers are applied here for the dev server and documented for
// deploy in SECURITY.md. In production the same headers must come from the CDN /
// reverse proxy — the meta CSP in index.html is a fallback, not the primary line.
const securityHeaders: Record<string, string> = {
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
}

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'prumo-security-headers',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          // Express sets its own headers for /api; only decorate the app shell.
          if (!req.url?.startsWith('/api')) {
            for (const [key, value] of Object.entries(securityHeaders)) {
              res.setHeader(key, value)
            }
          }
          next()
        })
      },
    },
    {
      // Runs the Express API in-process on the same dev server (no second port,
      // no proxy, no port-conflict flakiness). Production uses api/index.ts on
      // Vercel; this is dev-only.
      name: 'prumo-api-middleware',
      apply: 'serve',
      async configureServer(server) {
        // Dynamic import so `vite build` never loads server code (which validates
        // prod env vars). Express handles raw Node req/res; the cast bridges types.
        const { createApp } = await import('./server/app')
        const app = createApp() as unknown as (
          req: unknown,
          res: unknown,
          next: (err?: unknown) => void,
        ) => void
        server.middlewares.use((req, res, next) => {
          if (req.url?.startsWith('/api')) app(req, res, next)
          else next()
        })
      },
    },
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    target: 'es2020',
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        manualChunks: {
          motion: ['framer-motion'],
          forms: ['react-hook-form', 'zod', '@hookform/resolvers'],
        },
      },
    },
  },
})
