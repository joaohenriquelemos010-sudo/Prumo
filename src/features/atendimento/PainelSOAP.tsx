import { useEffect, useRef } from 'react'
import { Lock } from 'lucide-react'
import type { CampoSOAP } from './tipos'

const CAMPOS: { chave: CampoSOAP; rotulo: string; dica: string }[] = [
  { chave: 'subjetivo', rotulo: 'Subjetivo', dica: 'O que ela relata: queixas, sintomas, contexto.' },
  { chave: 'objetivo', rotulo: 'Objetivo', dica: 'Exame físico, medidas e sinais observados.' },
  { chave: 'avaliacao', rotulo: 'Avaliação', dica: 'Sua impressão diagnóstica.' },
  { chave: 'plano', rotulo: 'Conduta', dica: 'Orientações, prescrição e retorno.' },
]

/** Cresce com o conteúdo — sem barra de rolagem dentro de um campo de texto. */
function useAutoAltura(valor: string) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [valor])
  return ref
}

function Campo({
  rotulo,
  dica,
  valor,
  onChange,
  autoFocus,
}: {
  rotulo: string
  dica: string
  valor: string
  onChange: (v: string) => void
  autoFocus?: boolean
}) {
  const ref = useAutoAltura(valor)
  return (
    <div>
      <label className="font-display text-sm font-semibold tracking-title text-indigo">
        {rotulo}
        <span className="ml-2 font-body text-xs font-normal text-ink-mute">{dica}</span>
      </label>
      <textarea
        ref={ref}
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        className="input mt-1 min-h-20 resize-none overflow-hidden"
        maxLength={3000}
        autoFocus={autoFocus}
      />
    </div>
  )
}

/**
 * O S-O-A-P — quatro campos **sempre visíveis**, não um wizard de cinco passos.
 *
 * O wizard antigo obrigava a médica a avançar e voltar para corrigir o subjetivo
 * depois de examinar. Uma consulta não é linear; a anotação também não deveria
 * ser. Tudo na tela, tab-order na ordem natural, e o campo cresce sozinho.
 */
export function PainelSOAP({
  valores,
  onChange,
  avaliacaoPrivada,
  onAvaliacaoPrivada,
  notasPrivadas,
  onNotasPrivadas,
}: {
  valores: Record<CampoSOAP, string>
  onChange: (campo: CampoSOAP, valor: string) => void
  avaliacaoPrivada: boolean
  onAvaliacaoPrivada: (v: boolean) => void
  notasPrivadas: string
  onNotasPrivadas: (v: string) => void
}) {
  const refNotas = useAutoAltura(notasPrivadas)

  return (
    <div className="flex flex-col gap-md">
      {CAMPOS.map((c, i) => (
        <div key={c.chave}>
          <Campo
            rotulo={c.rotulo}
            dica={c.dica}
            valor={valores[c.chave]}
            onChange={(v) => onChange(c.chave, v)}
            autoFocus={i === 0}
          />

          {c.chave === 'avaliacao' && (
            <label className="mt-2 flex cursor-pointer items-start gap-3 rounded-xl bg-paper-2 p-3">
              <input
                type="checkbox"
                checked={avaliacaoPrivada}
                onChange={(e) => onAvaliacaoPrivada(e.target.checked)}
                className="mt-0.5 size-5 shrink-0 accent-[var(--color-lilas)]"
              />
              <span>
                <span className="inline-flex items-center gap-1.5 font-display text-sm font-semibold text-ink">
                  <Lock className="size-4" aria-hidden />
                  Só para mim
                </span>
                <span className="block text-xs text-ink-soft">
                  A família não lê esta impressão — só o que você escrever na Conduta. Útil
                  enquanto ainda é hipótese.
                </span>
              </span>
            </label>
          )}
        </div>
      ))}

      <div>
        <label
          htmlFor="notas-privadas"
          className="inline-flex items-center gap-1.5 font-display text-sm font-semibold tracking-title text-indigo"
        >
          <Lock className="size-4" aria-hidden />
          Notas só da equipe
        </label>
        <textarea
          id="notas-privadas"
          ref={refNotas}
          value={notasPrivadas}
          onChange={(e) => onNotasPrivadas(e.target.value)}
          className="input mt-1 min-h-16 resize-none overflow-hidden"
          maxLength={3000}
          placeholder="Hipóteses, condutas em aberto, o que não cabe no que a família lê."
        />
        <p className="mt-1 text-xs text-ink-mute">
          Nunca sai para a família — nem no app, nem na exportação, nem no PDF.
        </p>
      </div>
    </div>
  )
}
