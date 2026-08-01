import { useMemo } from 'react'
import { CalendarOff, Plus, X } from 'lucide-react'
import { cn } from '@/lib/cn'
import { doDia, faixaInvalida, substituirDia } from './semana'
import type { FaixaSemanal, PeriodoSemanal, SemanaConfig } from './semana'

type ListaFaixa = 'intervalos' | 'bloqueios' | 'reposicoes'

const DIAS = [
  { n: 1, curto: 'SEG', longo: 'Segunda-feira' },
  { n: 2, curto: 'TER', longo: 'Terça-feira' },
  { n: 3, curto: 'QUA', longo: 'Quarta-feira' },
  { n: 4, curto: 'QUI', longo: 'Quinta-feira' },
  { n: 5, curto: 'SEX', longo: 'Sexta-feira' },
  { n: 6, curto: 'SÁB', longo: 'Sábado' },
  { n: 0, curto: 'DOM', longo: 'Domingo' },
]

/** O que a maioria dos consultórios usa. Ponto de partida, não regra. */
const PERIODO_PADRAO = { inicio: '08:00', fim: '18:00' }
const INTERVALO_PADRAO = { inicio: '12:00', fim: '13:00' }
const BLOQUEIO_PADRAO = { inicio: '16:00', fim: '16:20' }
const REPOSICAO_PADRAO = { inicio: '19:00', fim: '19:30' }

/*
 * Sete colunas iguais mais o rótulo. O mínimo de 176px é o que faz dois campos de
 * hora, a seta e o botão de remover caberem numa linha só — abaixo disso o
 * conteúdo de um dia invade a coluna do dia seguinte. A soma (1396px) cabe na
 * largura ampla do app; abaixo dela a grade rola na horizontal, que é melhor do
 * que sete dias ilegíveis.
 */
const COLUNAS = 'grid grid-cols-[164px_repeat(7,minmax(176px,1fr))]'

/**
 * A semana inteira numa grade, um dia por coluna.
 *
 * O formulário anterior pedia "adicionar regra → escolher o dia → escolher a
 * hora", repetido para cada faixa, e devolvia o resultado numa lista onde ler a
 * própria semana exigia remontá-la de cabeça. Aqui a semana já *é* a tela: cada
 * coluna é um dia, cada linha é uma pergunta, e o vazio de um sábado desligado é
 * tão informativo quanto o preenchido de uma segunda.
 *
 * As quatro linhas dizem coisas diferentes de propósito, ainda que o motor trate
 * três delas igual:
 *
 * - **Período de atendimento** é quando se atende. Vários por dia, porque manhã
 *   no consultório e tarde no hospital é a regra e não a exceção.
 * - **Intervalos** são as pausas de dentro do período — almoço, café.
 * - **Bloqueios** são compromissos fixos que voltam toda semana: a reunião de
 *   segunda, a manhã de cirurgia.
 * - **Intervalos de reposição** são o contrário de todos os anteriores: janelas
 *   *extras*, fora do período, guardadas para remarcar quem perdeu a consulta.
 *
 * Ligar um dia já nasce com 08:00–18:00 em vez de campos vazios: quem discorda
 * edita, quem concorda terminou.
 */
export function GradeSemanal({
  valor,
  onChange,
  hoje = new Date().getDay(),
}: {
  valor: SemanaConfig
  onChange: (v: SemanaConfig) => void
  /** Dia da semana a destacar. Injetável para o teste não depender do relógio. */
  hoje?: number
}) {
  const ativos = useMemo(
    () => new Set(valor.periodos.map((p) => p.diaSemana)),
    [valor.periodos],
  )

  function alternarDia(dia: number) {
    if (ativos.has(dia)) {
      /*
       * Desligar apaga a configuração do dia inteiro, e não só os períodos: um
       * almoço órfão num sábado que não se atende é lixo que volta a aparecer no
       * dia em que o sábado for reativado.
       */
      onChange({
        periodos: valor.periodos.filter((p) => p.diaSemana !== dia),
        intervalos: valor.intervalos.filter((f) => f.diaSemana !== dia),
        bloqueios: valor.bloqueios.filter((f) => f.diaSemana !== dia),
        reposicoes: valor.reposicoes.filter((f) => f.diaSemana !== dia),
      })
      return
    }
    onChange({
      ...valor,
      periodos: substituirDia(valor.periodos, dia, [
        { diaSemana: dia, ...PERIODO_PADRAO, modalidades: ['presencial'], local: '' },
      ]),
    })
  }

  function mudarPeriodos(dia: number, novos: PeriodoSemanal[]) {
    onChange({ ...valor, periodos: substituirDia(valor.periodos, dia, novos) })
  }

  function mudarFaixas(lista: ListaFaixa, dia: number, novas: FaixaSemanal[]) {
    onChange({ ...valor, [lista]: substituirDia(valor[lista], dia, novas) })
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-paper shadow-soft">
      <div className="min-w-[1396px]">
        {/* Cabeçalho: os sete dias, com o de hoje marcado. */}
        <div className={cn(COLUNAS, 'border-b border-line bg-paper-2')}>
          <div className="flex items-center px-4 py-3">
            <span className="u-eyebrow">Configuração por dia</span>
          </div>
          {DIAS.map((d) => (
            <div
              key={d.n}
              className="flex flex-col items-center gap-0.5 border-l border-line px-2 py-3 text-center"
            >
              <span className="font-display text-sm font-bold text-ink">{d.curto}</span>
              <span className="text-xs text-ink-mute">{d.longo}</span>
              {d.n === hoje && (
                <span className="rounded-pill bg-[color-mix(in_oklab,var(--color-lilas)_22%,var(--color-paper))] px-2 py-0.5 text-[0.68rem] font-semibold text-indigo">
                  Hoje
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Ativo */}
        <div className={cn(COLUNAS, 'border-b border-line')}>
          <RotuloLinha titulo="Ativo" />
          {DIAS.map((d) => (
            <div key={d.n} className="flex items-center justify-center border-l border-line px-2 py-4">
              <Interruptor
                ligado={ativos.has(d.n)}
                onChange={() => alternarDia(d.n)}
                rotulo={`Atender ${d.longo.toLowerCase()}`}
              />
            </div>
          ))}
        </div>

        {/* Período de atendimento */}
        <div className={cn(COLUNAS, 'border-b border-line')}>
          <RotuloLinha titulo="Período de atendimento" />
          {DIAS.map((d) => {
            const periodos = doDia(valor.periodos, d.n)
            return (
              <Celula key={d.n} ativo={ativos.has(d.n)}>
                {periodos.map((p, i) => (
                  <div key={`${d.n}-${i}`} className="flex flex-col gap-1.5">
                    <CampoHora
                      valor={p.inicio}
                      rotulo={`Início do ${i + 1}º período de ${d.longo}`}
                      invalido={faixaInvalida(p)}
                      onChange={(v) =>
                        mudarPeriodos(
                          d.n,
                          periodos.map((x, j) => (i === j ? { ...x, inicio: v } : x)),
                        )
                      }
                    />
                    <div className="flex min-w-0 items-center gap-1">
                      <CampoHora
                        valor={p.fim}
                        rotulo={`Fim do ${i + 1}º período de ${d.longo}`}
                        invalido={faixaInvalida(p)}
                        onChange={(v) =>
                          mudarPeriodos(
                            d.n,
                            periodos.map((x, j) => (i === j ? { ...x, fim: v } : x)),
                          )
                        }
                      />
                      {periodos.length > 1 && (
                        <BotaoRemover
                          rotulo={`Remover o ${i + 1}º período de ${d.longo}`}
                          onClick={() =>
                            mudarPeriodos(
                              d.n,
                              periodos.filter((_, j) => j !== i),
                            )
                          }
                        />
                      )}
                    </div>
                  </div>
                ))}
                <BotaoAdicionar
                  texto="Adicionar período"
                  onClick={() =>
                    mudarPeriodos(d.n, [
                      ...periodos,
                      {
                        diaSemana: d.n,
                        inicio: periodos.at(-1)?.fim ?? PERIODO_PADRAO.inicio,
                        fim: PERIODO_PADRAO.fim,
                        modalidades: ['presencial'],
                        local: '',
                      },
                    ])
                  }
                />
              </Celula>
            )
          })}
        </div>

        <LinhaFaixas
          titulo="Intervalos"
          detalhe="(almoço, pausas)"
          lista="intervalos"
          padrao={INTERVALO_PADRAO}
          textoAdicionar="Adicionar intervalo"
          valor={valor}
          ativos={ativos}
          onChange={mudarFaixas}
        />
        <LinhaFaixas
          titulo="Bloqueios"
          lista="bloqueios"
          padrao={BLOQUEIO_PADRAO}
          textoAdicionar="Adicionar bloqueio"
          valor={valor}
          ativos={ativos}
          onChange={mudarFaixas}
        />
        <LinhaFaixas
          titulo="Intervalos de reposição"
          lista="reposicoes"
          padrao={REPOSICAO_PADRAO}
          textoAdicionar="Adicionar intervalo"
          valor={valor}
          ativos={ativos}
          onChange={mudarFaixas}
          ultima
        />
      </div>
    </div>
  )
}

/**
 * Intervalos, bloqueios e reposições têm a mesma forma na tela: uma pilha de
 * faixas "de → até" e um botão de adicionar. Três cópias desta linha seriam três
 * lugares para o mesmo defeito.
 */
function LinhaFaixas({
  titulo,
  detalhe,
  lista,
  padrao,
  textoAdicionar,
  valor,
  ativos,
  onChange,
  ultima,
}: {
  titulo: string
  detalhe?: string
  lista: ListaFaixa
  padrao: { inicio: string; fim: string }
  textoAdicionar: string
  valor: SemanaConfig
  ativos: Set<number>
  onChange: (lista: ListaFaixa, dia: number, novas: FaixaSemanal[]) => void
  ultima?: boolean
}) {
  return (
    <div className={cn(COLUNAS, !ultima && 'border-b border-line')}>
      <RotuloLinha titulo={titulo} detalhe={detalhe} />
      {DIAS.map((d) => {
        const faixas = doDia(valor[lista], d.n)
        return (
          <Celula key={d.n} ativo={ativos.has(d.n)}>
            {faixas.map((f, i) => (
              <div key={`${d.n}-${i}`} className="flex min-w-0 items-center gap-0.5">
                <CampoHora
                  compacto
                  valor={f.inicio}
                  rotulo={`Início do ${i + 1}º ${titulo.toLowerCase()} de ${d.longo}`}
                  invalido={faixaInvalida(f)}
                  onChange={(v) =>
                    onChange(
                      lista,
                      d.n,
                      faixas.map((x, j) => (i === j ? { ...x, inicio: v } : x)),
                    )
                  }
                />
                <span className="shrink-0 text-[0.7rem] text-ink-mute" aria-hidden>
                  →
                </span>
                <CampoHora
                  compacto
                  valor={f.fim}
                  rotulo={`Fim do ${i + 1}º ${titulo.toLowerCase()} de ${d.longo}`}
                  invalido={faixaInvalida(f)}
                  onChange={(v) =>
                    onChange(
                      lista,
                      d.n,
                      faixas.map((x, j) => (i === j ? { ...x, fim: v } : x)),
                    )
                  }
                />
                <BotaoRemover
                  rotulo={`Remover o ${i + 1}º ${titulo.toLowerCase()} de ${d.longo}`}
                  onClick={() =>
                    onChange(
                      lista,
                      d.n,
                      faixas.filter((_, j) => j !== i),
                    )
                  }
                />
              </div>
            ))}
            {faixas.length === 0 ? (
              <BotaoVazio
                texto={textoAdicionar}
                onClick={() => onChange(lista, d.n, [{ diaSemana: d.n, ...padrao }])}
              />
            ) : (
              <BotaoAdicionar
                texto={textoAdicionar}
                onClick={() => onChange(lista, d.n, [...faixas, { diaSemana: d.n, ...padrao }])}
              />
            )}
          </Celula>
        )
      })}
    </div>
  )
}

function RotuloLinha({ titulo, detalhe }: { titulo: string; detalhe?: string }) {
  return (
    <div className="flex flex-col justify-center px-4 py-4">
      <span className="font-display text-sm font-semibold text-ink">{titulo}</span>
      {detalhe && <span className="text-xs text-ink-mute">{detalhe}</span>}
    </div>
  )
}

/**
 * Um dia desligado não mostra campos vazios: mostra que está desligado.
 *
 * Campos habilitados numa coluna que não gera horário nenhum são um convite a
 * preencher a agenda de sábado inteira e não entender por que ninguém marca.
 */
function Celula({ ativo, children }: { ativo: boolean; children: React.ReactNode }) {
  if (!ativo) {
    return (
      <div className="flex flex-col items-center justify-center gap-1 border-l border-line px-2 py-5 text-center">
        <CalendarOff className="size-5 text-ink-mute opacity-60" aria-hidden />
        <span className="text-xs text-ink-mute">Dia inativo</span>
        <span className="text-[0.68rem] text-ink-mute opacity-80">Ative para configurar</span>
      </div>
    )
  }
  return <div className="flex flex-col gap-2 border-l border-line px-2 py-3">{children}</div>
}

function CampoHora({
  valor,
  rotulo,
  invalido,
  compacto,
  onChange,
}: {
  valor: string
  rotulo: string
  invalido: boolean
  compacto?: boolean
  onChange: (v: string) => void
}) {
  return (
    <input
      type="time"
      aria-label={rotulo}
      aria-invalid={invalido || undefined}
      value={valor}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        'input input-hora py-0 text-center',
        /*
         * O campo compacto é apertado de propósito: em navegador que formata hora
         * em AM/PM o texto é ~30% mais largo que em 24h, e uma fonte maior aqui
         * cortaria o "PM" — que é a diferença entre 13:00 e 01:00.
         */
        compacto ? 'h-9 min-w-0 flex-1 px-0.5 text-[0.7rem]' : 'h-10 w-full px-2 text-sm',
        invalido && 'border-[var(--color-warn-ink)] text-warn-ink',
      )}
    />
  )
}

function BotaoAdicionar({ texto, onClick }: { texto: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center justify-center gap-1 rounded-lg py-1 text-xs font-semibold text-indigo hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus)]"
    >
      <Plus className="size-3.5" aria-hidden />
      {texto}
    </button>
  )
}

/** Nada configurado ainda: um alvo grande, porque é o único clique da célula. */
function BotaoVazio({ texto, onClick }: { texto: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col items-center gap-1.5 py-2 text-xs font-semibold text-ink-mute hover:text-indigo focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus)]"
    >
      <span className="grid size-8 place-items-center rounded-pill border border-dashed border-[var(--color-lilas-soft)] text-indigo group-hover:bg-paper-2">
        <Plus className="size-4" aria-hidden />
      </span>
      {texto}
    </button>
  )
}

function BotaoRemover({ rotulo, onClick }: { rotulo: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={rotulo}
      onClick={onClick}
      className="grid size-6 shrink-0 place-items-center rounded-lg text-ink-mute hover:bg-paper-2 hover:text-warn-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus)]"
    >
      <X className="size-3.5" aria-hidden />
    </button>
  )
}

function Interruptor({
  ligado,
  onChange,
  rotulo,
}: {
  ligado: boolean
  onChange: () => void
  rotulo: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={ligado}
      aria-label={rotulo}
      onClick={onChange}
      className={cn(
        'relative h-6 w-11 shrink-0 rounded-pill transition-colors duration-[var(--dur-fast)]',
        'focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus)]',
        ligado ? '[background-image:var(--grad-brand)]' : 'bg-paper-3',
      )}
    >
      <span
        className={cn(
          'absolute top-0.5 size-5 rounded-pill bg-white shadow-soft transition-[left] duration-[var(--dur-fast)]',
          ligado ? 'left-[1.375rem]' : 'left-0.5',
        )}
        aria-hidden
      />
    </button>
  )
}
