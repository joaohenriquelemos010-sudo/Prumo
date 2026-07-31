import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Baby } from 'lucide-react'
import { EmptyState } from '@/components/EmptyState'
import { PainelAlertas } from '@/features/clinico/PainelAlertas'
import { Balanca } from '@/features/bebe/Balanca'
import { CurvaCrescimento } from '@/features/bebe/CurvaCrescimento'
import type { PontoMedida } from '@/features/bebe/CurvaCrescimento'
import { comparacaoDaSemana } from '@/features/bebe/comparacoes-semanais'
import { RegistrarMedidas } from '@/features/bebe/RegistrarMedidas'
import { Checkin } from '@/features/bebe/Checkin'
import { CartaoBatimentos } from '@/features/bebe/CartaoBatimentos'
import { CartaoPeriodoFetal } from '@/features/bebe/CartaoPeriodo'
import { GranularidadeSwitcher } from '@/features/bebe/GranularidadeSwitcher'
import { HistoricoFetal, TodosOsNumeros } from '@/features/bebe/Historicos'
import { NotaCaderninho } from '@/features/bebe/NotaCaderninho'
import { agruparFetais } from '@/features/bebe/agregacao'
import type { Granularidade } from '@/features/bebe/agregacao'
import type { RespostaBebe, ExameResumo } from '@/features/bebe/tipos'

/**
 * A gestação: o agora, e depois a história.
 *
 * A ordem é deliberada. O topo responde "como está o bebê hoje" — a balança, o
 * tamanho, o coração — porque é a pergunta com que a pessoa abriu a tela. Só
 * depois vem a evolução em períodos, que é a pergunta seguinte e não a
 * primeira. Inverter isso obrigaria a rolar para chegar ao que se veio ver.
 */
export function FaseGestacao({
  dados,
  ehMedico,
  semanaAtual,
  temDpp,
  sequencia,
  jaFezCheckin,
  exames,
  granularidade,
  onGranularidade,
  onCheckin,
  onSalvo,
}: {
  dados: RespostaBebe | null
  ehMedico: boolean
  semanaAtual: number
  temDpp: boolean
  sequencia: number
  jaFezCheckin: boolean
  exames: ExameResumo[]
  granularidade: Granularidade
  onGranularidade: (g: Granularidade) => void
  onCheckin: (nota: string) => void
  onSalvo: () => void
}) {
  const medidas = useMemo(() => dados?.medidas ?? [], [dados])

  const medidaAtual = useMemo(() => {
    const ateAgora = medidas.filter((m) => m.semana <= semanaAtual)
    return ateAgora[ateAgora.length - 1] ?? medidas[0] ?? null
  }, [medidas, semanaAtual])

  const pontos: PontoMedida[] = useMemo(
    () =>
      medidas
        .filter((m) => typeof m.pfeG === 'number' && m.pfeG > 0)
        .map((m) => ({ x: m.semana, valor: m.pfeG as number, percentil: m.percentis?.pfeG ?? null })),
    [medidas],
  )

  const periodos = useMemo(() => agruparFetais(medidas, granularidade), [medidas, granularidade])
  const comparacao = comparacaoDaSemana(semanaAtual)

  if (!temDpp && !ehMedico) {
    return (
      <EmptyState
        titulo="Comece pela data provável do parto"
        descricao="Com a DPP a gente calcula a semana da gestação e mostra o tamanho do bebê semana a semana."
        icon={<Baby className="size-7" aria-hidden />}
        action={
          <Link
            to="/app/agenda"
            className="inline-flex min-h-11 items-center rounded-pill px-5 font-display text-sm font-semibold text-white shadow-soft [background-image:var(--grad-brand)]"
          >
            Informar a data
          </Link>
        }
      />
    )
  }

  return (
    <>
      {ehMedico && !temDpp && (
        <p className="rounded-xl bg-paper-2 p-md text-sm text-ink-soft">
          Esta paciente ainda não tem data provável do parto registrada. Informe a DPP no perfil dela
          para a idade gestacional e os percentis serem calculados.
        </p>
      )}

      <section className="relative overflow-hidden rounded-2xl border border-line bg-paper p-lg shadow-soft">
        <Balanca
          semana={semanaAtual}
          pesoG={medidaAtual?.pfeG ?? null}
          vazio={ehMedico ? 'Nenhuma biometria registrada para esta paciente ainda.' : undefined}
        />

        {comparacao && !ehMedico && (
          <div className="mt-md rounded-2xl bg-paper-2 p-md text-center">
            <p className="font-display text-lg font-semibold text-ink">
              <span aria-hidden className="mr-2 text-2xl">
                {comparacao.emoji}
              </span>
              Do tamanho de {comparacao.objeto}
            </p>
            <p className="mt-1 text-sm text-ink-soft">
              Cerca de {String(comparacao.cm).replace('.', ',')} cm · {comparacao.acontecendo}
            </p>
          </div>
        )}
      </section>

      <CartaoBatimentos batimentos={dados?.batimentos ?? []} />

      {!ehMedico && (
        <Checkin
          titulo={`Seu check-in da semana ${semanaAtual}`}
          sequencia={sequencia}
          fraseSequencia={(n) => (n === 1 ? '1 semana seguida' : `${n} semanas seguidas`)}
          jaFez={jaFezCheckin}
          rotuloBotao="Marcar esta semana"
          placeholder="Senti ele mexer bastante à noite…"
          onCheckin={onCheckin}
        />
      )}

      <PainelAlertas />

      {periodos.length > 0 && (
        <section className="flex flex-col gap-md">
          <div className="flex flex-col gap-1">
            <h2 className="text-lg">Como o bebê vem crescendo</h2>
            <p className="text-sm text-ink-soft">
              Cada medida foi registrada pela sua equipe. Você escolhe se quer ver de perto ou de longe.
            </p>
          </div>

          <GranularidadeSwitcher
            valor={granularidade}
            onChange={onGranularidade}
            descricao={
              periodos.length === 1 ? '1 período' : `${periodos.length} períodos com medida`
            }
          />

          {periodos.map((p, i) => (
            <CartaoPeriodoFetal
              key={p.chave}
              periodo={p}
              exames={exames}
              ehMedico={ehMedico}
              indice={i}
            />
          ))}
        </section>
      )}

      {pontos.length > 0 && (
        <section className="rounded-2xl border border-line bg-paper p-lg shadow-soft">
          <h2 className="text-lg">A curva completa</h2>
          <p className="mt-1 text-sm text-ink-soft">
            A faixa mostra o esperado para cada semana. É aqui que os vazios aparecem — e nesta tela
            eles significam alguma coisa.
          </p>
          <div className="mt-md">
            <CurvaCrescimento
              curva={(dados?.curva ?? []).map((c) => ({ x: c.semana, faixa: c.faixa }))}
              medidas={pontos}
              rotuloX="semanas"
              unidade="g"
              /* Tick semanal é ruído quando se está lendo por trimestre. */
              passoX={granularidade === 'trimestre' ? 13 : granularidade === 'mes' ? 8 : 6}
              mostrarPercentis={ehMedico}
            />
          </div>
        </section>
      )}

      {ehMedico && (
        <RegistrarMedidas semanaSugerida={semanaAtual || 20} medidas={medidas} onSalvo={onSalvo} />
      )}

      {medidas.length > 0 && (
        <TodosOsNumeros>
          <HistoricoFetal medidas={medidas} ehMedico={ehMedico} />
        </TodosOsNumeros>
      )}

      {!ehMedico && (
        <NotaCaderninho texto="As medidas são registradas pela sua equipe a partir dos ultrassons." />
      )}
    </>
  )
}
