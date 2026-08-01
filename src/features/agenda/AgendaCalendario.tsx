import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarDays, ChevronLeft, ChevronRight, Play, Plus, Search, Video, X } from 'lucide-react'
import { api } from '@/lib/api/client'
import { Button } from '@/components/Button'
import { Sheet } from '@/components/Sheet'
import { Skeleton } from '@/components/Skeleton'
import { AlertaErro } from '@/components/AlertaErro'
import { GradeAgenda } from './GradeAgenda'
import type { EventoAgenda, Expediente } from './GradeAgenda'
import { NovoAgendamento } from './NovoAgendamento'
import { PainelLateralAgenda } from './PainelLateral'
import type { TipoOpcao } from './NovoAgendamento'
import { diasDaSemana, inicioDaSemana, semanaDoAno } from './grade'
import { MESES, horaCurta } from './agenda'
import { cn } from '@/lib/cn'
import { useAuth } from '@/lib/stores/auth'

const BaixarAgenda = lazy(() =>
  import('@/features/pdf/documents').then((m) => ({ default: m.BaixarAgenda })),
)

type Visao = 'dia' | 'semana'

const CORES_PONTO: Record<string, string> = {
  indigo: 'bg-indigo',
  lilas: 'bg-lilas',
  azul: 'bg-azul',
  success: 'bg-success-ink',
  warn: 'bg-warn-ink',
}

function rotuloIntervalo(dias: Date[]): string {
  const a = dias[0]
  const b = dias[dias.length - 1]
  if (dias.length === 1) {
    return `${a.getDate()} de ${MESES[a.getMonth()]} de ${a.getFullYear()}`
  }
  const mesmoMes = a.getMonth() === b.getMonth()
  return mesmoMes
    ? `${a.getDate()} – ${b.getDate()} ${MESES[a.getMonth()]} ${a.getFullYear()}`
    : `${a.getDate()} ${MESES[a.getMonth()]} – ${b.getDate()} ${MESES[b.getMonth()]} ${b.getFullYear()}`
}

/**
 * A agenda como calendário.
 *
 * O que existia era uma lista de cartões agrupada por dia: correta, e inútil para
 * a pergunta que se faz o dia inteiro no consultório — *onde tem meia hora livre
 * na quinta?*. Numa lista, a resposta exige ler tudo e subtrair de cabeça. Numa
 * grade, o espaço vazio **é** a resposta.
 *
 * Toda a semana vem numa requisição só (`GET /api/agenda`), incluindo o que
 * desenha o fundo — expediente, almoço, bloqueios. Buscar isso em quatro
 * chamadas faria a grade se montar em pedaços na frente de quem abriu, que é
 * exatamente a sensação que uma agenda não pode dar.
 */
export function AgendaCalendario() {
  const navigate = useNavigate()
  const medicoNome = useAuth((s) => s.user?.nome ?? '')
  const [visao, setVisao] = useState<Visao>('semana')
  const [ancora, setAncora] = useState(() => new Date())
  const [eventos, setEventos] = useState<EventoAgenda[]>([])
  const [expediente, setExpediente] = useState<Expediente>({
    ativo: false,
    almoco: { inicio: '', fim: '' },
    regras: [],
    bloqueios: [],
  })
  const [tipos, setTipos] = useState<TipoOpcao[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [busca, setBusca] = useState('')
  const [marcando, setMarcando] = useState(false)
  const [quandoInicial, setQuandoInicial] = useState<Date | null>(null)
  const [aberto, setAberto] = useState<EventoAgenda | null>(null)

  const dias = useMemo(
    () =>
      visao === 'semana'
        ? diasDaSemana(inicioDaSemana(ancora))
        : [new Date(ancora.getFullYear(), ancora.getMonth(), ancora.getDate())],
    [visao, ancora],
  )

  const carregar = useCallback(async () => {
    const de = new Date(dias[0])
    de.setHours(0, 0, 0, 0)
    const ate = new Date(dias[dias.length - 1])
    ate.setHours(23, 59, 59, 999)

    try {
      const d = await api.get<{
        agendamentos: EventoAgenda[]
        expediente: Expediente
        tipos: TipoOpcao[]
      }>(`/agenda?de=${de.toISOString()}&ate=${ate.toISOString()}`)
      setEventos(d.agendamentos)
      setExpediente(d.expediente)
      setTipos(d.tipos)
      setErro(null)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui carregar a agenda.')
    } finally {
      setCarregando(false)
    }
    // `dias` é derivado de `visao`+`ancora`; depender do ISO das pontas evita
    // recarregar a cada render por causa de um array novo com o mesmo conteúdo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dias[0]?.getTime(), dias[dias.length - 1]?.getTime()])

  useEffect(() => {
    void carregar()
  }, [carregar])

  function andar(passo: number) {
    const d = new Date(ancora)
    d.setDate(d.getDate() + passo * (visao === 'semana' ? 7 : 1))
    setAncora(d)
  }

  const visiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    if (!termo) return eventos
    return eventos.filter((e) => e.pacienteNome.toLowerCase().includes(termo))
  }, [eventos, busca])

  return (
    <div className="flex flex-col gap-md">
      {/* Barra de ações */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          iconLeft={<Plus className="size-4" aria-hidden />}
          onClick={() => {
            setQuandoInicial(null)
            setMarcando(true)
          }}
        >
          Novo agendamento
        </Button>

        {/*
          Papel na mesa continua sendo como muito consultório funciona: a
          secretária confere a lista, risca quem chegou, anota o telefone de quem
          faltou. Um sistema que não imprime não substitui o caderno — passa a
          conviver com ele, e aí os dois ficam errados.
        */}
        <Suspense fallback={null}>
          <BaixarAgenda
            dados={{
              medicoNome,
              periodo: rotuloIntervalo(dias),
              geradoEm: new Date().toISOString(),
              itens: visiveis.map((e) => ({
                inicio: e.inicio,
                duracaoMin: e.duracaoMin,
                pacienteNome: e.pacienteNome,
                tipoNome: e.tipoNome,
                modalidade: e.modalidade,
                status: e.status,
              })),
            }}
          />
        </Suspense>

        <label className="relative ml-auto min-w-[220px] flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-mute" aria-hidden />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="input pl-9"
            placeholder="Buscar na agenda"
            aria-label="Buscar paciente na agenda"
          />
        </label>
      </div>

      {/* Navegação */}
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="secondary" onClick={() => setAncora(new Date())}>
          Hoje
        </Button>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => andar(-1)}
            aria-label="Período anterior"
            className="grid size-9 place-items-center rounded-pill text-ink-soft hover:bg-paper-2"
          >
            <ChevronLeft className="size-5" aria-hidden />
          </button>
          <div className="min-w-[190px] text-center">
            <p className="font-display text-sm font-semibold text-ink">{rotuloIntervalo(dias)}</p>
            {visao === 'semana' && (
              <p className="text-xs text-ink-mute">Semana {semanaDoAno(dias[0])}</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => andar(1)}
            aria-label="Próximo período"
            className="grid size-9 place-items-center rounded-pill text-ink-soft hover:bg-paper-2"
          >
            <ChevronRight className="size-5" aria-hidden />
          </button>
        </div>

        <div className="ml-auto flex gap-1 rounded-pill bg-paper-2 p-1" role="tablist">
          {(['dia', 'semana'] as Visao[]).map((v) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={visao === v}
              onClick={() => setVisao(v)}
              className={cn(
                'min-h-8 rounded-pill px-4 text-sm font-semibold capitalize',
                visao === v ? 'bg-paper text-ink shadow-soft' : 'text-ink-soft',
              )}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* Legenda — vem do catálogo do médico, não de uma lista fixa. */}
      {tipos.length > 0 && (
        <ul className="flex flex-wrap gap-x-4 gap-y-1">
          {tipos.map((t) => (
            <li key={t.id} className="inline-flex items-center gap-1.5 text-xs text-ink-soft">
              <span
                className={cn('size-2 rounded-pill', CORES_PONTO[t.cor] ?? 'bg-indigo')}
                aria-hidden
              />
              {t.nome}
            </li>
          ))}
          {expediente.almoco.inicio && (
            <li className="inline-flex items-center gap-1.5 text-xs text-ink-mute">
              <span className="size-2 rounded-pill border border-line bg-paper-2" aria-hidden />
              Bloqueio / almoço
            </li>
          )}
        </ul>
      )}

      {erro && <AlertaErro>{erro}</AlertaErro>}

      {/*
        Grade e painel lado a lado a partir de 1280px. Abaixo disso o painel vai
        para baixo, e não some: a lista de espera importa exatamente no momento
        em que alguém cancela — e nesse momento os olhos estão no calendário.
      */}
      <div className="grid gap-md xl:grid-cols-[1fr_300px]">
        {carregando ? (
          <Skeleton className="h-[520px] w-full" />
        ) : (
          <div className="min-w-0 rounded-2xl border border-line bg-paper p-2 shadow-soft">
            <GradeAgenda
              dias={dias}
              eventos={visiveis}
              expediente={expediente}
              onAbrir={setAberto}
              onVago={(quando) => {
                setQuandoInicial(quando)
                setMarcando(true)
              }}
            />
          </div>
        )}

        <PainelLateralAgenda
          onAgendar={() => {
            setQuandoInicial(null)
            setMarcando(true)
          }}
        />
      </div>

      {!expediente.ativo && !carregando && (
        <p className="text-sm text-ink-soft">
          Sua agenda online ainda está fechada. Em <strong>Configurar</strong> você define os dias e
          horários — as famílias passam a ver os horários livres e marcam direto.
        </p>
      )}

      <NovoAgendamento
        aberto={marcando}
        onFechar={() => setMarcando(false)}
        onMarcado={() => void carregar()}
        tipos={tipos}
        quandoInicial={quandoInicial}
      />

      {/* Detalhe do horário — o que fazer com ele, sem sair do calendário. */}
      <Sheet aberto={aberto !== null} onFechar={() => setAberto(null)} titulo="Atendimento">
        {aberto && (
          <div className="flex flex-col gap-3">
            <div>
              <p className="font-display text-lg font-semibold text-ink">{aberto.pacienteNome}</p>
              <p className="text-sm text-ink-soft">
                {horaCurta(aberto.inicio)} · {aberto.duracaoMin} min
                {aberto.tipoNome && ` · ${aberto.tipoNome}`}
              </p>
              <p className="mt-0.5 text-xs text-ink-mute">
                {aberto.modalidade} · {aberto.status}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                iconLeft={<Play className="size-4" aria-hidden />}
                onClick={() =>
                  navigate(
                    aberto.consultaId
                      ? `/app/atendimento/${aberto.consultaId}?agendamento=${aberto.id}`
                      : `/app/atendimento/novo?agendamento=${aberto.id}`,
                  )
                }
              >
                Iniciar atendimento
              </Button>
              {aberto.modalidade === 'teleconsulta' && (
                <Button
                  size="sm"
                  variant="secondary"
                  iconLeft={<Video className="size-4" aria-hidden />}
                  onClick={() => navigate(`/app/teleconsulta/${aberto.id}`)}
                >
                  Entrar na sala
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                iconLeft={<CalendarDays className="size-4" aria-hidden />}
                onClick={() => navigate(`/app/pacientes/${aberto.jornada}`)}
              >
                Abrir paciente
              </Button>
              <Button
                size="sm"
                variant="ghost"
                iconLeft={<X className="size-4" aria-hidden />}
                onClick={async () => {
                  await api.patch(`/agendamentos/${aberto.id}`, { status: 'cancelado' })
                  setAberto(null)
                  void carregar()
                }}
              >
                Cancelar horário
              </Button>
            </div>
          </div>
        )}
      </Sheet>
    </div>
  )
}
