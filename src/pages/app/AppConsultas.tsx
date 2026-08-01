import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Stethoscope,
  Plus,
  ArrowLeft,
  ArrowRight,
  Check,
  ClipboardList,
  Lock,
  Eye,
  ListChecks,
  EyeOff,
} from 'lucide-react'
import { api } from '@/lib/api/client'
import { useAuth } from '@/lib/stores/auth'
import { usePerfil } from '@/lib/stores/perfil'
import { useMedicoContext, criancaQuery } from '@/lib/stores/medico-context'
import { SeletorPaciente } from '@/features/painel/SeletorPaciente'
import { Button } from '@/components/Button'
import { BotaoExcluir } from '@/components/BotaoExcluir'
import { EmptyState } from '@/components/EmptyState'
import { Skeleton } from '@/components/Skeleton'
import { AlertaErro } from '@/components/AlertaErro'
import { idadeGestacional } from '@/features/clinico/schedule'
import { roteiroParaSemana, intervaloRecomendado } from '@/features/clinico/diretrizes-prenatal'
import { ROTEIRO_PEDIATRICO } from '@/features/clinico/diretrizes-pediatria'
import type { BlocoChecklist } from '@/features/clinico/diretrizes-prenatal'
import { cn } from '@/lib/cn'

const BaixarResumo = lazy(() =>
  import('@/features/pdf/documents').then((m) => ({ default: m.BaixarResumoDaConsulta })),
)
const BaixarHistorico = lazy(() =>
  import('@/features/pdf/documents').then((m) => ({ default: m.BaixarHistoricoConsultas })),
)

interface Medidas {
  pesoKg?: number | null
  alturaCm?: number | null
  paSistolica?: number | null
  paDiastolica?: number | null
  alturaUterinaCm?: number | null
  bcfBpm?: number | null
  comprimentoCm?: number | null
  perimetroCefalicoCm?: number | null
}

interface ItemMarcado {
  id: string
  feito: boolean
  observacao?: string
}

interface Consulta {
  id: string
  autorId: string
  autorNome: string
  data: string
  tipo: 'pre-concepcional' | 'pre-natal' | 'pediatrica'
  subjetivo: string
  objetivo: string
  avaliacao: string
  avaliacaoOculta?: boolean
  plano: string
  igSemanas: number | null
  igDias: number | null
  medidas: Medidas
  checklist: ItemMarcado[]
  /** O texto em linguagem leiga, escrito para a família. */
  resumoParaFamilia?: string
  notasPrivadas?: string
  avaliacaoPrivada?: boolean
  peso: string
  altura: string
  pressao: string
}

const TIPO_LABEL: Record<Consulta['tipo'], string> = {
  'pre-concepcional': 'pré-concepcional',
  'pre-natal': 'pré-natal',
  pediatrica: 'pediátrica',
}

const slide = {
  initial: { opacity: 0, x: 20 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -20 },
  transition: { duration: 0.26, ease: [0.16, 1, 0.3, 1] as const },
}

/**
 * `embutido` = renderizada como aba dentro do hub da paciente (`AppPaciente`).
 *
 * Quando é aba, quem diz de quem é o prontuário e o que a tela é já está no
 * cabeçalho do hub, e o seletor de paciente viraria uma segunda maneira de
 * trocar de pessoa — dois controles para a mesma coisa é a origem do "confuso".
 * Então os dois somem, e só o conteúdo fica.
 */
export default function AppConsultas({ embutido = false }: { embutido?: boolean } = {}) {
  const papel = useAuth((s) => s.user?.papel)
  const isMedico = papel === 'medico'
  const criancaAtiva = useMedicoContext((s) => s.criancaAtiva)
  const nomeAtivo = useMedicoContext((s) => s.nomeAtivo)
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
      {!embutido && (
        <header className="flex flex-wrap items-start justify-between gap-md">
          <div className="flex flex-col gap-1">
            <p className="u-eyebrow">Consultas</p>
            <h1 className="text-3xl sm:text-4xl">{isMedico ? 'Registro de consultas' : 'Suas consultas'}</h1>
            <p className="text-ink-soft">
              {isMedico
                ? 'O roteiro da diretriz, passo a passo — sem esquecer nada, e sem levar para a família o que ainda é hipótese.'
                : 'O que foi conversado e combinado em cada consulta, guardado para você.'}
            </p>
          </div>
          {isMedico && !criando && (
            <Button size="md" iconLeft={<Plus className="size-4" aria-hidden />} onClick={() => setCriando(true)}>
              Nova consulta
            </Button>
                )}
              </header>
      )}

      {!embutido && <SeletorPaciente />}

      {/*
        O histórico inteiro num PDF só. O resumo de uma consulta já existia; o
        que o consultório usa de verdade é este — para levar a um colega, anexar
        a um pedido de convênio, ou guardar ao mudar de médico.
      */}
      {consultas.length > 1 && (
        <Suspense fallback={null}>
          <BaixarHistorico
            dados={{
              pacienteNome: nomeAtivo ?? 'Paciente',
              geradoEm: new Date().toISOString(),
              consultas: consultas.map((c) => ({
                data: c.data,
                tipo: c.tipo,
                autorNome: c.autorNome,
                igSemanas: c.igSemanas,
                igDias: c.igDias,
                subjetivo: c.subjetivo,
                objetivo: c.objetivo,
                avaliacao: c.avaliacaoOculta ? '' : c.avaliacao,
                plano: c.plano,
                medidas: c.medidas as Record<string, number | null | undefined>,
              })),
            }}
          />
        </Suspense>
      )}

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
              ? 'Comece registrando a consulta de hoje — o roteiro guia o preenchimento.'
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

/* ------------------------------ new encounter ----------------------------- */

const STEPS = [
  { key: 'checklist', label: 'Roteiro', hint: 'O que a diretriz pede nesta fase.' },
  { key: 'subjetivo', label: 'Subjetivo', hint: 'O que a família relata: queixas, sintomas, contexto.' },
  { key: 'objetivo', label: 'Objetivo', hint: 'Exame físico, medidas e sinais observados.' },
  { key: 'avaliacao', label: 'Avaliação', hint: 'Sua impressão diagnóstica.' },
  { key: 'plano', label: 'Plano', hint: 'Conduta, orientações e retorno.' },
] as const

type CampoTexto = 'subjetivo' | 'objetivo' | 'avaliacao' | 'plano'

function NovaConsulta({ onCancel, onSaved }: { onCancel: () => void; onSaved: (c: Consulta) => void }) {
  const criancaAtiva = useMedicoContext((s) => s.criancaAtiva)
  const perfil = usePerfil((s) => s.perfil)
  const loadPerfil = usePerfil((s) => s.load)
  const perfilLoaded = usePerfil((s) => s.loaded)

  useEffect(() => {
    if (!perfilLoaded) void loadPerfil()
  }, [perfilLoaded, loadPerfil])

  // The journey already knows whether this is a pregnancy or a child — default to
  // that instead of making the doctor answer a question the record can answer.
  const ig = perfil?.dpp ? idadeGestacional(new Date(perfil.dpp)) : null
  const [tipo, setTipo] = useState<Consulta['tipo']>(perfil?.dpp ? 'pre-natal' : 'pediatrica')

  const [step, setStep] = useState(0)
  const [campos, setCampos] = useState<Record<CampoTexto, string>>({
    subjetivo: '',
    objetivo: '',
    avaliacao: '',
    plano: '',
  })
  const [medidas, setMedidas] = useState<Record<string, string>>({})
  // Defaults to today, but editable: a visit often gets typed up afterwards, and
  // without this every consultation was stamped with the moment of typing —
  // which piled the whole growth curve onto a single month.
  const [dataConsulta, setDataConsulta] = useState(() => new Date().toISOString().slice(0, 10))
  const [marcados, setMarcados] = useState<Record<string, boolean>>({})
  const [notasPrivadas, setNotasPrivadas] = useState('')
  const [avaliacaoPrivada, setAvaliacaoPrivada] = useState(false)
  const [previa, setPrevia] = useState(false)
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const roteiro: BlocoChecklist[] = useMemo(
    () => (tipo === 'pediatrica' ? ROTEIRO_PEDIATRICO : roteiroParaSemana(ig?.semanas ?? 0)),
    [tipo, ig?.semanas],
  )

  const atual = STEPS[step]
  const progresso = Math.round(((step + 1) / STEPS.length) * 100)

  function num(chave: string): number | null {
    const v = medidas[chave]
    if (!v) return null
    const n = Number(v.replace(',', '.'))
    return Number.isFinite(n) ? n : null
  }

  async function salvar() {
    setErro(null)
    setSaving(true)
    try {
      const { consulta } = await api.post<{ consulta: Consulta }>(
        `/consultas${criancaQuery(criancaAtiva)}`,
        {
          tipo,
          data: dataConsulta || undefined,
          ...campos,
          notasPrivadas,
          avaliacaoPrivada,
          igSemanas: tipo === 'pre-natal' ? (ig?.semanas ?? null) : null,
          igDias: tipo === 'pre-natal' ? (ig?.dias ?? null) : null,
          medidas: {
            pesoKg: num('pesoKg'),
            alturaCm: num('alturaCm'),
            paSistolica: num('paSistolica'),
            paDiastolica: num('paDiastolica'),
            alturaUterinaCm: num('alturaUterinaCm'),
            bcfBpm: num('bcfBpm'),
            comprimentoCm: num('comprimentoCm'),
            perimetroCefalicoCm: num('perimetroCefalicoCm'),
          },
          checklist: Object.entries(marcados).map(([id, feito]) => ({ id, feito })),
        },
      )
      onSaved(consulta)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui salvar a consulta.')
    } finally {
      setSaving(false)
    }
  }

  const totalItens = roteiro.reduce((n, b) => n + b.itens.length, 0)
  const feitos = Object.values(marcados).filter(Boolean).length

  return (
    <div className="rounded-2xl border border-line bg-paper p-lg shadow-lift">
      <div className="mb-md flex items-center gap-md">
        {step > 0 && (
          <button
            type="button"
            onClick={() => setStep((s) => s - 1)}
            aria-label="Voltar"
            className="grid size-11 shrink-0 place-items-center rounded-pill text-indigo hover:bg-paper-2"
          >
            <ArrowLeft className="size-4" aria-hidden />
          </button>
        )}
        <div
          className="h-2 flex-1 overflow-hidden rounded-pill bg-paper-3"
          role="progressbar"
          aria-valuenow={step + 1}
          aria-valuemin={1}
          aria-valuemax={STEPS.length}
        >
          <div
            className="h-full rounded-pill [background-image:var(--grad-brand)] transition-[width] duration-[var(--dur-base)]"
            style={{ width: `${progresso}%` }}
          />
        </div>
        <span className="font-display text-sm font-semibold text-ink-mute">
          {step + 1}/{STEPS.length}
        </span>
      </div>

      {step === 0 && (
        <div className="mb-md flex flex-wrap gap-2">
          {(['pediatrica', 'pre-natal', 'pre-concepcional'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTipo(t)}
              aria-pressed={tipo === t}
              className={cn(
                'min-h-11 rounded-pill border px-4 text-sm font-semibold transition-colors',
                tipo === t
                  ? 'border-transparent [background-image:var(--grad-brand)] text-white'
                  : 'border-line bg-paper text-ink-soft hover:bg-paper-2',
              )}
            >
              {t === 'pediatrica' ? 'Pediátrica' : t === 'pre-natal' ? 'Pré-natal' : 'Pré-concepcional'}
            </button>
          ))}
          <label className="ml-auto flex items-center gap-2 text-sm text-ink-soft" htmlFor="data-consulta">
            Data
            <input
              id="data-consulta"
              type="date"
              value={dataConsulta}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setDataConsulta(e.target.value)}
              className="input h-11 w-auto py-0"
            />
          </label>
        </div>
      )}

      <AnimatePresence mode="wait">
        <motion.div key={atual.key} {...slide}>
          {atual.key === 'checklist' ? (
            <>
              <h2 className="inline-flex items-center gap-2 text-xl">
                <ListChecks className="size-5 text-indigo" aria-hidden />
                Roteiro da consulta
              </h2>
              <p className="mt-1 text-sm text-ink-soft">
                {tipo === 'pre-natal' && ig
                  ? `${ig.semanas} semanas e ${ig.dias} dias · retorno ${intervaloRecomendado(ig.semanas).toLowerCase()}`
                  : atual.hint}
              </p>

              {roteiro.length === 0 ? (
                <p className="mt-md text-sm text-ink-mute">
                  Informe a data provável do parto no perfil da paciente para o roteiro aparecer.
                </p>
              ) : (
                <div className="mt-md flex flex-col gap-md">
                  {roteiro.map((bloco) => (
                    <fieldset key={bloco.id}>
                      <legend className="font-display text-sm font-semibold text-indigo">{bloco.titulo}</legend>
                      <ul className="mt-2 flex flex-col gap-1.5">
                        {bloco.itens.map((item) => (
                          <li key={item.id}>
                            <label className="flex cursor-pointer items-start gap-3 rounded-xl p-2 hover:bg-paper-2">
                              <input
                                type="checkbox"
                                checked={Boolean(marcados[item.id])}
                                onChange={(e) =>
                                  setMarcados((m) => ({ ...m, [item.id]: e.target.checked }))
                                }
                                className="mt-1 size-5 shrink-0 accent-[var(--color-lilas)]"
                              />
                              <span className="min-w-0">
                                <span className="block text-sm font-semibold text-ink">
                                  {item.titulo}
                                  {item.exigeExplicacao && (
                                    <span
                                      title="Achado técnico: vale explicar em vez de deixar como número solto."
                                      className="u-chip-warn ml-2 inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-[0.65rem] font-semibold"
                                    >
                                      explicar
                                    </span>
                                  )}
                                </span>
                                <span className="block text-xs text-ink-mute">{item.detalhe}</span>
                              </span>
                            </label>
                          </li>
                        ))}
                      </ul>
                    </fieldset>
                  ))}
                  <p className="text-xs text-ink-mute">
                    {feitos} de {totalItens} itens marcados.
                  </p>
                </div>
              )}
            </>
          ) : (
            <>
              <h2 className="text-xl">{atual.label}</h2>
              <p className="mt-1 text-sm text-ink-soft">{atual.hint}</p>
              <textarea
                value={campos[atual.key as CampoTexto]}
                onChange={(e) => setCampos((c) => ({ ...c, [atual.key]: e.target.value }))}
                className="input mt-3 min-h-32 resize-y"
                maxLength={3000}
                placeholder="Escreva aqui…"
                autoFocus
              />

              {atual.key === 'avaliacao' && (
                <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-xl bg-paper-2 p-3">
                  <input
                    type="checkbox"
                    checked={avaliacaoPrivada}
                    onChange={(e) => setAvaliacaoPrivada(e.target.checked)}
                    className="mt-0.5 size-5 shrink-0 accent-[var(--color-lilas)]"
                  />
                  <span>
                    <span className="inline-flex items-center gap-1.5 font-display text-sm font-semibold text-ink">
                      <Lock className="size-4" aria-hidden />
                      Só para mim
                    </span>
                    <span className="block text-xs text-ink-soft">
                      A família não vê esta impressão diagnóstica — só o que você escrever no Plano.
                      Útil enquanto ainda é hipótese.
                    </span>
                  </span>
                </label>
              )}

              {atual.key === 'objetivo' && (
                <MedidasDaConsulta tipo={tipo} valores={medidas} onChange={setMedidas} />
              )}

              {atual.key === 'plano' && (
                <div className="mt-md">
                  <label className="inline-flex items-center gap-1.5 font-display text-sm font-semibold text-ink" htmlFor="notas-privadas">
                    <Lock className="size-4" aria-hidden />
                    Notas só da equipe
                  </label>
                  <textarea
                    id="notas-privadas"
                    value={notasPrivadas}
                    onChange={(e) => setNotasPrivadas(e.target.value)}
                    className="input mt-1 min-h-20 resize-y"
                    maxLength={3000}
                    placeholder="Hipóteses, condutas em aberto, o que não cabe no prontuário que a família lê."
                  />
                  <p className="mt-1 text-xs text-ink-mute">
                    Este campo nunca é enviado para a família — nem pelo app, nem na exportação.
                  </p>
                </div>
              )}
            </>
          )}
        </motion.div>
      </AnimatePresence>

      {erro && <AlertaErro>{erro}</AlertaErro>}

      <div className="mt-lg flex flex-wrap items-center gap-2">
        {step < STEPS.length - 1 ? (
          <Button iconRight={<ArrowRight className="size-4" aria-hidden />} onClick={() => setStep((s) => s + 1)}>
            Próximo
          </Button>
        ) : (
          <Button loading={saving} iconLeft={<Check className="size-4" aria-hidden />} onClick={salvar}>
            Salvar consulta
          </Button>
        )}
        <Button
          variant="secondary"
          iconLeft={previa ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
          onClick={() => setPrevia((v) => !v)}
        >
          {previa ? 'Fechar prévia' : 'Ver como a família vê'}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
      </div>

      {previa && (
        <PreviaFamilia
          campos={campos}
          avaliacaoPrivada={avaliacaoPrivada}
          temNotas={notasPrivadas.trim().length > 0}
        />
      )}
    </div>
  )
}

/** Exactly what the family will read, rendered from the same rules the server applies. */
function PreviaFamilia({
  campos,
  avaliacaoPrivada,
  temNotas,
}: {
  campos: Record<CampoTexto, string>
  avaliacaoPrivada: boolean
  temNotas: boolean
}) {
  const secoes: [string, string][] = [
    ['Subjetivo', campos.subjetivo],
    ['Objetivo', campos.objetivo],
    ['Avaliação', avaliacaoPrivada ? '' : campos.avaliacao],
    ['Plano', campos.plano],
  ]

  return (
    <section className="mt-md rounded-2xl border-2 border-dashed border-line bg-paper-2 p-md">
      <p className="inline-flex items-center gap-2 font-display text-sm font-semibold text-indigo">
        <Eye className="size-4" aria-hidden />
        Assim a família vê
      </p>
      <dl className="mt-3 grid gap-3 sm:grid-cols-2">
        {secoes.map(([label, valor]) => (
          <div key={label}>
            <dt className="text-xs font-semibold text-indigo">{label}</dt>
            <dd className="text-sm text-ink-soft">
              {valor || <span className="text-ink-mute">—</span>}
            </dd>
          </div>
        ))}
      </dl>
      {(avaliacaoPrivada || temNotas) && (
        <p className="mt-3 inline-flex items-start gap-1.5 text-xs text-ink-mute">
          <Lock className="mt-0.5 size-3 shrink-0" aria-hidden />
          {avaliacaoPrivada && temNotas
            ? 'A avaliação e suas notas ficam só com a equipe.'
            : avaliacaoPrivada
              ? 'A avaliação fica só com a equipe.'
              : 'Suas notas ficam só com a equipe.'}
        </p>
      )}
    </section>
  )
}

const CAMPOS_GESTANTE = [
  { chave: 'pesoKg', label: 'Peso (kg)', placeholder: '68,4' },
  { chave: 'paSistolica', label: 'PA sistólica', placeholder: '120' },
  { chave: 'paDiastolica', label: 'PA diastólica', placeholder: '80' },
  { chave: 'alturaUterinaCm', label: 'Altura uterina (cm)', placeholder: '28' },
  { chave: 'bcfBpm', label: 'BCF (bpm)', placeholder: '140' },
]

const CAMPOS_CRIANCA = [
  { chave: 'pesoKg', label: 'Peso (kg)', placeholder: '6,8' },
  { chave: 'comprimentoCm', label: 'Comprimento (cm)', placeholder: '63' },
  { chave: 'perimetroCefalicoCm', label: 'Perímetro cefálico (cm)', placeholder: '42' },
]

/**
 * Numeric fields, not the old free-text vitals. "6,8 kg" reads fine and plots
 * never — these are what the growth curve and the pattern checks run on.
 */
function MedidasDaConsulta({
  tipo,
  valores,
  onChange,
}: {
  tipo: Consulta['tipo']
  valores: Record<string, string>
  onChange: (v: Record<string, string>) => void
}) {
  const campos = tipo === 'pediatrica' ? CAMPOS_CRIANCA : CAMPOS_GESTANTE
  return (
    <div className="mt-md">
      <p className="font-display text-sm font-semibold text-indigo">Medidas</p>
      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
        {campos.map((c) => (
          <div key={c.chave}>
            <label className="block text-xs text-ink-mute" htmlFor={`medida-${c.chave}`}>
              {c.label}
            </label>
            <input
              id={`medida-${c.chave}`}
              value={valores[c.chave] ?? ''}
              onChange={(e) => onChange({ ...valores, [c.chave]: e.target.value })}
              inputMode="decimal"
              placeholder={c.placeholder}
              className="input mt-1"
            />
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-ink-mute">
        Números viram curva de crescimento e verificação automática de padrão.
      </p>
    </div>
  )
}

/* -------------------------------- reading -------------------------------- */

function ConsultaCard({ consulta, onRemove }: { consulta: Consulta; onRemove: (id: string) => void }) {
  const nomePaciente = useMedicoContext((s) => s.nomeAtivo) ?? undefined
  const userId = useAuth((s) => s.user?.id)
  const papel = useAuth((s) => s.user?.papel)
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

  const m = consulta.medidas ?? {}
  const resumo = [
    m.pesoKg && `${m.pesoKg} kg`,
    m.comprimentoCm && `${m.comprimentoCm} cm`,
    m.perimetroCefalicoCm && `PC ${m.perimetroCefalicoCm} cm`,
    m.alturaUterinaCm && `AU ${m.alturaUterinaCm} cm`,
    m.bcfBpm && `BCF ${m.bcfBpm}`,
    m.paSistolica && m.paDiastolica && `PA ${m.paSistolica}/${m.paDiastolica}`,
    !m.pesoKg && consulta.peso,
  ].filter(Boolean)

  const feitos = consulta.checklist?.filter((i) => i.feito).length ?? 0

  return (
    <li className="rounded-2xl border border-line bg-paper p-md shadow-soft">
      <div className="flex items-start justify-between gap-2">
        <button type="button" onClick={() => setAberto((v) => !v)} className="flex items-center gap-3 text-left">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl [background-image:var(--grad-brand-soft)] text-indigo">
            <ClipboardList className="size-5" aria-hidden />
          </span>
          <span className="min-w-0">
            <span className="block font-display font-semibold text-ink">
              Consulta {TIPO_LABEL[consulta.tipo]}
              {consulta.igSemanas != null && (
                <span className="text-ink-mute"> · {consulta.igSemanas}s{consulta.igDias ?? 0}d</span>
              )}
            </span>
            <span className="block text-xs text-ink-mute">
              {new Date(consulta.data).toLocaleDateString('pt-BR')}
              {resumo.length > 0 ? ` · ${resumo.join(' · ')}` : ''}
              {feitos > 0 ? ` · ${feitos} itens do roteiro` : ''}
            </span>
          </span>
        </button>
        {meu && <BotaoExcluir onConfirm={remover} titulo="Remover consulta" />}
      </div>

      {aberto && (
        <>
          {/*
            O resumo em linguagem leiga vem PRIMEIRO, antes do SOAP.
            É o que foi escrito para quem está lendo; o resto é o registro
            clínico, escrito para a próxima profissional.
          */}
          {consulta.resumoParaFamilia && (
            <div className="mt-md rounded-xl border-l-[3px] border-[var(--color-lilas)] bg-paper-2 p-3">
              <p className="text-xs font-semibold uppercase tracking-caption text-indigo">
                O que conversamos
              </p>
              <p className="mt-1 whitespace-pre-line text-sm text-ink">
                {consulta.resumoParaFamilia}
              </p>
              <div className="mt-3">
                <Suspense fallback={null}>
                  <BaixarResumo
                    dados={{
                      pacienteNome: nomePaciente,
                      data: consulta.data,
                      tipo: consulta.tipo,
                      igSemanas: consulta.igSemanas,
                      igDias: consulta.igDias,
                      resumoParaFamilia: consulta.resumoParaFamilia,
                      plano: consulta.plano,
                      medidas: { ...consulta.medidas },
                      medico: { nome: consulta.autorNome },
                    }}
                  />
                </Suspense>
              </div>
            </div>
          )}

          <dl className="mt-md grid gap-3 sm:grid-cols-2">
            {secoes.map(([label, valor]) => (
              <div key={label}>
                <dt className="text-xs font-semibold text-indigo">{label}</dt>
                <dd className="text-sm text-ink-soft">
                  {valor || (
                    label === 'Avaliação' && consulta.avaliacaoOculta ? (
                      <span className="inline-flex items-center gap-1 text-ink-mute">
                        <Lock className="size-3" aria-hidden />
                        Sua equipe registrou uma impressão e vai conversar com você sobre ela.
                      </span>
                    ) : (
                      <span className="text-ink-mute">—</span>
                    )
                  )}
                </dd>
              </div>
            ))}
          </dl>

          {papel === 'medico' && consulta.notasPrivadas && (
            <div className="mt-md rounded-xl bg-paper-2 p-3">
              <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo">
                <Lock className="size-3" aria-hidden />
                Notas só da equipe
              </p>
              <p className="mt-1 text-sm text-ink-soft">{consulta.notasPrivadas}</p>
            </div>
          )}
        </>
      )}
    </li>
  )
}
