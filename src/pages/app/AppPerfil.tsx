import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { LogOut, ShieldCheck, Download, Trash2 } from 'lucide-react'
import { useAuth } from '@/lib/stores/auth'
import { useTrilha } from '@/lib/stores/trilha'
import { Button } from '@/components/Button'

const PAPEL_LABEL: Record<string, string> = {
  gestante: 'Gestante',
  mae: 'Mãe',
  pai: 'Pai',
  medico: 'Médico(a)',
  admin: 'Administrador',
}

export default function AppPerfil() {
  const user = useAuth((s) => s.user)
  const logout = useAuth((s) => s.logout)
  const exportarDados = useAuth((s) => s.exportarDados)
  const excluirConta = useAuth((s) => s.excluirConta)
  const resetDemo = useTrilha((s) => s.resetDemo)
  const navigate = useNavigate()

  const [exportando, setExportando] = useState(false)
  const [erroExportar, setErroExportar] = useState<string | null>(null)

  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false)
  const [excluindo, setExcluindo] = useState(false)
  const [erroExcluir, setErroExcluir] = useState<string | null>(null)

  async function sair() {
    await logout()
    resetDemo()
    navigate('/')
  }

  async function exportar() {
    setErroExportar(null)
    setExportando(true)
    const result = await exportarDados()
    setExportando(false)
    if (!result.ok) setErroExportar(result.error ?? 'Não foi possível exportar seus dados.')
  }

  async function excluirContaConfirmado() {
    setErroExcluir(null)
    setExcluindo(true)
    const result = await excluirConta()
    setExcluindo(false)
    if (result.ok) {
      resetDemo()
      navigate('/')
    } else {
      setErroExcluir(result.error ?? 'Não foi possível excluir sua conta.')
    }
  }

  return (
    <div className="flex flex-col gap-lg">
      <header className="flex flex-col gap-1">
        <p className="u-eyebrow">Seu perfil</p>
        <h1 className="text-3xl sm:text-4xl">{user?.nome}</h1>
        <p className="text-ink-soft">
          {user ? PAPEL_LABEL[user.papel] : ''} · {user?.email}
        </p>
      </header>

      <section className="rounded-2xl border border-line bg-paper p-lg shadow-soft">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-5 text-indigo" aria-hidden />
          <h2 className="text-lg">Seus dados, sob seu controle</h2>
        </div>
        <p className="mt-1 text-ink-soft">
          A qualquer momento você pode levar seus dados com você ou apagar sua conta.
          É um direito seu (LGPD), sem letra miúda.
        </p>
        <div className="mt-md flex flex-wrap gap-2">
          <Button
            variant="secondary"
            iconLeft={<Download className="size-5" aria-hidden />}
            loading={exportando}
            onClick={exportar}
          >
            Exportar meus dados
          </Button>
          <Button
            variant="ghost"
            iconLeft={<Trash2 className="size-5" aria-hidden />}
            onClick={() => {
              setErroExcluir(null)
              setConfirmandoExclusao(true)
            }}
          >
            Excluir minha conta
          </Button>
        </div>
        {erroExportar && (
          <p role="alert" className="mt-3 text-sm font-semibold text-warn">
            {erroExportar}
          </p>
        )}
        <Link to="/seguranca" className="mt-md inline-block text-sm font-semibold text-indigo underline underline-offset-4">
          Como cuidamos dos seus dados
        </Link>

        {confirmandoExclusao && (
          <div className="mt-md rounded-xl border border-warn/40 bg-warn/5 p-md">
            <p className="font-semibold text-ink">Tem certeza que quer excluir sua conta?</p>
            <p className="mt-1 text-sm text-ink-soft">
              Isso apaga permanentemente seu perfil, sua trilha, prontuário, consultas, exames e conexões com
              médicos. Não é possível desfazer.
            </p>
            {erroExcluir && (
              <p role="alert" className="mt-3 text-sm font-semibold text-warn">
                {erroExcluir}
              </p>
            )}
            <div className="mt-md flex flex-wrap gap-2">
              <Button
                variant="secondary"
                iconLeft={<Trash2 className="size-5" aria-hidden />}
                loading={excluindo}
                onClick={excluirContaConfirmado}
              >
                Sim, excluir minha conta
              </Button>
              <Button variant="ghost" disabled={excluindo} onClick={() => setConfirmandoExclusao(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-line bg-paper p-lg shadow-soft">
        <h2 className="text-lg">Sessão</h2>
        <p className="mt-1 text-ink-soft">Sair encerra sua sessão com segurança neste aparelho.</p>
        <div className="mt-md">
          <Button variant="secondary" iconLeft={<LogOut className="size-5" aria-hidden />} onClick={sair}>
            Sair da conta
          </Button>
        </div>
      </section>
    </div>
  )
}
