import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  CalendarDays,
  ClipboardCheck,
  MessageCircleQuestion,
  Play,
  Search,
  UserPlus,
  Users,
  Zap,
} from 'lucide-react'
import { api } from '@/lib/api/client'
import { useMedicoContext } from '@/lib/stores/medico-context'
import { Button } from '@/components/Button'
import { EmptyState } from '@/components/EmptyState'
import { Skeleton } from '@/components/Skeleton'
import { AlertaErro } from '@/components/AlertaErro'
import { idadeGestacional } from '@/features/clinico/schedule'
import { cn } from '@/lib/cn'
import { NovoPaciente } from '@/features/pacientes/NovoPaciente'
import { InsightsPacientes } from '@/features/pacientes/Insights'

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
  /** Falso enquanto a paciente foi cadastrada no consultório e não criou conta. */
  temConta: boolean
  /** Data URL da foto da ficha, quando existe. */
  foto: string
  telefone: string
  /** A paciente mandou a ficha pelo link e ninguém conferiu ainda. */
  fichaPendente: boolean
}

const JANELA_INICIAR_MS = 4 * 60 * 60 * 1000

/** Quem digita "jose" tem que achar "José" — sem isso, não é busca. */
function normalizar(v: string): string {
  return v.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

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
  const [cadastrando, setCadastrando] = useState(false)
  const [busca, setBusca] = useState('')
  const setPaciente = useMedicoContext((s) => s.setPaciente)
  const navigate = useNavigate()

  useEffect(() => {
    api
      .get<{ pacientes: Paciente[] }>('/vinculos/pacientes')
      .then((d) => setPacientes(d.pacientes))
      .catch((e) => setErro(e instanceof Error ? e.message : 'Não foi possível carregar.'))
      .finally(() => setCarregando(false))
  }, [])

  /**
   * A paciente passa a viver na URL. Antes isto gravava a escolha num store e
   * mandava para `/app/prontuario` — uma tela global agindo sobre um contexto
   * invisível, que é o que fazia o médico não saber de quem era o que estava
   * lendo. O store continua sendo escrito porque as telas embutidas o leem, mas
   * agora ele é consequência do endereço, e não a fonte.
   */
  function abrir(p: Paciente) {
    setPaciente(p.crianca, p.nome)
    navigate(`/app/pacientes/${p.crianca}`)
  }

  const termo = normalizar(busca)
  const ordenados = pacientes
    .filter((p) => !termo || normalizar(p.nome).includes(termo))
    .sort((a, b) => {
      const ta = a.proximo ? new Date(a.proximo.inicio).getTime() : Infinity
      const tb = b.proximo ? new Date(b.proximo.inicio).getTime() : Infinity
      if (ta !== tb) return ta - tb
      if (b.alertas !== a.alertas) return b.alertas - a.alertas
      return b.duvidas - a.duvidas
    })

  return (
    <div>
      <header className="mb-lg flex flex-wrap items-start justify-between gap-md">
        <div>
          <h1 className="text-3xl">Pacientes</h1>
          <p className="mt-1 text-ink-soft">
            Quem precisa de você, e o que cada uma precisa.
          </p>
        </div>
        {/*
          Dois caminhos, e a diferença entre eles é o momento. A **ficha
          completa** é o cadastro de verdade, feito sentado. O **rápido** existe
          para quem chegou agora e precisa ser atendida antes de qualquer
          formulário — só o nome, o resto depois.
        */}
        <div className="flex flex-wrap gap-2">
          <Button
            variant="ghost"
            iconLeft={<Zap className="size-4" aria-hidden />}
            onClick={() => setCadastrando(true)}
          >
            Cadastro rápido
          </Button>
          <Button
            iconLeft={<UserPlus className="size-4" aria-hidden />}
            onClick={() => navigate('/app/pacientes/novo')}
          >
            Cadastrar paciente
          </Button>
        </div>
      </header>

      {erro && <AlertaErro>{erro}</AlertaErro>}

      <InsightsPacientes />

      {/*
        Busca sem acento e sem caixa, filtrando o que já está em memória. Com
        muitos pacientes o servidor também filtra (`?q=`), e o mesmo campo serve
        aos dois — quem digita não precisa saber onde o corte acontece.
      */}
      {pacientes.length > 6 && (
        <label className="relative mb-md mt-md block">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-mute" aria-hidden />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="input pl-9"
            placeholder="Buscar paciente pelo nome"
            aria-label="Buscar paciente"
          />
        </label>
      )}

      {carregando ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : ordenados.length === 0 ? (
        <EmptyState
          icon={<Users className="size-8" aria-hidden />}
          titulo="Nenhuma paciente ainda"
          descricao="Cadastre quem você atende — não é preciso que ela tenha conta. Se quiser acompanhar pelo celular depois, você gera um código e o histórico vai junto."
          action={
            <Button
              iconLeft={<UserPlus className="size-4" aria-hidden />}
              onClick={() => navigate('/app/pacientes/novo')}
            >
              Cadastrar paciente
            </Button>
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
                  <div className="flex min-w-0 items-start gap-3">
                    <Avatar foto={p.foto} nome={p.nome} />
                    <div className="min-w-0">
                      <button
                        type="button"
                        onClick={() => abrir(p)}
                        className="text-left font-display text-lg font-semibold tracking-title text-ink hover:text-indigo"
                      >
                        {p.nome}
                      </button>
                      <p className="text-sm text-ink-soft">
                        {descricao(p)}
                        {!p.temConta && (
                          <span className="ml-2 rounded-pill bg-paper-3 px-2 py-0.5 text-xs font-semibold text-ink-mute">
                            sem conta
                          </span>
                        )}
                      </p>
                    </div>
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
                  {p.fichaPendente && (
                    <Link
                      to={`/app/pacientes/${p.crianca}/editar`}
                      className="inline-flex items-center gap-1.5 rounded-pill u-chip-warn px-2.5 py-0.5 text-xs font-semibold"
                    >
                      <ClipboardCheck className="size-3.5" aria-hidden />
                      Ficha enviada pela paciente — conferir
                    </Link>
                  )}
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
                    Abrir
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <NovoPaciente
        aberto={cadastrando}
        onFechar={() => setCadastrando(false)}
        onCriado={(novo) => {
          setCadastrando(false)
          setPaciente(novo.id, novo.nome)
          navigate(`/app/pacientes/${novo.id}`)
        }}
      />
    </div>
  )
}

/**
 * O rosto antes do nome.
 *
 * Sem foto, mostra as iniciais em vez de um ícone genérico: numa lista de
 * cinquenta linhas, cinquenta silhuetas iguais são ruído, e duas letras já
 * distinguem uma paciente da outra.
 */
function Avatar({ foto, nome }: { foto: string; nome: string }) {
  const iniciais = nome
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((parte) => parte[0] ?? '')
    .join('')
    .toUpperCase()

  if (foto) {
    return (
      <img
        src={foto}
        alt=""
        aria-hidden
        className="size-11 shrink-0 rounded-full border border-line object-cover"
      />
    )
  }

  return (
    <span
      aria-hidden
      className="grid size-11 shrink-0 place-items-center rounded-full [background-image:var(--grad-brand-soft)] font-display text-sm font-bold text-indigo"
    >
      {iniciais || '?'}
    </span>
  )
}
