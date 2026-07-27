import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Baby, Flame, Check, Stethoscope, Sparkles, CalendarHeart, HeartPulse } from 'lucide-react'
import { api } from '@/lib/api/client'
import { useAuth } from '@/lib/stores/auth'
import { usePerfil } from '@/lib/stores/perfil'
import { useMedicoContext, criancaQuery } from '@/lib/stores/medico-context'
import { Button } from '@/components/Button'
import { Skeleton } from '@/components/Skeleton'
import { EmptyState } from '@/components/EmptyState'
import { AlertaErro } from '@/components/AlertaErro'
import { Confetti } from '@/features/trilha/Confetti'
import { PainelAlertas } from '@/features/clinico/PainelAlertas'
import { SeletorPaciente } from '@/features/painel/SeletorPaciente'
import { idadeGestacional } from '@/features/clinico/schedule'
import { MARCOS, NOTA_MARCOS } from '@/features/clinico/sus-marcos'
import { proximaPuericultura } from '@/features/clinico/diretrizes-pediatria'
import { PASSOS_PRECONCEPCIONAIS, REFERENCIA_PRECONCEPCIONAL } from '@/features/clinico/diretrizes-preconcepcional'
import { Balanca } from '@/features/bebe/Balanca'
import { CurvaCrescimento } from '@/features/bebe/CurvaCrescimento'
import type { PontoMedida } from '@/features/bebe/CurvaCrescimento'
import { CrescimentoInfantil } from '@/features/bebe/CrescimentoInfantil'
import type { CurvasInfantis, PontoInfantil } from '@/features/bebe/CrescimentoInfantil'
import { comparacaoDaSemana } from '@/features/bebe/comparacoes-semanais'
import { RegistrarMedidas } from '@/features/bebe/RegistrarMedidas'
import { cn } from '@/lib/cn'

export interface MedidaFetal {
  id: string
  semana: number
  data: string
  autorNome: string
  dbpMm: number | null
  ccMm: number | null
  caMm: number | null
  cfMm: number | null
  pfeG: number | null
  ilaCm: number | null
  apresentacao: string
  placenta: string
  observacao: string
  percentis?: Record<string, number | null>
  notasPrivadas?: string
}

type Fase = 'planejando' | 'gestacao' | 'pos-natal'

interface Checkin {
  periodo: number
  fase: Fase | 'gestacao' | 'pos-natal'
  em: string
  notaFamilia: string
}

interface RespostaBebe {
  fase: Fase
  idadeMeses: number | null
  medidas: MedidaFetal[]
  curva: { semana: number; faixa: { p3: number; p10: number; p50: number; p90: number; p97: number } }[]
  medidasInfantis: PontoInfantil[]
  curvasInfantis: CurvasInfantis | null
  checkins: Checkin[]
}

interface PerfilJornada {
  nome: string
  dpp: string | null
  dataNascimento: string | null
}

/**
 * The baby's growth — both halves of the journey.
 *
 * Before birth: fetal biometry, the size comparison, the weekly ritual. After
 * birth: the child's weight, length and head circumference against the WHO
 * curves, the milestones for the age, and the next puericultura visit. The page
 * follows the journey instead of ending at the delivery — which is the whole
 * point of a product that claims to run from pregnancy into paediatrics.
 */
export default function AppBebe() {
  const papel = useAuth((s) => s.user?.papel)
  const ehMedico = papel === 'medico'
  const criancaAtiva = useMedicoContext((s) => s.criancaAtiva)

  const perfilProprio = usePerfil((s) => s.perfil)
  const loadPerfil = usePerfil((s) => s.load)
  const perfilLoaded = usePerfil((s) => s.loaded)

  const [dados, setDados] = useState<RespostaBebe | null>(null)
  const [perfilPaciente, setPerfilPaciente] = useState<PerfilJornada | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [celebrar, setCelebrar] = useState(false)

  useEffect(() => {
    if (!ehMedico && !perfilLoaded) void loadPerfil()
  }, [ehMedico, perfilLoaded, loadPerfil])

  const carregar = useCallback(async () => {
    setCarregando(true)
    try {
      // The doctor reads the SELECTED patient's journey, not their own.
      const [d, p] = await Promise.all([
        api.get<RespostaBebe>(`/bebe${criancaQuery(criancaAtiva)}`),
        api.get<{ perfil: PerfilJornada }>(`/perfil${criancaQuery(criancaAtiva)}`).then((r) => r.perfil),
      ])
      setDados(d)
      setPerfilPaciente(p)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui carregar agora.')
    } finally {
      setCarregando(false)
    }
  }, [criancaAtiva])

  useEffect(() => {
    void carregar()
  }, [carregar])

  const perfil = ehMedico ? perfilPaciente : (perfilProprio as PerfilJornada | null)
  const fase: Fase = dados?.fase ?? 'planejando'
  const ig = perfil?.dpp && fase === 'gestacao' ? idadeGestacional(new Date(perfil.dpp)) : null

  // Weeks in pregnancy, months after birth — the period the check-in is keyed to.
  const periodoAtual = fase === 'pos-natal' ? (dados?.idadeMeses ?? 0) : (ig?.semanas ?? 0)

  const sequencia = useMemo(
    () => calcularSequencia(dados?.checkins ?? [], fase, periodoAtual),
    [dados, fase, periodoAtual],
  )
  const jaFezCheckin = (dados?.checkins ?? []).some(
    (c) => c.fase === fase && c.periodo === periodoAtual,
  )

  async function registrarCheckin(nota: string) {
    try {
      const { checkins } = await api.post<{ checkins: Checkin[] }>(
        `/bebe/checkin${criancaQuery(criancaAtiva)}`,
        { periodo: periodoAtual, fase, notaFamilia: nota || undefined },
      )
      setDados((d) => (d ? { ...d, checkins } : d))
      setCelebrar(true)
      setTimeout(() => setCelebrar(false), 2000)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui registrar agora.')
    }
  }

  if (carregando) {
    return (
      <div className="flex flex-col gap-lg">
        <Cabecalho fase="gestacao" />
        <Skeleton className="h-72" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-lg">
      <Confetti trigger={celebrar} />
      <Cabecalho
        fase={fase}
        ehMedico={ehMedico}
        paciente={perfilPaciente?.nome}
        descricao={
          fase === 'gestacao'
            ? ig
              ? ehMedico
                ? `${ig.porExtenso} de gestação.`
                : `Você está com ${ig.porExtenso} de gestação.`
              : undefined
            : fase === 'pos-natal'
              ? descreverIdade(dados?.idadeMeses ?? 0)
              : undefined
        }
      />

      <SeletorPaciente />

      {erro && <AlertaErro>{erro}</AlertaErro>}

      {fase === 'planejando' && <FasePlanejando ehMedico={ehMedico} />}

      {fase === 'gestacao' && (
        <FaseGestacao
          dados={dados}
          ehMedico={ehMedico}
          semanaAtual={ig?.semanas ?? 0}
          temDpp={Boolean(perfil?.dpp)}
          sequencia={sequencia}
          jaFezCheckin={jaFezCheckin}
          onCheckin={registrarCheckin}
          onSalvo={() => void carregar()}
        />
      )}

      {fase === 'pos-natal' && (
        <FasePosNatal
          dados={dados}
          ehMedico={ehMedico}
          idadeMeses={dados?.idadeMeses ?? 0}
          sequencia={sequencia}
          jaFezCheckin={jaFezCheckin}
          onCheckin={registrarCheckin}
        />
      )}
    </div>
  )
}

/* --------------------------------- header -------------------------------- */

const TITULO: Record<Fase, { eyebrow: string; titulo: string; padrao: string }> = {
  planejando: {
    eyebrow: 'Antes de engravidar',
    titulo: 'Primeiros passos',
    padrao: 'O que fazer antes de começar a tentar.',
  },
  gestacao: {
    eyebrow: 'Seu bebê',
    titulo: 'Semana a semana',
    padrao: 'O crescimento do bebê, do jeito que dá para ver.',
  },
  'pos-natal': {
    eyebrow: 'Seu bebê',
    titulo: 'Mês a mês',
    padrao: 'Como seu bebê vem crescendo desde o nascimento.',
  },
}

function Cabecalho({
  fase,
  ehMedico,
  paciente,
  descricao,
}: {
  fase: Fase
  ehMedico?: boolean
  paciente?: string
  descricao?: string
}) {
  const t = TITULO[fase]
  return (
    <header className="flex flex-col gap-1">
      <p className="u-eyebrow">{ehMedico ? 'Crescimento' : t.eyebrow}</p>
      <h1 className="text-3xl sm:text-4xl">
        {ehMedico && fase === 'gestacao' ? 'Biometria semana a semana' : t.titulo}
      </h1>
      <p className="text-ink-soft">
        {ehMedico && paciente ? `${paciente} · ` : ''}
        {descricao ?? t.padrao}
      </p>
    </header>
  )
}

function descreverIdade(meses: number): string {
  if (meses === 0) return 'Recém-nascido — as primeiras semanas.'
  if (meses < 12) return `${meses} ${meses === 1 ? 'mês' : 'meses'} de vida.`
  const anos = Math.floor(meses / 12)
  const resto = meses % 12
  const parteAnos = `${anos} ${anos === 1 ? 'ano' : 'anos'}`
  return resto ? `${parteAnos} e ${resto} ${resto === 1 ? 'mês' : 'meses'}.` : `${parteAnos}.`
}

/* ------------------------------- gestation ------------------------------- */

function FaseGestacao({
  dados,
  ehMedico,
  semanaAtual,
  temDpp,
  sequencia,
  jaFezCheckin,
  onCheckin,
  onSalvo,
}: {
  dados: RespostaBebe | null
  ehMedico: boolean
  semanaAtual: number
  temDpp: boolean
  sequencia: number
  jaFezCheckin: boolean
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

      {pontos.length > 0 && (
        <section className="rounded-2xl border border-line bg-paper p-lg shadow-soft">
          <h2 className="text-lg">Como o bebê vem crescendo</h2>
          <p className="mt-1 text-sm text-ink-soft">
            Cada ponto é uma medida registrada pela sua equipe. A faixa mostra o esperado para cada semana.
          </p>
          <div className="mt-md">
            <CurvaCrescimento
              curva={(dados?.curva ?? []).map((c) => ({ x: c.semana, faixa: c.faixa }))}
              medidas={pontos}
              rotuloX="semanas"
              unidade="g"
              passoX={6}
              mostrarPercentis={ehMedico}
            />
          </div>
        </section>
      )}

      {ehMedico && (
        <RegistrarMedidas semanaSugerida={semanaAtual || 20} medidas={medidas} onSalvo={onSalvo} />
      )}

      <HistoricoFetal medidas={medidas} ehMedico={ehMedico} />

      {!ehMedico && <NotaCaderninho texto="As medidas são registradas pela sua equipe a partir dos ultrassons." />}
    </>
  )
}

/* ------------------------------- postnatal ------------------------------- */

function FasePosNatal({
  dados,
  ehMedico,
  idadeMeses,
  sequencia,
  jaFezCheckin,
  onCheckin,
}: {
  dados: RespostaBebe | null
  ehMedico: boolean
  idadeMeses: number
  sequencia: number
  jaFezCheckin: boolean
  onCheckin: (nota: string) => void
}) {
  const medidas = useMemo(() => dados?.medidasInfantis ?? [], [dados])
  const ultima = medidas[medidas.length - 1] ?? null
  const proxima = proximaPuericultura(idadeMeses)

  // The milestone band for the age — the one the Caderneta tracks right now.
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
            <Medida termo="Peso" valor={ultima.pesoKg ? `${ultima.pesoKg.toFixed(2).replace('.', ',')} kg` : '—'} />
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

      <CrescimentoInfantil
        medidas={medidas}
        curvas={dados?.curvasInfantis ?? null}
        mostrarPercentis={ehMedico}
      />

      {!ehMedico && marco && (
        <section className="rounded-2xl border border-line bg-paper p-lg shadow-soft">
          <h2 className="inline-flex items-center gap-2 text-lg">
            <Sparkles className="size-5 text-indigo" aria-hidden />
            O que costuma aparecer por volta dos {marco.faixa}
          </h2>
          <ul className="mt-md flex flex-col gap-2">
            {marco.itens.map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full [background-image:var(--grad-brand)]" aria-hidden />
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

      <HistoricoInfantil medidas={medidas} ehMedico={ehMedico} />

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

/* ------------------------------- planning -------------------------------- */

/**
 * Before the pregnancy there is nothing to measure — but there is plenty to do,
 * and most of what reduces risk only works if it happens now. This surfaces the
 * pre-conception guidance instead of leaving the page blank.
 */
function FasePlanejando({ ehMedico }: { ehMedico: boolean }) {
  return (
    <>
      <section className="rounded-2xl border border-line bg-paper p-lg shadow-soft">
        <div className="grid place-items-center py-md text-center">
          <span className="grid size-16 place-items-center rounded-full [background-image:var(--grad-brand-soft)] text-indigo">
            <HeartPulse className="size-7" aria-hidden />
          </span>
          <p className="mt-md max-w-prose text-ink-soft">
            {ehMedico
              ? 'Jornada em planejamento — sem gestação em curso. Abaixo, o roteiro pré-concepcional.'
              : 'Ainda não há um bebê para medir, mas já há muito o que preparar. Boa parte do que mais protege a gestação só funciona se acontecer antes dela.'}
          </p>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        {PASSOS_PRECONCEPCIONAIS.map((passo, i) => (
          <article key={passo.id} className="rounded-2xl border border-line bg-paper p-lg shadow-soft">
            <div className="flex items-start gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-full [background-image:var(--grad-brand-soft)] font-display font-bold text-indigo">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg">{passo.titulo}</h2>
                  <span
                    className={cn(
                      'rounded-pill px-2.5 py-0.5 text-xs font-semibold',
                      passo.responsavel === 'equipe' ? 'u-chip-brand' : 'bg-paper-2 text-ink-soft',
                    )}
                  >
                    {passo.responsavel === 'equipe' ? 'com a equipe' : 'com você'}
                  </span>
                </div>
                <p className="mt-1 text-sm text-ink-soft">{passo.porque}</p>
                <ul className="mt-md flex flex-col gap-1.5">
                  {passo.comoFazer.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm">
                      <span
                        className="mt-1.5 size-1.5 shrink-0 rounded-full [background-image:var(--grad-brand)]"
                        aria-hidden
                      />
                      <span className="text-ink-soft">{item}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-md text-xs font-semibold text-indigo">{passo.quando}</p>
              </div>
            </div>
          </article>
        ))}
      </section>

      {!ehMedico && (
        <Link
          to="/app/profissionais?objetivo=pre-concepcional"
          className="inline-flex min-h-11 items-center gap-2 self-start rounded-pill px-5 font-display text-sm font-semibold text-white shadow-soft [background-image:var(--grad-brand)]"
        >
          <Stethoscope className="size-4" aria-hidden />
          Marcar consulta pré-concepcional
        </Link>
      )}

      <p className="rounded-xl bg-paper-2 p-md text-xs text-ink-mute">
        Fonte: {REFERENCIA_PRECONCEPCIONAL} Conteúdo informativo — a conduta é sempre da equipe que
        acompanha você.
      </p>
    </>
  )
}

/* -------------------------------- shared --------------------------------- */

function NotaCaderninho({ texto }: { texto: string }) {
  return (
    <p className="rounded-xl bg-paper-2 p-md text-xs text-ink-mute">
      {texto} Se algo aqui te deixar em dúvida, anote no{' '}
      <Link to="/app/caderninho" className="font-semibold text-indigo underline underline-offset-2">
        caderninho
      </Link>{' '}
      e leve para a próxima consulta.
    </p>
  )
}

function Checkin({
  titulo,
  sequencia,
  fraseSequencia,
  jaFez,
  rotuloBotao,
  placeholder,
  onCheckin,
}: {
  titulo: string
  sequencia: number
  /** Frase inteira, não só a unidade: "1 mês seguido" x "2 meses seguidos". */
  fraseSequencia: (n: number) => string
  jaFez: boolean
  rotuloBotao: string
  placeholder: string
  onCheckin: (nota: string) => void
}) {
  const [nota, setNota] = useState('')
  const [abrindo, setAbrindo] = useState(false)

  return (
    <section className="rounded-2xl border border-line bg-paper p-lg shadow-soft">
      <div className="flex flex-wrap items-center justify-between gap-md">
        <div className="min-w-0">
          <h2 className="inline-flex items-center gap-2 text-lg">
            <Sparkles className="size-5 text-indigo" aria-hidden />
            {titulo}
          </h2>
          <p className="mt-1 text-sm text-ink-soft">
            {jaFez ? 'Feito! Anote o que quiser lembrar.' : 'Um toque para marcar que você acompanhou.'}
          </p>
        </div>

        {sequencia > 0 && (
          <span className="u-chip-warn inline-flex items-center gap-1.5 rounded-pill px-3 py-1.5 font-display text-sm font-bold">
            <Flame className="size-4" aria-hidden />
            {fraseSequencia(sequencia)}
          </span>
        )}
      </div>

      {!jaFez && !abrindo && (
        <Button className="mt-md" onClick={() => setAbrindo(true)} iconLeft={<Check className="size-4" aria-hidden />}>
          {rotuloBotao}
        </Button>
      )}

      {(abrindo || jaFez) && (
        <div className="mt-md">
          <label className="block text-sm font-semibold text-ink" htmlFor="nota-checkin">
            Como foi? (opcional)
          </label>
          <textarea
            id="nota-checkin"
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            placeholder={placeholder}
            maxLength={500}
            className="input mt-1 min-h-20 resize-y"
          />
          <Button
            className="mt-3"
            onClick={() => {
              onCheckin(nota)
              setAbrindo(false)
            }}
            iconLeft={<Check className="size-4" aria-hidden />}
          >
            {jaFez ? 'Salvar anotação' : rotuloBotao}
          </Button>
        </div>
      )}
    </section>
  )
}

/** Consecutive periods checked in within the current phase, counting backwards. */
function calcularSequencia(checkins: Checkin[], fase: Fase, atual: number): number {
  const feitas = new Set(checkins.filter((c) => c.fase === fase).map((c) => c.periodo))
  let n = 0
  for (let p = atual; p >= 0; p--) {
    if (!feitas.has(p)) break
    n++
  }
  return n
}

/* -------------------------------- history -------------------------------- */

function HistoricoFetal({ medidas, ehMedico }: { medidas: MedidaFetal[]; ehMedico: boolean }) {
  if (medidas.length === 0) return null

  return (
    <section className="rounded-2xl border border-line bg-paper p-lg shadow-soft">
      <h2 className="inline-flex items-center gap-2 text-lg">
        <Stethoscope className="size-5 text-indigo" aria-hidden />
        Medidas registradas
      </h2>
      <div className="mt-md overflow-x-auto">
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead>
            <tr className="text-xs text-ink-mute">
              <th scope="col" className="pb-2 pr-3 font-semibold">Semana</th>
              <th scope="col" className="pb-2 pr-3 font-semibold">Peso estimado</th>
              {ehMedico && (
                <>
                  <th scope="col" className="pb-2 pr-3 font-semibold">CC</th>
                  <th scope="col" className="pb-2 pr-3 font-semibold">CA</th>
                  <th scope="col" className="pb-2 pr-3 font-semibold">CF</th>
                  <th scope="col" className="pb-2 pr-3 font-semibold">Percentil</th>
                </>
              )}
              <th scope="col" className="pb-2 font-semibold">Registrado por</th>
            </tr>
          </thead>
          <tbody>
            {[...medidas]
              .sort((a, b) => b.semana - a.semana)
              .map((m) => (
                <tr key={m.id} className="border-t border-line">
                  <td className="py-2 pr-3 font-semibold text-ink">{m.semana}s</td>
                  <td className="py-2 pr-3 text-ink-soft">{m.pfeG ? `${m.pfeG} g` : '—'}</td>
                  {ehMedico && (
                    <>
                      <td className="py-2 pr-3 text-ink-soft">{m.ccMm ? `${m.ccMm} mm` : '—'}</td>
                      <td className="py-2 pr-3 text-ink-soft">{m.caMm ? `${m.caMm} mm` : '—'}</td>
                      <td className="py-2 pr-3 text-ink-soft">{m.cfMm ? `${m.cfMm} mm` : '—'}</td>
                      <td className="py-2 pr-3">
                        <ChipPercentil valor={m.percentis?.pfeG ?? null} />
                      </td>
                    </>
                  )}
                  <td className="py-2 text-ink-mute">{m.autorNome || '—'}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function HistoricoInfantil({ medidas, ehMedico }: { medidas: PontoInfantil[]; ehMedico: boolean }) {
  if (medidas.length === 0) return null

  return (
    <section className="rounded-2xl border border-line bg-paper p-lg shadow-soft">
      <h2 className="inline-flex items-center gap-2 text-lg">
        <Stethoscope className="size-5 text-indigo" aria-hidden />
        Medidas registradas
      </h2>
      <div className="mt-md overflow-x-auto">
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead>
            <tr className="text-xs text-ink-mute">
              <th scope="col" className="pb-2 pr-3 font-semibold">Idade</th>
              <th scope="col" className="pb-2 pr-3 font-semibold">Peso</th>
              <th scope="col" className="pb-2 pr-3 font-semibold">Comprimento</th>
              <th scope="col" className="pb-2 pr-3 font-semibold">PC</th>
              {ehMedico && <th scope="col" className="pb-2 pr-3 font-semibold">Percentil peso</th>}
              <th scope="col" className="pb-2 font-semibold">Origem</th>
            </tr>
          </thead>
          <tbody>
            {[...medidas]
              .sort((a, b) => b.meses - a.meses)
              .map((m) => (
                <tr key={`${m.meses}-${m.data}`} className="border-t border-line">
                  <td className="py-2 pr-3 font-semibold text-ink">
                    {m.meses === 0 ? 'Nascimento' : `${m.meses} ${m.meses === 1 ? 'mês' : 'meses'}`}
                  </td>
                  <td className="py-2 pr-3 text-ink-soft">
                    {m.pesoKg ? `${m.pesoKg.toFixed(2).replace('.', ',')} kg` : '—'}
                  </td>
                  <td className="py-2 pr-3 text-ink-soft">{m.comprimentoCm ? `${m.comprimentoCm} cm` : '—'}</td>
                  <td className="py-2 pr-3 text-ink-soft">
                    {m.perimetroCefalicoCm ? `${m.perimetroCefalicoCm} cm` : '—'}
                  </td>
                  {ehMedico && (
                    <td className="py-2 pr-3">
                      <ChipPercentil valor={m.percentis?.pesoKg ?? null} />
                    </td>
                  )}
                  <td className="py-2 text-ink-mute">
                    {m.origem === 'nascimento' ? 'Resumo do nascimento' : m.autorNome || 'Consulta'}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function ChipPercentil({ valor }: { valor: number | null }) {
  if (valor == null) return <span className="text-ink-mute">—</span>
  return (
    <span
      className={cn(
        'rounded-pill px-2 py-0.5 text-xs font-semibold',
        valor < 10 || valor > 90 ? 'u-chip-warn' : 'u-chip-success',
      )}
    >
      P{valor}
    </span>
  )
}
