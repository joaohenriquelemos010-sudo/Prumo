import { useEffect, useMemo, useRef, useState } from 'react'
import { FileText, Upload, Paperclip, FlaskConical, ExternalLink } from 'lucide-react'
import { api } from '@/lib/api/client'
import { useAuth } from '@/lib/stores/auth'
import { useMedicoContext, criancaQuery } from '@/lib/stores/medico-context'
import { SeletorPaciente } from '@/features/painel/SeletorPaciente'
import { Button } from '@/components/Button'
import { BotaoExcluir } from '@/components/BotaoExcluir'
import { EmptyState } from '@/components/EmptyState'
import { Skeleton } from '@/components/Skeleton'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '/api'

interface Exame {
  id: string
  autorId: string
  autorNome: string
  nome: string
  categoria: string
  dataExame: string
  observacoes: string
  temArquivo: boolean
  arquivoNome: string
  mimeType: string
  tamanho: number
}

const CATEGORIAS: { value: string; label: string }[] = [
  { value: 'sangue', label: 'Sangue' },
  { value: 'imagem', label: 'Imagem' },
  { value: 'ultrassom', label: 'Ultrassom' },
  { value: 'urina', label: 'Urina' },
  { value: 'triagem', label: 'Triagem' },
  { value: 'outro', label: 'Outro' },
]

const CAT_LABEL = Object.fromEntries(CATEGORIAS.map((c) => [c.value, c.label]))

export default function AppExames() {
  const papel = useAuth((s) => s.user?.papel)
  const isMedico = papel === 'medico'
  const criancaAtiva = useMedicoContext((s) => s.criancaAtiva)
  const [exames, setExames] = useState<Exame[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    setLoading(true)
    api
      .get<{ exames: Exame[] }>(`/exames${criancaQuery(criancaAtiva)}`)
      .then((d) => active && setExames(d.exames))
      .catch(() => {})
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [criancaAtiva])

  return (
    <div className="flex flex-col gap-lg">
      <header className="flex flex-col gap-1">
        <p className="u-eyebrow">Exames</p>
        <h1 className="text-3xl sm:text-4xl">
          {isMedico ? 'Exames do paciente' : 'Seus exames, sempre à mão'}
        </h1>
        <p className="text-ink-soft">
          {isMedico
            ? 'Todo o histórico de exames, reunido pela Prumo — sem precisar pedir cópia a cada consulta.'
            : 'Guarde aqui cada exame. Quando você for a uma consulta, o médico vê tudo pela Prumo — nada se perde.'}
        </p>
      </header>

      <SeletorPaciente />

      <NovoExame onCreated={(e) => setExames((prev) => [e, ...prev])} />

      {loading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
      ) : exames.length === 0 ? (
        <EmptyState
          titulo="Nenhum exame guardado ainda"
          descricao="Que tal começar pelo último exame que você tem? É só dar um nome e anexar o arquivo."
          icon={<FlaskConical className="size-7" aria-hidden />}
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {exames.map((e) => (
            <ExameCard key={e.id} exame={e} onRemove={(id) => setExames((prev) => prev.filter((x) => x.id !== id))} />
          ))}
        </ul>
      )}
    </div>
  )
}

function NovoExame({ onCreated }: { onCreated: (e: Exame) => void }) {
  const criancaAtiva = useMedicoContext((s) => s.criancaAtiva)
  const [nome, setNome] = useState('')
  const [categoria, setCategoria] = useState('outro')
  const [dataExame, setDataExame] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function enviar() {
    setErro(null)
    if (nome.trim().length < 2) {
      setErro('Dê um nome ao exame.')
      return
    }
    const fd = new FormData()
    fd.append('nome', nome.trim())
    fd.append('categoria', categoria)
    if (dataExame) fd.append('dataExame', new Date(dataExame).toISOString())
    if (observacoes.trim()) fd.append('observacoes', observacoes.trim())
    if (arquivo) fd.append('arquivo', arquivo)

    setSaving(true)
    try {
      const { exame } = await api.upload<{ exame: Exame }>(`/exames${criancaQuery(criancaAtiva)}`, fd)
      onCreated(exame)
      setNome('')
      setCategoria('outro')
      setDataExame('')
      setObservacoes('')
      setArquivo(null)
      if (fileRef.current) fileRef.current.value = ''
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui salvar o exame.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-2xl border border-line bg-paper p-lg shadow-soft">
      <h2 className="inline-flex items-center gap-2 text-lg">
        <Upload className="size-5 text-indigo" aria-hidden />
        Guardar um exame
      </h2>
      <div className="mt-md grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 sm:col-span-2">
          <span className="font-display text-sm font-semibold text-ink">Nome do exame</span>
          <input value={nome} onChange={(e) => setNome(e.target.value)} className="input" maxLength={120} placeholder="Ex.: Ultrassom morfológico" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="font-display text-sm font-semibold text-ink">Categoria</span>
          <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className="input">
            {CATEGORIAS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="font-display text-sm font-semibold text-ink">Data do exame</span>
          <input type="date" value={dataExame} onChange={(e) => setDataExame(e.target.value)} className="input" />
        </label>
        <label className="flex flex-col gap-1.5 sm:col-span-2">
          <span className="font-display text-sm font-semibold text-ink">Observações (opcional)</span>
          <input value={observacoes} onChange={(e) => setObservacoes(e.target.value)} className="input" maxLength={1000} placeholder="Algo importante sobre o resultado" />
        </label>
        <label className="flex cursor-pointer flex-col gap-1.5 sm:col-span-2">
          <span className="font-display text-sm font-semibold text-ink">Arquivo (PDF, JPG, PNG — até 5 MB)</span>
          <span className="flex items-center gap-2 rounded-lg border border-dashed border-line bg-paper-2 px-4 py-3 text-sm text-ink-soft hover:border-[var(--color-lilas)]">
            <Paperclip className="size-4 shrink-0" aria-hidden />
            {arquivo ? arquivo.name : 'Escolher arquivo'}
          </span>
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf,image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
          />
        </label>
      </div>
      {erro && (
        <p role="alert" className="mt-3 text-sm font-semibold text-warn">
          {erro}
        </p>
      )}
      <div className="mt-md">
        <Button loading={saving} iconLeft={<Upload className="size-4" aria-hidden />} onClick={enviar}>
          Guardar exame
        </Button>
      </div>
    </div>
  )
}

function ExameCard({ exame, onRemove }: { exame: Exame; onRemove: (id: string) => void }) {
  const userId = useAuth((s) => s.user?.id)
  const criancaAtiva = useMedicoContext((s) => s.criancaAtiva)
  const meu = Boolean(userId) && exame.autorId === userId
  const data = useMemo(() => new Date(exame.dataExame).toLocaleDateString('pt-BR'), [exame.dataExame])

  async function remover() {
    try {
      await api.del(`/exames/${exame.id}`)
      onRemove(exame.id)
    } catch {
      /* ignore */
    }
  }

  return (
    <li className="flex items-start gap-3 rounded-xl border border-line bg-paper p-3 shadow-soft">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl [background-image:var(--grad-brand-soft)] text-indigo">
        <FileText className="size-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-display font-semibold text-ink">{exame.nome}</p>
        <p className="text-xs text-ink-mute">
          {CAT_LABEL[exame.categoria] ?? exame.categoria} · {data}
          {exame.autorNome ? ` · ${exame.autorNome}` : ''}
        </p>
        {exame.observacoes && <p className="mt-1 text-sm text-ink-soft">{exame.observacoes}</p>}
        {exame.temArquivo && (
          <a
            href={`${API_BASE}/exames/${exame.id}/arquivo${criancaQuery(criancaAtiva)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-indigo hover:text-azul"
          >
            <ExternalLink className="size-3.5" aria-hidden />
            Ver arquivo
          </a>
        )}
      </div>
      {meu && <BotaoExcluir onConfirm={remover} titulo="Remover exame" />}
    </li>
  )
}
