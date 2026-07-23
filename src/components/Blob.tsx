import { cn } from '@/lib/cn'

/**
 * Pure-SVG organic blob. Enrichment Tier A — no images, no library. Carries the
 * narrative gradient as an ambient background shape. Purely decorative, so it is
 * hidden from assistive tech and paused under reduced motion via CSS.
 */
interface BlobProps {
  className?: string
  /** 0–1 opacity of the fill. */
  intensity?: number
  variant?: 'a' | 'b' | 'c'
}

const PATHS: Record<NonNullable<BlobProps['variant']>, string> = {
  a: 'M46.5,-63.4C59.2,-54.3,67.4,-39.3,71.6,-23.4C75.8,-7.4,76,9.5,70.2,24.1C64.4,38.7,52.6,51,38.7,59.6C24.8,68.2,8.8,73.1,-7.7,73.3C-24.2,73.5,-41.2,69,-53.9,58.6C-66.6,48.2,-75,31.9,-77.6,14.7C-80.2,-2.6,-77,-20.8,-68.3,-35.6C-59.6,-50.4,-45.4,-61.8,-30.6,-70C-15.8,-78.2,-0.4,-83.2,13.7,-79.4C27.8,-75.6,33.8,-72.5,46.5,-63.4Z',
  b: 'M39.9,-56.4C50.5,-48.9,57.3,-36,62.6,-22.1C67.9,-8.2,71.6,6.7,68.4,20.2C65.2,33.7,55,45.8,42.4,54.9C29.8,64,14.9,70.1,-0.8,71.2C-16.5,72.3,-33,68.4,-45.9,59C-58.8,49.6,-68.1,34.7,-71.6,18.6C-75.1,2.5,-72.8,-14.8,-64.9,-28.6C-57,-42.4,-43.5,-52.7,-29.7,-59.6C-15.9,-66.5,-1.8,-70,10.6,-67.5C23,-65,45,-56.6,39.9,-56.4Z',
  c: 'M43.3,-58.9C55.4,-50.3,63.5,-36.5,67.9,-21.5C72.3,-6.5,73,9.7,67.4,23.3C61.8,36.9,49.9,47.9,36.6,56.4C23.3,64.9,8.6,70.9,-6.9,71.8C-22.4,72.7,-38.7,68.5,-51.3,58.9C-63.9,49.3,-72.8,34.3,-75.7,18.3C-78.6,2.3,-75.5,-14.7,-67.3,-28.5C-59.1,-42.3,-45.8,-52.9,-32,-60.6C-18.2,-68.3,-3.9,-73.1,9.6,-70.7C23.1,-68.3,31.2,-67.5,43.3,-58.9Z',
}

export function Blob({ className, intensity = 0.5, variant = 'a' }: BlobProps) {
  return (
    <svg
      viewBox="-100 -100 200 200"
      className={cn('pointer-events-none absolute -z-10 blur-2xl', className)}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={`blob-${variant}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--color-lilas)" />
          <stop offset="100%" stopColor="var(--color-azul)" />
        </linearGradient>
      </defs>
      <path d={PATHS[variant]} fill={`url(#blob-${variant})`} opacity={intensity} />
    </svg>
  )
}
