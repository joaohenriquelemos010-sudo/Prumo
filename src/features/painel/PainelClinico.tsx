import { Activity, AlertTriangle, CheckCircle2, Circle, Clock, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/cn'

/**
 * Mocked clinical panel — the "prova de conceito" a doctor sees. Fictional data
 * only. The tone here is denser and more direct, as the brief asks, while still
 * human. No invented efficacy metrics or social proof.
 */

const RISCOS = [
  { nivel: 'atencao', label: 'Diabetes gestacional (controlada)', origem: 'Gestação · 2º tri' },
  { nivel: 'ok', label: 'Sem alergias registradas', origem: 'Anamnese' },
]

const VACINAS = [
  { nome: 'BCG', status: 'aplicada', quando: 'Maternidade' },
  { nome: 'Hepatite B', status: 'aplicada', quando: 'Maternidade' },
  { nome: 'Pentavalente (1ª)', status: 'atual', quando: '2 meses' },
  { nome: 'Rotavírus (1ª)', status: 'atual', quando: '2 meses' },
  { nome: 'Pentavalente (2ª)', status: 'pendente', quando: '4 meses' },
]

const MARCOS = [
  { label: 'Sustento cervical', faixa: 'esperado 2–4m', ok: true },
  { label: 'Sorriso social', faixa: 'esperado 1,5–3m', ok: true },
  { label: 'Rolar', faixa: 'esperado 4–6m', ok: false },
]

export function PainelClinico() {
  return (
    <div className="grid gap-md lg:grid-cols-3">
      {/* Ficha */}
      <div className="rounded-2xl border border-line bg-paper p-lg shadow-soft lg:col-span-1">
        <p className="font-display text-sm font-semibold text-ink-mute">Paciente</p>
        <p className="mt-1 font-display text-2xl font-bold text-ink">Bebê M.</p>
        <p className="text-ink-soft">4 meses · nascido a termo (39s)</p>

        <dl className="mt-md grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-ink-mute">Peso ao nascer</dt>
            <dd className="font-semibold text-ink">3,240 kg</dd>
          </div>
          <div>
            <dt className="text-ink-mute">Apgar</dt>
            <dd className="font-semibold text-ink">9 / 10</dd>
          </div>
          <div>
            <dt className="text-ink-mute">Triagem neonatal</dt>
            <dd className="font-semibold text-success">Normal</dd>
          </div>
          <div>
            <dt className="text-ink-mute">Aleitamento</dt>
            <dd className="font-semibold text-ink">Exclusivo</dd>
          </div>
        </dl>
      </div>

      {/* Riscos + histórico contínuo */}
      <div className="rounded-2xl border border-line bg-paper p-lg shadow-soft lg:col-span-2">
        <div className="flex items-center gap-2">
          <Activity className="size-5 text-indigo" aria-hidden />
          <h3 className="text-lg">Histórico contínuo · gestação → hoje</h3>
        </div>

        <ul className="mt-md flex flex-col gap-2">
          {RISCOS.map((r) => (
            <li
              key={r.label}
              className={cn(
                'flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-sm',
                r.nivel === 'atencao' ? 'bg-[oklch(0.95_0.06_65)]' : 'bg-paper-2',
              )}
            >
              <span className="inline-flex items-center gap-2 font-semibold text-ink">
                {r.nivel === 'atencao' ? (
                  <AlertTriangle className="size-4 text-warn" aria-hidden />
                ) : (
                  <CheckCircle2 className="size-4 text-success" aria-hidden />
                )}
                {r.label}
              </span>
              <span className="text-ink-mute">{r.origem}</span>
            </li>
          ))}
        </ul>

        <div className="mt-md flex items-center gap-2 rounded-xl bg-paper-2 px-3 py-2.5 text-sm text-ink-soft">
          <TrendingUp className="size-4 shrink-0 text-indigo" aria-hidden />
          Curva de crescimento no percentil 60. Sem sinais de alerta na última consulta.
        </div>
      </div>

      {/* Vacinas */}
      <div className="rounded-2xl border border-line bg-paper p-lg shadow-soft lg:col-span-2">
        <h3 className="text-lg">Calendário vacinal</h3>
        <ul className="mt-md grid gap-2 sm:grid-cols-2">
          {VACINAS.map((v) => (
            <li key={v.nome} className="flex items-center gap-2 rounded-xl bg-paper-2 px-3 py-2 text-sm">
              {v.status === 'aplicada' && <CheckCircle2 className="size-4 text-success" aria-hidden />}
              {v.status === 'atual' && <Clock className="size-4 text-indigo" aria-hidden />}
              {v.status === 'pendente' && <Circle className="size-4 text-ink-mute" aria-hidden />}
              <span className="font-semibold text-ink">{v.nome}</span>
              <span className="ml-auto text-ink-mute">{v.quando}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Marcos */}
      <div className="rounded-2xl border border-line bg-paper p-lg shadow-soft lg:col-span-1">
        <h3 className="text-lg">Marcos</h3>
        <ul className="mt-md flex flex-col gap-3">
          {MARCOS.map((m) => (
            <li key={m.label} className="flex items-start gap-2 text-sm">
              {m.ok ? (
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
              ) : (
                <Circle className="mt-0.5 size-4 shrink-0 text-ink-mute" aria-hidden />
              )}
              <span>
                <span className="block font-semibold text-ink">{m.label}</span>
                <span className="block text-xs text-ink-mute">{m.faixa}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
