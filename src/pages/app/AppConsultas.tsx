import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Stethoscope, Plus, ArrowLeft, ArrowRight, Check, ClipboardList } from 'lucide-react'
import { api } from '@/lib/api/client'
import { useAuth } from '@/lib/stores/auth'
import { useMedicoContext, criancaQuery } from '@/lib/stores/medico-context'
import { SeletorPaciente } from '@/features/painel/SeletorPaciente'
import { Button } from '@/components/Button'
import { BotaoExcluir } from '@/components/BotaoExcluir'
import { EmptyState } from '@/components/EmptyState'
import { Skeleton } from '@/components/Skeleton'

interface Consulta {
  id: string
  autorId: string
  autorNome: string
  data: string
  tipo: 'pre-natal' | 'pediatrica'
  subjetivo: string
  objetivo: string
  avaliacao: string
  plano: string
  peso: string
  altura: string
  pressao: string
}

const slide = {
  initial: { opacity: 0, x: 20 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -20 },
  transition: { duration: 0.26, ease: [0.16, 1, 0.3, 1] as const },
}

export default function AppConsultas() {
  const papel = useAuth((s) => s.user?.papel)
  const isMedico = papel === 'medico'
  const criancaAtiva = useMedicoContext((s) => s.criancaAtiva)
  const [consultas, setConsultas] = useState<Consulta[]>([])
  const [loading, setLoading] = useState(true)
  const [criando, setCriando] = useState(false)

  useEffect(() => {
    let active = true
    setLoading(true)
    api
      .get<{ consultas: Consulta[] }>(`/consultas${criancaQuery(criancaAtiva)}`)
      .then((d) => active && setConsultas(d.consultas))
      .catch(() => {})
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [criancaAtiva])

  return (
    <div className="flex flex-col gap-lg">
      <header className="flex items-start justify-between gap-md">
        <div className="flex flex-col gap-1">
          <p className="u-eyebrow">Consultas</p>
          <h1 className="text-3xl sm:text-4xl">{isMedico ? 'Registro de consultas' : 'Suas consultas'}</h1>
          <p className="text-ink-soft">
            {isMedico
              ? 'Registre a consulta no formato SOAP — passo a passo, sem esquecer nada.'
              : 'O que foi conversado e combinado em cada consulta, guardado para você.'}
          </p>
        </div>
        {isMedico && !criando && (
          <Button size="md" iconLeft={<Plus className="size-4" aria-hidden />} onClick={() => setCriando(true)}>
            Nova consulta
          </Button>
        )}
      </header>

      <SeletorPaciente />

      {criando && isMedico && (
        <NovaConsulta
          onCancel={() => setCriando(false)}
          onSaved={(c) => {
            setConsultas((prev) => [c, ...prev])
            setCriando(false)
          }}
        />
      )}

      {loading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      ) : consultas.length === 0 && !criando ? (
        <EmptyState
          titulo={isMedico ? 'Nenhuma consulta registrada ainda' : 'Ainda não há consultas'}
          descricao={
            isMedico
              ? 'Comece registrando a consulta de hoje — leva menos de um minuto.'
              : 'Assim que uma consulta for registrada, ela aparece aqui.'
          }
          icon={<Stethoscope className="size-7" aria-hidden />}
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {consultas.map((c) => (
            <ConsultaCard
              key={c.id}
              consulta={c}
              onRemove={(id) => setConsultas((prev) => prev.filter((x) => x.id !== id))}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

const STEPS = [
  { key: 'subjetivo', label: 'Subjetivo', hint: 'O que a família relata: queixas, sintomas, contexto.' },
  { key: 'objetivo', label: 'Objetivo', hint: 'Exame físico e sinais observados.' },
  { key: 'avaliacao', label: 'Avaliação', hint: 'Sua impressão diagnóstica.' },
  { key: 'plano', label: 'Plano', hint: 'Conduta, orientações e retorno.' },
] as const

function NovaConsulta({ onCancel, onSaved }: { onCancel: () => void; onSaved: (c: Consulta) => void }) {
  const criancaAtiva = useMedicoContext((s) => s.criancaAtiva)
  const [step, setStep] = useState(0)
  const [tipo, setTipo] = useState<'pre-natal' | 'pediatrica'>('pediatrica')
  const [campos, setCampos] = useState({ subjetivo: '', objetivo: '', avaliacao: '', plano: '' })
  const [vitais, setVitais] = useState({ peso: '', altura: '', pressao: '' })
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const atual = STEPS[step]
  const progresso = Math.round(((step + 1) / STEPS.length) * 100)

  async function salvar() {
    setErro(null)
    setSaving(true)
    try {
      const { consulta } = await api.post<{ consulta: Consulta }>(`/consultas${criancaQuery(criancaAtiva)}`, { tipo, ...campos, ...vitais })
      onSaved(consulta)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui salvar a consulta.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-2xl border border-line bg-paper p-lg shadow-lift">
      <div className="mb-md flex items-center gap-md">
        {step > 0 && (
          <button
            type="button"
            onClick={() => setStep((s) => s - 1)}
            aria-label="Voltar"
            className="grid size-9 place-items-center rounded-pill text-indigo hover:bg-paper-2"
          >
            <ArrowLeft className="size-4" aria-hidden />
          </button>
        )}
        <div className="h-2 flex-1 overflow-hidden rounded-pill bg-paper-3">
          <div className="h-full rounded-pill [background-image:var(--grad-brand)] transition-[width] duration-[var(--dur-base)]" style={{ width: `${progresso}%` }} />
        </div>
        <span className="font-display text-sm font-semibold text-ink-mute">
          {step + 1}/{STEPS.length}
        </span>
      </div>

      {step === 0 && (
        <div className="mb-md flex flex-wrap gap-2">
          {(['pediatrica', 'pre-natal'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTipo(t)}
              aria-pressed={tipo === t}
              className={
                'rounded-pill border px-4 py-2 text-sm font-semibold transition-colors ' +
                (tipo === t ? 'border-transparent [background-image:var(--grad-brand)] text-white' : 'border-line bg-paper text-ink-soft hover:bg-paper-2')
              }
            >
              {t === 'pediatrica' ? 'Pediátrica' : 'Pré-natal'}
            </button>
          ))}
        </div>
      )}

      <AnimatePresence mode="wait">
        <motion.div key={atual.key} {...slide}>
          <h2 className="text-xl">{atual.label}</h2>
          <p className="mt-1 text-sm text-ink-soft">{atual.hint}</p>
          <textarea
            value={campos[atual.key]}
            onChange={(e) => setCampos((c) => ({ ...c, [atual.key]: e.target.value }))}
            className="input mt-3 min-h-32 resize-y"
            maxLength={3000}
            placeholder="Escreva aqui…"
            autoFocus
          />
          {atual.key === 'objetivo' && (
            <div className="mt-3 grid grid-cols-3 gap-2">
              <input value={vitais.peso} onChange={(e) => setVitais((v) => ({ ...v, peso: e.target.value }))} className="input" placeholder="Peso" maxLength={20} />
              <input value={vitais.altura} onChange={(e) => setVitais((v) => ({ ...v, altura: e.target.value }))} className="input" placeholder="Altura" maxLength={20} />
              <input value={vitais.pressao} onChange={(e) => setVitais((v) => ({ ...v, pressao: e.target.value }))} className="input" placeholder="PA" maxLength={20} />
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {erro && (
        <p role="alert" className="mt-3 text-sm font-semibold text-warn">
          {erro}
        </p>
      )}

      <div className="mt-lg flex gap-2">
        {step < STEPS.length - 1 ? (
          <Button iconRight={<ArrowRight className="size-4" aria-hidden />} onClick={() => setStep((s) => s + 1)}>
            Próximo
          </Button>
        ) : (
          <Button loading={saving} iconLeft={<Check className="size-4" aria-hidden />} onClick={salvar}>
            Salvar consulta
          </Button>
        )}
        <Button variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </div>
  )
}

function ConsultaCard({ consulta, onRemove }: { consulta: Consulta; onRemove: (id: string) => void }) {
  const userId = useAuth((s) => s.user?.id)
  const meu = Boolean(userId) && consulta.autorId === userId
  const [aberto, setAberto] = useState(false)

  async function remover() {
    try {
      await api.del(`/consultas/${consulta.id}`)
      onRemove(consulta.id)
    } catch {
      /* ignore */
    }
  }

  const secoes: [string, string][] = [
    ['Subjetivo', consulta.subjetivo],
    ['Objetivo', consulta.objetivo],
    ['Avaliação', consulta.avaliacao],
    ['Plano', consulta.plano],
  ]
  const vitais = [consulta.peso && `Peso ${consulta.peso}`, consulta.altura && `Altura ${consulta.altura}`, consulta.pressao && `PA ${consulta.pressao}`].filter(Boolean)

  return (
    <li className="rounded-2xl border border-line bg-paper p-md shadow-soft">
      <div className="flex items-start justify-between gap-2">
        <button type="button" onClick={() => setAberto((v) => !v)} className="flex items-center gap-3 text-left">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl [background-image:var(--grad-brand-soft)] text-indigo">
            <ClipboardList className="size-5" aria-hidden />
          </span>
          <span>
            <span className="block font-display font-semibold text-ink">
              Consulta {consulta.tipo === 'pediatrica' ? 'pediátrica' : 'pré-natal'}
            </span>
            <span className="block text-xs text-ink-mute">
              {new Date(consulta.data).toLocaleDateString('pt-BR')}
              {vitais.length > 0 ? ` · ${vitais.join(' · ')}` : ''}
            </span>
          </span>
        </button>
        {meu && <BotaoExcluir onConfirm={remover} titulo="Remover consulta" />}
      </div>

      {aberto && (
        <dl className="mt-md grid gap-3 sm:grid-cols-2">
          {secoes.map(([label, valor]) => (
            <div key={label}>
              <dt className="text-xs font-semibold text-indigo">{label}</dt>
              <dd className="text-sm text-ink-soft">{valor || <span className="text-ink-mute">—</span>}</dd>
            </div>
          ))}
        </dl>
      )}
    </li>
  )
}
