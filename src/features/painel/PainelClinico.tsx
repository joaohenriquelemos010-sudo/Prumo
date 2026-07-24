import { useEffect, useState } from 'react'
import { Activity, AlertTriangle, CheckCircle2, Syringe, TrendingUp, Route, FileHeart, Droplet } from 'lucide-react'
import { api } from '@/lib/api/client'
import { useMedicoContext, criancaQuery } from '@/lib/stores/medico-context'
import { TRILHA_NODES } from '@/features/trilha/data'
import { Skeleton } from '@/components/Skeleton'

/**
 * Clinical panel — a real snapshot of the currently selected patient (via the
 * doctor's patient selector / `useMedicoContext`). Reads the patient's own
 * prontuário, vaccines and trilha through the scoped API. With no patient
 * connected it falls back to the doctor's example journey.
 */

interface Evento {
  id: string
  data: string
  autorNome: string
  texto: string
}

interface Prontuario {
  tipoSanguineo: string
  alergias: string
  resumoGestacional: string
  condicoes: string[]
  eventos: Evento[]
}

export function PainelClinico() {
  const criancaAtiva = useMedicoContext((s) => s.criancaAtiva)
  const nomeAtivo = useMedicoContext((s) => s.nomeAtivo)
  const [prontuario, setProntuario] = useState<Prontuario | null>(null)
  const [vacinas, setVacinas] = useState<number>(0)
  const [etapas, setEtapas] = useState<number>(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    setLoading(true)
    const q = criancaQuery(criancaAtiva)
    Promise.all([
      api.get<{ prontuario: Prontuario }>(`/prontuario${q}`),
      api.get<{ vacinasAplicadas: string[] }>(`/vacinas${q}`),
      api.get<{ etapasConcluidas: string[] }>(`/trilha${q}`),
    ])
      .then(([p, v, t]) => {
        if (!active) return
        setProntuario(p.prontuario)
        setVacinas(v.vacinasAplicadas.length)
        setEtapas(t.etapasConcluidas.length)
      })
      .catch(() => {})
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [criancaAtiva])

  if (loading) {
    return (
      <div className="grid gap-md lg:grid-cols-3">
        <Skeleton className="h-48 lg:col-span-1" />
        <Skeleton className="h-48 lg:col-span-2" />
      </div>
    )
  }

  const nomePaciente = nomeAtivo || 'Paciente de exemplo'
  const progresso = Math.round((etapas / TRILHA_NODES.length) * 100)
  const condicoes = prontuario?.condicoes ?? []
  const ultimos = prontuario?.eventos.slice(0, 3) ?? []

  return (
    <div className="grid gap-md lg:grid-cols-3">
      {/* Ficha */}
      <div className="rounded-2xl border border-line bg-paper p-lg shadow-soft lg:col-span-1">
        <p className="font-display text-sm font-semibold text-ink-mute">Paciente</p>
        <p className="mt-1 font-display text-2xl font-bold text-ink">{nomePaciente}</p>

        <dl className="mt-md grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="inline-flex items-center gap-1 text-ink-mute">
              <Droplet className="size-3.5" aria-hidden /> Tipo sanguíneo
            </dt>
            <dd className="font-semibold text-ink">{prontuario?.tipoSanguineo || '—'}</dd>
          </div>
          <div>
            <dt className="inline-flex items-center gap-1 text-ink-mute">
              <Syringe className="size-3.5" aria-hidden /> Vacinas
            </dt>
            <dd className="font-semibold text-ink">{vacinas} registradas</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-ink-mute">Alergias</dt>
            <dd className="font-semibold text-ink">{prontuario?.alergias || 'Sem alergias registradas'}</dd>
          </div>
        </dl>
      </div>

      {/* Riscos + histórico contínuo */}
      <div className="rounded-2xl border border-line bg-paper p-lg shadow-soft lg:col-span-2">
        <div className="flex items-center gap-2">
          <Activity className="size-5 text-indigo" aria-hidden />
          <h3 className="text-lg">Histórico contínuo · gestação → hoje</h3>
        </div>

        {condicoes.length > 0 ? (
          <ul className="mt-md flex flex-col gap-2">
            {condicoes.map((c) => (
              <li key={c} className="flex items-center gap-2 rounded-xl bg-[oklch(0.95_0.06_65)] px-3 py-2.5 text-sm">
                <AlertTriangle className="size-4 text-warn" aria-hidden />
                <span className="font-semibold text-ink">{c}</span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-md flex items-center gap-2 rounded-xl bg-paper-2 px-3 py-2.5 text-sm text-ink-soft">
            <CheckCircle2 className="size-4 shrink-0 text-success" aria-hidden />
            Nenhuma condição em acompanhamento registrada.
          </div>
        )}

        {prontuario?.resumoGestacional && (
          <div className="mt-md flex items-start gap-2 rounded-xl bg-paper-2 px-3 py-2.5 text-sm text-ink-soft">
            <TrendingUp className="mt-0.5 size-4 shrink-0 text-indigo" aria-hidden />
            <span>{prontuario.resumoGestacional}</span>
          </div>
        )}
      </div>

      {/* Trilha */}
      <div className="rounded-2xl border border-line bg-paper p-lg shadow-soft lg:col-span-1">
        <h3 className="inline-flex items-center gap-2 text-lg">
          <Route className="size-5 text-indigo" aria-hidden />
          Trilha
        </h3>
        <p className="mt-md font-display text-3xl font-bold text-ink">{progresso}%</p>
        <p className="text-sm text-ink-mute">
          {etapas} de {TRILHA_NODES.length} etapas concluídas
        </p>
        <div className="mt-3 h-2.5 overflow-hidden rounded-pill bg-paper-3">
          <div className="h-full rounded-pill [background-image:var(--grad-brand)]" style={{ width: `${progresso}%` }} />
        </div>
      </div>

      {/* Últimas anotações */}
      <div className="rounded-2xl border border-line bg-paper p-lg shadow-soft lg:col-span-2">
        <h3 className="inline-flex items-center gap-2 text-lg">
          <FileHeart className="size-5 text-indigo" aria-hidden />
          Últimas anotações do prontuário
        </h3>
        {ultimos.length === 0 ? (
          <p className="mt-md text-sm text-ink-mute">Nenhuma anotação ainda.</p>
        ) : (
          <ul className="mt-md flex flex-col gap-2">
            {ultimos.map((ev) => (
              <li key={ev.id} className="rounded-xl bg-paper-2 px-3 py-2 text-sm">
                <p className="text-ink">{ev.texto}</p>
                <p className="text-xs text-ink-mute">
                  {new Date(ev.data).toLocaleDateString('pt-BR')}
                  {ev.autorNome && ` · ${ev.autorNome}`}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
