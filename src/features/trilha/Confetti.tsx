import { useEffect, useMemo, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

/**
 * Uma comemoração curta e elegante — um punhado de cacos, não um canhão infantil.
 *
 * ## Por que não é mais um `@keyframes`
 *
 * Era. E o problema não era a duração: era que todo caco descrevia **a mesma
 * trajetória**, deslocada no tempo. Catorze objetos caindo em paralelo perfeito
 * leem como uma animação; catorze objetos com velocidades, derivas e rotações
 * diferentes leem como coisas caindo.
 *
 * Cada caco agora tem física própria: a queda acelera, a deriva horizontal
 * desacelera, o giro é constante — e é a soma dos três que faz a trajetória
 * parecer uma trajetória. O desvanecer começa depois de a queda pegar ritmo:
 * sumir logo no topo faria parecer que nunca chegaram.
 */
interface Caco {
  id: number
  esquerda: number
  atraso: number
  duracao: number
  tamanho: number
  cor: string
  /** Deriva horizontal em vw. Sinal aleatório: metade vai para cada lado. */
  deriva: number
  giro: number
}

function sortearCacos(): Caco[] {
  return Array.from({ length: 14 }, (_, i) => ({
    id: i,
    esquerda: 10 + Math.random() * 80,
    atraso: Math.random() * 0.25,
    // A faixa larga é o ponto: sem ela, todos chegam ao chão juntos.
    duracao: 1.1 + Math.random() * 0.9,
    tamanho: 6 + Math.random() * 6,
    cor: i % 2 === 0 ? 'var(--color-lilas)' : 'var(--color-azul)',
    deriva: (Math.random() - 0.5) * 24,
    giro: (Math.random() < 0.5 ? -1 : 1) * (240 + Math.random() * 420),
  }))
}

export function Confetti({ trigger }: { trigger: boolean }) {
  const [ativo, setAtivo] = useState(false)
  const [cacos, setCacos] = useState<Caco[]>([])
  const reduzido = useReducedMotion()

  useEffect(() => {
    if (!trigger || reduzido) return
    // Sorteia a cada disparo. A mesma comemoração duas vezes seguidas, com os
    // mesmos cacos nas mesmas posições, é quando a pessoa percebe o truque.
    setCacos(sortearCacos())
    setAtivo(true)
    const t = setTimeout(() => setAtivo(false), 2100)
    return () => clearTimeout(t)
  }, [trigger, reduzido])

  const conteudo = useMemo(
    () =>
      cacos.map((c) => (
        <motion.span
          key={c.id}
          initial={{ y: '-10vh', x: 0, rotate: 0, opacity: 1 }}
          animate={{ y: '115vh', x: `${c.deriva}vw`, rotate: c.giro, opacity: 0 }}
          transition={{
            duration: c.duracao,
            delay: c.atraso,
            y: { ease: [0.55, 0, 1, 0.45] },
            x: { ease: [0, 0.55, 0.45, 1] },
            rotate: { ease: 'linear' },
            opacity: { duration: c.duracao * 0.35, delay: c.atraso + c.duracao * 0.65 },
          }}
          style={{
            position: 'absolute',
            left: `${c.esquerda}%`,
            top: 0,
            width: c.tamanho,
            height: c.tamanho,
            borderRadius: 3,
            background: c.cor,
          }}
        />
      )),
    [cacos],
  )

  if (!ativo) return null

  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden" aria-hidden="true">
      {conteudo}
    </div>
  )
}
