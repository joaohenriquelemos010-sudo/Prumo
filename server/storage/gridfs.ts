import mongoose from 'mongoose'
import { GridFSBucket, ObjectId } from 'mongodb'
import { Readable } from 'node:stream'
import type { Response } from 'express'

/**
 * Exam files live in GridFS inside the same MongoDB/Atlas database — no external
 * object store, no extra credentials. The bucket is created lazily against the
 * live Mongoose connection (which the app's connect middleware guarantees is
 * open before any route runs). In production these should be encrypted at rest.
 */
const BUCKET = 'exames'

function bucket(): GridFSBucket {
  const db = mongoose.connection.db
  if (!db) throw new Error('Conexão com o banco indisponível.')
  return new GridFSBucket(db, { bucketName: BUCKET })
}

/** Stores a buffer, resolves with the new GridFS file id. */
export function uploadBuffer(
  buffer: Buffer,
  filename: string,
  contentType: string,
): Promise<ObjectId> {
  return new Promise((resolve, reject) => {
    const uploadStream = bucket().openUploadStream(filename, { contentType })
    Readable.from(buffer)
      .pipe(uploadStream)
      .on('error', reject)
      .on('finish', () => resolve(uploadStream.id as ObjectId))
  })
}

/** Streams a stored file to the HTTP response. */
export function streamToResponse(fileId: ObjectId, res: Response): void {
  const stream = bucket().openDownloadStream(fileId)
  stream.on('error', () => {
    if (!res.headersSent) res.status(404).json({ error: 'Arquivo não encontrado.' })
    else res.end()
  })
  stream.pipe(res)
}

export async function deleteFile(fileId: ObjectId): Promise<void> {
  try {
    await bucket().delete(fileId)
  } catch {
    /* already gone — nothing to do */
  }
}

export function toObjectId(id: unknown): ObjectId | null {
  try {
    return new ObjectId(String(id))
  } catch {
    return null
  }
}
