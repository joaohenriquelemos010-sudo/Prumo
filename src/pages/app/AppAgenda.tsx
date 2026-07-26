import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CalendarDays, Syringe, TestTube2, ArrowRight, Stethoscope, List, CalendarRange } from 'lucide-react'
import { api } from '@/lib/api/client'
import { useAuth } from '@/lib/stores/auth'
import { usePerfil } from '@/lib/stores/perfil'
import { DadosCrianca } from '@/features/clinico/DadosCrianca'
import { calcularDosesVacinas, formatarData, semanasGestacionais, trimestreAtual } from '@/features/clinico/schedule'
import { EXAMES_PRENATAL, REFERENCIA_PRENATAL } from '@/features/clinico/sus-exames'
import { ChipCobertura } from '@/features/clinico/ChipCobertura'
import { Skeleton } from '@/components/Skeleton'
import { EmptyState } from '@/components/EmptyState'
import { AlertaErro } from '@/components/AlertaErro'
import { CardAgendamento } from '@/features/agenda/CardAgendamento'
import { Calendario } from '@/features/agenda/Calendario'
import { SeletorHorario } from '@/features/agenda/SeletorHorario'
import {
  STATUS_ATIVOS,
  ehFuturo,
  paraChaveDia,
  rotuloDoDia,
  horaCurta,
  OBJETIVO_LABEL,
} from '@/features/agenda/agenda'
import type { Agendamento, DiaComSlots } from '@/features/agenda/agenda'
import AppAgendaMedico from './AppAgendaMedico'
import { cn } from '@/lib/cn'

/**
 * `/app/agenda` is two different jobs behind one route: the family reads what is
 * coming, the professional runs their day. Splitting by role here keeps a single
 * nav entry — "Agenda" means the same thing to everyone, it just shows your side.
 */
export default function AppAgenda() {
  const papel = useAuth((s) => s.user?.papel)
  return papel === 'medico' ? <AppAgendaMedico /> : <AgendaPaciente />
}

function AgendaPaciente() {
  const perfil = usePerfil((s) => s.perfil)
  const [params, setParams] = useSearchParams()
  const [aplicadas, setAplicadas] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([])
  const [carregando, setCarregando] = useState(true)
  const [ocupadoId, setOcupadoId] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [vista, setVista] = useState<'lista' | 'mes'>('lista')
  const [remarcando, setRemarcando] = useState<Agendamento | null>(null)

  const acabouDeMarcar = params.get('novo') === '1'

  const carregar = useCallback(async () => {
    try {
      const { agendamentos: lista } = await api.get<{ agendamentos: Agendamento[] }>('/agendamentos')
      setAgendamentos(lista)
    } catch {
      /* the derived schedule below still renders — the agenda is never empty */
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    let active = true
    api
      .get<{ vacinasAplicadas: string[] }>('/vacinas')
      .then((d) => active && setAplicadas(d.vacinasAplicadas))
      .catch(() => {})
      .finally(() => active && setLoading(false))
    void carregar()
    return () => {
      active = false
    }
  }, [carregar])

  // Clear the "just booked" flag once it has been seen.
  useEffect(() => {
    if (!acabouDeMarcar) return
    const t = setTimeout(() => setParams({}, { replace: true }), 6000)
    return () => clearTimeout(t)
  }, [acabouDeMarcar, setParams])

  async function cancelar(id: string) {
    setOcupadoId(id)
    setErro(null)
    try {
      const { agendamento } = await api.del<{ agendamento: Agendamento }>(`/agendamentos/${id}`)
      setAgendamentos((atual) => atual.map((a) => (a.id === id ? agendamento : a)))
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui atualizar agora.')
    } finally {
      setOcupadoId(null)
    }
  }

  const dataNascimentoIso = perfil?.dataNascimento ?? null
  const dob = dataNascimentoIso ? new Date(dataNascimentoIso) : null
  const dpp = perfil?.dpp ? new Date(perfil.dpp) : null

  const proximasDoses = useMemo(() => {
    if (!dataNascimentoIso) return []
    return calcularDosesVacinas(new Date(dataNascimentoIso), aplicadas)
      .filter((d) => d.status !== 'aplicada')
      .slice(0, 6)
  }, [dataNascimentoIso, aplicadas])

  const proximos = useMemo(
    () => agendamentos.filter((a) => STATUS_ATIVOS.includes(a.status) && ehFuturo(a)),
    [agendamentos],
  )
  const passados = useMemo(
    () => agendamentos.filter((a) => !STATUS_ATIVOS.includes(a.status) || !ehFuturo(a)).reverse(),
    [agendamentos],
  )

  const temDados = Boolean(dob || dpp)

  return (
    <div className="flex flex-col gap-lg">
      <header className="flex flex-col gap-1">
        <p className="u-eyebrow">Agenda</p>
        <h1 className="text-3xl sm:text-4xl">O que vem a seguir</h1>
        <p className="text-ink-soft">
          Consultas, exames e vacinas, organizados por data — sem você precisar lembrar de tudo.
        </p>
      </header>

      {acabouDeMarcar && (
        <div className="u-chip-success rounded-2xl p-md" role="status">
          <p className="font-display font-semibold">Pedido enviado 🎉</p>
          <p className="text-sm opacity-90">
            Assim que confirmarem, o status muda aqui — e você pode jogar no calendário do celular.
          </p>
        </div>
      )}

      {erro && <AlertaErro>{erro}</AlertaErro>}

      <MeusAgendamentos
        proximos={proximos}
        passados={passados}
        carregando={carregando}
        ocupadoId={ocupadoId}
        vista={vista}
        onVista={setVista}
        onCancelar={cancelar}
        onRemarcar={setRemarcando}
      />

      {remarcando && (
        <PainelRemarcar
          agendamento={remarcando}
          onFechar={() => setRemarcando(null)}
          onRemarcado={(a) => {
            setAgendamentos((atual) => atual.map((x) => (x.id === a.id ? a : x)))
            setRemarcando(null)
          }}
        />
      )}

      <DadosCrianca />

      {loading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
      ) : !temDados ? (
        <EmptyState
          titulo="Sua agenda começa com uma data"
          descricao="Informe acima em que ponto você está. A partir daí, a gente monta seu caminho com as datas certas."
          icon={<CalendarDays className="size-7" aria-hidden />}
        />
      ) : dpp ? (
        <AgendaGestante dpp={dpp} />
      ) : (
        <AgendaBebe doses={proximasDoses} />
      )}
    </div>
  )
}

/* ---------------------------- my appointments ---------------------------- */

function MeusAgendamentos({
  proximos,
  passados,
  carregando,
  ocupadoId,
  vista,
  onVista,
  onCancelar,
  onRemarcar,
}: {
  proximos: Agendamento[]
  passados: Agendamento[]
  carregando: boolean
  ocupadoId: string | null
  vista: 'lista' | 'mes'
  onVista: (v: 'lista' | 'mes') => void
  onCancelar: (id: string) => void
  onRemarcar: (a: Agendamento) => void
}) {
  const [mostrarPassados, setMostrarPassados] = useState(false)

  return (
    <section className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-sm font-semibold text-indigo">Suas consultas e exames</h2>
        {proximos.length > 0 && (
          <div className="flex gap-1 rounded-pill bg-paper-2 p-1" role="tablist" aria-label="Como ver a agenda">
            <BotaoVista ativo={vista === 'lista'} onClick={() => onVista('lista')} icon={List}>
              Lista
            </BotaoVista>
            <BotaoVista ativo={vista === 'mes'} onClick={() => onVista('mes')} icon={CalendarRange}>
              Mês
            </BotaoVista>
          </div>
        )}
      </div>

      {carregando ? (
        <Skeleton className="h-28" />
      ) : proximos.length === 0 ? (
        <div className="rounded-2xl border border-line bg-paper p-lg text-center shadow-soft">
          <span className="mx-auto grid size-12 place-items-center rounded-xl [background-image:var(--grad-brand-soft)] text-indigo">
            <CalendarDays className="size-6" aria-hidden />
          </span>
          <p className="mt-3 font-display font-semibold text-ink">Nada marcado ainda</p>
          <p className="mt-1 text-sm text-ink-soft">
            Quando marcar uma consulta ou exame, ele aparece aqui com dia, hora e status.
          </p>
          <Link
            to="/app/profissionais"
            className="mt-md inline-flex min-h-11 items-center gap-2 rounded-pill px-5 font-display text-sm font-semibold text-white shadow-soft [background-image:var(--grad-brand)]"
          >
            <Stethoscope className="size-4" aria-hidden />
            Marcar uma consulta
          </Link>
        </div>
      ) : vista === 'mes' ? (
        <VistaMes agendamentos={proximos} />
      ) : (
        <ul className="flex flex-col gap-3">
          {proximos.map((a) => (
            <CardAgendamento
              key={a.id}
              agendamento={a}
              papel="paciente"
              ocupado={ocupadoId === a.id}
              onCancelar={onCancelar}
              onRemarcar={onRemarcar}
            />
          ))}
        </ul>
      )}

      {passados.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setMostrarPassados((v) => !v)}
            className="mt-1 self-start rounded-pill px-2 py-1 text-sm font-semibold text-ink-soft hover:text-indigo"
          >
            {mostrarPassados ? 'Esconder histórico' : `Ver histórico (${passados.length})`}
          </button>
          {mostrarPassados && (
            <ul className="flex flex-col gap-3">
              {passados.map((a) => (
                <CardAgendamento key={a.id} agendamento={a} papel="paciente" />
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  )
}

function BotaoVista({
  ativo,
  onClick,
  icon: Icon,
  children,
}: {
  ativo: boolean
  onClick: () => void
  icon: typeof List
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={ativo}
      onClick={onClick}
      className={cn(
        'inline-flex min-h-9 items-center gap-1.5 rounded-pill px-3 font-display text-sm font-semibold transition-colors',
        ativo ? 'bg-paper text-indigo shadow-soft' : 'text-ink-soft hover:text-indigo',
      )}
    >
      <Icon className="size-4" aria-hidden />
      {children}
    </button>
  )
}

/** The month at a glance — dots mark days that already hold something. */
function VistaMes({ agendamentos }: { agendamentos: Agendamento[] }) {
  const porDia = useMemo(() => {
    const mapa = new Map<string, Agendamento[]>()
    for (const a of agendamentos) {
      const chave = paraChaveDia(new Date(a.inicio))
      mapa.set(chave, [...(mapa.get(chave) ?? []), a])
    }
    return mapa
  }, [agendamentos])

  const [dia, setDia] = useState<string | null>(() => {
    const primeiro = agendamentos[0]
    return primeiro ? paraChaveDia(new Date(primeiro.inicio)) : null
  })

  const doDia = dia ? (porDia.get(dia) ?? []) : []

  return (
    <div className="flex flex-col gap-md">
      <Calendario
        valor={dia}
        onSelecionar={setDia}
        diasMarcados={new Set(porDia.keys())}
        minimo="1900-01-01"
        legenda="Os pontinhos marcam os dias com algo agendado."
      />
      {dia && (
        <div>
          <p className="mb-2 font-display text-sm font-semibold first-letter:uppercase text-indigo">{rotuloDoDia(dia)}</p>
          {doDia.length === 0 ? (
            <p className="text-sm text-ink-mute">Nada marcado nesse dia.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {doDia.map((a) => (
                <li key={a.id} className="flex items-center gap-3 rounded-xl border border-line bg-paper p-3">
                  <span className="font-display font-bold text-indigo">{horaCurta(a.inicio)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-ink">{a.profissionalNome}</span>
                    <span className="block text-xs text-ink-mute">{OBJETIVO_LABEL[a.objetivo]}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

/* -------------------------------- reschedule ------------------------------ */

function PainelRemarcar({
  agendamento,
  onFechar,
  onRemarcado,
}: {
  agendamento: Agendamento
  onFechar: () => void
  onRemarcado: (a: Agendamento) => void
}) {
  const online = agendamento.origem === 'medico' && Boolean(agendamento.medicoId)
  const [dias, setDias] = useState<DiaComSlots[]>([])
  const [dia, setDia] = useState<string | null>(null)
  const [slot, setSlot] = useState<string | null>(null)
  const [hora, setHora] = useState('09:00')
  const [carregando, setCarregando] = useState(online)
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    if (!online) return
    let ativo = true
    const de = paraChaveDia(new Date())
    const ate = paraChaveDia(new Date(Date.now() + 60 * 86_400_000))
    api
      .get<{ dias: DiaComSlots[] }>(`/disponibilidade/${agendamento.medicoId}/slots?de=${de}&ate=${ate}`)
      .then((d) => {
        if (!ativo) return
        setDias(d.dias)
        setDia(d.dias[0]?.dia ?? null)
      })
      .catch(() => ativo && setDias([]))
      .finally(() => ativo && setCarregando(false))
    return () => {
      ativo = false
    }
  }, [online, agendamento.medicoId])

  const novoInicio = useMemo(() => {
    if (online) return slot
    if (!dia) return null
    const [h, m] = hora.split(':').map(Number)
    const d = new Date(`${dia}T00:00:00`)
    d.setHours(h, m, 0, 0)
    return d.toISOString()
  }, [online, slot, dia, hora])

  async function salvar() {
    if (!novoInicio) return
    setErro(null)
    setEnviando(true)
    try {
      const { agendamento: novo } = await api.patch<{ agendamento: Agendamento }>(
        `/agendamentos/${agendamento.id}`,
        { inicio: novoInicio },
      )
      onRemarcado(novo)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui remarcar agora.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <section className="rounded-2xl border-2 border-[var(--color-lilas-soft)] bg-paper p-lg shadow-soft">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg">Remarcar com {agendamento.profissionalNome}</h2>
        <button
          type="button"
          onClick={onFechar}
          className="min-h-9 rounded-pill px-3 text-sm font-semibold text-ink-soft hover:bg-paper-2"
        >
          Cancelar
        </button>
      </div>
      <p className="mt-1 text-sm text-ink-soft">
        Escolher outro horário devolve o agendamento para confirmação — quem aceitou concordou com um
        horário, não com qualquer horário.
      </p>

      <div className="mt-md">
        {carregando ? (
          <Skeleton className="h-64" />
        ) : online ? (
          <SeletorHorario
            dias={dias}
            diaSelecionado={dia}
            onSelecionarDia={(d) => {
              setDia(d)
              setSlot(null)
            }}
            slotSelecionado={slot}
            onSelecionarSlot={setSlot}
          />
        ) : (
          <div className="flex flex-col gap-md">
            <Calendario valor={dia} onSelecionar={setDia} />
            <div>
              <label className="text-sm font-semibold text-ink" htmlFor="hora-remarcar">
                Novo horário
              </label>
              <input
                id="hora-remarcar"
                type="time"
                value={hora}
                onChange={(e) => setHora(e.target.value)}
                className="input mt-1 w-40"
              />
            </div>
          </div>
        )}
      </div>

      {erro && <AlertaErro>{erro}</AlertaErro>}

      <button
        type="button"
        disabled={!novoInicio || enviando}
        onClick={salvar}
        className="mt-md inline-flex min-h-11 items-center gap-2 rounded-pill px-5 font-display text-sm font-semibold text-white shadow-soft [background-image:var(--grad-brand)] disabled:opacity-60"
      >
        {enviando ? 'Remarcando…' : 'Confirmar novo horário'}
      </button>
    </section>
  )
}

/* --------------------------- derived SUS schedule ------------------------- */

function AgendaBebe({ doses }: { doses: ReturnType<typeof calcularDosesVacinas> }) {
  if (doses.length === 0) {
    return (
      <div className="rounded-2xl bg-paper-2 p-lg text-center">
        <p className="font-display text-lg font-semibold text-indigo">Tudo em dia por aqui! 🎉</p>
        <p className="mt-1 text-ink-soft">Nenhuma vacina pendente no momento. Que trilha bem cuidada.</p>
      </div>
    )
  }
  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-display text-sm font-semibold text-indigo">Próximas vacinas</h2>
      <ol className="flex flex-col gap-2">
        {doses.map((d) => (
          <li
            key={d.vacina.id}
            className={cn(
              'flex items-center gap-3 rounded-xl border bg-paper p-3 shadow-soft',
              d.status === 'atrasada' ? 'border-[var(--color-warn)]' : 'border-line',
            )}
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-xl [background-image:var(--grad-brand-soft)] text-indigo">
              <Syringe className="size-5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-display font-semibold text-ink">
                {d.vacina.nome} <span className="text-ink-mute">· {d.vacina.dose}</span>
              </p>
              <p className="text-xs text-ink-mute">
                {d.vacina.idadeLabel} · {formatarData(d.data)}
                {d.status === 'atrasada' && <span className="font-semibold text-warn-ink"> · em atraso</span>}
              </p>
            </div>
            <ChipCobertura item="vacina" />
          </li>
        ))}
      </ol>
      <Link
        to="/app/vacinas"
        className="mt-1 inline-flex items-center gap-1 font-display text-sm font-semibold text-indigo hover:text-azul"
      >
        Ver a carteira completa <ArrowRight className="size-4" aria-hidden />
      </Link>

      <Link
        to="/app/profissionais?objetivo=consulta-crianca"
        className="mt-2 inline-flex min-h-11 items-center gap-2 self-start rounded-pill px-5 font-display text-sm font-semibold text-white shadow-soft [background-image:var(--grad-brand)]"
      >
        <Stethoscope className="size-4" aria-hidden />
        Marcar consulta com pediatra
      </Link>
    </section>
  )
}

function AgendaGestante({ dpp }: { dpp: Date }) {
  const semanas = semanasGestacionais(dpp)
  const triAtual = trimestreAtual(semanas)

  return (
    <div className="flex flex-col gap-lg">
      <div className="rounded-2xl border border-line bg-paper p-lg shadow-soft">
        <p className="font-display text-sm font-semibold text-indigo">Sua gestação</p>
        <p className="font-display text-2xl font-bold text-ink">Aproximadamente {semanas} semanas</p>
        <p className="text-sm text-ink-soft">
          Você está no <strong>{triAtual}º trimestre</strong>. Parto previsto para{' '}
          {dpp.toLocaleDateString('pt-BR')}.
        </p>
      </div>

      {EXAMES_PRENATAL.map((tri) => (
        <section
          key={tri.trimestre}
          className={cn(
            'rounded-2xl border p-lg shadow-soft',
            tri.trimestre === triAtual ? 'border-[var(--color-lilas)] bg-paper' : 'border-line bg-paper',
          )}
        >
          <div className="flex items-center justify-between gap-2">
            <h2 className="inline-flex items-center gap-2 text-lg">
              <TestTube2 className="size-5 text-indigo" aria-hidden />
              {tri.titulo}
            </h2>
            {tri.trimestre === triAtual && (
              <span className="rounded-pill [background-image:var(--grad-brand-soft)] px-3 py-1 text-xs font-semibold text-indigo">
                Agora
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-ink-mute">{tri.janela}</p>
          <ul className="mt-md flex flex-col gap-3">
            {tri.exames.map((ex) => (
              <li key={ex.nome} className="flex items-start gap-2 text-sm">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full [background-image:var(--grad-brand)]" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="font-semibold text-ink">{ex.nome}</span>
                  <span className="block text-ink-mute">{ex.motivo}</span>
                  <ChipCobertura item="exame-prenatal" className="mt-1" />
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <Link
        to="/app/profissionais?objetivo=consulta-gestante"
        className="inline-flex min-h-11 items-center gap-2 self-start rounded-pill px-5 font-display text-sm font-semibold text-white shadow-soft [background-image:var(--grad-brand)]"
      >
        <Stethoscope className="size-4" aria-hidden />
        Marcar com obstetra ou enfermeira
      </Link>

      <p className="rounded-xl bg-paper-2 p-md text-xs text-ink-mute">
        Fonte: {REFERENCIA_PRENATAL} Conteúdo informativo — a solicitação e a leitura dos exames são
        sempre da sua equipe.
      </p>
    </div>
  )
}
