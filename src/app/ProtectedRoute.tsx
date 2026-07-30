import { Suspense, useEffect } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/lib/stores/auth'
import { InternalLayout } from './InternalLayout'
import { PageFallback } from './PageFallback'

/**
 * Portão da área interna: resolve a sessão uma vez, mostra esqueleto enquanto
 * isso, e manda visitante para o login.
 *
 * Separado do layout de propósito. Quase toda tela quer o shell (rail lateral,
 * nav inferior, largura de leitura), mas o atendimento **não pode** tê-lo: ele
 * ocupa a altura inteira da viewport e não oferece navegação para fora no meio
 * de uma consulta. Sem essa separação, a alternativa seria lutar contra o
 * `max-w-4xl` do shell com CSS — o que sempre acaba mal.
 */
function usePortao(): 'carregando' | 'visitante' | 'ok' {
  const status = useAuth((s) => s.status)
  const bootstrap = useAuth((s) => s.bootstrap)

  useEffect(() => {
    void bootstrap()
  }, [bootstrap])

  if (status === 'idle' || status === 'loading') return 'carregando'
  if (status === 'guest') return 'visitante'
  return 'ok'
}

/** Autenticado, dentro do shell da plataforma. O caso comum. */
export function ProtectedRoute() {
  const portao = usePortao()
  if (portao === 'carregando') return <PageFallback />
  if (portao === 'visitante') return <Navigate to="/entrar" replace />
  return <InternalLayout />
}

/** Autenticado, tela cheia, sem shell. Para o cockpit de atendimento. */
export function ProtectedFullscreen() {
  const portao = usePortao()
  if (portao === 'carregando') return <PageFallback />
  if (portao === 'visitante') return <Navigate to="/entrar" replace />
  return (
    <Suspense fallback={<PageFallback />}>
      <Outlet />
    </Suspense>
  )
}
