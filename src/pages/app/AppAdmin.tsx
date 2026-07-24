import { useEffect, useState } from 'react'
import { ShieldCheck, Users, BarChart3, Stethoscope, Check, X, Clock } from 'lucide-react'
import { api } from '@/lib/api/client'
import { Button } from '@/components/Button'
import { BotaoExcluir } from '@/components/BotaoExcluir'
import { Skeleton } from '@/components/Skeleton'
import { cn } from '@/lib/cn'

type Aba = 'medicos' | 'usuarios' | 'metricas'

const PAPEL_LABEL: Record<string, string> = {
  gestante: 'Gestante',
  mae: 'Mãe',
  pai: 'Pai',
  medico: 'Médico(a)',
  admin: 'Admin',
}

export default function AppAdmin() {
  const [aba, setAba] = useState<Aba>('medicos')

  return (
    <div className="flex flex-col gap-lg">
      <header className="flex flex-col gap-1">
        <p className="u-eyebrow inline-flex items-center gap-2">
          <ShieldCheck className="size-4" aria-hidden /> Administração
        </p>
        <h1 className="text-3xl sm:text-4xl">Painel do administrador</h1>
        <p className="text-ink-soft">Verifique médicos, acompanhe as contas e veja os números da plataforma.</p>
      </header>

      <div className="flex flex-wrap gap-2">
        <TabButton ativo={aba === 'medicos'} onClick={() => setAba('medicos')} icon={Stethoscope}>
          Médicos
        </TabButton>
        <TabButton ativo={aba === 'usuarios'} onClick={() => setAba('usuarios')} icon={Users}>
          Usuários
        </TabButton>
        <TabButton ativo={aba === 'metricas'} onClick={() => setAba('metricas')} icon={BarChart3}>
          Métricas
        </TabButton>
      </div>

      {aba === 'medicos' && <Medicos />}
      {aba === 'usuarios' && <Usuarios />}
      {aba === 'metricas' && <Metricas />}
    </div>
  )
}

function TabButton({
  ativo,
  onClick,
  icon: Icon,
  children,
}: {
  ativo: boolean
  onClick: () => void
  icon: typeof Users
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-2 rounded-pill px-4 py-2 text-sm font-semibold transition-colors',
        ativo ? 'bg-indigo text-white shadow-soft' : 'bg-paper-2 text-ink-soft hover:text-indigo',
      )}
    >
      <Icon className="size-4" aria-hidden />
      {children}
    </button>
  )
}

interface Medico {
  id: string
  nome: string
  email: string
  crm: string
  crmUf: string
  especialidade: string
  verificacaoStatus: 'nao_aplicavel' | 'pendente' | 'verificado' | 'recusado'
}

function StatusBadge({ status }: { status: Medico['verificacaoStatus'] }) {
  const map: Record<Medico['verificacaoStatus'], { label: string; cls: string }> = {
    verificado: { label: 'Verificado', cls: 'bg-[oklch(0.95_0.05_150)] text-success' },
    pendente: { label: 'Pendente', cls: 'bg-[oklch(0.96_0.04_65)] text-warn' },
    recusado: { label: 'Recusado', cls: 'bg-paper-3 text-ink-soft' },
    nao_aplicavel: { label: '—', cls: 'bg-paper-2 text-ink-mute' },
  }
  const { label, cls } = map[status]
  return <span className={cn('rounded-pill px-2.5 py-1 text-xs font-semibold', cls)}>{label}</span>
}

function Medicos() {
  const [medicos, setMedicos] = useState<Medico[] | null>(null)
  const [salvando, setSalvando] = useState<string | null>(null)

  useEffect(() => {
    api.get<{ medicos: Medico[] }>('/admin/medicos').then((d) => setMedicos(d.medicos)).catch(() => setMedicos([]))
  }, [])

  async function verificar(id: string, status: 'verificado' | 'recusado') {
    setSalvando(id)
    try {
      await api.post(`/admin/medicos/${id}/verificar`, { status })
      setMedicos((prev) => prev?.map((m) => (m.id === id ? { ...m, verificacaoStatus: status } : m)) ?? null)
    } catch {
      /* ignore */
    } finally {
      setSalvando(null)
    }
  }

  if (!medicos) return <Skeleton className="h-40" />
  if (medicos.length === 0)
    return <p className="rounded-2xl border border-line bg-paper p-lg text-sm text-ink-mute shadow-soft">Nenhum médico cadastrado ainda.</p>

  return (
    <ul className="flex flex-col gap-2">
      {medicos.map((m) => (
        <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-paper p-lg shadow-soft">
          <div className="min-w-0">
            <p className="inline-flex items-center gap-2 font-display font-semibold text-ink">
              {m.nome} <StatusBadge status={m.verificacaoStatus} />
            </p>
            <p className="text-sm text-ink-soft">{m.email}</p>
            <p className="text-sm text-ink-mute">
              {m.especialidade || 'Especialidade não informada'}
              {m.crm && ` · CRM ${m.crm}${m.crmUf ? `/${m.crmUf}` : ''}`}
            </p>
          </div>
          <div className="flex gap-2">
            {m.verificacaoStatus !== 'verificado' && (
              <Button size="md" loading={salvando === m.id} iconLeft={<Check className="size-4" aria-hidden />} onClick={() => verificar(m.id, 'verificado')}>
                Verificar
              </Button>
            )}
            {m.verificacaoStatus !== 'recusado' && (
              <Button size="md" variant="ghost" iconLeft={<X className="size-4" aria-hidden />} onClick={() => verificar(m.id, 'recusado')}>
                Recusar
              </Button>
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}

interface Usuario {
  id: string
  nome: string
  email: string
  papel: string
  criadoEm: string
}

function Usuarios() {
  const [usuarios, setUsuarios] = useState<Usuario[] | null>(null)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const limit = 20

  async function carregar(p: number) {
    try {
      const d = await api.get<{ usuarios: Usuario[]; total: number }>(`/admin/usuarios?page=${p}&limit=${limit}`)
      setUsuarios(d.usuarios)
      setTotal(d.total)
      setPage(p)
    } catch {
      setUsuarios([])
    }
  }

  useEffect(() => {
    carregar(1)
  }, [])

  async function excluir(id: string) {
    try {
      await api.del(`/admin/usuarios/${id}`)
      setUsuarios((prev) => prev?.filter((u) => u.id !== id) ?? null)
      setTotal((t) => Math.max(0, t - 1))
    } catch {
      /* ignore */
    }
  }

  if (!usuarios) return <Skeleton className="h-40" />

  const totalPaginas = Math.max(1, Math.ceil(total / limit))

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-ink-mute">{total} contas no total</p>
      <ul className="flex flex-col gap-2">
        {usuarios.map((u) => (
          <li key={u.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-paper p-md shadow-soft">
            <div className="min-w-0">
              <p className="inline-flex items-center gap-2 font-semibold text-ink">
                {u.nome}
                <span className="rounded-pill bg-paper-2 px-2 py-0.5 text-xs font-semibold text-ink-soft">{PAPEL_LABEL[u.papel] ?? u.papel}</span>
              </p>
              <p className="text-sm text-ink-soft">{u.email}</p>
            </div>
            {u.papel !== 'admin' && <BotaoExcluir onConfirm={() => excluir(u.id)} titulo="Excluir conta" />}
          </li>
        ))}
      </ul>
      {totalPaginas > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button size="md" variant="ghost" disabled={page <= 1} onClick={() => carregar(page - 1)}>
            Anterior
          </Button>
          <span className="text-sm text-ink-mute">
            {page} / {totalPaginas}
          </span>
          <Button size="md" variant="ghost" disabled={page >= totalPaginas} onClick={() => carregar(page + 1)}>
            Próxima
          </Button>
        </div>
      )}
    </div>
  )
}

interface Metricas {
  totalUsuarios: number
  usuariosPorPapel: Record<string, number>
  medicosPendentes: number
  vinculosAtivos: number
  exames: number
  solicitacoes: number
  criancas: number
}

function Metricas() {
  const [m, setM] = useState<Metricas | null>(null)

  useEffect(() => {
    api.get<Metricas>('/admin/metricas').then(setM).catch(() => {})
  }, [])

  if (!m) return <Skeleton className="h-40" />

  const cards = [
    { label: 'Contas', valor: m.totalUsuarios },
    { label: 'Gestantes', valor: m.usuariosPorPapel.gestante ?? 0 },
    { label: 'Mães', valor: m.usuariosPorPapel.mae ?? 0 },
    { label: 'Pais', valor: m.usuariosPorPapel.pai ?? 0 },
    { label: 'Médicos', valor: m.usuariosPorPapel.medico ?? 0 },
    { label: 'Médicos pendentes', valor: m.medicosPendentes, alerta: m.medicosPendentes > 0 },
    { label: 'Vínculos ativos', valor: m.vinculosAtivos },
    { label: 'Jornadas', valor: m.criancas },
    { label: 'Exames', valor: m.exames },
    { label: 'Solicitações', valor: m.solicitacoes },
  ]

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((c) => (
        <div key={c.label} className="rounded-2xl border border-line bg-paper p-lg shadow-soft">
          <p className="text-sm font-semibold text-ink-mute">{c.label}</p>
          <p className={cn('mt-1 font-display text-3xl font-bold', c.alerta ? 'text-warn' : 'text-ink')}>{c.valor}</p>
          {c.alerta && (
            <p className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-warn">
              <Clock className="size-3" aria-hidden /> aguardando verificação
            </p>
          )}
        </div>
      ))}
    </div>
  )
}
