import { useEffect, useRef, useState } from 'react'

/**
 * Diz se há conteúdo passando por baixo de um chrome flutuante.
 *
 * Em vez de uma borda de 1px permanente sob um cabeçalho grudento, o certo é
 * revelar material e fio **só** quando o conteúdo de fato passa por baixo — a
 * separação aparece quando é necessária e some quando não é.
 *
 * Uso: renderize `<span ref={sentinela} />` como o primeiro filho da região
 * rolável e aplique o material quando `rolado` for true.
 *
 * @example
 * const { sentinela, rolado } = useBordaDeRolagem()
 * <header data-rolado={rolado}>…</header>
 * <span ref={sentinela} aria-hidden className="block h-px" />
 */
export function useBordaDeRolagem<T extends HTMLElement = HTMLSpanElement>() {
  const sentinela = useRef<T>(null)
  const [rolado, setRolado] = useState(false)

  useEffect(() => {
    const alvo = sentinela.current
    if (!alvo || typeof IntersectionObserver === 'undefined') return

    // A sentinela some de vista assim que a página rola: fora de vista = rolado.
    const obs = new IntersectionObserver(([entrada]) => setRolado(!entrada?.isIntersecting), {
      threshold: 0,
    })
    obs.observe(alvo)
    return () => obs.disconnect()
  }, [])

  return { sentinela, rolado }
}
