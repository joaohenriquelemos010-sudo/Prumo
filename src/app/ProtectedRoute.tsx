import { Suspense, useEffect } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/lib/stores/auth'
import { useConfiguracao } from '@/lib/stores/configuracao'
import { InternalLayout } from './InternalLayout'
import { PageFallback } from './PageFallback'
import { TrocarSenha } from '@/features/conta/TrocarSenha'

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

/**
 * Autenticado, dentro do shell da plataforma. O caso comum.
 *
 * Uma conta com senha provisória não passa daqui: enquanto
 * `trocaSenhaObrigatoria` for verdadeiro, toda rota do `/app` vira a tela de
 * troca. É o que fecha o ciclo da conta de administrador provisionada — sem
 * isso, a senha inicial vira a senha permanente, que é o defeito que o
 * provisionamento tentava evitar.
 *
 * A tela de troca é servida **no lugar** da rota pedida, e não por redirect: a
 * URL de destino fica preservada, então terminar a troca leva a pessoa para
 * onde ela estava indo em vez de despejá-la no início.
 */
export function ProtectedRoute() {
  const portao = usePortao()
  const precisaTrocar = useAuth((s) => s.user?.trocaSenhaObrigatoria)
  const ehMedico = useAuth((s) => s.user?.papel === 'medico')
  const configurada = useConfiguracao((s) => s.configurada)
  const verificar = useConfiguracao((s) => s.verificar)
  const local = useLocation()

  useEffect(() => {
    if (ehMedico && configurada === null) void verificar()
  }, [ehMedico, configurada, verificar])

  if (portao === 'carregando') return <PageFallback />
  if (portao === 'visitante') return <Navigate to="/entrar" replace />
  if (precisaTrocar) return <PortaoSenha />

  /*
   * Médico sem agenda configurada vai para a configuração — é o passo que o
   * fluxo do consultório coloca entre criar a conta e usar o produto.
   *
   * Sem isso, quem acabava de se cadastrar caía num app que parecia quebrado:
   * calendário vazio, nenhum horário para oferecer, nenhum tipo de consulta, e
   * nenhuma pista de que faltava configurar alguma coisa. O produto funcionava;
   * ele é que não tinha como saber por onde começar.
   *
   * `configurada === null` é "ainda não sei" e não redireciona: mandar alguém
   * para o onboarding enquanto a resposta não chegou tiraria da tela um médico
   * já configurado a cada recarga. E `/app/perfil` fica de fora do portão —
   * ninguém pode ficar preso sem conseguir sair da conta.
   */
  const escapes = ['/app/configurar-agenda', '/app/perfil']
  if (ehMedico && configurada === false && !escapes.includes(local.pathname)) {
    return <Navigate to="/app/configurar-agenda" replace />
  }

  return <InternalLayout />
}

function PortaoSenha() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-lg p-lg">
      <header className="flex flex-col gap-1">
        <p className="u-eyebrow">Antes de continuar</p>
        <h1 className="text-3xl sm:text-4xl">Sua senha precisa ser trocada</h1>
      </header>
      <Suspense fallback={<PageFallback />}>
        <TrocarSenha obrigatoria />
      </Suspense>
    </div>
  )
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
