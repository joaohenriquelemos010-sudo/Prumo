import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarDays, CheckCircle2, Clock, Play, Sunrise } from 'lucide-react'
import { api } from '@/lib/api/client'
import { Button } from '@/components/Button'
import { Skeleton } from '@/components/Skeleton'
import { cn } from '@/lib/cn'

interface AgendamentoDoDia {
  id: string
  pacienteNome: string
  inicio: string
  duracaoMin: number
  modalidade: 'teleconsulta' | 'presencial' | 'domiciliar'
  status: string
  objetivo: string
}

/** Quanto antes/depois do horário o botão de iniciar aparece. */
const JANELA_INICIAR_MS = 4 * 60 * 60 * 1000

function hora(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

/**
 * "Meu dia" — a primeira coisa que a obstetra vê ao entrar.
 *
 * Substitui o painel-demo que estava aqui. A pergunta que essa tela responde é
 * uma só: *o que eu faço agora?* Por isso ela é uma fila de horários, cada um
 * com o botão que começa o trabalho — e não um resumo de indicadores.
 *
 * O CTA aparece numa janela de ±4h em torno do horário: cedo o bastante para
 * quem adianta, tarde o bastante para quem atrasou, e estreito o bastante para
 * que "iniciar atendimento" nunca signifique a consulta errada.
 */
export function MeuDia() {
  const [itens, setItens] = useState<AgendamentoDoDia[]>([])
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    const hoje = new Date()
    const de = new Date(hoje)
    de.setHours(0, 0, 0, 0)
    const ate = new Date(hoje)
    ate.setHours(23, 59, 59, 999)

    api
      .get<{ agendamentos: AgendamentoDoDia[] }>(
        `/agendamentos?meus=true&de=${de.toISOString()}&ate=${ate.toISOString()}`,
      )
      .then((d) =>
        setItens(
          d.agendamentos
            .filter((a) => a.status === 'confirmado' || a.status === 'pendente')
            .sort((a, b) => a.inicio.localeCompare(b.inicio)),
        ),
      )
      .catch(() => setItens([]))
      .finally(() => setCarregando(false))
  }, [])

  if (carregando) {
    return (
      <section className="flex flex-col gap-2">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-20 w-full" />
      </section>
    )
  }

  if (itens.length === 0) {
    return (
      <section className="rounded-2xl border border-line bg-paper p-lg text-center shadow-soft">
        <Sunrise className="mx-auto size-8 text-indigo" aria-hidden />
        <p className="mt-2 font-display text-lg font-semibold tracking-title text-ink">
          Nenhum atendimento hoje
        </p>
        <p className="mt-1 text-sm text-ink-soft">
          Sua agenda está livre. Boa hora para responder as dúvidas que ficaram.
        </p>
        <div className="mt-md flex flex-wrap justify-center gap-2">
          <Link to="/app/agenda">
            <Button variant="secondary" size="sm" iconLeft={<CalendarDays className="size-4" aria-hidden />}>
              Ver agenda
            </Button>
          </Link>
          <Link to="/app/caderninho">
            <Button variant="secondary" size="sm">
              Dúvidas das pacientes
            </Button>
          </Link>
        </div>
      </section>
    )
  }

  return (
    <section>
      <h2 className="u-eyebrow mb-2">Hoje</h2>
      <ul className="flex flex-col gap-2">
        {itens.map((a) => {
          const inicio = new Date(a.inicio)
          const podeIniciar =
            a.status === 'confirmado' && Math.abs(inicio.getTime() - Date.now()) <= JANELA_INICIAR_MS
          const passou = inicio.getTime() < Date.now()

          return (
            <li
              key={a.id}
              className={cn(
                'flex flex-wrap items-center gap-3 rounded-2xl border bg-paper p-md shadow-soft',
                podeIniciar ? 'border-[var(--color-lilas-soft)]' : 'border-line',
              )}
            >
              <span className="font-display text-lg font-semibold tabular-nums tracking-title text-ink">
                {hora(a.inicio)}
              </span>

              <div className="min-w-0 flex-1">
                <p className="truncate font-display font-semibold text-ink">
                  {a.pacienteNome || 'Paciente'}
                </p>
                <p className="truncate text-xs text-ink-mute">
                  {a.duracaoMin} min · {a.modalidade}
                  {a.status === 'pendente' && ' · aguardando sua confirmação'}
                </p>
              </div>

              {podeIniciar ? (
                <Link to={`/app/atendimento/novo?agendamento=${a.id}`}>
                  <Button size="sm" iconLeft={<Play className="size-4" aria-hidden />}>
                    Iniciar atendimento
                  </Button>
                </Link>
              ) : a.status === 'pendente' ? (
                <Link to="/app/agenda">
                  <Button variant="secondary" size="sm">
                    Confirmar
                  </Button>
                </Link>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-xs text-ink-mute">
                  {passou ? (
                    <>
                      <CheckCircle2 className="size-4" aria-hidden />
                      Encerrado
                    </>
                  ) : (
                    <>
                      <Clock className="size-4" aria-hidden />
                      Mais tarde
                    </>
                  )}
                </span>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
