import { useEffect, useState } from 'react'
import { AlertTriangle, Check, Info, ShieldAlert } from 'lucide-react'
import { api } from '@/lib/api/client'
import { useAuth } from '@/lib/stores/auth'
import { useMedicoContext, criancaQuery } from '@/lib/stores/medico-context'
import { cn } from '@/lib/cn'

export interface Alerta {
  id: string
  severidade: 'info' | 'atencao' | 'urgente'
  titulo: string
  detalhe: string
  condutaSugerida: string
  fonte: string
  origem: string
  criadoEm: string
}

const ESTILO: Record<Alerta['severidade'], { chip: string; icon: typeof Info; label: string }> = {
  info: { chip: 'bg-paper-2 text-ink-soft', icon: Info, label: 'Observação' },
  atencao: { chip: 'u-chip-warn', icon: AlertTriangle, label: 'Atenção' },
  urgente: { chip: 'u-chip-warn', icon: ShieldAlert, label: 'Avaliar logo' },
}

/**
 * Findings raised by the automatic pattern check — a measurement that fell
 * outside the expected band for the age.
 *
 * The clinician sees the number, the threshold that fired it and the suggested
 * next step; the family sees, at most, a gentle "worth mentioning next visit".
 * Which of the two you get is decided on the server, not here.
 */
export function PainelAlertas({ compacto }: { compacto?: boolean }) {
  const papel = useAuth((s) => s.user?.papel)
  const criancaAtiva = useMedicoContext((s) => s.criancaAtiva)
  const [alertas, setAlertas] = useState<Alerta[]>([])
  const [resolvendo, setResolvendo] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    let ativo = true
    setCarregando(true)
    api
      .get<{ alertas: Alerta[] }>(`/bebe${criancaQuery(criancaAtiva)}`)
      .then((d) => ativo && setAlertas(d.alertas))
      .catch(() => {})
      .finally(() => ativo && setCarregando(false))
    return () => {
      ativo = false
    }
  }, [criancaAtiva])

  async function resolver(id: string) {
    setResolvendo(id)
    try {
      await api.patch(`/bebe/alertas/${id}`)
      setAlertas((atual) => atual.filter((a) => a.id !== id))
    } catch {
      /* keep it on screen — better a stale alert than a silently lost one */
    } finally {
      setResolvendo(null)
    }
  }

  if (carregando || alertas.length === 0) return null

  const ehMedico = papel === 'medico'

  return (
    <section
      className={cn(
        'rounded-2xl border border-line bg-paper p-lg shadow-soft',
        compacto && 'p-md',
      )}
    >
      <h2 className="inline-flex items-center gap-2 text-lg">
        <AlertTriangle className="size-5 text-warn-ink" aria-hidden />
        {ehMedico ? 'Verificação de padrões' : 'Para conversar na consulta'}
      </h2>
      {ehMedico && (
        <p className="mt-1 text-sm text-ink-soft">
          Medidas fora da faixa esperada para a idade. É um convite para olhar de perto — não um
          diagnóstico.
        </p>
      )}

      <ul className="mt-md flex flex-col gap-2">
        {alertas.map((a) => {
          const estilo = ESTILO[a.severidade]
          const Icon = estilo.icon
          return (
            <li key={a.id} className="rounded-xl border border-line bg-paper-2 p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="inline-flex min-w-0 items-start gap-2 font-display font-semibold text-ink">
                  <Icon className="mt-0.5 size-4 shrink-0 text-warn-ink" aria-hidden />
                  {a.titulo}
                </p>
                <span className={cn('shrink-0 rounded-pill px-2.5 py-0.5 text-xs font-semibold', estilo.chip)}>
                  {estilo.label}
                </span>
              </div>

              {a.detalhe && <p className="mt-1 text-sm text-ink-soft">{a.detalhe}</p>}

              {ehMedico && a.condutaSugerida && (
                <p className="mt-2 text-sm text-ink-soft">
                  <strong className="text-ink">Sugestão:</strong> {a.condutaSugerida}
                </p>
              )}
              {ehMedico && a.fonte && <p className="mt-1 text-xs text-ink-mute">Fonte: {a.fonte}</p>}

              {ehMedico && (
                <button
                  type="button"
                  disabled={resolvendo === a.id}
                  onClick={() => resolver(a.id)}
                  className="mt-2 inline-flex min-h-9 items-center gap-1.5 rounded-pill border border-line px-3 text-sm font-semibold text-ink-soft hover:text-success-ink disabled:opacity-60"
                >
                  <Check className="size-4" aria-hidden />
                  Avaliado
                </button>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
