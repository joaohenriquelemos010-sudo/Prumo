import { useTrilha } from '@/lib/stores/trilha'

/** Progress summary above the path — warm, not a bare percentage. */
export function ProgressHeader() {
  const progress = useTrilha((s) => s.progress())
  const nodes = useTrilha((s) => s.nodes)
  const done = nodes.filter((n) => n.status === 'concluido').length
  const atual = nodes.find((n) => n.status === 'atual')

  return (
    <div className="mx-auto max-w-xl rounded-2xl border border-line bg-paper p-md shadow-soft sm:p-lg">
      <div className="flex items-end justify-between gap-md">
        <div>
          <p className="font-display text-sm font-semibold text-indigo">Seu caminho até aqui</p>
          <p className="text-2xl font-display font-bold text-ink">
            {done} de {nodes.length} etapas
          </p>
        </div>
        <span className="u-gradient-text font-display text-3xl font-extrabold">{progress}%</span>
      </div>

      <div className="mt-3 h-2.5 overflow-hidden rounded-pill bg-paper-3" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="Progresso da trilha">
        <div
          className="h-full rounded-pill [background-image:var(--grad-brand)] transition-[width] duration-[var(--dur-slow)] ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {atual && (
        <p className="mt-3 text-sm text-ink-soft">
          Próximo passo: <span className="font-semibold text-ink">{atual.titulo}</span>. É só tocar no
          nó que está pulsando.
        </p>
      )}
    </div>
  )
}
