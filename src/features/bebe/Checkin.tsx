import { useState } from 'react'
import { Sparkles, Flame, Check } from 'lucide-react'
import { Button } from '@/components/Button'

/**
 * O ritual da família — semanal na gestação, mensal depois do nascimento.
 *
 * Não é dado clínico: é uma anotação e a sequência que faz voltar parecer bom.
 * A mecânica do Duolingo que vale copiar não é a culpa, é o reconhecimento —
 * por isso o chip de sequência só aparece quando existe sequência, e nunca há
 * um "você perdeu 3 semanas" em lugar nenhum desta tela.
 */
export function Checkin({
  titulo,
  sequencia,
  fraseSequencia,
  jaFez,
  rotuloBotao,
  placeholder,
  onCheckin,
}: {
  titulo: string
  sequencia: number
  /** Frase inteira, não só a unidade: "1 mês seguido" x "2 meses seguidos". */
  fraseSequencia: (n: number) => string
  jaFez: boolean
  rotuloBotao: string
  placeholder: string
  onCheckin: (nota: string) => void
}) {
  const [nota, setNota] = useState('')
  const [abrindo, setAbrindo] = useState(false)

  return (
    <section className="rounded-2xl border border-line bg-paper p-lg shadow-soft">
      <div className="flex flex-wrap items-center justify-between gap-md">
        <div className="min-w-0">
          <h2 className="inline-flex items-center gap-2 text-lg">
            <Sparkles className="size-5 text-indigo" aria-hidden />
            {titulo}
          </h2>
          <p className="mt-1 text-sm text-ink-soft">
            {jaFez ? 'Feito! Anote o que quiser lembrar.' : 'Um toque para marcar que você acompanhou.'}
          </p>
        </div>

        {sequencia > 0 && (
          <span className="u-chip-warn inline-flex items-center gap-1.5 rounded-pill px-3 py-1.5 font-display text-sm font-bold">
            <Flame className="size-4" aria-hidden />
            {fraseSequencia(sequencia)}
          </span>
        )}
      </div>

      {!jaFez && !abrindo && (
        <Button className="mt-md" onClick={() => setAbrindo(true)} iconLeft={<Check className="size-4" aria-hidden />}>
          {rotuloBotao}
        </Button>
      )}

      {(abrindo || jaFez) && (
        <div className="mt-md">
          <label className="block text-sm font-semibold text-ink" htmlFor="nota-checkin">
            Como foi? (opcional)
          </label>
          <textarea
            id="nota-checkin"
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            placeholder={placeholder}
            maxLength={500}
            className="input mt-1 min-h-20 resize-y"
          />
          <Button
            className="mt-3"
            onClick={() => {
              onCheckin(nota)
              setAbrindo(false)
            }}
            iconLeft={<Check className="size-4" aria-hidden />}
          >
            {jaFez ? 'Salvar anotação' : rotuloBotao}
          </Button>
        </div>
      )}
    </section>
  )
}