import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { Check, Clock, AlertTriangle, Circle, Syringe } from 'lucide-react'
import { api } from '@/lib/api/client'

const BaixarVacinacao = lazy(() =>
  import('@/features/pdf/documents').then((m) => ({ default: m.BaixarVacinacao })),
)
import { usePerfil } from '@/lib/stores/perfil'
import { DadosCrianca } from '@/features/clinico/DadosCrianca'
import {
  VACINAS_GESTANTE,
  REFERENCIA_PNI,
  NOTA_CAMPANHAS,
} from '@/features/clinico/sus-vacinas'
import { calcularDosesVacinas, formatarData } from '@/features/clinico/schedule'
import type { DoseAgendada, DoseStatus } from '@/features/clinico/schedule'
import { Skeleton } from '@/components/Skeleton'
import { cn } from '@/lib/cn'

const STATUS_META: Record<DoseStatus, { label: string; className: string; icon: typeof Check }> = {
  aplicada: { label: 'Aplicada', className: 'text-success', icon: Check },
  atrasada: { label: 'Em atraso', className: 'text-warn', icon: AlertTriangle },
  proxima: { label: 'Em breve', className: 'text-indigo', icon: Clock },
  futura: { label: 'Futura', className: 'text-ink-mute', icon: Circle },
}

export default function AppVacinas() {
  const perfil = usePerfil((s) => s.perfil)
  const [aplicadas, setAplicadas] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    api
      .get<{ vacinasAplicadas: string[] }>('/vacinas')
      .then((d) => active && setAplicadas(d.vacinasAplicadas))
      .catch(() => {})
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [])

  const dataNascimentoIso = perfil?.dataNascimento ?? null
  const dob = dataNascimentoIso ? new Date(dataNascimentoIso) : null
  const isGestante = perfil?.momento === 'gestante' || perfil?.momento === 'planejando'

  const doses = useMemo(
    () => (dataNascimentoIso ? calcularDosesVacinas(new Date(dataNascimentoIso), aplicadas) : []),
    [dataNascimentoIso, aplicadas],
  )

  // Group child doses by age label, preserving order.
  const grupos = useMemo(() => {
    const map = new Map<string, DoseAgendada[]>()
    for (const d of doses) {
      const arr = map.get(d.vacina.idadeLabel) ?? []
      arr.push(d)
      map.set(d.vacina.idadeLabel, arr)
    }
    return [...map.entries()]
  }, [doses])

  async function toggle(vacinaId: string, aplicada: boolean) {
    // Optimistic
    setAplicadas((prev) => (aplicada ? [...new Set([...prev, vacinaId])] : prev.filter((v) => v !== vacinaId)))
    try {
      await api.post('/vacinas', { vacinaId, aplicada })
    } catch {
      // revert on failure
      setAplicadas((prev) => (aplicada ? prev.filter((v) => v !== vacinaId) : [...prev, vacinaId]))
    }
  }

  return (
    <div className="flex flex-col gap-lg">
      <header className="flex flex-col gap-1">
        <p className="u-eyebrow">Carteira de vacinas</p>
        <h1 className="text-3xl sm:text-4xl">Vacinas em dia, no ritmo do SUS</h1>
        <p className="text-ink-soft">
          Seguindo o Calendário Nacional de Vacinação. Marque o que já foi aplicado —
          a Prumo cuida de mostrar o que vem a seguir.
        </p>
      </header>

      <DadosCrianca />

      {loading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      ) : isGestante ? (
        <GestanteVacinas />
      ) : dob ? (
        <div className="flex flex-col gap-lg">
          {grupos.map(([idade, lista]) => (
            <section key={idade}>
              <h2 className="mb-2 font-display text-sm font-semibold text-indigo">{idade}</h2>
              <ul className="flex flex-col gap-2">
                {lista.map((d) => (
                  <DoseRow key={d.vacina.id} dose={d} onToggle={toggle} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : (
        <p className="rounded-xl bg-paper-2 p-md text-sm text-ink-soft">
          Assim que você informar a data de nascimento acima, a carteira de vacinas
          aparece aqui, personalizada.
        </p>
      )}

      {dob && doses.length > 0 && (
        <Suspense fallback={null}>
          <BaixarVacinacao
            nome={perfil?.nome}
            doses={doses.map((d) => ({
              id: d.vacina.id,
              nome: d.vacina.nome,
              dose: d.vacina.dose,
              idadeLabel: d.vacina.idadeLabel,
              data: d.data.toISOString(),
              status: d.status,
            }))}
          />
        </Suspense>
      )}

      <Referencia />
    </div>
  )
}

function DoseRow({ dose, onToggle }: { dose: DoseAgendada; onToggle: (id: string, aplicada: boolean) => void }) {
  const meta = STATUS_META[dose.status]
  const Icon = meta.icon
  const aplicada = dose.status === 'aplicada'

  return (
    <li className="flex items-center gap-3 rounded-xl border border-line bg-paper p-3 shadow-soft">
      <button
        type="button"
        role="checkbox"
        aria-checked={aplicada}
        aria-label={`Marcar ${dose.vacina.nome} ${dose.vacina.dose} como aplicada`}
        onClick={() => onToggle(dose.vacina.id, !aplicada)}
        className={cn(
          'grid size-8 shrink-0 place-items-center rounded-full border-2 transition-colors duration-[var(--dur-fast)]',
          aplicada ? 'border-transparent [background-image:var(--grad-brand)] text-white' : 'border-line text-transparent hover:border-[var(--color-lilas)]',
        )}
      >
        <Check className="size-4" aria-hidden />
      </button>

      <div className="min-w-0 flex-1">
        <p className="truncate font-display font-semibold text-ink">
          {dose.vacina.nome} <span className="text-ink-mute">· {dose.vacina.dose}</span>
        </p>
        <p className="truncate text-xs text-ink-mute">{dose.vacina.protege}</p>
      </div>

      <div className={cn('flex shrink-0 flex-col items-end text-xs font-semibold', meta.className)}>
        <span className="inline-flex items-center gap-1">
          <Icon className="size-3.5" aria-hidden />
          {meta.label}
        </span>
        <span className="text-ink-mute">{formatarData(dose.data)}</span>
      </div>
    </li>
  )
}

function GestanteVacinas() {
  return (
    <section>
      <h2 className="mb-2 font-display text-sm font-semibold text-indigo">Vacinas na gestação</h2>
      <ul className="flex flex-col gap-2">
        {VACINAS_GESTANTE.map((v) => (
          <li key={v.id} className="flex items-start gap-3 rounded-xl border border-line bg-paper p-3 shadow-soft">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl [background-image:var(--grad-brand-soft)] text-indigo">
              <Syringe className="size-4" aria-hidden />
            </span>
            <div>
              <p className="font-display font-semibold text-ink">{v.nome}</p>
              <p className="text-sm text-ink-soft">{v.protege}</p>
              <p className="mt-0.5 text-xs text-ink-mute">{v.quando}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

function Referencia() {
  return (
    <div className="rounded-xl bg-paper-2 p-md text-xs text-ink-mute">
      <p>{NOTA_CAMPANHAS}</p>
      <p className="mt-1">Fonte: {REFERENCIA_PNI} Conteúdo informativo — não substitui a orientação da sua equipe de saúde.</p>
    </div>
  )
}
