import { cn } from '@/lib/cn'

/** Skeleton loader — never a bare spinner. Shimmer pauses under reduced motion. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-lg bg-paper-3',
        'before:absolute before:inset-0 before:-translate-x-full',
        'before:bg-gradient-to-r before:from-transparent before:via-[var(--color-paper)] before:to-transparent',
        'before:animate-[shimmer_1.6s_infinite] motion-reduce:before:animate-none',
        className,
      )}
      aria-hidden="true"
    />
  )
}

export function TrilhaSkeleton() {
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-lg py-xl" aria-label="Carregando a trilha">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className={cn('flex items-center gap-md', i % 2 ? 'flex-row-reverse' : '')}
        >
          <Skeleton className="size-16 rounded-full" />
          <Skeleton className="h-4 w-40" />
        </div>
      ))}
    </div>
  )
}
