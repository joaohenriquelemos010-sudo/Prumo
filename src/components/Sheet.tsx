import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { AnimatePresence, motion, useMotionValue, useTransform } from 'framer-motion'
import type { PanInfo } from 'framer-motion'
import { X } from 'lucide-react'
import { useMovimento, projetarMomento, elastico, encaixeMaisProximo } from '@/lib/motion'

interface SheetProps {
  aberto: boolean
  onFechar: () => void
  titulo: string
  children: ReactNode
  /**
   * Alturas de repouso como fração da viewport, da menor para a maior. Com mais
   * de uma, a folha encaixa entre elas em vez de só abrir e fechar.
   */
  alturas?: number[]
  /** Some com o cabeçalho quando o conteúdo já se explica. */
  semCabecalho?: boolean
}

const FOCAVEIS =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/** Fração da altura além da qual a folha se despede em vez de voltar. */
const LIMIAR_DISPENSA = 0.4

/**
 * A folha do Prumo — a superfície que sobe por cima da página.
 *
 * Generaliza a `BottomSheet` original em três direções que importam:
 *
 * 1. **Existe no desktop.** A anterior era `md:hidden`, o que significa que
 *    telas grandes não tinham diálogo nenhum. Aqui vira um diálogo centrado.
 * 2. **Segue o dedo 1:1**, com rubber-band além da borda superior em vez de
 *    parada dura, e o véu escurecendo em proporção ao arraste.
 * 3. **Decide pela velocidade, não pela distância.** Um flick rápido dispensa a
 *    partir de 10px; um arraste lento e longo volta. É o gesto que diz a
 *    intenção, não o deslocamento.
 *
 * O focus trap, o scroll lock, o Escape e a restauração de foco vêm verbatim da
 * versão anterior — aquele código estava certo e não havia motivo para reescrevê-lo.
 */
export function Sheet({
  aberto,
  onFechar,
  titulo,
  children,
  alturas = [0.92],
  semCabecalho = false,
}: SheetProps) {
  const painelRef = useRef<HTMLDivElement>(null)
  const origemFoco = useRef<HTMLElement | null>(null)
  const { ativo, mola, duracao } = useMovimento()

  const y = useMotionValue(0)
  const [altura, setAltura] = useState(0)

  /**
   * O véu acompanha o dedo. Sem isto o fundo fica na mesma opacidade enquanto a
   * folha desce, e a superfície parece descolada do ambiente.
   */
  const opacidadeVeu = useTransform(y, [0, Math.max(altura, 1)], [1, 0], { clamp: true })

  useEffect(() => {
    if (!aberto) return

    origemFoco.current = document.activeElement as HTMLElement | null
    const overflowAnterior = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const primeiro = painelRef.current?.querySelector<HTMLElement>(FOCAVEIS)
    ;(primeiro ?? painelRef.current)?.focus()

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        onFechar()
        return
      }
      if (e.key !== 'Tab') return
      const alvos = painelRef.current?.querySelectorAll<HTMLElement>(FOCAVEIS)
      if (!alvos || alvos.length === 0) return
      const primeiroAlvo = alvos[0]
      const ultimoAlvo = alvos[alvos.length - 1]
      if (e.shiftKey && document.activeElement === primeiroAlvo) {
        e.preventDefault()
        ultimoAlvo.focus()
      } else if (!e.shiftKey && document.activeElement === ultimoAlvo) {
        e.preventDefault()
        primeiroAlvo.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = overflowAnterior
      origemFoco.current?.focus()
    }
  }, [aberto, onFechar])

  // Reabrir tem que começar do zero, senão a folha nasce onde a anterior morreu.
  useEffect(() => {
    if (aberto) y.set(0)
  }, [aberto, y])

  /**
   * A altura real da folha alimenta o rubber-band, o véu e os encaixes. Medida
   * por observação e não uma vez só: o conteúdo cresce (um textarea, uma lista
   * que carregou) e uma altura congelada faria o gesto mentir.
   */
  useEffect(() => {
    const painel = painelRef.current
    if (!aberto || !painel || typeof ResizeObserver === 'undefined') return
    const obs = new ResizeObserver(([entrada]) => {
      const h = entrada?.contentRect.height ?? 0
      if (h) setAltura(h)
    })
    obs.observe(painel)
    return () => obs.disconnect()
  }, [aberto])

  /**
   * Tracking 1:1 abaixo da borda; resistência crescente acima dela. `dragElastic`
   * fica em 0 justamente para que a elasticidade seja **esta**, e não a curva
   * padrão do framer — que não é a do iOS.
   */
  function aoArrastar(_: unknown, info: PanInfo) {
    if (info.offset.y >= 0) return
    y.set(-elastico(-info.offset.y, altura || window.innerHeight))
  }

  function aoSoltar(_: unknown, info: PanInfo) {
    /**
     * A decisão sai da **velocidade projetada**, não da distância no ponto em que
     * o dedo soltou: um flick rápido dispensa a partir de 10px, um arraste lento
     * e longo volta. É o gesto que diz a intenção.
     */
    const projetado = y.get() + projetarMomento(info.velocity.y)

    if (projetado >= altura * LIMIAR_DISPENSA) {
      onFechar()
      return
    }

    /**
     * Encaixa no detent mais próximo do ponto projetado. Um detent na fração `f`
     * da viewport quer o topo do painel em `(1−f)·vh`, o que em deslocamento a
     * partir do repouso dá `altura − f·vh`.
     */
    const vh = window.innerHeight
    const pontos = alturas.map((f) => Math.max(0, altura - f * vh))
    y.set(encaixeMaisProximo(projetado, pontos))
  }

  const fracaoMaior = alturas[alturas.length - 1] ?? 0.92

  return (
    <AnimatePresence>
      {aberto && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end sm:items-center sm:justify-center">
          <motion.button
            type="button"
            aria-label="Fechar"
            onClick={onFechar}
            className="absolute inset-0 bg-[color-mix(in_oklab,var(--color-ink)_45%,transparent)] backdrop-blur-[2px]"
            style={{ opacity: ativo ? opacidadeVeu : 1 }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={duracao(0.18)}
          />

          <motion.div
            ref={painelRef}
            role="dialog"
            aria-modal="true"
            aria-label={titulo}
            tabIndex={-1}
            className="relative flex w-full flex-col overflow-hidden rounded-t-2xl border-t border-line bg-paper px-md pt-md shadow-lift [padding-bottom:calc(var(--space-md)+env(safe-area-inset-bottom))] sm:max-w-lg sm:rounded-2xl sm:border"
            style={{ y, maxHeight: `${fracaoMaior * 100}dvh` }}
            initial={ativo ? { y: '100%' } : { opacity: 0 }}
            animate={ativo ? { y: 0 } : { opacity: 1 }}
            exit={ativo ? { y: '100%' } : { opacity: 0 }}
            transition={mola('folha')}
            /**
             * Arrastar nunca é bloqueado por uma animação em curso: agarrar uma
             * folha que está fechando tem que pegá-la no meio do voo. É por isso
             * que não existe nenhum `isAnimating` neste componente.
             */
            drag={ativo ? 'y' : false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={0}
            dragMomentum={false}
            onDrag={aoArrastar}
            onDragEnd={aoSoltar}
          >
            {/* Alça — diz "isto puxa" sem uma palavra de texto. */}
            <span
              aria-hidden
              className="mx-auto mb-md block h-1 w-10 shrink-0 rounded-pill bg-paper-3 sm:hidden"
            />

            {!semCabecalho && (
              <div className="mb-sm flex shrink-0 items-center justify-between gap-md">
                <h2 className="font-display text-lg font-semibold tracking-title text-ink">{titulo}</h2>
                <button
                  type="button"
                  onClick={onFechar}
                  aria-label="Fechar"
                  className="grid size-11 shrink-0 place-items-center rounded-pill text-ink-soft hover:bg-paper-2"
                >
                  <X className="size-5" aria-hidden />
                </button>
              </div>
            )}

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
