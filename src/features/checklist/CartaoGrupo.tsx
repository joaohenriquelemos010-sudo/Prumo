import { motion } from 'framer-motion'
import { Check, Clock } from 'lucide-react'
import { ProgressoAnel } from './ProgressoAnel'
import { useMovimento } from '@/lib/motion'
import type { GrupoChecklist } from '@/lib/stores/checklist'
import { cn } from '@/lib/cn'

/**
 * O cartão de nível 1 — o que fazer.
 *
 * Mostra três coisas e para: o que é, quanto já foi, e **por que importa**. Essa
 * última linha é o que separa um checklist de uma lista de tarefas: ninguém
 * marca "fazer o exame do estreptococo" com vontade; marca-se depois de
 * entender que é o que protege o bebê na hora do parto.
 *
 * Toda a explicação longa fica um toque depois, na folha — aqui não cabe e não
 * deve caber.
 */
export function CartaoGrupo({
  grupo,
  onAbrir,
}: {
  grupo: GrupoChecklist
  onAbrir: () => void
}) {
  const { ativo, mola } = useMovimento()
  const feito = grupo.estado === 'feito'
  const naoSeAplica = grupo.estado === 'nao-se-aplica'

  return (
    <motion.button
      type="button"
      onClick={onAbrir}
      whileTap={ativo ? { scale: 0.98 } : undefined}
      transition={mola('rapida')}
      className={cn(
        'flex w-full items-center gap-md rounded-2xl border p-md text-left shadow-soft transition-colors',
        feito
          ? 'border-[color-mix(in_oklab,var(--color-success)_40%,transparent)] bg-[color-mix(in_oklab,var(--color-success)_7%,var(--color-paper))]'
          : 'border-line bg-paper hover:border-[var(--color-lilas-soft)]',
        (grupo.foraDaJanela || naoSeAplica) && 'opacity-60',
      )}
      aria-label={`${grupo.titulo}. ${grupo.feitos} de ${grupo.total} passos.`}
    >
      {feito ? (
        <span className="grid size-11 shrink-0 place-items-center rounded-pill bg-[var(--color-success)]">
          <Check className="size-6 text-white" aria-hidden />
        </span>
      ) : (
        <ProgressoAnel feitos={grupo.feitos} total={grupo.total} />
      )}

      <span className="min-w-0 flex-1">
        <span className="block font-display font-semibold tracking-title text-ink">
          {grupo.titulo}
        </span>

        {grupo.porqueImporta && !feito && (
          <span className="mt-0.5 block text-sm leading-snug text-ink-soft">
            {grupo.porqueImporta}
          </span>
        )}

        {feito && (
          <span className="mt-0.5 block text-sm text-success-ink">Feito. Pode respirar.</span>
        )}

        {naoSeAplica && (
          <span className="mt-0.5 block text-sm text-ink-mute">Não se aplica a você.</span>
        )}

        {grupo.foraDaJanela && !feito && !naoSeAplica && (
          <span className="mt-1 inline-flex items-center gap-1 text-xs text-ink-mute">
            <Clock className="size-3" aria-hidden />
            {janelaEmPalavras(grupo)}
          </span>
        )}
      </span>
    </motion.button>
  )
}

/**
 * A janela em português, não em intervalo numérico.
 *
 * "Entre 24 e 28 semanas" diz mais a uma gestante do que qualquer chip com
 * números soltos, e é o que ela vai repetir para marcar o exame.
 */
function janelaEmPalavras(grupo: GrupoChecklist): string {
  const j = grupo.janela
  if (j.desdeSemana != null && j.ateSemana != null) {
    return `Entre ${j.desdeSemana} e ${j.ateSemana} semanas`
  }
  if (j.desdeSemana != null) return `A partir de ${j.desdeSemana} semanas`
  if (j.ateSemana != null) return `Até ${j.ateSemana} semanas`
  if (j.desdeMes != null && j.ateMes != null) return `Entre ${j.desdeMes} e ${j.ateMes} meses`
  if (j.desdeMes != null) return `A partir de ${j.desdeMes} meses`
  return 'Mais para frente'
}
