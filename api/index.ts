import { createApp } from '../server/app'

/**
 * Vercel serverless entry. `vercel.json` rewrites /api/(.*) here; Vercel treats
 * the exported Express app as the request handler. The Mongoose connection is
 * cached across warm invocations (see server/db.ts).
 */
export default createApp()
