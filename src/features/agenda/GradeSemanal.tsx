import { useMemo, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/cn'
import { doDia, substituirDia } from './semana'
import type { SemanaConfig } from './semana'
import { EditorDia } from './EditorDia'
import { DIAS, LINHAS, PERIODO_PADRAO, resumoCelula, resumoDia } from './linhasSemana'
import type { Dia, Linha, Resumo } from './linhasSemana'

/*
 * Rótulo + sete dias. As células mostram valor, não campo, então 116px bastam
 * para "08:00 – 18:00" com folga — a grade inteira cabe em 980px, contra os
 * 1396px que os campos de hora editáveis exigiam. É a diferença entre a semana
 * caber num laptop e a semana rolar para o lado.
 */
const COLUNAS = 'grid grid-cols-[168px_repeat(7,minmax(116px,1fr))]'

/**
 * A semana inteira numa grade — sete colunas de leitura, uma folha de edição.
 *
 * A versão anterior colocava um campo de hora editável em cada uma das 28
 * células. Tudo era editável e nada era legível: para responder *"a quarta está
 * como a terça?"* — a pergunta que se faz de verdade ao abrir esta tela — era
 * preciso comparar 56 caixinhas de texto.
 *
 * Aqui a grade **informa** e a folha **edita**. Cada célula diz o horário e o
 * estado ("08:00 – 18:00 · Ativo"), com o vazio de um sábado desligado tão
 * informativo quanto o preenchido de uma segunda; clicar abre o dia inteiro numa
 * folha, onde há espaço para rótulo, ajuda e o botão de remover sem apertar nada.
 *
 * As quatro linhas dizem coisas diferentes de propósito, ainda que o motor trate
 * três delas igual — ver `linhasSemana.ts`, onde os rótulos moram para a grade,
 * a lista do celular e a folha nunca divergirem.
 *
 * Abaixo de `xl` a grade dá lugar a uma lista de cartões, um por dia: sete
 * colunas espremidas num telefone devolveriam o formulário sequencial que esta
 * tela veio substituir.
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
  const [emEdicao, setEmEdicao] = useState<Dia | null>(null)

  const ativos = useMemo(() => new Set(valor.periodos.map((p) => p.diaSemana)), [valor.periodos])

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
      if (emEdicao?.n === dia) setEmEdicao(null)
      return
    }
    /* Ligar já nasce com 08:00–18:00: quem discorda edita, quem concorda terminou. */
    onChange({
      ...valor,
      periodos: substituirDia(valor.periodos, dia, [
        { diaSemana: dia, ...PERIODO_PADRAO, modalidades: ['presencial'], local: '' },
      ]),
    })
  }

  return (
    <>
      {/* Desktop: a semana de uma vez. */}
      <div className="hidden overflow-x-auto rounded-2xl border border-line bg-paper shadow-soft xl:block">
        <div className="min-w-[980px]">
          <div className={cn(COLUNAS, 'border-b border-line bg-paper-2')}>
            <div className="sticky left-0 z-10 flex items-center bg-paper-2 px-4 py-3">
              <span className="u-eyebrow text-xs">Configuração por dia</span>
            </div>
            {DIAS.map((d) => (
              <div
                key={d.n}
                className={cn(
                  'flex flex-col items-center gap-0.5 border-l border-line px-2 py-3 text-center',
                  !ativos.has(d.n) && 'opacity-60',
                )}
              >
                <span className="font-display text-sm font-bold tracking-title text-ink">
                  {d.curto}
                </span>
                <span className="text-[0.7rem] text-ink-mute">{d.longo}</span>
                {d.n === hoje && (
                  <span className="u-chip-brand mt-0.5 rounded-pill px-2 py-0.5 text-[0.65rem] font-semibold">
                    Hoje
                  </span>
                )}
              </div>
            ))}
          </div>

          <div className={cn(COLUNAS, 'border-b border-line')}>
            <RotuloLinha titulo="Ativo" detalhe="atende neste dia" />
            {DIAS.map((d) => (
              <div
                key={d.n}
                className={cn(
                  'flex items-center justify-center border-l border-line px-2 py-3.5',
                  !ativos.has(d.n) && 'bg-[color-mix(in_oklab,var(--color-paper-2)_55%,transparent)]',
                )}
              >
                <Interruptor
                  ligado={ativos.has(d.n)}
                  onChange={() => alternarDia(d.n)}
                  rotulo={`Atender ${d.longo.toLowerCase()}`}
                />
              </div>
            ))}
          </div>

          {LINHAS.map((linha, i) => (
            <div key={linha.id} className={cn(COLUNAS, i < LINHAS.length - 1 && 'border-b border-line')}>
              <RotuloLinha titulo={linha.titulo} detalhe={linha.detalhe} />
              {DIAS.map((d) => (
                <Celula
                  key={d.n}
                  ativo={ativos.has(d.n)}
                  linha={linha}
                  dia={d}
                  resumo={resumoCelula(doDia(valor[linha.id], d.n), linha)}
                  onAbrir={() => setEmEdicao(d)}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Celular e tablet: um cartão por dia, na ordem da semana. */}
      <ul className="flex flex-col gap-2 xl:hidden">
        {DIAS.map((d) => (
          <li key={d.n}>
            <CartaoDia
              dia={d}
              hoje={d.n === hoje}
              ativo={ativos.has(d.n)}
              resumo={resumoDia(valor, d.n)}
              onAlternar={() => alternarDia(d.n)}
              onAbrir={() => setEmEdicao(d)}
            />
          </li>
        ))}
      </ul>

      <EditorDia
        dia={emEdicao}
        valor={valor}
        diasAtivos={[...ativos]}
        onChange={onChange}
        onFechar={() => setEmEdicao(null)}
      />
    </>
  )
}

function RotuloLinha({ titulo, detalhe }: { titulo: string; detalhe?: string }) {
  return (
    <div className="sticky left-0 z-10 flex flex-col justify-center bg-paper px-4 py-3">
      <span className="font-display text-sm font-semibold tracking-title text-ink">{titulo}</span>
      {detalhe && <span className="text-[0.7rem] text-ink-mute">{detalhe}</span>}
    </div>
  )
}

/**
 * Um dia desligado não mostra campos vazios: mostra que está desligado.
 *
 * Célula habilitada numa coluna que não gera horário nenhum é um convite a
 * preencher a agenda de sábado inteira e não entender por que ninguém marca.
 */
function Celula({
  ativo,
  linha,
  dia,
  resumo,
  onAbrir,
}: {
  ativo: boolean
  linha: Linha
  dia: Dia
  resumo: Resumo
  onAbrir: () => void
}) {
  const Icone = linha.icone

  if (!ativo) {
    return (
      <div className="flex items-center justify-center border-l border-line bg-[color-mix(in_oklab,var(--color-paper-2)_55%,transparent)] px-2 py-4">
        <span className="text-xs text-ink-mute" aria-label={`${linha.titulo}: dia inativo`}>
          —
        </span>
      </div>
    )
  }

  return (
    <div className="border-l border-line p-1.5">
      <button
        type="button"
        onClick={onAbrir}
        aria-label={`${linha.titulo} de ${dia.longo}: ${resumo.principal}, ${resumo.secundario}. Abrir para editar.`}
        className={cn(
          'group flex w-full flex-col items-center gap-1 rounded-xl px-1.5 py-2.5',
          'transition-colors duration-[var(--dur-fast)] ease-out',
          'hover:bg-paper-2 active:bg-paper-3',
          'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus)]',
        )}
      >
        <Icone
          className={cn(
            'size-4 transition-colors duration-[var(--dur-fast)]',
            resumo.tom === 'warn' ? 'text-warn-ink' : 'text-ink-mute group-hover:text-indigo',
          )}
          aria-hidden
        />
        <span
          className={cn(
            'font-display text-[0.8125rem] font-semibold tabular-nums tracking-title',
            resumo.tom === 'mute' ? 'text-ink-mute' : 'text-ink',
          )}
        >
          {resumo.principal}
        </span>
        <span
          className={cn(
            'text-[0.7rem]',
            resumo.tom === 'ok' && 'text-success-ink',
            resumo.tom === 'warn' && 'font-semibold text-warn-ink',
            resumo.tom === 'mute' && 'text-ink-mute',
          )}
        >
          {resumo.secundario}
        </span>
      </button>
    </div>
  )
}

/** A mesma semana em coluna única: o dia, o resumo, o interruptor, o caminho. */
function CartaoDia({
  dia,
  hoje,
  ativo,
  resumo,
  onAlternar,
  onAbrir,
}: {
  dia: Dia
  hoje: boolean
  ativo: boolean
  resumo: string
  onAlternar: () => void
  onAbrir: () => void
}) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-2xl border border-line shadow-soft',
        ativo ? 'bg-paper' : 'bg-paper-2',
      )}
    >
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 font-display text-sm font-semibold tracking-title text-ink">
            {dia.longo}
            {hoje && (
              <span className="u-chip-brand rounded-pill px-2 py-0.5 text-[0.65rem] font-semibold">
                Hoje
              </span>
            )}
          </p>
          <p className={cn('truncate text-xs tabular-nums', ativo ? 'text-ink-soft' : 'text-ink-mute')}>
            {resumo}
          </p>
        </div>
        <Interruptor
          ligado={ativo}
          onChange={onAlternar}
          rotulo={`Atender ${dia.longo.toLowerCase()}`}
        />
      </div>

      {ativo && (
        <button
          type="button"
          onClick={onAbrir}
          className="flex min-h-11 w-full items-center justify-between gap-2 border-t border-line px-4 py-2.5 text-left font-display text-sm font-semibold text-indigo transition-colors duration-[var(--dur-fast)] hover:bg-paper-2 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--color-focus)]"
        >
          Ajustar horários de {dia.curto.toLowerCase()}
          <ChevronRight className="size-4 shrink-0" aria-hidden />
        </button>
      )}
    </div>
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
