import { useCallback, useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Wallet, Plus, Check, Undo2, ChevronDown } from 'lucide-react'
import { api } from '@/lib/api/client'
import { molas } from '@/lib/motion'
import { reais, paraCentavos, FORMAS, rotuloDaForma, rotuloDaCompetencia } from '@/lib/dinheiro'
import { Button } from '@/components/Button'
import { EmptyState } from '@/components/EmptyState'
import { Skeleton } from '@/components/Skeleton'
import { AlertaErro } from '@/components/AlertaErro'
import { BotaoExcluir } from '@/components/BotaoExcluir'
import { cn } from '@/lib/cn'

interface Recebimento {
  id: string
  pacienteNome: string
  valorCentavos: number
  forma: string
  convenio: string
  estado: 'previsto' | 'recebido' | 'cancelado'
  dataAtendimento: string
  recebidoEm: string | null
  observacao: string
}

interface Resumo {
  recebidoCentavos: number
  previstoCentavos: number
  totalCentavos: number
  atendimentos: number
  porForma: { forma: string; centavos: number; atendimentos: number }[]
  particularCentavos: number
  convenioCentavos: number
  ticketMedioCentavos: number
}

interface Resposta {
  competencia: string
  recebimentos: Recebimento[]
  resumo: Resumo
}

interface Pendente {
  id: string
  pacienteNome: string
  inicio: string
  objetivo: string
  convenio: string
}

function dia(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

/**
 * O financeiro da médica.
 *
 * ## O que esta tela responde
 *
 * Uma pergunta: *quanto entrou este mês?* Tudo aqui existe para respondê-la, e o
 * que não serve a ela ficou de fora — inclusive TISS, que é meses de trabalho e
 * só paga para quem fatura convênio direto.
 *
 * ## Isto não é dado clínico
 *
 * O escopo é por médico, e não por jornada: quanto ele cobrou é o negócio dele,
 * e a paciente não tem nada com isso. Um recebimento nunca aparece na exportação
 * LGPD dela nem no pacote de transferência.
 */
export default function AppFinanceiro() {
  const reduzido = useReducedMotion()
  const [dados, setDados] = useState<Resposta | null>(null)
  const [meses, setMeses] = useState<string[]>([])
  const [competencia, setCompetencia] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [novo, setNovo] = useState(false)
  const [pendentes, setPendentes] = useState<Pendente[]>([])
  const [cobrando, setCobrando] = useState<Pendente | null>(null)

  const carregar = useCallback(
    async (mes?: string) => {
      setCarregando(true)
      try {
        const url = mes ? `/financeiro?competencia=${mes}` : '/financeiro'
        const r = await api.get<Resposta>(url)
        setDados(r)
        setCompetencia(r.competencia)
      } catch (e) {
        setErro(e instanceof Error ? e.message : 'Não consegui carregar agora.')
      } finally {
        setCarregando(false)
      }
    },
    [],
  )

  const recarregarAuxiliares = useCallback(async () => {
    const [m, p] = await Promise.all([
      api.get<{ meses: string[] }>('/financeiro/meses').catch(() => null),
      api.get<{ pendentes: Pendente[] }>('/financeiro/pendentes').catch(() => null),
    ])
    if (m) setMeses(m.meses)
    if (p) setPendentes(p.pendentes)
  }, [])

  useEffect(() => {
    void carregar()
    void recarregarAuxiliares()
  }, [carregar, recarregarAuxiliares])

  async function mudarEstado(id: string, estado: Recebimento['estado']) {
    await api.patch(`/financeiro/${id}`, { estado }).catch(() => {})
    await carregar(competencia)
  }

  async function excluir(id: string) {
    await api.del(`/financeiro/${id}`).catch(() => {})
    await carregar(competencia)
  }

  const resumo = dados?.resumo

  return (
    <div className="flex flex-col gap-lg">
      <header className="flex flex-col gap-1">
        <p className="u-eyebrow">Financeiro</p>
        <h1 className="text-3xl sm:text-4xl">Quanto entrou</h1>
        <p className="text-ink-soft">
          O que você cobrou e o que já recebeu. Estes números são seus — nenhuma paciente vê nada
          disto.
        </p>
      </header>

      {/* O seletor lista só os meses que têm algo: oferecer dezembro de 2019 e
          a pessoa descobrir que está vazio depois de clicar é ruído. */}
      {meses.length > 1 && (
        <label className="relative self-start">
          <span className="sr-only">Mês</span>
          <select
            value={competencia}
            onChange={(e) => void carregar(e.target.value)}
            className="min-h-11 appearance-none rounded-pill border border-line bg-paper py-2 pl-4 pr-10 font-display text-sm font-semibold text-indigo"
          >
            {meses.map((m) => (
              <option key={m} value={m}>
                {rotuloDaCompetencia(m)}
              </option>
            ))}
          </select>
          <ChevronDown
            className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-ink-mute"
            aria-hidden
          />
        </label>
      )}

      {erro && <AlertaErro>{erro}</AlertaErro>}

      {carregando ? (
        <Skeleton className="h-40 rounded-2xl" />
      ) : resumo ? (
        <section className="grid gap-3 sm:grid-cols-3">
          <Cartao
            titulo="Recebido"
            valor={reais(resumo.recebidoCentavos)}
            nota={`${resumo.atendimentos} ${resumo.atendimentos === 1 ? 'atendimento' : 'atendimentos'}`}
            destaque
          />
          <Cartao
            titulo="A receber"
            valor={reais(resumo.previstoCentavos)}
            nota={resumo.previstoCentavos > 0 ? 'ainda não entrou' : 'nada pendente'}
          />
          <Cartao
            titulo="Ticket médio"
            valor={reais(resumo.ticketMedioCentavos)}
            nota="do que já foi recebido"
          />
        </section>
      ) : null}

      {resumo && resumo.recebidoCentavos > 0 && (
        <section className="rounded-2xl border border-line bg-paper p-lg shadow-soft">
          <h2 className="text-lg">De onde veio</h2>
          <div className="mt-md flex flex-col gap-2">
            <Barra
              rotulo="Particular"
              centavos={resumo.particularCentavos}
              total={resumo.recebidoCentavos}
            />
            <Barra
              rotulo="Convênio"
              centavos={resumo.convenioCentavos}
              total={resumo.recebidoCentavos}
            />
          </div>

          <ul className="mt-md flex flex-wrap gap-2">
            {resumo.porForma.map((f) => (
              <li
                key={f.forma}
                className="rounded-pill bg-paper-2 px-3 py-1.5 text-sm text-ink-soft"
              >
                <span className="font-display font-semibold text-indigo">
                  {rotuloDaForma(f.forma)}
                </span>{' '}
                {reais(f.centavos)}
              </li>
            ))}
          </ul>
        </section>
      )}

      {pendentes.length > 0 && !cobrando && (
        <section className="rounded-2xl border border-line bg-paper p-lg shadow-soft">
          <h2 className="text-lg">Atendimentos sem lançamento</h2>
          <p className="mt-1 text-sm text-ink-soft">
            A agenda já sabe quem você atendeu. Um toque lança — sem digitar de novo.
          </p>
          <ul className="mt-md flex flex-col gap-2">
            {pendentes.slice(0, 8).map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-2 rounded-xl bg-paper-2 p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display font-semibold text-ink">
                    {p.pacienteNome || 'Atendimento'}
                  </p>
                  <p className="text-xs text-ink-mute">
                    {dia(p.inicio)}
                    {p.convenio ? ` · ${p.convenio}` : ''}
                  </p>
                </div>
                <Button size="sm" variant="secondary" onClick={() => setCobrando(p)}>
                  Lançar
                </Button>
              </li>
            ))}
          </ul>
          {pendentes.length > 8 && (
            <p className="mt-2 text-xs text-ink-mute">
              e mais {pendentes.length - 8} — os oito mais recentes aparecem primeiro.
            </p>
          )}
        </section>
      )}

      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg">Lançamentos</h2>
        {!novo && (
          <Button size="sm" variant="secondary" iconLeft={<Plus className="size-4" />} onClick={() => setNovo(true)}>
            Novo lançamento
          </Button>
        )}
      </div>

      {(novo || cobrando) && (
        <NovoLancamento
          pendente={cobrando}
          onSalvo={async () => {
            setNovo(false)
            setCobrando(null)
            await carregar(competencia)
            await recarregarAuxiliares()
          }}
          onCancelar={() => {
            setNovo(false)
            setCobrando(null)
          }}
        />
      )}

      {!carregando && (dados?.recebimentos.length ?? 0) === 0 && !novo ? (
        <EmptyState
          icon={<Wallet size={28} />}
          titulo="Nada lançado neste mês"
          descricao="Registre o que cobrou por cada atendimento e o mês fecha sozinho."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {(dados?.recebimentos ?? []).map((r) => (
            <motion.li
              key={r.id}
              layout={reduzido ? false : 'position'}
              transition={reduzido ? { duration: 0 } : molas.suave}
              className={cn(
                'flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-paper p-md shadow-soft',
                r.estado === 'cancelado' && 'opacity-60',
              )}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-display font-semibold text-ink">
                  {r.pacienteNome || 'Atendimento'}
                </p>
                <p className="text-sm text-ink-soft">
                  {dia(r.dataAtendimento)} · {rotuloDaForma(r.forma)}
                  {r.convenio ? ` (${r.convenio})` : ''}
                  {r.observacao ? ` · ${r.observacao}` : ''}
                </p>
              </div>

              <p
                className={cn(
                  'font-display text-lg font-bold',
                  r.estado === 'recebido' ? 'text-success-ink' : 'text-ink-soft',
                  r.estado === 'cancelado' && 'line-through',
                )}
              >
                {reais(r.valorCentavos)}
              </p>

              <div className="flex shrink-0 gap-1.5">
                {r.estado === 'previsto' && (
                  <button
                    type="button"
                    onClick={() => void mudarEstado(r.id, 'recebido')}
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-pill border border-line px-3 text-sm font-semibold text-indigo hover:bg-paper-2"
                  >
                    <Check className="size-4" aria-hidden />
                    Recebi
                  </button>
                )}
                {r.estado === 'recebido' && (
                  <button
                    type="button"
                    aria-label="Voltar para a receber"
                    onClick={() => void mudarEstado(r.id, 'previsto')}
                    className="grid size-9 place-items-center rounded-pill text-ink-mute hover:bg-paper-2"
                  >
                    <Undo2 className="size-4" aria-hidden />
                  </button>
                )}
                <BotaoExcluir onConfirm={() => void excluir(r.id)} titulo="Excluir lançamento" />
              </div>
            </motion.li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Cartao({
  titulo,
  valor,
  nota,
  destaque,
}: {
  titulo: string
  valor: string
  nota?: string
  destaque?: boolean
}) {
  return (
    <div
      className={cn(
        'rounded-2xl border p-lg shadow-soft',
        destaque ? 'border-transparent [background-image:var(--grad-brand-soft)]' : 'border-line bg-paper',
      )}
    >
      <p className="u-eyebrow">{titulo}</p>
      <p className="mt-1 font-display text-2xl font-bold text-indigo">{valor}</p>
      {nota ? <p className="mt-0.5 text-xs text-ink-mute">{nota}</p> : null}
    </div>
  )
}

function Barra({ rotulo, centavos, total }: { rotulo: string; centavos: number; total: number }) {
  const pct = total > 0 ? Math.round((centavos / total) * 100) : 0
  return (
    <div>
      <div className="flex justify-between text-sm">
        <span className="font-semibold text-ink">{rotulo}</span>
        <span className="text-ink-soft">
          {reais(centavos)} · {pct}%
        </span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-pill bg-paper-3">
        <div className="h-full rounded-pill [background-image:var(--grad-brand)]" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

/**
 * O formulário.
 *
 * O valor entra como texto e vira centavos com `paraCentavos` — a mesma função
 * do servidor, e um teste compara as duas caso a caso. "1.500" e "1.500,00"
 * chegam os dois em R$ 1.500,00, que é o que a médica quis dizer nos dois casos.
 */
function NovoLancamento({
  pendente,
  onSalvo,
  onCancelar,
}: {
  /** Quando vem de um atendimento da agenda, o formulário já chega preenchido. */
  pendente?: Pendente | null
  onSalvo: () => void | Promise<void>
  onCancelar: () => void
}) {
  const [paciente, setPaciente] = useState(pendente?.pacienteNome ?? '')
  const [valor, setValor] = useState('')
  // Um agendamento com convênio anotado já chega como convênio: repetir a
  // escolha que a agenda já sabe é a digitação dupla que este atalho evita.
  const [forma, setForma] = useState(pendente?.convenio ? 'convenio' : 'pix')
  const [convenio, setConvenio] = useState(pendente?.convenio ?? '')
  const [jaRecebi, setJaRecebi] = useState(true)
  const [data, setData] = useState(() =>
    (pendente?.inicio ?? new Date().toISOString()).slice(0, 10),
  )
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  const centavos = paraCentavos(valor)

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    setSalvando(true)
    try {
      await api.post('/financeiro', {
        agendamentoId: pendente?.id,
        pacienteNome: paciente || undefined,
        valorCentavos: centavos,
        forma,
        convenio: forma === 'convenio' ? convenio : undefined,
        estado: jaRecebi ? 'recebido' : 'previsto',
        dataAtendimento: new Date(`${data}T12:00:00`).toISOString(),
      })
      await onSalvo()
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não consegui salvar agora.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <form onSubmit={salvar} className="rounded-2xl border border-line bg-paper p-lg shadow-soft">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-semibold text-ink">Paciente (opcional)</span>
          <input className="input" value={paciente} onChange={(e) => setPaciente(e.target.value)} />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-semibold text-ink">Valor</span>
          <input
            className="input"
            inputMode="decimal"
            placeholder="350,00"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            required
          />
          {/* Eco do valor entendido. Sem ele, quem digita "1.500" não descobre
              se o sistema leu mil e quinhentos ou um e cinquenta — e a diferença
              é de mil vezes. */}
          <span className="text-xs text-ink-mute">{centavos > 0 ? reais(centavos) : '—'}</span>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-semibold text-ink">Forma</span>
          <select className="input" value={forma} onChange={(e) => setForma(e.target.value)}>
            {FORMAS.map((f) => (
              <option key={f.id} value={f.id}>
                {f.rotulo}
              </option>
            ))}
          </select>
        </label>

        {forma === 'convenio' ? (
          <label className="flex flex-col gap-1">
            <span className="text-sm font-semibold text-ink">Convênio</span>
            <input className="input" value={convenio} onChange={(e) => setConvenio(e.target.value)} />
          </label>
        ) : (
          <label className="flex flex-col gap-1">
            <span className="text-sm font-semibold text-ink">Data do atendimento</span>
            <input
              type="date"
              className="input"
              value={data}
              onChange={(e) => setData(e.target.value)}
            />
          </label>
        )}
      </div>

      <label className="mt-3 flex items-center gap-2 text-sm font-semibold text-ink">
        <input
          type="checkbox"
          checked={jaRecebi}
          onChange={(e) => setJaRecebi(e.target.checked)}
          className="size-4 accent-[var(--color-lilas)]"
        />
        Já recebi
      </label>

      {erro && <AlertaErro>{erro}</AlertaErro>}

      <div className="mt-md flex flex-wrap gap-2">
        <Button type="submit" loading={salvando} disabled={centavos <= 0}>
          Salvar lançamento
        </Button>
        <Button type="button" variant="ghost" onClick={onCancelar}>
          Cancelar
        </Button>
      </div>
    </form>
  )
}
