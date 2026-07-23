import { createApp } from './app.js'
import { env } from './env.js'

/** Local development entry. Vite proxies /api → this server (see vite.config.ts). */
const app = createApp()

app.listen(env.PORT, () => {
  console.info(`[prumo] API em http://localhost:${env.PORT}`)
})
