import { useEffect, useState } from 'react'
import { Check, Copy, PhoneCall, Share2 } from 'lucide-react'
import { api } from '@/lib/api/client'
import { Button } from '@/components/Button'
import { useAuth } from '@/lib/stores/auth'
import { cn } from '@/lib/cn'

interface ItemEspera {
  id: string
  nome: string
  telefone: string
  tipoNome: string
  prioridade: number
  disponibilidade: string
  estado: string
}

const PRIORIDADE_COR: Record<number, string> = {
  1: 'bg-warn-ink',
  2: 'bg-indigo',
  3: 'bg-ink-mute',
}

/** As iniciais que viram avatar quando não há foto — e nunca haverá, aqui. */
function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean)
  if (partes.length === 0) return '?'
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase()
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase()
}

/**
 * Compartilhar os horários livres da semana.
 *
 * O link já existe e é público (`/app/profissionais`): a família escolhe o
 * profissional e vê os horários abertos. O que faltava era o gesto — a
 * secretária no telefone precisa mandar isso em dois segundos, não navegar até
 * a página para copiar a URL da barra.
 */
function Compartilhar() {
  const [copiado, setCopiado] = useState(false)
  // O id já está na sessão: buscar de novo seria uma requisição para saber algo
  // que o cliente sabe desde o login.
  const id = useAuth((s) => s.user?.id)

  const url = id ? `${window.location.origin}/app/profissionais?medico=${id}` : ''

  return (
    <section className="rounded-2xl border border-line bg-paper p-md shadow-soft">
      <h2 className="inline-flex items-center gap-2 font-display text-sm font-semibold text-ink">
        <Share2 className="size-4 text-indigo" aria-hidden />
        Compartilhar horários disponíveis
      </h2>
      <p className="mt-1 text-xs text-ink-soft">
        Mande para suas pacientes: elas veem os horários abertos e marcam sozinhas.
      </p>
      <Button
        className="mt-3 w-full"
        size="sm"
        disabled={!url}
        iconLeft={copiado ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
        onClick={() => {
          void navigator.clipboard?.writeText(url)
          setCopiado(true)
          // Volta ao estado normal: um botão que fica "Copiado!" para sempre
          // deixa de responder ao segundo clique, e ninguém sabe se funcionou.
          setTimeout(() => setCopiado(false), 2000)
        }}
      >
        {copiado ? 'Link copiado' : 'Copiar link da agenda'}
      </Button>
    </section>
  )
}

/**
 * A fila, resumida, ao lado do calendário.
 *
 * É onde ela precisa estar: o momento em que a lista de espera vale alguma coisa
 * é exatamente o momento em que alguém cancela — e nesse momento os olhos estão
 * no calendário. Numa aba separada, a fila só é consultada por quem já lembrou
 * que ela existe.
 */
function FilaResumida({ onAgendar }: { onAgendar: (nome: string) => void }) {
  const [fila, setFila] = useState<ItemEspera[]>([])
  const [tudo, setTudo] = useState(false)

  useEffect(() => {
    api
      .get<{ fila: ItemEspera[] }>('/lista-espera')
      .then((d) => setFila(d.fila))
      .catch(() => {})
  }, [])

  if (fila.length === 0) return null
  const visiveis = tudo ? fila : fila.slice(0, 3)

  return (
    <section className="rounded-2xl border border-line bg-paper p-md shadow-soft">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-display text-sm font-semibold text-ink">
          Lista de espera{' '}
          <span className="ml-1 rounded-pill bg-paper-3 px-1.5 text-xs text-ink-mute">
            {fila.length}
          </span>
        </h2>
      </div>

      <ul className="mt-3 flex flex-col gap-3">
        {visiveis.map((i) => (
          <li key={i.id} className="flex gap-2.5">
            <span
              className="grid size-9 shrink-0 place-items-center rounded-pill bg-paper-2 font-display text-xs font-bold text-indigo"
              aria-hidden
            >
              {iniciais(i.nome)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-display text-sm font-semibold text-ink">{i.nome}</p>
              <p className="inline-flex items-center gap-1.5 text-xs text-ink-mute">
                <span
                  className={cn('size-1.5 rounded-pill', PRIORIDADE_COR[i.prioridade])}
                  aria-hidden
                />
                {i.tipoNome || 'Consulta'}
              </p>
              {i.disponibilidade && (
                <p className="truncate text-xs text-ink-mute">{i.disponibilidade}</p>
              )}
              {i.telefone && (
                <a
                  href={`tel:${i.telefone.replace(/\D/g, '')}`}
                  className="inline-flex items-center gap-1 text-xs text-ink-soft hover:text-indigo"
                >
                  <PhoneCall className="size-3" aria-hidden />
                  {i.telefone}
                </a>
              )}
            </div>
            <Button size="sm" variant="secondary" onClick={() => onAgendar(i.nome)}>
              Agendar
            </Button>
          </li>
        ))}
      </ul>

      {fila.length > 3 && (
        <button
          type="button"
          onClick={() => setTudo((v) => !v)}
          className="mt-3 w-full text-center text-sm font-semibold text-indigo hover:underline"
        >
          {tudo ? 'Ver menos' : `Ver todas (${fila.length})`}
        </button>
      )}
    </section>
  )
}

export function PainelLateralAgenda({ onAgendar }: { onAgendar: (nome: string) => void }) {
  return (
    <div className="flex flex-col gap-md">
      <Compartilhar />
      <FilaResumida onAgendar={onAgendar} />
    </div>
  )
}
