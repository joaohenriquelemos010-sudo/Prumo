import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { NotebookPen, Plus, Pencil, Check, X, Share2, Download, Reply } from 'lucide-react'
import { BotaoExcluir } from '@/components/BotaoExcluir'
import { api } from '@/lib/api/client'
import { useAuth } from '@/lib/stores/auth'
import { Button } from '@/components/Button'
import { EmptyState } from '@/components/EmptyState'
import { Skeleton } from '@/components/Skeleton'
import { cn } from '@/lib/cn'

// The PDF library is heavy — load it in its own chunk, only when a patient
// actually reaches the download button.
const BaixarCaderninho = lazy(() =>
  import('@/features/pdf/documents').then((m) => ({ default: m.BaixarCaderninho })),
)

interface Duvida {
  id: string
  texto: string
  autorId: string
  autorNome: string
  compartilhada: boolean
  respondida: boolean
  respostaTexto: string
  respondidaPor: string
  respondidaEm: string | null
  criadaEm: string
}

function diaLabel(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })
}

export default function AppCaderninho() {
  const papel = useAuth((s) => s.user?.papel)
  const nome = useAuth((s) => s.user?.nome)
  const isMedico = papel === 'medico'
  const [duvidas, setDuvidas] = useState<Duvida[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    api
      .get<{ duvidas: Duvida[] }>('/caderninho')
      .then((d) => active && setDuvidas(d.duvidas))
      .catch(() => {})
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [])

  const grupos = useMemo(() => {
    const map = new Map<string, Duvida[]>()
    for (const d of duvidas) {
      const dia = diaLabel(d.criadaEm)
      const arr = map.get(dia) ?? []
      arr.push(d)
      map.set(dia, arr)
    }
    return [...map.entries()]
  }, [duvidas])

  return (
    <div className="flex flex-col gap-lg">
      <header className="flex flex-col gap-1">
        <p className="u-eyebrow">Caderninho de dúvidas</p>
        <h1 className="caderno-hand text-4xl text-indigo sm:text-5xl">
          {isMedico ? 'Dúvidas do seu paciente' : 'Suas dúvidas, no seu tempo'}
        </h1>
        <p className="text-ink-soft">
          {isMedico
            ? 'As perguntas que a família anotou e escolheu compartilhar. Responda com carinho.'
            : 'Anote o que surgir — de madrugada, na fila, no susto. Depois é só levar (ou compartilhar) com quem cuida de vocês.'}
        </p>
      </header>

      {!isMedico && <NovaDuvida onCreated={(d) => setDuvidas((prev) => [d, ...prev])} />}

      {loading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      ) : duvidas.length === 0 ? (
        <EmptyState
          titulo={isMedico ? 'Nenhuma dúvida compartilhada ainda' : 'Seu caderninho está esperando'}
          descricao={
            isMedico
              ? 'Quando a família compartilhar uma dúvida, ela aparece aqui pra você responder.'
              : 'Que tal começar anotando aquela pergunta que ficou martelando?'
          }
          icon={<NotebookPen className="size-7" aria-hidden />}
        />
      ) : (
        <div className="caderno flex flex-col gap-lg p-md sm:p-lg">
          {grupos.map(([dia, lista]) => (
            <section key={dia} className="flex flex-col gap-2">
              <h2 className="caderno-hand text-2xl text-indigo first-letter:uppercase">{dia}</h2>
              {lista.map((d) => (
                <DuvidaCard
                  key={d.id}
                  duvida={d}
                  isMedico={isMedico}
                  onChange={(nova) => setDuvidas((prev) => prev.map((x) => (x.id === nova.id ? nova : x)))}
                  onRemove={(id) => setDuvidas((prev) => prev.filter((x) => x.id !== id))}
                />
              ))}
            </section>
          ))}
        </div>
      )}

      {!isMedico && duvidas.length > 0 && (
        <Suspense
          fallback={
            <span className="inline-flex h-11 items-center gap-2 self-start rounded-pill border border-line bg-paper px-5 font-display text-sm font-semibold text-ink-mute shadow-soft">
              <Download className="size-4" aria-hidden />
              Preparando…
            </span>
          }
        >
          <BaixarCaderninho duvidas={duvidas} nome={nome} />
        </Suspense>
      )}
    </div>
  )
}

function NovaDuvida({ onCreated }: { onCreated: (d: Duvida) => void }) {
  const [texto, setTexto] = useState('')
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function adicionar() {
    setErro(null)
    if (texto.trim().length < 2) {
      setErro('Escreve sua dúvida aqui 🙂')
      return
    }
    setSaving(true)
    try {
      const { duvida } = await api.post<{ duvida: Duvida }>('/caderninho', { texto })
      onCreated(duvida)
      setTexto('')
    } catch {
      setErro('Não consegui salvar agora. Tenta de novo?')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-2xl border border-line bg-paper p-md shadow-soft">
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          value={texto}
          onChange={(e) => {
            setTexto(e.target.value)
            if (erro) setErro(null)
          }}
          onKeyDown={(e) => e.key === 'Enter' && adicionar()}
          placeholder="Ex.: posso dar água pro bebê nesse calor?"
          className="input"
          maxLength={1000}
          aria-label="Nova dúvida"
        />
        <Button size="md" loading={saving} iconLeft={<Plus className="size-4" aria-hidden />} onClick={adicionar}>
          Anotar dúvida
        </Button>
      </div>
      {erro && (
        <p role="alert" className="mt-2 text-sm font-semibold text-warn">
          {erro}
        </p>
      )}
    </div>
  )
}

interface CardProps {
  duvida: Duvida
  isMedico: boolean
  onChange: (d: Duvida) => void
  onRemove: (id: string) => void
}

function DuvidaCard({ duvida, isMedico, onChange, onRemove }: CardProps) {
  const userId = useAuth((s) => s.user?.id)
  const meu = Boolean(userId) && duvida.autorId === userId
  const [editando, setEditando] = useState(false)
  const [editTexto, setEditTexto] = useState(duvida.texto)
  const [respondendo, setRespondendo] = useState(false)
  const [resposta, setResposta] = useState('')

  async function salvarEdicao() {
    if (editTexto.trim().length < 2) return
    try {
      const { duvida: nova } = await api.put<{ duvida: Duvida }>(`/caderninho/${duvida.id}`, { texto: editTexto })
      onChange(nova)
      setEditando(false)
    } catch {
      /* keep editing */
    }
  }

  async function alternarCompartilhar() {
    try {
      const { duvida: nova } = await api.put<{ duvida: Duvida }>(`/caderninho/${duvida.id}`, {
        compartilhada: !duvida.compartilhada,
      })
      onChange(nova)
    } catch {
      /* ignore */
    }
  }

  async function remover() {
    try {
      await api.del(`/caderninho/${duvida.id}`)
      onRemove(duvida.id)
    } catch {
      /* ignore */
    }
  }

  async function enviarResposta() {
    if (resposta.trim().length < 2) return
    try {
      const { duvida: nova } = await api.post<{ duvida: Duvida }>(`/caderninho/${duvida.id}/resposta`, { texto: resposta })
      onChange(nova)
      setRespondendo(false)
      setResposta('')
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="group rounded-xl bg-[color-mix(in_oklab,var(--color-paper)_88%,transparent)] p-3 shadow-soft ring-1 ring-line">
      {editando ? (
        <div className="flex flex-col gap-2 sm:flex-row">
          <input value={editTexto} onChange={(e) => setEditTexto(e.target.value)} className="input" maxLength={1000} autoFocus />
          <div className="flex gap-1">
            <IconBtn label="Salvar" onClick={salvarEdicao} tone="success"><Check className="size-4" aria-hidden /></IconBtn>
            <IconBtn label="Cancelar" onClick={() => setEditando(false)}><X className="size-4" aria-hidden /></IconBtn>
          </div>
        </div>
      ) : (
        <div className="flex items-start justify-between gap-2">
          <p className="text-ink">{duvida.texto}</p>
          {meu && (
            <div className="flex shrink-0 gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
              <IconBtn
                label={duvida.compartilhada ? 'Deixar de compartilhar' : 'Compartilhar com o médico'}
                onClick={alternarCompartilhar}
                tone={duvida.compartilhada ? 'accent' : 'mute'}
              >
                <Share2 className="size-3.5" aria-hidden />
              </IconBtn>
              <IconBtn label="Editar" onClick={() => setEditando(true)}><Pencil className="size-3.5" aria-hidden /></IconBtn>
              <BotaoExcluir onConfirm={remover} titulo="Remover dúvida" />
            </div>
          )}
        </div>
      )}

      {meu && duvida.compartilhada && !editando && (
        <p className="mt-1 inline-flex items-center gap-1 text-xs text-indigo">
          <Share2 className="size-3" aria-hidden /> compartilhada com o médico
        </p>
      )}

      {/* Answer block */}
      {duvida.respondida ? (
        <div className="mt-2 rounded-lg bg-[color-mix(in_oklab,var(--color-azul-soft)_35%,var(--color-paper))] p-2.5">
          <p className="text-xs font-semibold text-indigo">Resposta{duvida.respondidaPor ? ` · ${duvida.respondidaPor}` : ''}</p>
          <p className="text-sm text-ink">{duvida.respostaTexto}</p>
        </div>
      ) : (
        isMedico && (
          <div className="mt-2">
            {respondendo ? (
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  value={resposta}
                  onChange={(e) => setResposta(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && enviarResposta()}
                  placeholder="Responder com calma…"
                  className="input"
                  maxLength={1000}
                  autoFocus
                />
                <div className="flex gap-1">
                  <IconBtn label="Enviar resposta" onClick={enviarResposta} tone="success"><Check className="size-4" aria-hidden /></IconBtn>
                  <IconBtn label="Cancelar" onClick={() => setRespondendo(false)}><X className="size-4" aria-hidden /></IconBtn>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setRespondendo(true)}
                className="inline-flex items-center gap-1 text-sm font-semibold text-indigo hover:text-azul"
              >
                <Reply className="size-4" aria-hidden /> Responder
              </button>
            )}
          </div>
        )
      )}
    </div>
  )
}

function IconBtn({
  label,
  onClick,
  tone = 'default',
  children,
}: {
  label: string
  onClick: () => void
  tone?: 'default' | 'success' | 'warn' | 'accent' | 'mute'
  children: React.ReactNode
}) {
  const tones: Record<string, string> = {
    default: 'text-ink-soft hover:text-indigo',
    success: 'text-success',
    warn: 'text-ink-soft hover:text-warn',
    accent: 'text-indigo',
    mute: 'text-ink-mute hover:text-indigo',
  }
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn('grid size-8 place-items-center rounded-lg hover:bg-paper-2', tones[tone])}
    >
      {children}
    </button>
  )
}
