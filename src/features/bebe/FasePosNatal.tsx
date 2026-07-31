import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Sparkles, CalendarHeart, Stethoscope } from 'lucide-react'
import { PainelAlertas } from '@/features/clinico/PainelAlertas'
import { MARCOS, NOTA_MARCOS } from '@/features/clinico/sus-marcos'
import { proximaPuericultura } from '@/features/clinico/diretrizes-pediatria'
import { Balanca } from '@/features/bebe/Balanca'
import { CrescimentoInfantil } from '@/features/bebe/CrescimentoInfantil'
import { Checkin } from '@/features/bebe/Checkin'
import { CartaoPeriodoInfantil } from '@/features/bebe/CartaoPeriodo'
import { GranularidadeSwitcher } from '@/features/bebe/GranularidadeSwitcher'
import { HistoricoInfantil, TodosOsNumeros } from '@/features/bebe/Historicos'
import { NotaCaderninho } from '@/features/bebe/NotaCaderninho'
import { agruparInfantis } from '@/features/bebe/agregacao'
import type { Granularidade } from '@/features/bebe/agregacao'
import type { RespostaBebe, ExameResumo } from '@/features/bebe/tipos'

/**
 * Depois do nascimento.
 *
 * Mesma estrutura da gestação — o agora, depois a história — porque a pessoa é
 * a mesma e o hábito de leitura que ela formou em nove meses não deve ser
 * desfeito no dia do parto. O que muda é a unidade: mês em vez de semana, e por
 * isso "semana" nem aparece no seletor.
 */
export function FasePosNatal({
  dados,
  ehMedico,
  idadeMeses,
  sequencia,
  jaFezCheckin,
  exames,
  granularidade,
  onGranularidade,
  onCheckin,
}: {
  dados: RespostaBebe | null
  ehMedico: boolean
  idadeMeses: number
  sequencia: number
  jaFezCheckin: boolean
  exames: ExameResumo[]
  granularidade: Granularidade
  onGranularidade: (g: Granularidade) => void
  onCheckin: (nota: string) => void
}) {
  const medidas = useMemo(() => dados?.medidasInfantis ?? [], [dados])
  const ultima = medidas[medidas.length - 1] ?? null
  const proxima = proximaPuericultura(idadeMeses)

  const periodos = useMemo(
    () => agruparInfantis(medidas, granularidade),
    [medidas, granularidade],
  )

  // A faixa de marcos da idade — a que a Caderneta acompanha agora.
  const marco = useMemo(() => {
    const candidatos = MARCOS.filter((m) => m.idadeMeses <= Math.max(idadeMeses, 1))
    return candidatos[candidatos.length - 1] ?? MARCOS[0]
  }, [idadeMeses])

  return (
    <>
      <section className="relative overflow-hidden rounded-2xl border border-line bg-paper p-lg shadow-soft">
        <Balanca
          semana={40}
          progresso={1}
          pesoG={ultima?.pesoKg ? ultima.pesoKg * 1000 : null}
          legenda={
            ultima
              ? `medido ${ultima.meses === 0 ? 'no nascimento' : `com ${ultima.meses} ${ultima.meses === 1 ? 'mês' : 'meses'}`}`
              : undefined
          }
          vazio={
            ehMedico
              ? 'Nenhuma medida registrada para esta criança ainda.'
              : 'As medidas do bebê aparecem aqui depois da próxima consulta de puericultura.'
          }
        />

        {ultima && (
          <dl className="mt-md grid grid-cols-2 gap-3 rounded-2xl bg-paper-2 p-md text-center min-[560px]:grid-cols-3">
            <Medida
              termo="Peso"
              valor={ultima.pesoKg ? `${ultima.pesoKg.toFixed(2).replace('.', ',')} kg` : '—'}
            />
            <Medida
              termo="Comprimento"
              valor={ultima.comprimentoCm ? `${String(ultima.comprimentoCm).replace('.', ',')} cm` : '—'}
            />
            <Medida
              termo="Perímetro cefálico"
              valor={
                ultima.perimetroCefalicoCm
                  ? `${String(ultima.perimetroCefalicoCm).replace('.', ',')} cm`
                  : '—'
              }
            />
          </dl>
        )}
      </section>

      {!ehMedico && (
        <Checkin
          titulo={`Seu check-in de ${idadeMeses === 0 ? 'recém-nascido' : `${idadeMeses} ${idadeMeses === 1 ? 'mês' : 'meses'}`}`}
          sequencia={sequencia}
          fraseSequencia={(n) => (n === 1 ? '1 mês seguido' : `${n} meses seguidos`)}
          jaFez={jaFezCheckin}
          rotuloBotao="Marcar este mês"
          placeholder="Dormiu melhor esta semana, começou a sorrir…"
          onCheckin={onCheckin}
        />
      )}

      <PainelAlertas />

      {periodos.length > 0 && (
        <section className="flex flex-col gap-md">
          <div className="flex flex-col gap-1">
            <h2 className="text-lg">Como o bebê vem crescendo</h2>
            <p className="text-sm text-ink-soft">
              Cada medida veio de uma consulta. Você escolhe se quer ver mês a mês ou por trimestre.
            </p>
          </div>

          <GranularidadeSwitcher
            valor={granularidade === 'semana' ? 'mes' : granularidade}
            onChange={onGranularidade}
            /* Depois do nascimento a puericultura e as curvas da OMS são
               mensais — oferecer "semana" seria oferecer um agrupamento que
               não existe do outro lado. */
            desabilitadas={['semana']}
            descricao={periodos.length === 1 ? '1 período' : `${periodos.length} períodos com medida`}
          />

          {periodos.map((p, i) => (
            <CartaoPeriodoInfantil key={p.chave} periodo={p} exames={exames} indice={i} />
          ))}
        </section>
      )}

      <CrescimentoInfantil
        medidas={medidas}
        curvas={dados?.curvasInfantis ?? null}
        mostrarPercentis={ehMedico}
      />

      {!ehMedico && marco && (
        <section className="rounded-2xl border border-line bg-paper p-lg shadow-soft">
          <h2 className="inline-flex items-center gap-2 text-lg">
            <Sparkles className="size-5 text-indigo" aria-hidden />O que costuma aparecer por volta
            dos {marco.faixa}
          </h2>
          <ul className="mt-md flex flex-col gap-2">
            {marco.itens.map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm">
                <span
                  className="mt-1.5 size-1.5 shrink-0 rounded-full [background-image:var(--grad-brand)]"
                  aria-hidden
                />
                <span className="text-ink-soft">{item}</span>
              </li>
            ))}
          </ul>
          <p className="mt-md rounded-xl bg-paper-2 p-md text-xs text-ink-mute">{NOTA_MARCOS}</p>
        </section>
      )}

      {proxima && (
        <section className="rounded-2xl border border-line bg-paper p-lg shadow-soft">
          <h2 className="inline-flex items-center gap-2 text-lg">
            <CalendarHeart className="size-5 text-indigo" aria-hidden />
            Próxima consulta de puericultura
          </h2>
          <p className="mt-2 font-display text-xl font-bold text-ink">{proxima.idadeLabel}</p>
          <p className="mt-1 text-sm text-ink-soft">{proxima.foco}</p>
          {!ehMedico && (
            <Link
              to="/app/profissionais?objetivo=consulta-crianca"
              className="mt-md inline-flex min-h-11 items-center gap-2 rounded-pill px-5 font-display text-sm font-semibold text-white shadow-soft [background-image:var(--grad-brand)]"
            >
              <Stethoscope className="size-4" aria-hidden />
              Marcar com pediatra
            </Link>
          )}
        </section>
      )}

      {medidas.length > 0 && (
        <TodosOsNumeros>
          <HistoricoInfantil medidas={medidas} ehMedico={ehMedico} />
        </TodosOsNumeros>
      )}

      {ehMedico && (
        <p className="rounded-xl bg-paper-2 p-md text-xs text-ink-mute">
          As medidas vêm das consultas pediátricas registradas em{' '}
          <Link to="/app/consultas" className="font-semibold text-indigo underline underline-offset-2">
            Consultas
          </Link>
          , e o ponto do nascimento vem do resumo no prontuário.
        </p>
      )}

      {!ehMedico && (
        <NotaCaderninho texto="As medidas são registradas pela sua equipe nas consultas de puericultura." />
      )}
    </>
  )
}

function Medida({ termo, valor }: { termo: string; valor: string }) {
  return (
    <div>
      <dt className="text-xs text-ink-mute">{termo}</dt>
      <dd className="font-display text-lg font-bold text-ink">{valor}</dd>
    </div>
  )
}
