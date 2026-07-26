import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Baby, Flame, Check, Ruler, Stethoscope, Sparkles } from 'lucide-react'
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
import { Balanca } from '@/features/bebe/Balanca'
import { CurvaCrescimento } from '@/features/bebe/CurvaCrescimento'
import type { PontoCurva, PontoMedida } from '@/features/bebe/CurvaCrescimento'
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
  percentis: Record<string, number | null>
  notasPrivadas?: string
}

interface Checkin {
  semana: number
  em: string
  notaFamilia: string
}

interface RespostaBebe {
  medidas: MedidaFetal[]
  curva: PontoCurva[]
  checkins: Checkin[]
}

interface PerfilJornada {
  nome: string
  dpp: string | null
}

/**
 * The baby's week — the family's ritual, and the obstetrician's measurement form.
 *
 * Same record, two readings. The family sees how big the baby is now, the curve,
 * and a streak for coming back; the clinician sees the biometry, the percentiles
 * and the private notes. Which one you get is decided by the server.
 */
export default function AppBebe() {
  const papel = useAuth((s) => s.user?.papel)
  const ehMedico = papel === 'medico'
  const criancaAtiva = useMedicoContext((s) => s.criancaAtiva)

  const perfil = usePerfil((s) => s.perfil)
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
      // The doctor reads the SELECTED patient's journey, not their own — the
      // gestational age drives every number on this page, so taking it from the
      // wrong profile shows the wrong week to the person recording measurements.
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

  const dpp = ehMedico ? perfilPaciente?.dpp : perfil?.dpp
  const ig = dpp ? idadeGestacional(new Date(dpp)) : null
  const semanaAtual = ig?.semanas ?? 0

  const medidaAtual = useMemo(() => {
    if (!dados) return null
    const ateAgora = dados.medidas.filter((m) => m.semana <= semanaAtual)
    return ateAgora[ateAgora.length - 1] ?? dados.medidas[0] ?? null
  }, [dados, semanaAtual])

  const pontos: PontoMedida[] = useMemo(
    () =>
      (dados?.medidas ?? [])
        .filter((m) => typeof m.pfeG === 'number' && m.pfeG > 0)
        .map((m) => ({ semana: m.semana, valor: m.pfeG as number, percentil: m.percentis?.pfeG ?? null })),
    [dados],
  )

  const sequencia = useMemo(() => calcularSequencia(dados?.checkins ?? [], semanaAtual), [dados, semanaAtual])
  const jaFezCheckin = (dados?.checkins ?? []).some((c) => c.semana === semanaAtual)

  async function registrarCheckin(nota: string) {
    try {
      const { checkins } = await api.post<{ checkins: Checkin[] }>(
        `/bebe/checkin${criancaQuery(criancaAtiva)}`,
        { semana: semanaAtual, notaFamilia: nota || undefined },
      )
      setDados((d) => (d ? { ...d, checkins } : d))
      setCelebrar(true)
      setTimeout(() => setCelebrar(false), 2000)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui registrar agora.')
    }
  }

  if (!dpp && !ehMedico) {
    return (
      <div className="flex flex-col gap-lg">
        <Cabecalho />
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
      </div>
    )
  }

  const comparacao = comparacaoDaSemana(semanaAtual)

  return (
    <div className="flex flex-col gap-lg">
      <Confetti trigger={celebrar} />
      <Cabecalho ig={ig?.porExtenso} ehMedico={ehMedico} paciente={perfilPaciente?.nome} />

      <SeletorPaciente />

      {erro && <AlertaErro>{erro}</AlertaErro>}

      {ehMedico && !dpp && (
        <p className="rounded-xl bg-paper-2 p-md text-sm text-ink-soft">
          Esta paciente ainda não tem data provável do parto registrada. Informe a DPP no perfil
          dela para a idade gestacional e os percentis serem calculados.
        </p>
      )}

      {carregando ? (
        <Skeleton className="h-72" />
      ) : (
        <>
          <section className="relative overflow-hidden rounded-2xl border border-line bg-paper p-lg shadow-soft">
            <Balanca
              semana={semanaAtual}
              pesoG={medidaAtual?.pfeG ?? null}
              vazio={
                ehMedico
                  ? 'Nenhuma biometria registrada para esta paciente ainda.'
                  : undefined
              }
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
            <CheckinSemanal
              semana={semanaAtual}
              sequencia={sequencia}
              jaFez={jaFezCheckin}
              onCheckin={registrarCheckin}
            />
          )}

          <PainelAlertas />

          {pontos.length > 0 && (
            <section className="rounded-2xl border border-line bg-paper p-lg shadow-soft">
              <h2 className="inline-flex items-center gap-2 text-lg">
                <Ruler className="size-5 text-indigo" aria-hidden />
                Como o bebê vem crescendo
              </h2>
              <p className="mt-1 text-sm text-ink-soft">
                Cada ponto é uma medida registrada pela sua equipe. A faixa mostra o esperado para
                cada semana.
              </p>
              <div className="mt-md">
                <CurvaCrescimento curva={dados?.curva ?? []} medidas={pontos} mostrarPercentis={ehMedico} />
              </div>
            </section>
          )}

          {ehMedico && (
            <RegistrarMedidas
              semanaSugerida={semanaAtual || 20}
              medidas={dados?.medidas ?? []}
              onSalvo={() => void carregar()}
            />
          )}

          <HistoricoMedidas medidas={dados?.medidas ?? []} ehMedico={ehMedico} />

          {!ehMedico && (
            <p className="rounded-xl bg-paper-2 p-md text-xs text-ink-mute">
              As medidas são registradas pela sua equipe a partir dos ultrassons. Se algo aqui te
              deixar em dúvida, anote no{' '}
              <Link to="/app/caderninho" className="font-semibold text-indigo underline underline-offset-2">
                caderninho
              </Link>{' '}
              e leve para a próxima consulta.
            </p>
          )}
        </>
      )}
    </div>
  )
}

function Cabecalho({
  ig,
  ehMedico,
  paciente,
}: {
  ig?: string
  ehMedico?: boolean
  paciente?: string
}) {
  if (ehMedico) {
    return (
      <header className="flex flex-col gap-1">
        <p className="u-eyebrow">Crescimento fetal</p>
        <h1 className="text-3xl sm:text-4xl">Biometria semana a semana</h1>
        <p className="text-ink-soft">
          {paciente ? `${paciente} · ` : ''}
          {ig ? `${ig} de gestação.` : 'Sem idade gestacional registrada.'}
        </p>
      </header>
    )
  }
  return (
    <header className="flex flex-col gap-1">
      <p className="u-eyebrow">Seu bebê</p>
      <h1 className="text-3xl sm:text-4xl">Semana a semana</h1>
      <p className="text-ink-soft">
        {ig ? `Você está com ${ig} de gestação.` : 'O crescimento do bebê, do jeito que dá para ver.'}
      </p>
    </header>
  )
}

/* ------------------------------ weekly ritual ----------------------------- */

function CheckinSemanal({
  semana,
  sequencia,
  jaFez,
  onCheckin,
}: {
  semana: number
  sequencia: number
  jaFez: boolean
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
            Seu check-in da semana {semana}
          </h2>
          <p className="mt-1 text-sm text-ink-soft">
            {jaFez
              ? 'Feito! Anote o que quiser lembrar desta semana.'
              : 'Um toque para marcar que você acompanhou esta semana.'}
          </p>
        </div>

        {sequencia > 0 && (
          <span className="u-chip-warn inline-flex items-center gap-1.5 rounded-pill px-3 py-1.5 font-display text-sm font-bold">
            <Flame className="size-4" aria-hidden />
            {sequencia} {sequencia === 1 ? 'semana' : 'semanas'} seguidas
          </span>
        )}
      </div>

      {!jaFez && !abrindo && (
        <Button className="mt-md" onClick={() => setAbrindo(true)} iconLeft={<Check className="size-4" aria-hidden />}>
          Marcar esta semana
        </Button>
      )}

      {(abrindo || jaFez) && (
        <div className="mt-md">
          <label className="block text-sm font-semibold text-ink" htmlFor="nota-semana">
            Como foi esta semana? (opcional)
          </label>
          <textarea
            id="nota-semana"
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            placeholder="Senti ele mexer bastante à noite…"
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
            {jaFez ? 'Salvar anotação' : 'Marcar semana'}
          </Button>
        </div>
      )}
    </section>
  )
}

/** Consecutive weeks checked in, counting back from the current one. */
function calcularSequencia(checkins: Checkin[], semanaAtual: number): number {
  const feitas = new Set(checkins.map((c) => c.semana))
  let n = 0
  for (let s = semanaAtual; s > 0; s--) {
    if (!feitas.has(s)) break
    n++
  }
  return n
}

/* -------------------------------- history -------------------------------- */

function HistoricoMedidas({ medidas, ehMedico }: { medidas: MedidaFetal[]; ehMedico: boolean }) {
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
                        {m.percentis?.pfeG != null ? (
                          <span
                            className={cn(
                              'rounded-pill px-2 py-0.5 text-xs font-semibold',
                              m.percentis.pfeG < 10 || m.percentis.pfeG > 90
                                ? 'u-chip-warn'
                                : 'u-chip-success',
                            )}
                          >
                            P{m.percentis.pfeG}
                          </span>
                        ) : (
                          <span className="text-ink-mute">—</span>
                        )}
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
