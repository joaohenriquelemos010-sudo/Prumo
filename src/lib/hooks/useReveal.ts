import { useEffect, useRef, useState } from 'react'

/**
 * On-scroll reveal. Returns a ref + a boolean; pair with the `.u-reveal` class
 * and `data-shown`. Respects reduced motion by revealing immediately.
 */
export function useReveal<T extends HTMLElement = HTMLDivElement>(
  options: IntersectionObserverInit = { threshold: 0.15, rootMargin: '0px 0px -8% 0px' },
) {
  const ref = useRef<T>(null)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    const node = ref.current
    if (!node) return

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) {
      setShown(true)
      return
    }

    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          setShown(true)
          observer.disconnect()
        }
      }
    }, options)

    observer.observe(node)
    return () => observer.disconnect()
  }, [options])

  return { ref, shown }
}
