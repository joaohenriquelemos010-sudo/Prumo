import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { MotionConfig } from 'framer-motion'
import { router } from './app/router'
import { registrarServiceWorker } from './lib/pwa'
import './styles/index.css'

const rootEl = document.getElementById('root')
if (!rootEl) throw new Error('Elemento #root não encontrado.')

createRoot(rootEl).render(
  <StrictMode>
    {/* reducedMotion="user" makes every framer-motion animation honor the OS
        "reduce motion" setting — JS-driven motion the CSS media query can't reach. */}
    <MotionConfig reducedMotion="user">
      <RouterProvider router={router} future={{ v7_startTransition: true }} />
    </MotionConfig>
  </StrictMode>,
)

/**
 * Registrado fora do React: é um efeito global do documento, não do ciclo de
 * vida de um componente. Só em produção — em desenvolvimento um worker
 * interceptando `fetch` transforma o HMR do Vite num bug caro de diagnosticar.
 */
void registrarServiceWorker()
