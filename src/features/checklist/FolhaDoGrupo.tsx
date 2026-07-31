import { motion } from 'framer-motion'
import { Check, Info, Lightbulb } from 'lucide-react'
import { Sheet } from '@/components/Sheet'
import { Button } from '@/components/Button'
import { useMovimento } from '@/lib/motion'
import type { GrupoChecklist } from '@/lib/stores/checklist'
import { cn } from '@/lib/cn'

/**
 * O nível 2 — como fazer.
 *
 * Abre numa folha, e não numa página nova. É a diferença entre "abriu o item" e
 * "navegou para outro lugar": a gestante continua onde estava, arrasta para
 * baixo e volta. Uma página exigiria voltar, e voltar sempre custa uma decisão.
 *
 * A explicação em linguagem leiga fica **sempre visível no topo**, nunca atrás
 * de um "saiba mais". Se ela precisasse de um toque extra, metade das pessoas
 * marcaria os itens sem entender o que está marcando — que é exatamente o
 * checklist que não queremos.
 */
export function FolhaDoGrupo({
  grupo,
  aberto,
  onFechar,
  onMarcarPasso,
  onNaoSeAplica,
}: {
  grupo: GrupoChecklist | null
  aberto: boolean
  onFechar: () => void
  onMarcarPasso: (passoId: string, feito: boolean) => void
  onNaoSeAplica: () => void
}) {
  const { ativo, mola } = useMovimento()
  if (!grupo) return null

  return (
    <Sheet aberto={aberto} onFechar={onFechar} titulo={grupo.titulo} alturas={[0.55, 0.92]}>
      <div className="flex flex-col gap-md pb-md">
        {/* A explicação. Sempre aberta, em corpo de leitura. */}
        <section className="rounded-2xl bg-paper-2 p-md">
          <p className="text-base leading-relaxed text-ink">{grupo.explicacaoLeiga}</p>

          {grupo.porqueImporta && (
            <p className="mt-3 flex items-start gap-2 text-sm text-indigo">
              <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>{grupo.porqueImporta}</span>
            </p>
          )}
        </section>

        <section>
          <h3 className="u-eyebrow mb-2">Como fazer</h3>
          <ul className="flex flex-col gap-1.5">
            {grupo.passos.map((passo) => (
              <li key={passo.id}>
                <motion.button
                  type="button"
                  onClick={() => onMarcarPasso(passo.id, !passo.feito)}
                  whileTap={ativo ? { scale: 0.985 } : undefined}
                  transition={mola('rapida')}
                  aria-pressed={passo.feito}
                  className={cn(
                    'flex w-full items-start gap-3 rounded-xl p-3 text-left transition-colors',
                    passo.feito ? 'bg-[color-mix(in_oklab,var(--color-success)_9%,transparent)]' : 'hover:bg-paper-2',
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      'mt-0.5 grid size-6 shrink-0 place-items-center rounded-lg border-2 transition-colors',
                      passo.feito
                        ? 'border-transparent bg-[var(--color-success)]'
                        : 'border-line bg-paper',
                    )}
                  >
                    {passo.feito && <Check className="size-4 text-white" />}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span
                      className={cn(
                        'block font-display text-sm font-semibold',
                        passo.feito ? 'text-ink-mute line-through' : 'text-ink',
                      )}
                    >
                      {passo.titulo}
                      {passo.opcional && (
                        <span className="ml-1.5 font-body text-xs font-normal text-ink-mute">
                          opcional
                        </span>
                      )}
                    </span>

                    {passo.explicacaoLeiga && !passo.feito && (
                      <span className="mt-0.5 block text-sm leading-snug text-ink-soft">
                        {passo.explicacaoLeiga}
                      </span>
                    )}

                    {passo.dica && !passo.feito && (
                      <span className="mt-1 inline-flex items-start gap-1.5 text-xs text-indigo">
                        <Lightbulb className="mt-0.5 size-3 shrink-0" aria-hidden />
                        {passo.dica}
                      </span>
                    )}
                  </span>
                </motion.button>
              </li>
            ))}
          </ul>
        </section>

        {/*
          "Não se aplica" existe porque um checklist clínico aplicado a todo
          mundo sempre tem itens que não são de todo mundo. Sem essa saída, a
          pessoa fica com um item eternamente pendente e aprende a ignorar a
          lista inteira.
        */}
        {grupo.estado !== 'feito' && (
          <Button variant="ghost" size="sm" onClick={onNaoSeAplica}>
            {grupo.estado === 'nao-se-aplica' ? 'Voltar para a lista' : 'Isso não se aplica a mim'}
          </Button>
        )}

        {grupo.fonte && (
          <p className="text-xs leading-snug text-ink-mute">
            Fonte: {grupo.fonte} Este conteúdo explica — quem orienta o seu caso é a sua equipe de
            saúde.
          </p>
        )}
      </div>
    </Sheet>
  )
}
