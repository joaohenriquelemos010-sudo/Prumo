import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, Baby, CalendarClock, KeyRound, TrendingUp } from 'lucide-react'
import { api } from '@/lib/api/client'
import { Skeleton } from '@/components/Skeleton'
import { cn } from '@/lib/cn'

interface Insights {
  total: number
  gestantes: { total: number; primeiro: number; segundo: number; terceiro: number }
  criancas: { total: number; ate6meses: number; ate2anos: number; maiores: number }
  semConta: number
  semRetorno: number
  emRisco: { jornada: string; nome: string; diasSemConsulta: number }[]
  comAlerta: number
  partosProximos: number
}

function Numero({
  valor,
  rotulo,
  icone,
  destaque,
}: {
  valor: number
  rotulo: string
  icone: React.ReactNode
  destaque?: boolean
}) {
  return (
    <div
      className={cn(
        'rounded-xl border p-3',
        destaque && valor > 0
          ? 'border-[var(--color-warn)] bg-[var(--color-warn)]'
          : 'border-line bg-paper-2',
      )}
    >
      <p className="inline-flex items-center gap-1.5 text-xs text-ink-mute">
        {icone}
        {rotulo}
      </p>
      <p className="font-display text-2xl font-bold tracking-title text-ink">{valor}</p>
    </div>
  )
}

/**
 * O consultório visto de cima.
 *
 * Não é um painel de indicadores — é uma lista de coisas para fazer hoje. Cada
 * número aqui responde uma pergunta que muda decisão: quantas entram no terceiro
 * trimestre (quantas consultas quinzenais vêm por aí), quem está sem retorno
 * marcado, quantas ainda não vinculam conta.
 *
 * O bloco que importa mais é o último. **Quem sumiu não aparece em lista
 * nenhuma** — uma lista ordenada por urgência mostra quem tem horário marcado, e
 * quem não voltou não tem. A gestante que abandona o pré-natal é exatamente o
 * desfecho que o pré-natal existe para evitar, e é a única que o produto inteiro
 * era cego para enxergar.
 */
export function InsightsPacientes() {
  const [dados, setDados] = useState<Insights | null>(null)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    api
      .get<{ insights: Insights }>('/vinculos/insights')
      .then((d) => setDados(d.insights))
      .catch(() => {})
      .finally(() => setCarregando(false))
  }, [])

  if (carregando) return <Skeleton className="h-32 w-full" />
  if (!dados || dados.total === 0) return null

  return (
    <section className="flex flex-col gap-md">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Numero
          valor={dados.gestantes.terceiro}
          rotulo="no 3º trimestre"
          icone={<TrendingUp className="size-3.5" aria-hidden />}
        />
        <Numero
          valor={dados.partosProximos}
          rotulo="parto em até 30 dias"
          icone={<Baby className="size-3.5" aria-hidden />}
        />
        <Numero
          valor={dados.semRetorno}
          rotulo="sem retorno marcado"
          icone={<CalendarClock className="size-3.5" aria-hidden />}
          destaque
        />
        <Numero
          valor={dados.semConta}
          rotulo="ainda sem conta"
          icone={<KeyRound className="size-3.5" aria-hidden />}
        />
      </div>

      {dados.emRisco.length > 0 && (
        <div className="rounded-xl border border-[var(--color-warn)] bg-[var(--color-warn)] p-md">
          <h3 className="inline-flex items-center gap-1.5 font-display text-sm font-semibold text-warn-ink">
            <AlertTriangle className="size-4" aria-hidden />
            Sumiram, e ninguém marcou retorno
          </h3>
          <p className="mt-0.5 text-xs text-ink-soft">
            Sem consulta há mais de 90 dias e sem nada agendado. Uma ligação resolve o que uma
            lista de espera não alcança.
          </p>
          <ul className="mt-2 flex flex-col gap-1">
            {dados.emRisco.map((p) => (
              <li key={p.jornada} className="flex items-baseline justify-between gap-2 text-sm">
                <Link to={`/app/pacientes/${p.jornada}`} className="truncate font-medium text-ink hover:underline">
                  {p.nome}
                </Link>
                <span className="shrink-0 text-xs text-ink-mute">
                  há {p.diasSemConsulta} dias
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
