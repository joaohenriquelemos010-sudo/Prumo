import { useMemo } from 'react'
import { cn } from '@/lib/cn'
import {
  faixaDeHoras,
  horaParaMinuto,
  linhasDeHora,
  minutoDoDia,
  minutoParaHora,
  posicionar,
} from './grade'
import type { Faixa } from './grade'
import { paraChaveDia } from './agenda'

export interface EventoAgenda {
  id: string
  inicio: string
  duracaoMin: number
  pacienteNome: string
  jornada: string
  tipoNome: string
  cor: string
  status: string
  modalidade: string
  consultaId: string
}

export interface Expediente {
  ativo: boolean
  almoco: { inicio: string; fim: string }
  regras: { diaSemana: number; inicio: string; fim: string }[]
  bloqueios: { de: string; ate: string; motivo: string }[]
}

const DIAS_CURTOS = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB']

/**
 * As cores dos blocos.
 *
 * Cada classe está escrita **por extenso**, e isso não é repetição por
 * preguiça: o Tailwind gera CSS varrendo o código-fonte atrás de strings de
 * classe. Uma classe montada em tempo de execução — `bg-[...var(${cor})...]` —
 * ele não enxerga, e o resultado é um bloco sem fundo nenhum. Foi exatamente o
 * que aconteceu na primeira versão deste arquivo, e só apareceu ao olhar a tela
 * renderizada: nada quebra, os blocos só ficam brancos.
 *
 * A receita é a mesma para todos: 28% da cor misturada ao papel. Os tokens
 * `-soft` prontos não serviam — existem só para lilás e azul, enquanto
 * `--color-success` e `--color-warn` são cores cheias, e um bloco verde chapado
 * com texto escuro em cima é ilegível a 60 cm, que é como se lê uma agenda.
 * Misturar com o papel também mantém o tom certo no tema escuro.
 *
 * `color-mix` e não `bg-cor/28`: as cores deste projeto são funções OKLCH
 * completas, então a substituição de alfa do Tailwind não funciona — está
 * documentado no topo de `tailwind.config.ts`.
 */
const CORES: Record<string, { fundo: string; barra: string; texto: string }> = {
  indigo: {
    fundo: 'bg-[color-mix(in_oklab,var(--color-indigo)_28%,var(--color-paper))]',
    barra: 'bg-indigo',
    texto: 'text-indigo',
  },
  lilas: {
    fundo: 'bg-[color-mix(in_oklab,var(--color-lilas)_28%,var(--color-paper))]',
    barra: 'bg-lilas',
    texto: 'text-indigo',
  },
  azul: {
    fundo: 'bg-[color-mix(in_oklab,var(--color-azul)_28%,var(--color-paper))]',
    barra: 'bg-azul',
    texto: 'text-indigo',
  },
  success: {
    fundo: 'bg-[color-mix(in_oklab,var(--color-success)_28%,var(--color-paper))]',
    barra: 'bg-success-ink',
    texto: 'text-success-ink',
  },
  warn: {
    fundo: 'bg-[color-mix(in_oklab,var(--color-warn)_28%,var(--color-paper))]',
    barra: 'bg-warn-ink',
    texto: 'text-warn-ink',
  },
}

function cores(cor: string) {
  return CORES[cor] ?? CORES.indigo
}

/** Altura de uma hora. É o único número em pixels da grade — o resto é %. */
const PX_POR_HORA = 56

/**
 * Quantas linhas de texto cabem numa altura, em pixels.
 *
 * O bloco tem altura proporcional à duração, e o texto não: uma consulta de 25
 * minutos rende 23 px, onde não cabem duas linhas de 13. A primeira versão
 * empilhava horário + nome sempre, e o `overflow-hidden` cortava o nome no meio
 * — o dado mais importante do bloco, justamente nas consultas mais comuns.
 *
 * A saída é mudar a forma, não encolher a fonte: bloco baixo vira **uma linha
 * só**, com hora e nome lado a lado. Ilegível e ausente dão no mesmo numa
 * agenda.
 */
function linhasQueCabem(alturaPx: number): 1 | 2 | 3 {
  if (alturaPx < 34) return 1
  if (alturaPx < 52) return 2
  return 3
}

function Bloco({
  evento,
  posicao,
  coluna,
  colunas,
  onAbrir,
  alturaGradePx,
}: {
  evento: EventoAgenda
  posicao: { topo: number; altura: number }
  coluna: number
  colunas: number
  onAbrir: (e: EventoAgenda) => void
  /** Altura total da coluna, para saber quantos pixels a % do bloco vale. */
  alturaGradePx: number
}) {
  const c = cores(evento.cor)
  const largura = 100 / colunas
  const inicio = new Date(evento.inicio)
  const fim = new Date(inicio.getTime() + evento.duracaoMin * 60_000)
  const de = minutoParaHora(minutoDoDia(evento.inicio))
  const ate = minutoParaHora(minutoDoDia(fim))
  const faixaHoraria = `${de} – ${ate}`
  const nome = evento.pacienteNome || 'Paciente'

  const linhas = linhasQueCabem((posicao.altura / 100) * alturaGradePx)

  return (
    <button
      type="button"
      onClick={() => onAbrir(evento)}
      style={{
        top: `${posicao.topo}%`,
        height: `${posicao.altura}%`,
        left: `${coluna * largura}%`,
        width: `calc(${largura}% - 3px)`,
      }}
      className={cn(
        'absolute overflow-hidden rounded-[6px] border border-line pl-2 pr-1 text-left',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--color-focus)]',
        c.fundo,
        // Um agendamento ainda pendente é uma promessa, não um compromisso.
        evento.status === 'pendente' && 'border-dashed opacity-80',
      )}
      title={`${faixaHoraria} · ${nome}${evento.tipoNome ? ` · ${evento.tipoNome}` : ''}`}
    >
      <span className={cn('absolute inset-y-0 left-0 w-1 rounded-l-[6px]', c.barra)} aria-hidden />

      {linhas === 1 ? (
        // Hora e nome na mesma linha. A hora encolhe primeiro porque o nome é o
        // que se procura ao varrer a coluna.
        <span className="flex items-baseline gap-1 truncate text-[11px] leading-[1.15] text-ink">
          <span className="shrink-0 text-ink-mute">{de}</span>
          <span className="truncate font-semibold">{nome}</span>
        </span>
      ) : (
        <>
          <span className="block truncate pt-0.5 text-[10px] leading-tight text-ink-mute">
            {faixaHoraria}
          </span>
          <span className="block truncate text-xs font-semibold leading-tight text-ink">
            {nome}
          </span>
          {linhas === 3 && evento.tipoNome && (
            <span className={cn('block truncate text-[10px] leading-tight', c.texto)}>
              {evento.tipoNome}
            </span>
          )}
        </>
      )}
    </button>
  )
}

/** O fundo hachurado do almoço e dos bloqueios: fechado, e visivelmente fechado. */
function Fechado({
  topo,
  altura,
  rotulo,
}: {
  topo: number
  altura: number
  rotulo: string
}) {
  return (
    <div
      style={{ top: `${topo}%`, height: `${altura}%` }}
      className="pointer-events-none absolute inset-x-0 overflow-hidden rounded-[6px] border border-line bg-paper-2 px-2"
      aria-hidden
    >
      {/* Hachura em CSS puro — nenhuma imagem, e acompanha qualquer altura. */}
      <span className="absolute inset-0 bg-[repeating-linear-gradient(135deg,transparent,transparent_5px,var(--color-line)_5px,var(--color-line)_6px)] opacity-60" />
      <span className="relative block truncate pt-1 text-[10px] leading-tight text-ink-mute">
        {rotulo}
      </span>
    </div>
  )
}

/** Onde estamos agora — a linha que responde "já passou?" sem contar horas. */
function LinhaDeAgora({ faixa }: { faixa: Faixa }) {
  const agora = new Date()
  const minuto = agora.getHours() * 60 + agora.getMinutes()
  if (minuto < faixa.de || minuto > faixa.ate) return null
  const topo = ((minuto - faixa.de) / (faixa.ate - faixa.de)) * 100
  return (
    <div
      style={{ top: `${topo}%` }}
      className="pointer-events-none absolute inset-x-0 z-10 h-px bg-indigo"
      aria-hidden
    >
      <span className="absolute -left-1 -top-[3px] size-[7px] rounded-pill bg-indigo" />
    </div>
  )
}

/**
 * O calendário do consultório: dias em colunas, horas em linhas.
 *
 * A agenda era uma lista de cartões agrupados por dia — correta e ilegível para
 * quem precisa achar um buraco de 30 minutos na quinta. Uma grade responde essa
 * pergunta com o olho, sem ler nada: o espaço vazio **é** a resposta.
 *
 * Duas decisões sustentam o desenho. A geometria vive em `grade.ts`, pura e
 * testada — num calendário, um evento desenhado meia hora acima continua sendo
 * um retângulo bonito, e ninguém percebe. E a faixa de horas cresce para caber o
 * que existe: o encaixe das 20h aparece mesmo fora do expediente, senão a agenda
 * deixa de ser o registro do dia e vira o registro do que estava planejado.
 */
export function GradeAgenda({
  dias,
  eventos,
  expediente,
  onAbrir,
  onVago,
}: {
  dias: Date[]
  eventos: EventoAgenda[]
  expediente: Expediente
  onAbrir: (e: EventoAgenda) => void
  /** Clicar num espaço livre marca ali — é o gesto que todo calendário tem. */
  onVago: (quando: Date) => void
}) {
  const hoje = paraChaveDia(new Date())
  const umDia = dias.length === 1

  const faixa = useMemo(
    () => faixaDeHoras(eventos, expediente.regras),
    [eventos, expediente.regras],
  )
  const horas = linhasDeHora(faixa)
  const altura = ((faixa.ate - faixa.de) / 60) * PX_POR_HORA

  const almocoDe = horaParaMinuto(expediente.almoco.inicio)
  const almocoAte = horaParaMinuto(expediente.almoco.fim)

  const porDia = useMemo(() => {
    const mapa = new Map<string, EventoAgenda[]>()
    for (const e of eventos) {
      const chave = paraChaveDia(new Date(e.inicio))
      mapa.set(chave, [...(mapa.get(chave) ?? []), e])
    }
    return mapa
  }, [eventos])

  /** Traduz um clique em minuto do dia, arredondado para o quarto de hora. */
  function minutoDoClique(ev: React.MouseEvent<HTMLDivElement>): number {
    const caixa = ev.currentTarget.getBoundingClientRect()
    const fracao = (ev.clientY - caixa.top) / caixa.height
    const minuto = faixa.de + fracao * (faixa.ate - faixa.de)
    return Math.round(minuto / 15) * 15
  }

  return (
    <div className="overflow-x-auto">
      <div className={cn('min-w-[680px]', umDia && 'min-w-0')}>
        {/* Cabeçalho dos dias */}
        <div
          className="grid border-b border-line"
          style={{ gridTemplateColumns: `52px repeat(${dias.length}, minmax(0,1fr))` }}
        >
          <div />
          {dias.map((d) => {
            const chave = paraChaveDia(d)
            const ehHoje = chave === hoje
            return (
              <div key={chave} className="px-1 pb-2 pt-1 text-center">
                <p className="text-[10px] font-semibold uppercase tracking-caption text-ink-mute">
                  {DIAS_CURTOS[d.getDay()]}
                </p>
                <p
                  className={cn(
                    'mx-auto mt-0.5 grid size-8 place-items-center rounded-pill font-display text-sm font-semibold',
                    ehHoje ? 'bg-indigo text-white' : 'text-ink',
                  )}
                >
                  {d.getDate()}
                </p>
              </div>
            )
          })}
        </div>

        {/* Corpo */}
        <div
          className="grid"
          style={{
            gridTemplateColumns: `52px repeat(${dias.length}, minmax(0,1fr))`,
            height: altura,
            // O rótulo da última hora fica centrado em 100%: sem esta folga ele
            // é cortado ao meio pela borda do container.
            marginBottom: 10,
          }}
        >
          {/* Régua de horas */}
          <div className="relative">
            {horas.map((m) => (
              <span
                key={m}
                style={{ top: `${((m - faixa.de) / (faixa.ate - faixa.de)) * 100}%` }}
                className="absolute right-1.5 -translate-y-1/2 text-[10px] tabular-nums text-ink-mute"
              >
                {minutoParaHora(m)}
              </span>
            ))}
          </div>

          {dias.map((d) => {
            const chave = paraChaveDia(d)
            const doDia = porDia.get(chave) ?? []
            const posicionados = posicionar(doDia, faixa)
            const trabalha = expediente.regras.some((r) => r.diaSemana === d.getDay())
            const ehHoje = chave === hoje

            const total = faixa.ate - faixa.de
            const pct = (m: number) => ((m - faixa.de) / total) * 100

            const bloqueiosDoDia = expediente.bloqueios.filter(
              (b) => paraChaveDia(new Date(b.de)) <= chave && paraChaveDia(new Date(b.ate)) >= chave,
            )

            return (
              <div
                key={chave}
                onClick={(ev) => {
                  // Só o fundo marca horário. Um clique num bloco é "abrir", e o
                  // botão já parou a propagação por ser um botão de verdade.
                  if (ev.target !== ev.currentTarget) return
                  const m = minutoDoClique(ev)
                  const quando = new Date(d)
                  quando.setHours(Math.floor(m / 60), m % 60, 0, 0)
                  onVago(quando)
                }}
                className={cn(
                  /*
                   * Sem sufixo de opacidade em nenhuma cor daqui: as cores deste
                   * projeto são funções OKLCH completas, então `bg-cor/30` é uma
                   * classe que não gera CSS — o fundo simplesmente não aparece.
                   * Toda transparência é `color-mix`.
                   */
                  'relative cursor-copy overflow-hidden border-l border-line',
                  // Linhas de hora como fundo, e não como elementos: um dia com
                  // 14 divs de linha vezes 7 colunas é ruído no DOM sem motivo.
                  'bg-[repeating-linear-gradient(to_bottom,var(--color-line)_0,var(--color-line)_1px,transparent_1px,transparent_var(--altura-hora))]',
                  !trabalha && 'bg-paper-2',
                  ehHoje && 'bg-[color-mix(in_oklab,var(--color-lilas-soft)_28%,var(--color-paper))]',
                )}
                style={{ ['--altura-hora' as string]: `${PX_POR_HORA}px` }}
              >
                {almocoDe !== null && almocoAte !== null && almocoAte > almocoDe && trabalha && (
                  <Fechado
                    topo={pct(almocoDe)}
                    altura={pct(almocoAte) - pct(almocoDe)}
                    rotulo={`${expediente.almoco.inicio} – ${expediente.almoco.fim} Almoço`}
                  />
                )}

                {bloqueiosDoDia.map((b, i) => (
                  <Fechado key={i} topo={0} altura={100} rotulo={b.motivo || 'Bloqueado'} />
                ))}

                {ehHoje && <LinhaDeAgora faixa={faixa} />}

                {posicionados.map((p) => (
                  <Bloco
                    key={p.evento.id}
                    evento={p.evento}
                    posicao={p.posicao}
                    coluna={p.coluna}
                    colunas={p.colunas}
                    onAbrir={onAbrir}
                    alturaGradePx={altura}
                  />
                ))}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

