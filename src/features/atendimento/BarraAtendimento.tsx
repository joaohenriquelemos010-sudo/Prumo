import { useEffect, useState } from 'react'
import { Check, Cloud, CloudOff, Eye, EyeOff, Loader2 } from 'lucide-react'
import { Button } from '@/components/Button'
import { Material } from '@/components/Material'

function decorrido(desde: string | null): string {
  if (!desde) return '0:00'
  const s = Math.max(0, Math.floor((Date.now() - new Date(desde).getTime()) / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

function IndicadorSalvamento({
  salvando,
  salvoEm,
  temErro,
}: {
  salvando: boolean
  salvoEm: string | null
  temErro: boolean
}) {
  const [, forcar] = useState(0)
  // Re-renderiza a cada 10s só para o "há Xs" não congelar.
  useEffect(() => {
    const t = setInterval(() => forcar((n) => n + 1), 10_000)
    return () => clearInterval(t)
  }, [])

  if (temErro) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-warn-ink">
        <CloudOff className="size-3.5" aria-hidden />
        Sem salvar — vamos tentar de novo
      </span>
    )
  }
  if (salvando) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-ink-mute">
        <Loader2 className="size-3.5 animate-spin" aria-hidden />
        Salvando…
      </span>
    )
  }
  if (!salvoEm) return null

  const s = Math.floor((Date.now() - new Date(salvoEm).getTime()) / 1000)
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-ink-mute">
      <Cloud className="size-3.5" aria-hidden />
      {s < 10 ? 'Salvo agora' : s < 60 ? `Salvo há ${s}s` : `Salvo há ${Math.floor(s / 60)}min`}
    </span>
  )
}

/**
 * A barra fixa do atendimento.
 *
 * Um único botão primário — *Finalizar atendimento*. Tudo o mais aqui é
 * informação passiva: quanto tempo já passou e se o que foi digitado está a
 * salvo. Essas duas perguntas são as que fazem alguém sair da tela para
 * conferir, e responder as duas no rodapé é o que mantém a médica dentro dela.
 */
export function BarraAtendimento({
  iniciadaEm,
  salvando,
  salvoEm,
  temErro,
  previaAberta,
  onPrevia,
  onFinalizar,
  finalizando,
}: {
  iniciadaEm: string | null
  salvando: boolean
  salvoEm: string | null
  temErro: boolean
  previaAberta: boolean
  onPrevia: () => void
  onFinalizar: () => void
  finalizando: boolean
}) {
  const [tempo, setTempo] = useState(() => decorrido(iniciadaEm))
  useEffect(() => {
    const t = setInterval(() => setTempo(decorrido(iniciadaEm)), 1000)
    return () => clearInterval(t)
  }, [iniciadaEm])

  return (
    <Material
      as="footer"
      peso="denso"
      className="flex shrink-0 flex-wrap items-center gap-3 rounded-t-2xl px-md py-3 [padding-bottom:calc(0.75rem+env(safe-area-inset-bottom))]"
    >
      <span className="font-display text-sm font-semibold tabular-nums text-ink" aria-label="Tempo de atendimento">
        {tempo}
      </span>

      <IndicadorSalvamento salvando={salvando} salvoEm={salvoEm} temErro={temErro} />

      <div className="ml-auto flex flex-wrap items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          iconLeft={previaAberta ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
          onClick={onPrevia}
        >
          {previaAberta ? 'Fechar prévia' : 'Ver como a família vê'}
        </Button>
        <Button
          size="sm"
          loading={finalizando}
          iconLeft={<Check className="size-4" aria-hidden />}
          onClick={onFinalizar}
        >
          Finalizar atendimento
        </Button>
      </div>
    </Material>
  )
}
