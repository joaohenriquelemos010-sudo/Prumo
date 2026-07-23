import { useEffect, useMemo, useState } from 'react'

/**
 * Subtle, elegant celebration — a short burst of small gradient shards, not a
 * childish confetti cannon. Auto-clears, and does nothing under reduced motion.
 */
export function Confetti({ trigger }: { trigger: boolean }) {
  const [active, setActive] = useState(false)

  useEffect(() => {
    if (!trigger) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) return
    setActive(true)
    const t = setTimeout(() => setActive(false), 1800)
    return () => clearTimeout(t)
  }, [trigger])

  const shards = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => ({
        id: i,
        left: 10 + Math.random() * 80,
        delay: Math.random() * 0.25,
        duration: 1.1 + Math.random() * 0.7,
        size: 6 + Math.random() * 6,
        hue: i % 2 === 0 ? 'var(--color-lilas)' : 'var(--color-azul)',
      })),
    [],
  )

  if (!active) return null

  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden" aria-hidden="true">
      {shards.map((s) => (
        <span
          key={s.id}
          style={{
            position: 'absolute',
            left: `${s.left}%`,
            top: '-5%',
            width: s.size,
            height: s.size,
            borderRadius: 3,
            background: s.hue,
            animation: `confetti-fall ${s.duration}s ${s.delay}s var(--ease-in) forwards`,
          }}
        />
      ))}
    </div>
  )
}
