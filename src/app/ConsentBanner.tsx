import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useConsent } from '@/lib/stores/consent'
import { Button } from '@/components/Button'
import { cn } from '@/lib/cn'

/**
 * Non-intrusive LGPD consent. Sits at the bottom, never blocks the page. Offers
 * granular control (accept all / essentials only / choose). Reduced-motion
 * users get an instant appearance instead of the slide.
 */
export function ConsentBanner() {
  const decided = useConsent((s) => s.decided)
  const acceptAll = useConsent((s) => s.acceptAll)
  const rejectOptional = useConsent((s) => s.rejectOptional)
  const setConsent = useConsent((s) => s.setConsent)

  const [detailed, setDetailed] = useState(false)
  const [analytics, setAnalytics] = useState(false)
  const [comunicacoes, setComunicacoes] = useState(false)

  if (decided) return null

  return (
    <AnimatePresence>
      <motion.div
        role="dialog"
        aria-label="Preferências de privacidade"
        aria-live="polite"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 24 }}
        transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
        className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-2xl rounded-2xl border border-line bg-paper p-md shadow-lift sm:inset-x-auto sm:right-4 sm:bottom-4"
      >
        <p className="font-display text-lg font-semibold text-indigo">
          Cuidamos dos seus dados como cuidamos de você
        </p>
        <p className="mt-1 text-sm text-ink-soft">
          Usamos o essencial para a Prumo funcionar. O resto — só se você deixar.
          Você mantém o controle e pode mudar de ideia quando quiser em{' '}
          <Link to="/seguranca" className="font-semibold text-indigo underline">
            Segurança e privacidade
          </Link>
          .
        </p>

        {detailed && (
          <div className="mt-md flex flex-col gap-2">
            <ConsentRow
              label="Melhorar a Prumo (analytics)"
              hint="Nos ajuda a entender o que funciona, de forma anônima."
              checked={analytics}
              onChange={setAnalytics}
            />
            <ConsentRow
              label="Receber comunicações"
              hint="Lembretes gentis de próximos passos da trilha."
              checked={comunicacoes}
              onChange={setComunicacoes}
            />
          </div>
        )}

        <div className="mt-md flex flex-wrap gap-2">
          <Button size="md" onClick={acceptAll}>
            Aceitar tudo
          </Button>
          {detailed ? (
            <Button variant="secondary" onClick={() => setConsent({ analytics, comunicacoes })}>
              Salvar escolhas
            </Button>
          ) : (
            <Button variant="secondary" onClick={() => setDetailed(true)}>
              Escolher
            </Button>
          )}
          <Button variant="ghost" onClick={rejectOptional}>
            Só o essencial
          </Button>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}

interface ConsentRowProps {
  label: string
  hint: string
  checked: boolean
  onChange: (v: boolean) => void
}

function ConsentRow({ label, hint, checked, onChange }: ConsentRowProps) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg p-2 hover:bg-paper-2">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          'mt-0.5 flex h-6 w-11 shrink-0 items-center rounded-pill p-0.5 transition-colors duration-[var(--dur-fast)]',
          checked ? '[background-image:var(--grad-brand)]' : 'bg-paper-3',
        )}
      >
        <span
          className={cn(
            'size-5 rounded-full bg-white shadow-soft transition-transform duration-[var(--dur-fast)]',
            checked && 'translate-x-5',
          )}
        />
      </button>
      <span>
        <span className="block text-sm font-semibold text-ink">{label}</span>
        <span className="block text-xs text-ink-mute">{hint}</span>
      </span>
    </label>
  )
}
