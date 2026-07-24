import { useEffect, useMemo, useState } from 'react'
import { Heart, MessageCircle, Send, Users, Sparkles, Check, X, RotateCcw, BookOpen } from 'lucide-react'
import { api } from '@/lib/api/client'
import { Button } from '@/components/Button'
import { BotaoExcluir } from '@/components/BotaoExcluir'
import { EmptyState } from '@/components/EmptyState'
import { Skeleton } from '@/components/Skeleton'
import { QUIZZES } from '@/features/aprender/quizzes'
import type { Quiz } from '@/features/aprender/quizzes'
import { CARDS_AMAMENTACAO, NOTA_AMAMENTACAO } from '@/features/aprender/amamentacao'
import { cn } from '@/lib/cn'

interface Comentario {
  id: string
  autorNome: string
  texto: string
  criadaEm: string
}
interface Post {
  id: string
  autorNome: string
  anonimo: boolean
  ehMeu: boolean
  categoria: string
  texto: string
  curtidas: number
  curtiu: boolean
  criadaEm: string
  comentarios: Comentario[]
}

const CATEGORIAS: { value: string; label: string }[] = [
  { value: 'maternidade', label: 'Maternidade' },
  { value: 'gestacao', label: 'Gestação' },
  { value: 'amamentacao', label: 'Amamentação' },
  { value: 'desabafo', label: 'Desabafo' },
  { value: 'dica', label: 'Dica' },
]
const CAT_LABEL = Object.fromEntries(CATEGORIAS.map((c) => [c.value, c.label]))

export default function AppComunidade() {
  const [aba, setAba] = useState<'conversas' | 'aprender'>('conversas')

  return (
    <div className="flex flex-col gap-lg">
      <header className="flex flex-col gap-1">
        <p className="u-eyebrow">Comunidade</p>
        <h1 className="text-3xl sm:text-4xl">Você não está sozinha</h1>
        <p className="text-ink-soft">Troque com outras mães e gestantes — e aprenda desmistificando mitos.</p>
      </header>

      <div className="flex gap-1 rounded-pill bg-paper-2 p-1" role="tablist">
        <TabBtn ativo={aba === 'conversas'} onClick={() => setAba('conversas')} icon={Users}>
          Conversas
        </TabBtn>
        <TabBtn ativo={aba === 'aprender'} onClick={() => setAba('aprender')} icon={BookOpen}>
          Aprender
        </TabBtn>
      </div>

      {aba === 'conversas' ? <Conversas /> : <Aprender />}
    </div>
  )
}

function TabBtn({ ativo, onClick, icon: Icon, children }: { ativo: boolean; onClick: () => void; icon: typeof Users; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={ativo}
      onClick={onClick}
      className={cn(
        'inline-flex flex-1 items-center justify-center gap-2 rounded-pill px-4 py-2 text-sm font-display font-semibold transition-colors',
        ativo ? 'bg-paper text-indigo shadow-soft' : 'text-ink-soft hover:text-indigo',
      )}
    >
      <Icon className="size-4" aria-hidden />
      {children}
    </button>
  )
}

/* ------------------------------- Conversas ------------------------------- */

function Conversas() {
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    api
      .get<{ posts: Post[] }>('/comunidade')
      .then((d) => active && setPosts(d.posts))
      .catch(() => {})
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [])

  const atualizar = (p: Post) => setPosts((prev) => prev.map((x) => (x.id === p.id ? p : x)))

  return (
    <div className="flex flex-col gap-md">
      <NovoPost onCreated={(p) => setPosts((prev) => [p, ...prev])} />
      {loading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
      ) : posts.length === 0 ? (
        <EmptyState
          titulo="Seja a primeira a compartilhar"
          descricao="Um desabafo, uma dúvida, uma vitória do dia — aqui é um espaço acolhedor."
          icon={<Users className="size-7" aria-hidden />}
        />
      ) : (
        posts.map((p) => (
          <PostCard key={p.id} post={p} onChange={atualizar} onRemove={(id) => setPosts((prev) => prev.filter((x) => x.id !== id))} />
        ))
      )}
    </div>
  )
}

function NovoPost({ onCreated }: { onCreated: (p: Post) => void }) {
  const [texto, setTexto] = useState('')
  const [categoria, setCategoria] = useState('maternidade')
  const [anonimo, setAnonimo] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function publicar() {
    setErro(null)
    if (texto.trim().length < 2) {
      setErro('Escreva algo para compartilhar.')
      return
    }
    setEnviando(true)
    try {
      const { post } = await api.post<{ post: Post }>('/comunidade', { texto, categoria, anonimo })
      onCreated(post)
      setTexto('')
      setAnonimo(false)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui publicar.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="rounded-2xl border border-line bg-paper p-lg shadow-soft">
      <textarea
        value={texto}
        onChange={(e) => {
          setTexto(e.target.value)
          if (erro) setErro(null)
        }}
        placeholder="Compartilhe o que está no coração…"
        className="input min-h-20 resize-y"
        maxLength={1000}
      />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className="input h-9 w-auto py-0">
          {CATEGORIAS.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
        <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-ink-soft">
          <input type="checkbox" checked={anonimo} onChange={(e) => setAnonimo(e.target.checked)} className="size-4 accent-[var(--color-lilas)]" />
          Postar como anônima
        </label>
        <Button size="md" className="ml-auto" loading={enviando} iconLeft={<Send className="size-4" aria-hidden />} onClick={publicar}>
          Publicar
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

function PostCard({ post, onChange, onRemove }: { post: Post; onChange: (p: Post) => void; onRemove: (id: string) => void }) {
  const [comentando, setComentando] = useState(false)
  const [comentario, setComentario] = useState('')
  const data = useMemo(() => new Date(post.criadaEm).toLocaleDateString('pt-BR'), [post.criadaEm])

  async function curtir() {
    try {
      const { post: novo } = await api.post<{ post: Post }>(`/comunidade/${post.id}/curtir`)
      onChange(novo)
    } catch {
      /* ignore */
    }
  }
  async function enviarComentario() {
    if (comentario.trim().length < 1) return
    try {
      const { post: novo } = await api.post<{ post: Post }>(`/comunidade/${post.id}/comentar`, { texto: comentario })
      onChange(novo)
      setComentario('')
    } catch {
      /* ignore */
    }
  }
  async function remover() {
    try {
      await api.del(`/comunidade/${post.id}`)
      onRemove(post.id)
    } catch {
      /* ignore */
    }
  }

  return (
    <article className="rounded-2xl border border-line bg-paper p-lg shadow-soft">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="grid size-9 place-items-center rounded-full [background-image:var(--grad-brand-soft)] text-sm font-bold text-indigo">
            {post.autorNome.charAt(0).toUpperCase()}
          </span>
          <div>
            <p className="text-sm font-semibold text-ink">{post.autorNome}</p>
            <p className="text-xs text-ink-mute">{CAT_LABEL[post.categoria] ?? post.categoria} · {data}</p>
          </div>
        </div>
        {post.ehMeu && <BotaoExcluir onConfirm={remover} titulo="Remover post" />}
      </div>

      <p className="mt-3 whitespace-pre-wrap text-ink">{post.texto}</p>

      <div className="mt-3 flex items-center gap-4">
        <button type="button" onClick={curtir} className={cn('inline-flex items-center gap-1.5 text-sm font-semibold', post.curtiu ? 'text-[var(--color-lilas)]' : 'text-ink-soft hover:text-indigo')}>
          <Heart className={cn('size-4', post.curtiu && 'fill-[var(--color-lilas)]')} aria-hidden />
          {post.curtidas > 0 ? post.curtidas : ''} <span className="sr-only">curtir</span>
        </button>
        <button type="button" onClick={() => setComentando((v) => !v)} className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-soft hover:text-indigo">
          <MessageCircle className="size-4" aria-hidden />
          {post.comentarios.length > 0 ? post.comentarios.length : 'Comentar'}
        </button>
      </div>

      {(comentando || post.comentarios.length > 0) && (
        <div className="mt-md flex flex-col gap-2 border-t border-line pt-md">
          {post.comentarios.map((c) => (
            <div key={c.id} className="rounded-xl bg-paper-2 px-3 py-2">
              <p className="text-sm text-ink">{c.texto}</p>
              <p className="text-xs text-ink-mute">{c.autorNome}</p>
            </div>
          ))}
          {comentando && (
            <div className="flex gap-2">
              <input
                value={comentario}
                onChange={(e) => setComentario(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && enviarComentario()}
                placeholder="Escreva um comentário gentil…"
                className="input"
                maxLength={500}
              />
              <Button size="md" iconLeft={<Send className="size-4" aria-hidden />} onClick={enviarComentario}>
                Enviar
              </Button>
            </div>
          )}
        </div>
      )}
    </article>
  )
}

/* -------------------------------- Aprender -------------------------------- */

function Aprender() {
  const [quiz, setQuiz] = useState<Quiz | null>(null)

  return (
    <div className="flex flex-col gap-lg">
      {quiz ? (
        <QuizRunner quiz={quiz} onSair={() => setQuiz(null)} />
      ) : (
        <section>
          <h2 className="mb-2 inline-flex items-center gap-2 text-lg">
            <Sparkles className="size-5 text-indigo" aria-hidden /> Mito ou verdade?
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {QUIZZES.map((q) => (
              <button
                key={q.id}
                type="button"
                onClick={() => setQuiz(q)}
                className="flex flex-col items-start gap-1 rounded-2xl border-2 border-transparent bg-paper p-lg text-left shadow-soft transition-[transform,border-color] duration-[var(--dur-fast)] hover:-translate-y-0.5 hover:border-[var(--color-lilas-soft)]"
              >
                <span className="font-display text-lg font-semibold text-ink">{q.titulo}</span>
                <span className="text-sm text-ink-soft">{q.descricao}</span>
                <span className="mt-1 text-xs font-semibold text-indigo">{q.itens.length} perguntas →</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-2 inline-flex items-center gap-2 text-lg">
          <BookOpen className="size-5 text-indigo" aria-hidden /> Sobre amamentação
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {CARDS_AMAMENTACAO.map((card) => (
            <div key={card.titulo} className="flex flex-col gap-2 rounded-2xl border border-line bg-paper p-lg shadow-soft">
              <h3 className="font-display text-base font-semibold text-ink">{card.titulo}</h3>
              <p className="text-sm text-ink-soft">{card.texto}</p>
              <p className="mt-auto text-xs text-ink-mute">Fonte: {card.fonte}</p>
            </div>
          ))}
        </div>
        <p className="mt-md rounded-xl bg-paper-2 p-md text-xs text-ink-mute">{NOTA_AMAMENTACAO}</p>
      </section>
    </div>
  )
}

function QuizRunner({ quiz, onSair }: { quiz: Quiz; onSair: () => void }) {
  const [idx, setIdx] = useState(0)
  const [acertos, setAcertos] = useState(0)
  const [resposta, setResposta] = useState<boolean | null>(null)
  const item = quiz.itens[idx]
  const fim = idx >= quiz.itens.length

  function responder(escolha: boolean) {
    if (resposta !== null) return
    setResposta(escolha)
    if (escolha === item.verdade) setAcertos((a) => a + 1)
  }
  function proxima() {
    setResposta(null)
    setIdx((i) => i + 1)
  }
  function reiniciar() {
    setIdx(0)
    setAcertos(0)
    setResposta(null)
  }

  if (fim) {
    return (
      <div className="rounded-2xl border border-line bg-paper p-xl text-center shadow-soft">
        <p className="font-display text-2xl font-bold text-indigo">
          Você acertou {acertos} de {quiz.itens.length} 🎉
        </p>
        <p className="mt-1 text-ink-soft">Cada mito desmistificado é mais tranquilidade para você.</p>
        <div className="mt-lg flex justify-center gap-2">
          <Button iconLeft={<RotateCcw className="size-4" aria-hidden />} onClick={reiniciar}>
            Jogar de novo
          </Button>
          <Button variant="ghost" onClick={onSair}>
            Voltar
          </Button>
        </div>
      </div>
    )
  }

  const acertou = resposta === item.verdade

  return (
    <div className="rounded-2xl border border-line bg-paper p-lg shadow-lift">
      <div className="mb-md flex items-center justify-between gap-2">
        <span className="font-display text-sm font-semibold text-ink-mute">
          {idx + 1} / {quiz.itens.length}
        </span>
        <button type="button" onClick={onSair} className="text-sm font-semibold text-ink-mute hover:text-ink">
          Sair
        </button>
      </div>

      <p className="text-xl font-display font-semibold text-ink">“{item.afirmacao}”</p>

      {resposta === null ? (
        <div className="mt-lg grid grid-cols-2 gap-2">
          <button type="button" onClick={() => responder(true)} className="rounded-xl [background-image:var(--grad-brand)] py-4 font-display font-bold text-white">
            É verdade
          </button>
          <button type="button" onClick={() => responder(false)} className="rounded-xl border-2 border-line bg-paper py-4 font-display font-bold text-indigo">
            É mito
          </button>
        </div>
      ) : (
        <div className="mt-lg">
          <div className={cn('flex items-center gap-2 rounded-xl p-3 font-semibold', acertou ? 'bg-[oklch(0.94_0.08_155)] text-success' : 'bg-[oklch(0.95_0.06_65)] text-warn')}>
            {acertou ? <Check className="size-5" aria-hidden /> : <X className="size-5" aria-hidden />}
            {acertou ? 'Isso mesmo!' : 'Quase!'} É {item.verdade ? 'verdade' : 'mito'}.
          </div>
          <p className="mt-3 text-ink-soft">{item.explicacao}</p>
          <p className="mt-2 text-xs text-ink-mute">Fonte: {item.fonte}</p>
          <div className="mt-lg">
            <Button fullWidth onClick={proxima}>
              {idx + 1 < quiz.itens.length ? 'Próxima' : 'Ver resultado'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
