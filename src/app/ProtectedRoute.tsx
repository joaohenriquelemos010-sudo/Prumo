import { useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/lib/stores/auth'
import { InternalLayout } from './InternalLayout'
import { PageFallback } from './PageFallback'

/**
 * Gate for the internal area. Bootstraps the session once, shows a skeleton
 * while it resolves, redirects guests to the login page, and otherwise renders
 * the authenticated shell.
 */
export function ProtectedRoute() {
  const status = useAuth((s) => s.status)
  const bootstrap = useAuth((s) => s.bootstrap)

  useEffect(() => {
    void bootstrap()
  }, [bootstrap])

  if (status === 'idle' || status === 'loading') return <PageFallback />
  if (status === 'guest') return <Navigate to="/entrar" replace />

  return <InternalLayout />
}
