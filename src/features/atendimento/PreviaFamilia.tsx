import { Eye, Lock, Send } from 'lucide-react'
import type { CampoSOAP } from './tipos'

/**
 * Exatamente o que a família vai ler — renderizado pelas MESMAS regras que o
 * servidor aplica em `serializeConsulta`.
 *
 * É a peça que faz a médica confiar no campo "só para mim": ela vê o efeito
 * antes de salvar, em vez de descobrir depois pelo que a paciente perguntou.
 */
export function PreviaFamilia({
  campos,
  avaliacaoPrivada,
  temNotas,
  resumo,
  onResumo,
}: {
  campos: Record<CampoSOAP, string>
  avaliacaoPrivada: boolean
  temNotas: boolean
  resumo: string
  onResumo: (v: string) => void
}) {
  const secoes: [string, string][] = [
    ['Subjetivo', campos.subjetivo],
    ['Objetivo', campos.objetivo],
    ['Avaliação', avaliacaoPrivada ? '' : campos.avaliacao],
    ['Conduta', campos.plano],
  ]

  return (
    <section className="rounded-2xl border-2 border-dashed border-line bg-paper-2 p-md">
      <p className="inline-flex items-center gap-2 font-display text-sm font-semibold text-indigo">
        <Eye className="size-4" aria-hidden />
        Assim a família vê
      </p>

      <dl className="mt-3 grid gap-3 sm:grid-cols-2">
        {secoes.map(([rotulo, valor]) => (
          <div key={rotulo}>
            <dt className="text-xs font-semibold text-indigo">{rotulo}</dt>
            <dd className="whitespace-pre-line text-sm text-ink-soft">
              {valor || <span className="text-ink-mute">—</span>}
            </dd>
          </div>
        ))}
      </dl>

      {(avaliacaoPrivada || temNotas) && (
        <p className="mt-3 inline-flex items-start gap-1.5 text-xs text-ink-mute">
          <Lock className="mt-0.5 size-3 shrink-0" aria-hidden />
          {avaliacaoPrivada && temNotas
            ? 'A avaliação e suas notas ficam só com a equipe.'
            : avaliacaoPrivada
              ? 'A avaliação fica só com a equipe.'
              : 'Suas notas ficam só com a equipe.'}
        </p>
      )}

      {/*
        O resumo é a única coisa aqui escrita PARA ela, e não para o prontuário.
        Fica dentro da prévia de propósito: escreve-se olhando o que ela vai ler.
      */}
      <div className="mt-md border-t border-line pt-md">
        <label
          htmlFor="resumo-familia"
          className="inline-flex items-center gap-1.5 font-display text-sm font-semibold text-indigo"
        >
          <Send className="size-4" aria-hidden />
          Resumo para ela
        </label>
        <textarea
          id="resumo-familia"
          value={resumo}
          onChange={(e) => onResumo(e.target.value)}
          className="input mt-1 min-h-20 resize-y"
          maxLength={2000}
          placeholder="Em palavras dela: como foi a consulta, o que fazer até a próxima, o que observar."
        />
        <p className="mt-1 text-xs text-ink-mute">
          Vai junto ao finalizar. Se ficar em branco, nada é enviado.
        </p>
      </div>
    </section>
  )
}
