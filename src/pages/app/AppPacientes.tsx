import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AlertTriangle, CalendarDays, MessageCircleQuestion, Play, UserPlus, Users } from 'lucide-react'
import { api } from '@/lib/api/client'
import { useMedicoContext } from '@/lib/stores/medico-context'
import { Button } from '@/components/Button'
import { EmptyState } from '@/components/EmptyState'
import { Skeleton } from '@/components/Skeleton'
import { AlertaErro } from '@/components/AlertaErro'
import { idadeGestacional } from '@/features/clinico/schedule'
import { cn } from '@/lib/cn'

interface Paciente {
  vinculoId: string
  crianca: string
  nome: string
  momento: 'planejando' | 'gestante' | 'ja-nasceu' | null
  dpp: string | null
  dataNascimento: string | null
  proximo: { id: string; inicio: string; status: string; modalidade: string } | null
  alertas: number
  duvidas: number
}

const JANELA_INICIAR_MS = 4 * 60 * 60 * 1000

function descricao(p: Paciente): string {
  if (p.dpp) {
    const ig = idadeGestacional(new Date(p.dpp))
    return `${ig.semanas}s${ig.dias}d de gestação`
  }
  if (p.dataNascimento) {
    const n = new Date(p.dataNascimento)
    const hoje = new Date()
    const meses = Math.max(
      0,
      (hoje.getFullYear() - n.getFullYear()) * 12 + (hoje.getMonth() - n.getMonth()),
    )
    return `${meses} ${meses === 1 ? 'mês' : 'meses'} de vida`
  }
  return p.momento === 'planejando' ? 'Planejando' : 'Jornada aberta'
}

/**
 * "Meus pacientes" — a lista que responde *quem precisa de mim agora*.
 *
 * Ordenada por urgência real e não alfabeticamente: quem tem atendimento nas
 * próximas horas primeiro, depois quem tem alerta aberto, depois quem deixou
 * pergunta. O nome sozinho não ajuda ninguém a decidir por onde começar.
 */
export default function AppPacientes() {
  const [pacientes, setPacientes] = useState<Paciente[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const setPaciente = useMedicoContext((s) => s.setPaciente)
  const navigate = useNavigate()

  useEffect(() => {
    api
      .get<{ pacientes: Paciente[] }>('/vinculos/pacientes')
      .then((d) => setPacientes(d.pacientes))
      .catch((e) => setErro(e instanceof Error ? e.message : 'Não foi possível carregar.'))
      .finally(() => setCarregando(false))
  }, [])

  function abrir(p: Paciente) {
    setPaciente(p.crianca, p.nome)
    navigate('/app/prontuario')
  }

  const ordenados = [...pacientes].sort((a, b) => {
    const ta = a.proximo ? new Date(a.proximo.inicio).getTime() : Infinity
    const tb = b.proximo ? new Date(b.proximo.inicio).getTime() : Infinity
    if (ta !== tb) return ta - tb
    if (b.alertas !== a.alertas) return b.alertas - a.alertas
    return b.duvidas - a.duvidas
  })

  return (
    <div>
      <header className="mb-lg">
        <h1 className="text-3xl">Meus pacientes</h1>
        <p className="mt-1 text-ink-soft">
          Quem está conectado a você, e o que cada uma precisa.
        </p>
      </header>

      {erro && <AlertaErro>{erro}</AlertaErro>}

      {carregando ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : ordenados.length === 0 ? (
        <EmptyState
          icon={<Users className="size-8" aria-hidden />}
          titulo="Nenhuma paciente conectada ainda"
          descricao="Gere um convite e mande o link — ela entra e a jornada dela passa a aparecer aqui."
          action={
            <Link to="/app/compartilhar">
              <Button iconLeft={<UserPlus className="size-4" aria-hidden />}>
                Convidar uma paciente
              </Button>
            </Link>
          }
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {ordenados.map((p) => {
            const inicio = p.proximo ? new Date(p.proximo.inicio) : null
            const podeIniciar =
              p.proximo?.status === 'confirmado' &&
              inicio !== null &&
              Math.abs(inicio.getTime() - Date.now()) <= JANELA_INICIAR_MS

            return (
              <li
                key={p.vinculoId}
                className="rounded-2xl border border-line bg-paper p-md shadow-soft"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <button
                      type="button"
                      onClick={() => abrir(p)}
                      className="text-left font-display text-lg font-semibold tracking-title text-ink hover:text-indigo"
                    >
                      {p.nome}
                    </button>
                    <p className="text-sm text-ink-soft">{descricao(p)}</p>
                  </div>

                  {podeIniciar && p.proximo && (
                    <Link to={`/app/atendimento/novo?agendamento=${p.proximo.id}`}>
                      <Button size="sm" iconLeft={<Play className="size-4" aria-hidden />}>
                        Iniciar atendimento
                      </Button>
                    </Link>
                  )}
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                  {inicio && (
                    <span className="inline-flex items-center gap-1.5 text-ink-soft">
                      <CalendarDays className="size-4" aria-hidden />
                      {inicio.toLocaleString('pt-BR', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                      {p.proximo?.status === 'pendente' && (
                        <span className="text-warn-ink"> · a confirmar</span>
                      )}
                    </span>
                  )}
                  {p.alertas > 0 && (
                    <span className="inline-flex items-center gap-1.5 text-warn-ink">
                      <AlertTriangle className="size-4" aria-hidden />
                      {p.alertas} {p.alertas === 1 ? 'alerta' : 'alertas'}
                    </span>
                  )}
                  {p.duvidas > 0 && (
                    <span className="inline-flex items-center gap-1.5 text-indigo">
                      <MessageCircleQuestion className="size-4" aria-hidden />
                      {p.duvidas} {p.duvidas === 1 ? 'pergunta' : 'perguntas'}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => abrir(p)}
                    className={cn('ml-auto text-sm font-semibold text-indigo hover:underline')}
                  >
                    Ver prontuário
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
