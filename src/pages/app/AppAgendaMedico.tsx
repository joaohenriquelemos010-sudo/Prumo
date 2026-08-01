import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarClock, CalendarOff, Check, Inbox, Plus, Settings2, Trash2, Users } from 'lucide-react'
import { api } from '@/lib/api/client'
import { Button } from '@/components/Button'
import { Skeleton } from '@/components/Skeleton'
import { AlertaErro } from '@/components/AlertaErro'
import { ListaEspera } from '@/features/agenda/ListaEspera'
import { TiposAtendimento } from '@/features/agenda/TiposAtendimento'
import { CardAgendamento } from '@/features/agenda/CardAgendamento'
import { AgendaCalendario } from '@/features/agenda/AgendaCalendario'
import { paraChaveDia, horaCurta, MODALIDADE_LABEL } from '@/features/agenda/agenda'
import type { Agendamento, ModalidadeAgendamento } from '@/features/agenda/agenda'
import { OPERADORAS } from '@/features/clinico/convenios'
import { cn } from '@/lib/cn'

interface Regra {
  id?: string
  diaSemana: number
  inicio: string
  fim: string
  modalidades: ModalidadeAgendamento[]
  local: string
}

interface Bloqueio {
  id?: string
  de: string
  ate: string
  motivo: string
}

interface Disponibilidade {
  ativo: boolean
  almoco: { inicio: string; fim: string }
  duracaoPadraoMin: number
  antecedenciaMinHoras: number
  janelaMaxDias: number
  fuso: string
  regras: Regra[]
  bloqueios: Bloqueio[]
  conveniosAtendidos: string[]
  atendeParticular: boolean
  atendeSus: boolean
}

const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
const DIAS_CURTOS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
const MODALIDADES: ModalidadeAgendamento[] = ['presencial', 'teleconsulta', 'domiciliar']

type Aba = 'dia' | 'pedidos' | 'espera' | 'disponibilidade'

/**
 * The doctor's side of the agenda — the half that did not exist. Three jobs:
 * run today, answer what's waiting, and decide when you can be booked.
 */
export default function AppAgendaMedico() {
  const [aba, setAba] = useState<Aba>('dia')
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([])
  const [carregando, setCarregando] = useState(true)
  const [ocupadoId, setOcupadoId] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    try {
      const { agendamentos: lista } = await api.get<{ agendamentos: Agendamento[] }>(
        '/agendamentos?meus=true',
      )
      setAgendamentos(lista)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui carregar sua agenda.')
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    void carregar()
  }, [carregar])

  async function atualizar(id: string, corpo: Record<string, unknown>) {
    setOcupadoId(id)
    setErro(null)
    try {
      const { agendamento } = await api.patch<{ agendamento: Agendamento }>(
        `/agendamentos/${id}`,
        corpo,
      )
      setAgendamentos((atual) => atual.map((a) => (a.id === id ? agendamento : a)))
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui atualizar agora.')
    } finally {
      setOcupadoId(null)
    }
  }

  const pendentes = useMemo(() => agendamentos.filter((a) => a.status === 'pendente'), [agendamentos])
  const aFechar = useMemo(
    () => agendamentos.filter((a) => a.status === 'confirmado' && new Date(a.inicio).getTime() < Date.now()),
    [agendamentos],
  )


  return (
    <div className="flex flex-col gap-md">
      {/*
        Cabeçalho compacto na aba do calendário.
        A grade é a informação; título grande e subtítulo explicativo empurravam
        um dia inteiro de trabalho para baixo da dobra. Nas outras abas o título
        continua inteiro, porque lá ele orienta.
      */}
      <header className="flex flex-col gap-1">
        {aba === 'dia' ? (
          <h1 className="text-2xl">Sua agenda</h1>
        ) : (
          <>
            <p className="u-eyebrow">Agenda</p>
            <h1 className="text-3xl sm:text-4xl">Sua agenda</h1>
            <p className="text-ink-soft">
              O que está marcado, o que espera resposta e quando você pode ser agendada.
            </p>
          </>
        )}
      </header>

      {erro && <AlertaErro>{erro}</AlertaErro>}

      <div className="flex flex-wrap gap-1 rounded-pill bg-paper-2 p-1" role="tablist">
        <TabBtn ativo={aba === 'dia'} onClick={() => setAba('dia')} icon={CalendarClock}>
          Calendário
        </TabBtn>
        <TabBtn ativo={aba === 'pedidos'} onClick={() => setAba('pedidos')} icon={Inbox} contador={pendentes.length}>
          Pedidos
        </TabBtn>
        <TabBtn ativo={aba === 'espera'} onClick={() => setAba('espera')} icon={Users}>
          Espera
        </TabBtn>
        <TabBtn ativo={aba === 'disponibilidade'} onClick={() => setAba('disponibilidade')} icon={Settings2}>
          Configurar
        </TabBtn>
      </div>

      {aba === 'dia' && (
        <>
          {/*
            A grade responde a pergunta que se faz o dia inteiro no consultório —
            *onde tem meia hora livre na quinta?* — sem ler nada: o espaço vazio
            é a resposta. A lista de cartões que estava aqui exigia ler tudo e
            subtrair de cabeça.
          */}
          <AgendaCalendario />

          {aFechar.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="font-display text-sm font-semibold text-indigo">Fechar atendimento</h2>
              <p className="text-sm text-ink-soft">
                Já passou do horário. Registre o desfecho para o histórico da paciente ficar
                completo.
              </p>
              <ul className="flex flex-col gap-3">
                {aFechar.map((a) => (
                  <CardAgendamento
                    key={a.id}
                    agendamento={a}
                    papel="profissional"
                    mostrarPaciente
                    ocupado={ocupadoId === a.id}
                    onRealizado={(id, compareceu) =>
                      atualizar(id, { status: compareceu ? 'realizado' : 'faltou' })
                    }
                  />
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      {aba === 'pedidos' &&
        (carregando ? (
          <Skeleton className="h-40" />
        ) : pendentes.length === 0 ? (
          <div className="rounded-2xl border border-line bg-paper p-lg text-center shadow-soft">
            <span className="mx-auto grid size-12 place-items-center rounded-xl [background-image:var(--grad-brand-soft)] text-indigo">
              <Inbox className="size-6" aria-hidden />
            </span>
            <p className="mt-3 font-display font-semibold text-ink">Nenhum pedido esperando</p>
            <p className="mt-1 text-sm text-ink-soft">Tudo respondido. 🎉</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {pendentes.map((a) => (
              <CardAgendamento
                key={a.id}
                agendamento={a}
                papel="profissional"
                mostrarPaciente
                ocupado={ocupadoId === a.id}
                onConfirmar={(id) => atualizar(id, { status: 'confirmado' })}
                onRecusar={(id, motivo) => atualizar(id, { status: 'recusado', motivo })}
              />
            ))}
          </ul>
        ))}

      {aba === 'espera' && <ListaEspera />}

      {/*
        Disponibilidade e catálogo de tipos moram na mesma aba de propósito: são
        as duas metades da mesma pergunta — quando eu atendo, e do que é cada
        atendimento. Separá-las faria o médico configurar uma e esquecer a outra,
        e é a combinação das duas que gera os horários da agenda.
      */}
      {aba === 'disponibilidade' && (
        <div className="flex flex-col gap-lg">
          <EditorDisponibilidade />
          <TiposAtendimento />
        </div>
      )}
    </div>
  )
}

function TabBtn({
  ativo,
  onClick,
  icon: Icon,
  contador,
  children,
}: {
  ativo: boolean
  onClick: () => void
  icon: typeof Inbox
  contador?: number
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={ativo}
      onClick={onClick}
      className={cn(
        'inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-pill px-3 font-display text-sm font-semibold transition-colors',
        ativo ? 'bg-paper text-indigo shadow-soft' : 'text-ink-soft hover:text-indigo',
      )}
    >
      <Icon className="size-4 shrink-0" aria-hidden />
      {children}
      {contador ? (
        <span className="u-chip-warn rounded-pill px-1.5 text-xs">{contador}</span>
      ) : null}
    </button>
  )
}

/* -------------------------- availability editor -------------------------- */

function EditorDisponibilidade() {
  const [disp, setDisp] = useState<Disponibilidade | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [salvo, setSalvo] = useState(false)

  useEffect(() => {
    api
      .get<{ disponibilidade: Disponibilidade }>('/disponibilidade/me')
      .then((d) => setDisp(d.disponibilidade))
      .catch((e) => setErro(e instanceof Error ? e.message : 'Não consegui carregar.'))
      .finally(() => setCarregando(false))
  }, [])

  function mudar(patch: Partial<Disponibilidade>) {
    setDisp((d) => (d ? { ...d, ...patch } : d))
    setSalvo(false)
  }

  async function salvar() {
    if (!disp) return
    setErro(null)
    setSalvando(true)
    try {
      const { disponibilidade } = await api.put<{ disponibilidade: Disponibilidade }>(
        '/disponibilidade/me',
        {
          ativo: disp.ativo,
          duracaoPadraoMin: disp.duracaoPadraoMin,
          almoco: disp.almoco ?? { inicio: '', fim: '' },
          antecedenciaMinHoras: disp.antecedenciaMinHoras,
          janelaMaxDias: disp.janelaMaxDias,
          regras: disp.regras.map(({ diaSemana, inicio, fim, modalidades, local }) => ({
            diaSemana,
            inicio,
            fim,
            modalidades,
            local,
          })),
          bloqueios: disp.bloqueios.map(({ de, ate, motivo }) => ({ de, ate, motivo })),
          conveniosAtendidos: disp.conveniosAtendidos,
          atendeParticular: disp.atendeParticular,
          atendeSus: disp.atendeSus,
        },
      )
      setDisp(disponibilidade)
      setSalvo(true)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui salvar agora.')
    } finally {
      setSalvando(false)
    }
  }

  if (carregando) return <Skeleton className="h-64" />
  if (!disp) return <AlertaErro>{erro ?? 'Não consegui carregar sua disponibilidade.'}</AlertaErro>

  return (
    <div className="flex flex-col gap-md">
      <section className="rounded-2xl border border-line bg-paper p-lg shadow-soft">
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={disp.ativo}
            onChange={(e) => mudar({ ativo: e.target.checked })}
            className="mt-1 size-5 shrink-0 accent-[var(--color-lilas)]"
          />
          <span>
            <span className="block font-display font-semibold text-ink">Abrir minha agenda online</span>
            <span className="block text-sm text-ink-soft">
              Com isso ligado, as famílias veem seus horários livres e marcam direto — você só confirma.
              Desligado, você continua aparecendo na busca, mas sem horários.
            </span>
          </span>
        </label>
      </section>

      <section className="rounded-2xl border border-line bg-paper p-lg shadow-soft">
        <h2 className="text-lg">Como funciona sua consulta</h2>
        <div className="mt-md grid gap-md sm:grid-cols-3">
          <CampoNumero
            label="Duração"
            sufixo="min"
            valor={disp.duracaoPadraoMin}
            min={10}
            max={240}
            passo={5}
            onChange={(v) => mudar({ duracaoPadraoMin: v })}
            ajuda="Tamanho de cada horário."
          />
          <CampoNumero
            label="Antecedência"
            sufixo="h"
            valor={disp.antecedenciaMinHoras}
            min={0}
            max={720}
            passo={1}
            onChange={(v) => mudar({ antecedenciaMinHoras: v })}
            ajuda="Quanto antes precisa ser marcado."
          />
          <CampoNumero
            label="Abrir até"
            sufixo="dias"
            valor={disp.janelaMaxDias}
            min={1}
            max={365}
            passo={1}
            onChange={(v) => mudar({ janelaMaxDias: v })}
            ajuda="Horizonte visível da agenda."
          />
        </div>

        {/*
          O almoço vale para todos os dias que têm regra.
          Dava para expressá-lo com duas regras no mesmo dia (09–12 e 14–18) — e
          era como funcionava. Só que ninguém descobre sozinho, e o resultado
          prático era agenda aberta na hora do almoço.
        */}
        <div className="mt-md flex flex-wrap items-end gap-3">
          <label className="text-sm">
            Almoço — de
            <input
              type="time"
              value={disp.almoco?.inicio ?? ''}
              onChange={(e) => mudar({ almoco: { ...disp.almoco, inicio: e.target.value } })}
              className="input mt-1"
            />
          </label>
          <label className="text-sm">
            até
            <input
              type="time"
              value={disp.almoco?.fim ?? ''}
              onChange={(e) => mudar({ almoco: { ...disp.almoco, fim: e.target.value } })}
              className="input mt-1"
            />
          </label>
          {(disp.almoco?.inicio || disp.almoco?.fim) && (
            <button
              type="button"
              className="pb-2 text-sm text-ink-soft underline"
              onClick={() => mudar({ almoco: { inicio: '', fim: '' } })}
            >
              Sem intervalo
            </button>
          )}
          <p className="w-full text-xs text-ink-mute">
            Vale para todos os dias. Em branco significa que você atende direto.
          </p>
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-paper p-lg shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg">Seus horários na semana</h2>
          <Button
            size="md"
            variant="secondary"
            iconLeft={<Plus className="size-4" aria-hidden />}
            onClick={() =>
              mudar({
                regras: [
                  ...disp.regras,
                  { diaSemana: 1, inicio: '09:00', fim: '12:00', modalidades: ['presencial'], local: '' },
                ],
              })
            }
          >
            Adicionar faixa
          </Button>
        </div>

        {disp.regras.length === 0 ? (
          <p className="mt-md text-sm text-ink-mute">
            Nenhuma faixa ainda. Adicione, por exemplo, “terça, das 09:00 às 12:00”.
          </p>
        ) : (
          <ul className="mt-md flex flex-col gap-3">
            {disp.regras.map((r, i) => (
              <li key={i} className="rounded-xl bg-paper-2 p-3">
                <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto_auto]">
                  <label className="sr-only" htmlFor={`dia-${i}`}>
                    Dia da semana
                  </label>
                  <select
                    id={`dia-${i}`}
                    value={r.diaSemana}
                    onChange={(e) => {
                      const regras = [...disp.regras]
                      regras[i] = { ...r, diaSemana: Number(e.target.value) }
                      mudar({ regras })
                    }}
                    className="input h-11 py-0"
                  >
                    {DIAS.map((d, idx) => (
                      <option key={d} value={idx}>
                        {d}
                      </option>
                    ))}
                  </select>
                  <input
                    type="time"
                    aria-label="Início"
                    value={r.inicio}
                    onChange={(e) => {
                      const regras = [...disp.regras]
                      regras[i] = { ...r, inicio: e.target.value }
                      mudar({ regras })
                    }}
                    className="input h-11 py-0"
                  />
                  <input
                    type="time"
                    aria-label="Fim"
                    value={r.fim}
                    onChange={(e) => {
                      const regras = [...disp.regras]
                      regras[i] = { ...r, fim: e.target.value }
                      mudar({ regras })
                    }}
                    className="input h-11 py-0"
                  />
                  <button
                    type="button"
                    aria-label={`Remover faixa de ${DIAS[r.diaSemana]}`}
                    onClick={() => mudar({ regras: disp.regras.filter((_, idx) => idx !== i) })}
                    className="grid size-11 place-items-center rounded-lg text-ink-mute hover:bg-paper hover:text-warn-ink"
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                </div>

                <div className="mt-2 flex flex-wrap gap-1.5">
                  {MODALIDADES.map((m) => {
                    const ativa = r.modalidades.includes(m)
                    return (
                      <button
                        key={m}
                        type="button"
                        aria-pressed={ativa}
                        onClick={() => {
                          const modalidades = ativa
                            ? r.modalidades.filter((x) => x !== m)
                            : [...r.modalidades, m]
                          if (modalidades.length === 0) return // at least one
                          const regras = [...disp.regras]
                          regras[i] = { ...r, modalidades }
                          mudar({ regras })
                        }}
                        className={cn(
                          'min-h-9 rounded-pill border px-3 text-xs font-semibold',
                          ativa
                            ? 'border-transparent [background-image:var(--grad-brand)] text-white'
                            : 'border-line bg-paper text-ink-soft',
                        )}
                      >
                        {MODALIDADE_LABEL[m]}
                      </button>
                    )
                  })}
                  <input
                    aria-label="Local"
                    value={r.local}
                    onChange={(e) => {
                      const regras = [...disp.regras]
                      regras[i] = { ...r, local: e.target.value }
                      mudar({ regras })
                    }}
                    placeholder="Local (opcional)"
                    maxLength={160}
                    className="input h-9 flex-1 py-0 text-xs"
                  />
                </div>
              </li>
            ))}
          </ul>
        )}

        {disp.regras.length > 0 && (
          <p className="mt-md text-xs text-ink-mute">
            Resumo:{' '}
            {disp.regras
              .map((r) => `${DIAS_CURTOS[r.diaSemana]} ${r.inicio}–${r.fim}`)
              .join(' · ')}
          </p>
        )}
      </section>

      <section className="rounded-2xl border border-line bg-paper p-lg shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="inline-flex items-center gap-2 text-lg">
            <CalendarOff className="size-5 text-indigo" aria-hidden />
            Bloqueios
          </h2>
          <Button
            size="md"
            variant="secondary"
            iconLeft={<Plus className="size-4" aria-hidden />}
            onClick={() => {
              const hoje = paraChaveDia(new Date())
              mudar({
                bloqueios: [
                  ...disp.bloqueios,
                  { de: `${hoje}T00:00`, ate: `${hoje}T23:59`, motivo: '' },
                ],
              })
            }}
          >
            Adicionar
          </Button>
        </div>
        <p className="mt-1 text-sm text-ink-soft">Férias, congresso, uma tarde de cirurgia.</p>

        {disp.bloqueios.length > 0 && (
          <ul className="mt-md flex flex-col gap-2">
            {disp.bloqueios.map((b, i) => (
              <li key={i} className="grid gap-2 rounded-xl bg-paper-2 p-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
                <input
                  type="datetime-local"
                  aria-label="Início do bloqueio"
                  value={paraLocalInput(b.de)}
                  onChange={(e) => {
                    const bloqueios = [...disp.bloqueios]
                    bloqueios[i] = { ...b, de: e.target.value }
                    mudar({ bloqueios })
                  }}
                  className="input h-11 py-0 text-sm"
                />
                <input
                  type="datetime-local"
                  aria-label="Fim do bloqueio"
                  value={paraLocalInput(b.ate)}
                  onChange={(e) => {
                    const bloqueios = [...disp.bloqueios]
                    bloqueios[i] = { ...b, ate: e.target.value }
                    mudar({ bloqueios })
                  }}
                  className="input h-11 py-0 text-sm"
                />
                <input
                  aria-label="Motivo"
                  value={b.motivo}
                  onChange={(e) => {
                    const bloqueios = [...disp.bloqueios]
                    bloqueios[i] = { ...b, motivo: e.target.value }
                    mudar({ bloqueios })
                  }}
                  placeholder="Motivo (opcional)"
                  maxLength={160}
                  className="input h-11 py-0 text-sm"
                />
                <button
                  type="button"
                  aria-label="Remover bloqueio"
                  onClick={() => mudar({ bloqueios: disp.bloqueios.filter((_, idx) => idx !== i) })}
                  className="grid size-11 place-items-center rounded-lg text-ink-mute hover:bg-paper hover:text-warn-ink"
                >
                  <Trash2 className="size-4" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-line bg-paper p-lg shadow-soft">
        <h2 className="text-lg">Convênios que você atende</h2>
        <p className="mt-1 text-sm text-ink-soft">
          É o que permite a família filtrar por “atende meu plano”.
        </p>
        <div className="mt-md flex flex-wrap gap-1.5">
          {OPERADORAS.map((op) => {
            const ativo = disp.conveniosAtendidos.includes(op)
            return (
              <button
                key={op}
                type="button"
                aria-pressed={ativo}
                onClick={() =>
                  mudar({
                    conveniosAtendidos: ativo
                      ? disp.conveniosAtendidos.filter((c) => c !== op)
                      : [...disp.conveniosAtendidos, op],
                  })
                }
                className={cn(
                  'min-h-9 rounded-pill border px-3 text-sm font-semibold',
                  ativo
                    ? 'border-transparent [background-image:var(--grad-brand)] text-white'
                    : 'border-line bg-paper text-ink-soft hover:text-indigo',
                )}
              >
                {op}
              </button>
            )
          })}
        </div>
        <div className="mt-md flex flex-wrap gap-md">
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-semibold text-ink-soft">
            <input
              type="checkbox"
              checked={disp.atendeParticular}
              onChange={(e) => mudar({ atendeParticular: e.target.checked })}
              className="size-4 accent-[var(--color-lilas)]"
            />
            Atendo particular
          </label>
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-semibold text-ink-soft">
            <input
              type="checkbox"
              checked={disp.atendeSus}
              onChange={(e) => mudar({ atendeSus: e.target.checked })}
              className="size-4 accent-[var(--color-lilas)]"
            />
            Atendo pelo SUS
          </label>
        </div>
      </section>

      {erro && <AlertaErro>{erro}</AlertaErro>}

      <div className="flex flex-wrap items-center gap-3">
        <Button size="md" loading={salvando} onClick={salvar}>
          Salvar disponibilidade
        </Button>
        {salvo && (
          <span className="inline-flex items-center gap-1 text-sm font-semibold text-success-ink" role="status">
            <Check className="size-4" aria-hidden /> Salvo
          </span>
        )}
      </div>
    </div>
  )
}

function CampoNumero({
  label,
  sufixo,
  valor,
  min,
  max,
  passo,
  onChange,
  ajuda,
}: {
  label: string
  sufixo: string
  valor: number
  min: number
  max: number
  passo: number
  onChange: (v: number) => void
  ajuda: string
}) {
  const id = `campo-${label.toLowerCase().replace(/\s/g, '-')}`
  return (
    <div>
      <label className="block text-sm font-semibold text-ink" htmlFor={id}>
        {label}
      </label>
      <div className="mt-1 flex items-center gap-2">
        <input
          id={id}
          type="number"
          value={valor}
          min={min}
          max={max}
          step={passo}
          onChange={(e) => onChange(Number(e.target.value))}
          className="input h-11 w-24 py-0"
        />
        <span className="text-sm text-ink-mute">{sufixo}</span>
      </div>
      <p className="mt-1 text-xs text-ink-mute">{ajuda}</p>
    </div>
  )
}

/** `datetime-local` wants 'YYYY-MM-DDTHH:MM' with no zone or seconds. */
function paraLocalInput(iso: string): string {
  if (!iso) return ''
  if (!iso.includes('Z') && iso.length <= 16) return iso
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${paraChaveDia(d)}T${horaCurta(d.toISOString())}`
}
