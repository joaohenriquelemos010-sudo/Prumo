import { Copy, Plus, X } from 'lucide-react'
import { Sheet } from '@/components/Sheet'
import { Button } from '@/components/Button'
import { cn } from '@/lib/cn'
import { doDia, faixaInvalida, repetirDia, substituirDia } from './semana'
import type { FaixaSemanal, SemanaConfig } from './semana'
import { LINHAS, faixaLegivel } from './linhasSemana'
import type { Dia, Linha, ListaFaixa } from './linhasSemana'

/**
 * Um dia inteiro numa folha — as quatro perguntas do dia, uma abaixo da outra.
 *
 * A grade responde *como está minha semana*; esta folha responde *o que eu quero
 * mudar nesta terça*. Separá-las é o que permite a grade ser legível: ela mostra
 * valores, não campos, e o trabalho de digitar hora acontece num lugar onde há
 * espaço para o rótulo inteiro, a ajuda e o botão de remover.
 *
 * A folha é a mesma no desktop e no celular (`components/Sheet` vira diálogo
 * centrado em tela grande), então a edição de um dia é o mesmo gesto nos dois —
 * que é justamente o que a grade de sete colunas não conseguia ser.
 */
export function EditorDia({
  dia,
  valor,
  diasAtivos,
  onChange,
  onFechar,
}: {
  /** `null` fecha a folha. */
  dia: Dia | null
  valor: SemanaConfig
  /** Para onde "repetir" pode copiar — os dias ligados, menos este. */
  diasAtivos: number[]
  onChange: (v: SemanaConfig) => void
  onFechar: () => void
}) {
  function mudarFaixas(lista: ListaFaixa, novas: FaixaSemanal[]) {
    if (!dia) return
    onChange({ ...valor, [lista]: substituirDia(valor[lista], dia.n, novas) })
  }

  const outrosAtivos = dia ? diasAtivos.filter((d) => d !== dia.n) : []

  return (
    <Sheet aberto={dia !== null} onFechar={onFechar} titulo={dia?.longo ?? ''}>
      {dia && (
        <div className="flex flex-col gap-sm pb-2">
          {LINHAS.map((linha) => (
            <Grupo
              key={linha.id}
              linha={linha}
              dia={dia}
              faixas={doDia(valor[linha.id], dia.n)}
              onChange={(novas) => mudarFaixas(linha.id, novas)}
            />
          ))}

          <div className="mt-1 flex flex-wrap items-center gap-2">
            {outrosAtivos.length > 0 && (
              <Button
                size="sm"
                variant="secondary"
                iconLeft={<Copy className="size-4" aria-hidden />}
                onClick={() => onChange(repetirDia(valor, dia.n, outrosAtivos))}
              >
                Repetir nos outros {outrosAtivos.length} dias ativos
              </Button>
            )}
            <Button size="sm" className="ml-auto" onClick={onFechar}>
              Concluir
            </Button>
          </div>
        </div>
      )}
    </Sheet>
  )
}

/** Uma pergunta do dia: o título, a ajuda, as faixas e o botão de adicionar. */
function Grupo({
  linha,
  dia,
  faixas,
  onChange,
}: {
  linha: Linha
  dia: Dia
  faixas: FaixaSemanal[]
  onChange: (novas: FaixaSemanal[]) => void
}) {
  const Icone = linha.icone

  function adicionar() {
    /*
     * Um período novo começa onde o anterior terminou: manhã no consultório e
     * tarde no hospital é a regra, e 08:00–18:00 repetido seria uma faixa que se
     * sobrepõe à própria — o motor de slots contaria o mesmo horário duas vezes.
     */
    const anterior = faixas.at(-1)
    const inicio = linha.id === 'periodos' && anterior ? anterior.fim : linha.padrao.inicio
    onChange([...faixas, { diaSemana: dia.n, inicio, fim: linha.padrao.fim }])
  }

  return (
    <section className="rounded-xl border border-line bg-paper-2 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-paper text-indigo">
            <Icone className="size-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <h3 className="font-display text-sm font-semibold tracking-title text-ink">
              {linha.titulo}
            </h3>
            <p className="text-xs text-ink-mute">{linha.ajuda}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={adicionar}
          className="inline-flex min-h-9 shrink-0 items-center gap-1 rounded-pill px-2.5 font-display text-xs font-semibold text-indigo transition-colors duration-[var(--dur-fast)] hover:bg-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus)]"
        >
          <Plus className="size-3.5" aria-hidden />
          Adicionar
        </button>
      </div>

      {faixas.length === 0 ? (
        <p className="mt-2 rounded-lg bg-paper px-3 py-2.5 text-xs text-ink-mute">
          {linha.vazio.principal} · {linha.vazio.secundario}
        </p>
      ) : (
        <ul className="mt-2 flex flex-col gap-1.5">
          {faixas.map((f, i) => {
            const invalida = faixaInvalida(f)
            return (
              <li key={`${dia.n}-${linha.id}-${i}`}>
                <div className="flex items-center gap-2 rounded-lg bg-paper p-1.5 pl-2.5">
                  <CampoHora
                    valor={f.inicio}
                    rotulo={`Início — ${linha.titulo.toLowerCase()} de ${dia.longo}`}
                    invalido={invalida}
                    onChange={(v) => onChange(faixas.map((x, j) => (i === j ? { ...x, inicio: v } : x)))}
                  />
                  <span className="shrink-0 text-xs text-ink-mute" aria-hidden>
                    →
                  </span>
                  <CampoHora
                    valor={f.fim}
                    rotulo={`Fim — ${linha.titulo.toLowerCase()} de ${dia.longo}`}
                    invalido={invalida}
                    onChange={(v) => onChange(faixas.map((x, j) => (i === j ? { ...x, fim: v } : x)))}
                  />
                  <button
                    type="button"
                    aria-label={`Remover ${faixaLegivel(f)} de ${dia.longo}`}
                    onClick={() => onChange(faixas.filter((_, j) => j !== i))}
                    className="ml-auto grid size-9 shrink-0 place-items-center rounded-lg text-ink-mute transition-colors duration-[var(--dur-fast)] hover:bg-paper-2 hover:text-warn-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus)]"
                  >
                    <X className="size-4" aria-hidden />
                  </button>
                </div>
                {invalida && (
                  <p className="mt-1 pl-2.5 text-xs font-semibold text-warn-ink">
                    Termina antes de começar.
                  </p>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

function CampoHora({
  valor,
  rotulo,
  invalido,
  onChange,
}: {
  valor: string
  rotulo: string
  invalido: boolean
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
        'input input-hora h-10 w-[6.5rem] px-2 py-0 text-center text-sm',
        invalido && 'border-[var(--color-warn-ink)] text-warn-ink',
      )}
    />
  )
}
