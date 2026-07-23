import mongoose from 'mongoose'
import { env } from './env'

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
}

const globalForMongoose = globalThis as unknown as { __prumoMongoose?: Cache }
const cache: Cache = globalForMongoose.__prumoMongoose ?? { conn: null, promise: null }
globalForMongoose.__prumoMongoose = cache

async function resolveUri(): Promise<string> {
  if (env.MONGODB_URI) return env.MONGODB_URI
  if (env.isProd) {
    throw new Error('MONGODB_URI ausente em produção. Configure a connection string do Atlas.')
  }
  // Dev only: lazy-load the in-memory server so it is never bundled into prod.
  const { MongoMemoryServer } = await import('mongodb-memory-server')
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
  return cache.conn
}
