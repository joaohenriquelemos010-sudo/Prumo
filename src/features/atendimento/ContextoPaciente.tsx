import { AlertTriangle, Droplet, HeartPulse, MessageCircleQuestion, ShieldAlert } from 'lucide-react'
import type { AlertaAberto, Consulta, PacienteDoAtendimento, ProntuarioResumo } from './tipos'
import { idadeGestacional } from '@/features/clinico/schedule'
import { cn } from '@/lib/cn'

const COR_SEVERIDADE = {
  urgente: 'border-warn bg-[color-mix(in_oklab,var(--color-warn)_14%,transparent)] text-warn-ink',
  atencao: 'border-warn bg-[color-mix(in_oklab,var(--color-warn)_9%,transparent)] text-warn-ink',
  info: 'border-line bg-paper-2 text-ink-soft',
} as const

function idadeEmMeses(nascimento: string): number {
  const n = new Date(nascimento)
  const hoje = new Date()
  return Math.max(
    0,
    (hoje.getFullYear() - n.getFullYear()) * 12 + (hoje.getMonth() - n.getMonth()),
  )
}

/**
 * A coluna que a médica olha primeiro — e que ela não deveria precisar procurar.
 *
 * A ordem não é estética: alergia antes de qualquer outra coisa, depois alertas
 * abertos, depois tendência, depois as dúvidas que a família deixou. É a ordem
 * do que muda uma conduta.
 */
export function ContextoPaciente({
  paciente,
  prontuario,
  alertas,
  duvidas,
  anteriores,
}: {
  paciente: PacienteDoAtendimento
  prontuario: ProntuarioResumo | null
  alertas: AlertaAberto[]
  duvidas: { id: string; texto: string }[]
  anteriores: Consulta[]
}) {
  const ig = paciente.dpp ? idadeGestacional(new Date(paciente.dpp)) : null
  const meses = paciente.dataNascimento ? idadeEmMeses(paciente.dataNascimento) : null
  const alergias = prontuario?.alergias?.trim()

  return (
    <div className="flex flex-col gap-md">
      <header>
        <h2 className="font-display text-xl font-semibold tracking-title text-ink">
          {paciente.nome || 'Paciente'}
        </h2>
        <p className="text-sm text-ink-soft">
          {ig
            ? `${ig.semanas}s${ig.dias}d de gestação`
            : meses !== null
              ? `${meses} ${meses === 1 ? 'mês' : 'meses'} de vida`
              : 'Planejando'}
        </p>
      </header>

      {/* Alergia é a única coisa aqui que pode matar alguém se passar batido. */}
      {alergias ? (
        <div className="flex items-start gap-2 rounded-xl border border-warn bg-[color-mix(in_oklab,var(--color-warn)_14%,transparent)] p-3">
          <ShieldAlert className="mt-0.5 size-4 shrink-0 text-warn-ink" aria-hidden />
          <div className="min-w-0">
            <p className="font-display text-xs font-semibold uppercase tracking-caption text-warn-ink">
              Alergias
            </p>
            <p className="text-sm text-ink">{alergias}</p>
          </div>
        </div>
      ) : null}

      <dl className="grid grid-cols-2 gap-2 text-sm">
        {prontuario?.tipoSanguineo ? (
          <div className="rounded-xl bg-paper-2 p-2.5">
            <dt className="flex items-center gap-1 text-xs text-ink-mute">
              <Droplet className="size-3" aria-hidden />
              Sangue
            </dt>
            <dd className="font-display font-semibold text-ink">{prontuario.tipoSanguineo}</dd>
          </div>
        ) : null}
        {(prontuario?.condicoes?.length ?? 0) > 0 ? (
          <div className="col-span-2 rounded-xl bg-paper-2 p-2.5">
            <dt className="text-xs text-ink-mute">Condições</dt>
            <dd className="text-ink">{prontuario!.condicoes!.join(' · ')}</dd>
          </div>
        ) : null}
      </dl>

      {alertas.length > 0 && (
        <section>
          <h3 className="u-eyebrow mb-2 flex items-center gap-1.5">
            <AlertTriangle className="size-3.5" aria-hidden />
            Alertas abertos
          </h3>
          <ul className="flex flex-col gap-2">
            {alertas.map((a) => (
              <li key={a.id} className={cn('rounded-xl border p-2.5 text-sm', COR_SEVERIDADE[a.severidade])}>
                <p className="font-display font-semibold">{a.titulo}</p>
                {a.detalhe && <p className="mt-0.5 text-xs opacity-90">{a.detalhe}</p>}
                {a.condutaSugerida && (
                  <p className="mt-1 text-xs italic opacity-80">{a.condutaSugerida}</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {anteriores.length > 0 && (
        <section>
          <h3 className="u-eyebrow mb-2 flex items-center gap-1.5">
            <HeartPulse className="size-3.5" aria-hidden />
            Últimas medidas
          </h3>
          <ul className="flex flex-col gap-1.5">
            {anteriores.map((c) => (
              <li key={c.id} className="flex items-baseline justify-between gap-2 text-sm">
                <span className="text-ink-mute">
                  {new Date(c.data).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                </span>
                <span className="text-right text-ink">{resumoMedidas(c) || '—'}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {duvidas.length > 0 && (
        <section>
          <h3 className="u-eyebrow mb-2 flex items-center gap-1.5">
            <MessageCircleQuestion className="size-3.5" aria-hidden />
            Ela perguntou
          </h3>
          <ul className="flex flex-col gap-1.5">
            {duvidas.map((d) => (
              <li key={d.id} className="rounded-xl bg-paper-2 p-2.5 text-sm text-ink-soft">
                “{d.texto}”
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

function resumoMedidas(c: Consulta): string {
  const m = c.medidas ?? {}
  return [
    m.pesoKg && `${m.pesoKg} kg`,
    m.alturaUterinaCm && `AU ${m.alturaUterinaCm}`,
    m.bcfBpm && `BCF ${m.bcfBpm}`,
    m.paSistolica && m.paDiastolica && `PA ${m.paSistolica}/${m.paDiastolica}`,
    m.comprimentoCm && `${m.comprimentoCm} cm`,
    m.perimetroCefalicoCm && `PC ${m.perimetroCefalicoCm}`,
  ]
    .filter(Boolean)
    .join(' · ')
}
