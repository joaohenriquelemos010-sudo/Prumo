import { Link } from 'react-router-dom'
import { HeartPulse, Stethoscope } from 'lucide-react'
import {
  PASSOS_PRECONCEPCIONAIS,
  REFERENCIA_PRECONCEPCIONAL,
} from '@/features/clinico/diretrizes-preconcepcional'
import { cn } from '@/lib/cn'

/**
 * Antes da gestação não há nada para medir — mas há muito o que fazer, e boa
 * parte do que mais protege a gravidez só funciona se acontecer agora. Esta
 * fase existe para que a tela não fique em branco justamente quando o conteúdo
 * é mais acionável.
 */
/**
 * Before the pregnancy there is nothing to measure — but there is plenty to do,
 * and most of what reduces risk only works if it happens now. This surfaces the
 * pre-conception guidance instead of leaving the page blank.
 */
export function FasePlanejando({ ehMedico }: { ehMedico: boolean }) {
  return (
    <>
      <section className="rounded-2xl border border-line bg-paper p-lg shadow-soft">
        <div className="grid place-items-center py-md text-center">
          <span className="grid size-16 place-items-center rounded-full [background-image:var(--grad-brand-soft)] text-indigo">
            <HeartPulse className="size-7" aria-hidden />
          </span>
          <p className="mt-md max-w-prose text-ink-soft">
            {ehMedico
              ? 'Jornada em planejamento — sem gestação em curso. Abaixo, o roteiro pré-concepcional.'
              : 'Ainda não há um bebê para medir, mas já há muito o que preparar. Boa parte do que mais protege a gestação só funciona se acontecer antes dela.'}
          </p>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        {PASSOS_PRECONCEPCIONAIS.map((passo, i) => (
          <article key={passo.id} className="rounded-2xl border border-line bg-paper p-lg shadow-soft">
            <div className="flex items-start gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-full [background-image:var(--grad-brand-soft)] font-display font-bold text-indigo">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg">{passo.titulo}</h2>
                  <span
                    className={cn(
                      'rounded-pill px-2.5 py-0.5 text-xs font-semibold',
                      passo.responsavel === 'equipe' ? 'u-chip-brand' : 'bg-paper-2 text-ink-soft',
                    )}
                  >
                    {passo.responsavel === 'equipe' ? 'com a equipe' : 'com você'}
                  </span>
                </div>
                <p className="mt-1 text-sm text-ink-soft">{passo.porque}</p>
                <ul className="mt-md flex flex-col gap-1.5">
                  {passo.comoFazer.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm">
                      <span
                        className="mt-1.5 size-1.5 shrink-0 rounded-full [background-image:var(--grad-brand)]"
                        aria-hidden
                      />
                      <span className="text-ink-soft">{item}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-md text-xs font-semibold text-indigo">{passo.quando}</p>
              </div>
            </div>
          </article>
        ))}
      </section>

      {!ehMedico && (
        <Link
          to="/app/profissionais?objetivo=pre-concepcional"
          className="inline-flex min-h-11 items-center gap-2 self-start rounded-pill px-5 font-display text-sm font-semibold text-white shadow-soft [background-image:var(--grad-brand)]"
        >
          <Stethoscope className="size-4" aria-hidden />
          Marcar consulta pré-concepcional
        </Link>
      )}

      <p className="rounded-xl bg-paper-2 p-md text-xs text-ink-mute">
        Fonte: {REFERENCIA_PRECONCEPCIONAL} Conteúdo informativo — a conduta é sempre da equipe que
        acompanha você.
      </p>
    </>
  )
}

/* -------------------------------- shared --------------------------------- */