import { useNavigate, Link } from 'react-router-dom'
import { LogOut, ShieldCheck, Download, Trash2 } from 'lucide-react'
import { useAuth } from '@/lib/stores/auth'
import { useTrilha } from '@/lib/stores/trilha'
import { Button } from '@/components/Button'
import { emitAuditEvent } from '@/lib/audit'

const PAPEL_LABEL: Record<string, string> = {
  gestante: 'Gestante',
  mae: 'Mãe ou pai',
  medico: 'Médico(a)',
}

export default function AppPerfil() {
  const user = useAuth((s) => s.user)
  const logout = useAuth((s) => s.logout)
  const resetDemo = useTrilha((s) => s.resetDemo)
  const navigate = useNavigate()

  async function sair() {
    await logout()
    resetDemo()
    navigate('/')
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
          <Button variant="secondary" iconLeft={<Download className="size-5" aria-hidden />} onClick={() => emitAuditEvent('privacy.data_export_requested')}>
            Exportar meus dados
          </Button>
          <Button variant="ghost" iconLeft={<Trash2 className="size-5" aria-hidden />} onClick={() => emitAuditEvent('privacy.account_deletion_requested')}>
            Excluir minha conta
          </Button>
        </div>
        <Link to="/seguranca" className="mt-md inline-block text-sm font-semibold text-indigo underline underline-offset-4">
          Como cuidamos dos seus dados
        </Link>
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
