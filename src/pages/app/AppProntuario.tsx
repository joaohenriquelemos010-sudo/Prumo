import { lazy, Suspense, useEffect, useState } from 'react'
import { Activity, FileHeart, Plus, Baby, Save, Pencil, X, Check } from 'lucide-react'
import { api } from '@/lib/api/client'
import { useAuth } from '@/lib/stores/auth'
import { useMedicoContext, criancaQuery } from '@/lib/stores/medico-context'
import { SeletorPaciente } from '@/features/painel/SeletorPaciente'

const BaixarProntuario = lazy(() =>
  import('@/features/pdf/documents').then((m) => ({ default: m.BaixarProntuario })),
)
import { MARCOS, REFERENCIA_MARCOS, NOTA_MARCOS } from '@/features/clinico/sus-marcos'
import { Button } from '@/components/Button'
import { BotaoExcluir } from '@/components/BotaoExcluir'
import { Skeleton } from '@/components/Skeleton'
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
  eventos: Evento[]
}

export default function AppProntuario() {
  const papel = useAuth((s) => s.user?.papel)
  const nome = useAuth((s) => s.user?.nome)
  const criancaAtiva = useMedicoContext((s) => s.criancaAtiva)
  const podeEditar = papel === 'medico'
  const [prontuario, setProntuario] = useState<Prontuario | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    setLoading(true)
    api
      .get<{ prontuario: Prontuario }>(`/prontuario${criancaQuery(criancaAtiva)}`)
      .then((d) => active && setProntuario(d.prontuario))
      .catch(() => {})
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [criancaAtiva])

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
          <Eventos prontuario={prontuario} onChange={setProntuario} />
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
  const [saving, setSaving] = useState(false)

  async function salvar() {
    setSaving(true)
    try {
      const { prontuario: novo } = await api.put<{ prontuario: Prontuario }>(`/prontuario${criancaQuery(criancaAtiva)}`, {
        tipoSanguineo,
        alergias,
        resumoGestacional: resumo,
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

function Eventos({ prontuario, onChange }: { prontuario: Prontuario; onChange: (p: Prontuario) => void }) {
  const userId = useAuth((s) => s.user?.id)
  const criancaAtiva = useMedicoContext((s) => s.criancaAtiva)
  const [texto, setTexto] = useState('')
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const [editTexto, setEditTexto] = useState('')

  async function adicionar() {
    setErro(null)
    if (texto.trim().length < 2) {
      setErro('Escreva a anotação.')
      return
    }
    setSaving(true)
    try {
      const { prontuario: novo } = await api.post<{ prontuario: Prontuario }>(`/prontuario/evento${criancaQuery(criancaAtiva)}`, { texto })
      onChange(novo)
      setTexto('')
    } catch {
      setErro('Não consegui salvar a anotação. Tenta de novo?')
    } finally {
      setSaving(false)
    }
  }

  async function salvarEdicao(id: string) {
    if (editTexto.trim().length < 2) return
    try {
      const { prontuario: novo } = await api.put<{ prontuario: Prontuario }>(`/prontuario/evento/${id}${criancaQuery(criancaAtiva)}`, {
        texto: editTexto,
      })
      onChange(novo)
      setEditId(null)
    } catch {
      /* keep editing on failure */
    }
  }

  async function remover(id: string) {
    try {
      const { prontuario: novo } = await api.del<{ prontuario: Prontuario }>(`/prontuario/evento/${id}${criancaQuery(criancaAtiva)}`)
      onChange(novo)
    } catch {
      /* ignore — the item stays */
    }
  }

  return (
    <section className="rounded-2xl border border-line bg-paper p-lg shadow-soft">
      <h2 className="inline-flex items-center gap-2 text-lg">
        <FileHeart className="size-5 text-indigo" aria-hidden />
        Linha do tempo
      </h2>

      <div className="mt-md flex flex-col gap-2 sm:flex-row">
        <input
          value={texto}
          onChange={(e) => {
            setTexto(e.target.value)
            if (erro) setErro(null)
          }}
          onKeyDown={(e) => e.key === 'Enter' && adicionar()}
          placeholder="Adicionar uma anotação…"
          className="input"
          maxLength={2000}
        />
        <Button size="md" loading={saving} iconLeft={<Plus className="size-4" aria-hidden />} onClick={adicionar}>
          Anotar
        </Button>
      </div>
      {erro && (
        <p role="alert" className="mt-2 text-sm font-semibold text-warn">
          {erro}
        </p>
      )}

      {prontuario.eventos.length === 0 ? (
        <p className="mt-md text-sm text-ink-mute">Ainda não há anotações. A primeira pode ser agora.</p>
      ) : (
        <ol className="mt-md flex flex-col gap-3 border-l-2 border-line pl-4">
          {prontuario.eventos.map((ev) => {
            const meu = Boolean(userId) && ev.autorId === userId
            const editando = editId === ev.id
            return (
              <li key={ev.id} className="group relative">
                <span className="absolute -left-[1.35rem] top-1.5 size-2.5 rounded-full [background-image:var(--grad-brand)]" aria-hidden />
                {editando ? (
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                      value={editTexto}
                      onChange={(e) => setEditTexto(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && salvarEdicao(ev.id)}
                      className="input"
                      maxLength={2000}
                      autoFocus
                    />
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => salvarEdicao(ev.id)}
                        aria-label="Salvar edição"
                        className="grid size-9 place-items-center rounded-lg text-success hover:bg-paper-2"
                      >
                        <Check className="size-4" aria-hidden />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditId(null)}
                        aria-label="Cancelar edição"
                        className="grid size-9 place-items-center rounded-lg text-ink-mute hover:bg-paper-2"
                      >
                        <X className="size-4" aria-hidden />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm text-ink">{ev.texto}</p>
                      <p className="text-xs text-ink-mute">
                        {new Date(ev.data).toLocaleDateString('pt-BR')}
                        {ev.autorNome && ` · ${ev.autorNome}`}
                      </p>
                    </div>
                    {meu && (
                      <div className="flex shrink-0 gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                        <button
                          type="button"
                          onClick={() => {
                            setEditId(ev.id)
                            setEditTexto(ev.texto)
                          }}
                          aria-label="Editar anotação"
                          className="grid size-8 place-items-center rounded-lg text-ink-soft hover:bg-paper-2 hover:text-indigo"
                        >
                          <Pencil className="size-3.5" aria-hidden />
                        </button>
                        <BotaoExcluir onConfirm={() => remover(ev.id)} titulo="Remover anotação" />
                      </div>
                    )}
                  </div>
                )}
              </li>
            )
          })}
        </ol>
      )}
    </section>
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
