import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Flame, Sparkles } from 'lucide-react'
import { CartaoGrupo } from './CartaoGrupo'
import { FolhaDoGrupo } from './FolhaDoGrupo'
import { Confetti } from '@/features/trilha/Confetti'
import { useChecklist, proximoGrupo } from '@/lib/stores/checklist'
import type { Checklist } from '@/lib/stores/checklist'
import { useMovimento } from '@/lib/motion'
import { cn } from '@/lib/cn'

/**
 * O checklist como caminho, não como lista.
 *
 * A diferença que faz alguém voltar: existe **um** próximo passo destacado, e o
 * resto fica visível mas quieto. Uma lista de onze itens com onze caixinhas
 * iguais é uma lista de tarefas; um caminho com um item aceso na sua frente é
 * algo que dá vontade de continuar.
 *
 * Nada aqui cobra. Não há prazo vermelho, não há "você está atrasada" — o que
 * está fora da janela é marcado com uma frase neutra ("entre 24 e 28 semanas") e
 * segue esperando. Culpa não faz ninguém cuidar melhor da própria gravidez.
 */
export function TrilhaChecklist({
  checklist,
  crianca,
}: {
  checklist: Checklist
  crianca: string | null
}) {
  const { ativo, mola } = useMovimento()
  const marcarPasso = useChecklist((s) => s.marcarPasso)
  const marcarGrupo = useChecklist((s) => s.marcarGrupo)
  const comemorando = useChecklist((s) => s.comemorando)
  const limparComemoracao = useChecklist((s) => s.limparComemoracao)

  const [abertoId, setAbertoId] = useState<string | null>(null)
  const aberto = checklist.grupos.find((g) => g.id === abertoId) ?? null
  const proximo = proximoGrupo(checklist)

  // A comemoração é um instante, não um estado.
  useEffect(() => {
    if (!comemorando) return
    const t = setTimeout(limparComemoracao, 2200)
    return () => clearTimeout(t)
  }, [comemorando, limparComemoracao])

  return (
    <div className="flex flex-col gap-lg">
      <Confetti trigger={Boolean(comemorando)} />

      <Cabecalho checklist={checklist} />

      {proximo && (
        <section>
          <h2 className="u-eyebrow mb-2 flex items-center gap-1.5">
            <Sparkles className="size-3.5" aria-hidden />
            Seu próximo passo
          </h2>
          <motion.div
            layout={ativo}
            transition={mola('suave')}
            className="rounded-2xl [background-image:var(--grad-brand-soft)] p-1"
          >
            <CartaoGrupo grupo={proximo} onAbrir={() => setAbertoId(proximo.id)} />
          </motion.div>
        </section>
      )}

      <section>
        <h2 className="u-eyebrow mb-2">O caminho inteiro</h2>
        <ul className="flex flex-col gap-2">
          {checklist.grupos.map((grupo) => (
            <motion.li key={grupo.id} layout={ativo} transition={mola('suave')}>
              <CartaoGrupo grupo={grupo} onAbrir={() => setAbertoId(grupo.id)} />
            </motion.li>
          ))}
        </ul>
      </section>

      <FolhaDoGrupo
        grupo={aberto}
        aberto={Boolean(aberto)}
        onFechar={() => setAbertoId(null)}
        onMarcarPasso={(passoId, feito) => {
          if (!aberto) return
          void marcarPasso(checklist.chave, aberto.id, passoId, feito, crianca)
        }}
        onNaoSeAplica={() => {
          if (!aberto) return
          const proximoEstado = aberto.estado === 'nao-se-aplica' ? 'pendente' : 'nao-se-aplica'
          void marcarGrupo(checklist.chave, aberto.id, proximoEstado, crianca)
          setAbertoId(null)
        }}
      />
    </div>
  )
}

function Cabecalho({ checklist }: { checklist: Checklist }) {
  const { ativo, mola } = useMovimento()
  const prontos = checklist.grupos.filter(
    (g) => g.estado === 'feito' || g.estado === 'nao-se-aplica',
  ).length

  return (
    <header>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl sm:text-3xl">{checklist.titulo}</h1>

        {checklist.sequenciaDias > 1 && (
          <span
            className="inline-flex items-center gap-1.5 rounded-pill bg-[color-mix(in_oklab,var(--color-warn)_16%,transparent)] px-3 py-1 text-sm font-semibold text-warn-ink"
            title="Dias seguidos por aqui"
          >
            <Flame className="size-4" aria-hidden />
            {checklist.sequenciaDias} dias
          </span>
        )}
      </div>

      {checklist.descricao && <p className="mt-1 text-ink-soft">{checklist.descricao}</p>}

      <div className="mt-md">
        <div className="h-2.5 overflow-hidden rounded-pill bg-paper-3">
          <motion.div
            className="h-full rounded-pill [background-image:var(--grad-brand)]"
            initial={false}
            animate={{ width: `${checklist.progresso}%` }}
            transition={ativo ? mola('suave') : { duration: 0 }}
          />
        </div>
        <p className={cn('mt-1.5 text-sm text-ink-soft')}>
          {prontos} de {checklist.grupos.length} etapas
          {checklist.atribuidoPorNome ? ` · indicado por ${checklist.atribuidoPorNome}` : ''}
        </p>
      </div>
    </header>
  )
}
