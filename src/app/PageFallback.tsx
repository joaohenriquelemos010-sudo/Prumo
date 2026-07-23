import { Skeleton } from '@/components/Skeleton'

/** Route-level loading skeleton for lazy pages. Never a bare spinner. */
export function PageFallback() {
  return (
    <div className="u-shell flex flex-col gap-lg py-3xl" aria-label="Carregando" aria-busy="true">
      <Skeleton className="h-6 w-32" />
      <Skeleton className="h-14 w-3/4" />
      <Skeleton className="h-5 w-2/3" />
      <div className="mt-md grid gap-md sm:grid-cols-3">
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
      </div>
    </div>
  )
}
