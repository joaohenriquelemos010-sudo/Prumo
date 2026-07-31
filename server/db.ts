import mongoose from 'mongoose'
import { env } from './env.js'
import { seedAdmin } from './services/seedAdmin.js'
import { runMigracoes } from './services/migracoes/index.js'

/**
 * Mongoose connection, cached on `globalThis`. In a serverless environment
 * (Vercel) the module may be re-evaluated between invocations while the process
 * stays warm; caching the connection avoids opening a new one on every request,
 * which would exhaust the Atlas connection pool.
 *
 * Dev fallback: when MONGODB_URI is not set, spin up a real MongoDB in memory
 * (mongodb-memory-server) so the app runs end-to-end with zero setup. As soon as
 * an Atlas URI is provided, it is used instead.
 */

interface Cache {
  conn: typeof mongoose | null
  promise: Promise<typeof mongoose> | null
  adminSeeded?: Promise<void>
  migracoesRodadas?: Promise<void>
}

const globalForMongoose = globalThis as unknown as { __prumoMongoose?: Cache }
const cache: Cache = globalForMongoose.__prumoMongoose ?? { conn: null, promise: null }
globalForMongoose.__prumoMongoose = cache

async function resolveUri(): Promise<string> {
  if (env.MONGODB_URI) return env.MONGODB_URI
  if (env.isProd) {
    throw new Error('MONGODB_URI ausente em produção. Configure a connection string do Atlas.')
  }
  // Dev only. The specifier is assembled at runtime on purpose: with a literal,
  // the bundler that builds the Vercel function follows it and pulls a
  // devDependency into the production bundle — and, worse, fails the build
  // outright the day dependencies are installed without dev ones. A variable
  // makes the import invisible to static analysis and resolvable only here,
  // where we already know we are not in production.
  const somenteDev = 'mongodb-memory-server'
  const { MongoMemoryServer } = (await import(/* @vite-ignore */ somenteDev)) as {
    MongoMemoryServer: { create(): Promise<{ getUri(db: string): string }> }
  }
  const mem = await MongoMemoryServer.create()
  console.info('[db] MONGODB_URI ausente — usando MongoDB em memória (somente dev).')
  return mem.getUri('prumo')
}

export async function connectDB(): Promise<typeof mongoose> {
  if (cache.conn) return cache.conn
  if (!cache.promise) {
    cache.promise = resolveUri().then((uri) =>
      mongoose.connect(uri, {
        bufferCommands: false,
        serverSelectionTimeoutMS: 8000,
      }),
    )
  }
  cache.conn = await cache.promise
  // Provision the administrator account before any request proceeds. Awaited so a
  // request (e.g. the admin's own login, right after a cold start) can never race
  // ahead of the account being created. Still best-effort: a seeding failure is
  // logged, not thrown — it must not take down request handling.
  if (!cache.adminSeeded) {
    cache.adminSeeded = seedAdmin().catch((err) => {
      console.error('[seed] falha ao provisionar admin:', err)
    })
  }
  await cache.adminSeeded

  // Move os documentos existentes para o formato que o código espera, antes de
  // qualquer requisição rodar. Awaited pelo mesmo motivo do seed: um handler não
  // pode chegar na frente de uma mudança de forma dos dados. Best-effort na
  // falha — o runner já registrou o estado `falhou` e vai retentar no próximo
  // cold start; derrubar a API inteira seria pior que rodar com o formato velho.
  if (!cache.migracoesRodadas) {
    cache.migracoesRodadas = runMigracoes().catch((err) => {
      console.error('[migracao] runner falhou:', err)
    })
  }
  await cache.migracoesRodadas

  return cache.conn
}
