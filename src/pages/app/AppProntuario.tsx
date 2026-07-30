import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { Activity, Baby, Save } from 'lucide-react'
import { api } from '@/lib/api/client'
import { useAuth } from '@/lib/stores/auth'
import { useMedicoContext, criancaQuery } from '@/lib/stores/medico-context'
import { SeletorPaciente } from '@/features/painel/SeletorPaciente'

const BaixarProntuario = lazy(() =>
  import('@/features/pdf/documents').then((m) => ({ default: m.BaixarProntuario })),
)
import { MARCOS, REFERENCIA_MARCOS, NOTA_MARCOS } from '@/features/clinico/sus-marcos'
import { Button } from '@/components/Button'
import { Skeleton } from '@/components/Skeleton'
import { ResumoNascimento } from '@/features/clinico/ResumoNascimento'
import type { ResumoNascimento as ResumoNascimentoDados } from '@/features/clinico/ResumoNascimento'
import { LinhaDoTempo } from '@/features/prontuario/LinhaDoTempo'
import { Transferencias } from '@/features/prontuario/Transferencias'
import type { Evolucao } from '@/features/prontuario/LinhaDoTempo'
import { cn } from '@/lib/cn'

interface Evento {
  id: string
  data: string
  autorId: string
  autorNome: string
  autorPapel: string
  texto: string
}

interface Prontuario {
  tipoSanguineo: string
  alergias: string
  resumoGestacional: string
  condicoes: string[]
  /** Legado: congelado, lido só por telas antigas. A história vive em `Evolucao`. */
  eventos: Evento[]
  resumoNascimento: ResumoNascimentoDados | null
}

export default function AppProntuario() {
  const papel = useAuth((s) => s.user?.papel)
  const nome = useAuth((s) => s.user?.nome)
  const criancaAtiva = useMedicoContext((s) => s.criancaAtiva)
  const podeEditar = papel === 'medico'
  const [prontuario, setProntuario] = useState<Prontuario | null>(null)
  const [evolucoes, setEvolucoes] = useState<Evolucao[]>([])
  const [loading, setLoading] = useState(true)

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const d = await api.get<{ prontuario: Prontuario; evolucoes: Evolucao[] }>(
        `/prontuario${criancaQuery(criancaAtiva)}`,
      )
      setProntuario(d.prontuario)
      setEvolucoes(d.evolucoes ?? [])
    } catch {
      /* the page keeps whatever it already had */
    } finally {
      setLoading(false)
    }
  }, [criancaAtiva])

  useEffect(() => {
    void carregar()
  }, [carregar])

  return (
    <div className="flex flex-col gap-lg">
      <header className="flex flex-col gap-1">
        <p className="u-eyebrow">Prontuário</p>
        <h1 className="text-3xl sm:text-4xl">O histórico contínuo, num só lugar</h1>
        <p className="text-ink-soft">
          Da gestação à pediatria, sem se perder. {podeEditar ? 'Você pode editar o resumo e registrar anotações.' : 'Você pode acompanhar e adicionar anotações.'}
        </p>
      </header>

      <SeletorPaciente />

      {loading || !prontuario ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-40" />
          <Skeleton className="h-32" />
        </div>
      ) : (
        <>
          <ResumoClinico prontuario={prontuario} podeEditar={podeEditar} onSaved={setProntuario} />
          {podeEditar && (
            <ResumoNascimento resumo={prontuario.resumoNascimento} onSalvo={() => void carregar()} />
          )}
          <LinhaDoTempo evolucoes={evolucoes} onMudou={setEvolucoes} />

          <Transferencias />
          <Marcos />
          <Suspense fallback={null}>
            <BaixarProntuario dados={{ nome, ...prontuario }} />
          </Suspense>
        </>
      )}
    </div>
  )
}

function ResumoClinico({
  prontuario,
  podeEditar,
  onSaved,
}: {
  prontuario: Prontuario
  podeEditar: boolean
  onSaved: (p: Prontuario) => void
}) {
  const criancaAtiva = useMedicoContext((s) => s.criancaAtiva)
  const [editing, setEditing] = useState(false)
  const [tipoSanguineo, setTipo] = useState(prontuario.tipoSanguineo)
  const [alergias, setAlergias] = useState(prontuario.alergias)
  const [resumo, setResumo] = useState(prontuario.resumoGestacional)
  const [condicoes, setCondicoes] = useState(prontuario.condicoes.join(', '))
  const [saving, setSaving] = useState(false)

  async function salvar() {
    setSaving(true)
    try {
      const { prontuario: novo } = await api.put<{ prontuario: Prontuario }>(`/prontuario${criancaQuery(criancaAtiva)}`, {
        tipoSanguineo,
        alergias,
        resumoGestacional: resumo,
        condicoes: condicoes
          .split(',')
          .map((c) => c.trim())
          .filter(Boolean),
      })
      onSaved(novo)
      setEditing(false)
    } catch {
      /* friendly failure — keep editing */
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="rounded-2xl border border-line bg-paper p-lg shadow-soft">
      <div className="flex items-center justify-between gap-2">
        <h2 className="inline-flex items-center gap-2 text-lg">
          <Activity className="size-5 text-indigo" aria-hidden />
          Resumo clínico
        </h2>
        {podeEditar && !editing && (
          <Button variant="ghost" size="md" onClick={() => setEditing(true)}>
            Editar
          </Button>
        )}
      </div>

      {editing ? (
        <div className="mt-md flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="font-display text-sm font-semibold text-ink">Tipo sanguíneo</span>
            <input value={tipoSanguineo} onChange={(e) => setTipo(e.target.value)} className="input" maxLength={8} placeholder="Ex.: O+" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="font-display text-sm font-semibold text-ink">Alergias</span>
            <input value={alergias} onChange={(e) => setAlergias(e.target.value)} className="input" maxLength={500} placeholder="Ex.: sem alergias registradas" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="font-display text-sm font-semibold text-ink">Resumo gestacional</span>
            <textarea
              value={resumo}
              onChange={(e) => setResumo(e.target.value)}
              className="input min-h-24 resize-y"
              maxLength={2000}
              placeholder="Intercorrências, condutas, o que importa carregar adiante…"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="font-display text-sm font-semibold text-ink">Condições em acompanhamento</span>
            <input
              value={condicoes}
              onChange={(e) => setCondicoes(e.target.value)}
              className="input"
              maxLength={400}
              placeholder="Separe por vírgula. Ex.: Diabetes gestacional, Refluxo"
            />
          </label>
          <div className="flex gap-2">
            <Button size="md" loading={saving} iconLeft={<Save className="size-4" aria-hidden />} onClick={salvar}>
              Salvar
            </Button>
            <Button variant="ghost" size="md" onClick={() => setEditing(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <dl className="mt-md grid gap-md sm:grid-cols-2">
          <Campo termo="Tipo sanguíneo" valor={prontuario.tipoSanguineo} />
          <Campo termo="Alergias" valor={prontuario.alergias} />
          <div className="sm:col-span-2">
            <Campo termo="Resumo gestacional" valor={prontuario.resumoGestacional} />
          </div>
          {prontuario.condicoes.length > 0 && (
            <div className="sm:col-span-2">
              <dt className="text-xs font-semibold text-ink-mute">Condições em acompanhamento</dt>
              <dd className="mt-1 flex flex-wrap gap-2">
                {prontuario.condicoes.map((c) => (
                  <span key={c} className="rounded-pill bg-paper-2 px-3 py-1 text-sm font-semibold text-ink">
                    {c}
                  </span>
                ))}
              </dd>
            </div>
          )}
        </dl>
      )}
    </section>
  )
}

function Campo({ termo, valor }: { termo: string; valor: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold text-ink-mute">{termo}</dt>
      <dd className="font-medium text-ink">{valor || <span className="text-ink-mute">— ainda não informado</span>}</dd>
    </div>
  )
}

function Marcos() {
  return (
    <section className="rounded-2xl border border-line bg-paper p-lg shadow-soft">
      <h2 className="inline-flex items-center gap-2 text-lg">
        <Baby className="size-5 text-indigo" aria-hidden />
        Marcos do desenvolvimento
      </h2>
      <p className="mt-1 text-sm text-ink-soft">{NOTA_MARCOS}</p>

      <div className="mt-md grid gap-md sm:grid-cols-2">
        {MARCOS.map((m) => (
          <div key={m.idadeMeses} className={cn('rounded-xl bg-paper-2 p-md')}>
            <p className="font-display text-sm font-semibold text-indigo">{m.faixa}</p>
            <ul className="mt-2 flex flex-col gap-1.5">
              {m.itens.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-ink-soft">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full [background-image:var(--grad-brand)]" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <p className="mt-md text-xs text-ink-mute">Fonte: {REFERENCIA_MARCOS}</p>
    </section>
  )
}
