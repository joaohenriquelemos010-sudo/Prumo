import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarDays, Syringe, TestTube2, ArrowRight, Stethoscope } from 'lucide-react'
import { api } from '@/lib/api/client'
import { usePerfil } from '@/lib/stores/perfil'
import { DadosCrianca } from '@/features/clinico/DadosCrianca'
import { calcularDosesVacinas, formatarData, semanasGestacionais, trimestreAtual } from '@/features/clinico/schedule'
import { EXAMES_PRENATAL, REFERENCIA_PRENATAL } from '@/features/clinico/sus-exames'
import { Skeleton } from '@/components/Skeleton'
import { EmptyState } from '@/components/EmptyState'
import { cn } from '@/lib/cn'

export default function AppAgenda() {
  const perfil = usePerfil((s) => s.perfil)
  const [aplicadas, setAplicadas] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    api
      .get<{ vacinasAplicadas: string[] }>('/vacinas')
      .then((d) => active && setAplicadas(d.vacinasAplicadas))
      .catch(() => {})
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [])

  const dataNascimentoIso = perfil?.dataNascimento ?? null
  const dob = dataNascimentoIso ? new Date(dataNascimentoIso) : null
  const dpp = perfil?.dpp ? new Date(perfil.dpp) : null

  const proximasDoses = useMemo(() => {
    if (!dataNascimentoIso) return []
    return calcularDosesVacinas(new Date(dataNascimentoIso), aplicadas)
      .filter((d) => d.status !== 'aplicada')
      .slice(0, 6)
  }, [dataNascimentoIso, aplicadas])

  const temDados = Boolean(dob || dpp)

  return (
    <div className="flex flex-col gap-lg">
      <header className="flex flex-col gap-1">
        <p className="u-eyebrow">Agenda</p>
        <h1 className="text-3xl sm:text-4xl">O que vem a seguir</h1>
        <p className="text-ink-soft">Consultas, exames e vacinas, organizados por data — sem você precisar lembrar de tudo.</p>
      </header>

      <DadosCrianca />

      {loading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
      ) : !temDados ? (
        <EmptyState
          titulo="Sua agenda começa com uma data"
          descricao="Informe acima em que ponto você está. A partir daí, a gente monta seu caminho com as datas certas."
          icon={<CalendarDays className="size-7" aria-hidden />}
        />
      ) : dpp ? (
        <AgendaGestante dpp={dpp} />
      ) : (
        <AgendaBebe doses={proximasDoses} />
      )}
    </div>
  )
}

function AgendaBebe({ doses }: { doses: ReturnType<typeof calcularDosesVacinas> }) {
  if (doses.length === 0) {
    return (
      <div className="rounded-2xl bg-paper-2 p-lg text-center">
        <p className="font-display text-lg font-semibold text-indigo">Tudo em dia por aqui! 🎉</p>
        <p className="mt-1 text-ink-soft">Nenhuma vacina pendente no momento. Que trilha bem cuidada.</p>
      </div>
    )
  }
  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-display text-sm font-semibold text-indigo">Próximas vacinas</h2>
      <ol className="flex flex-col gap-2">
        {doses.map((d) => (
          <li
            key={d.vacina.id}
            className={cn(
              'flex items-center gap-3 rounded-xl border bg-paper p-3 shadow-soft',
              d.status === 'atrasada' ? 'border-[var(--color-warn)]' : 'border-line',
            )}
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-xl [background-image:var(--grad-brand-soft)] text-indigo">
              <Syringe className="size-5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-display font-semibold text-ink">
                {d.vacina.nome} <span className="text-ink-mute">· {d.vacina.dose}</span>
              </p>
              <p className="text-xs text-ink-mute">
                {d.vacina.idadeLabel} · {formatarData(d.data)}
                {d.status === 'atrasada' && <span className="font-semibold text-warn"> · em atraso</span>}
              </p>
            </div>
          </li>
        ))}
      </ol>
      <Link to="/app/vacinas" className="mt-1 inline-flex items-center gap-1 font-display text-sm font-semibold text-indigo hover:text-azul">
        Ver a carteira completa <ArrowRight className="size-4" aria-hidden />
      </Link>

      <Link
        to="/app/profissionais?objetivo=consulta-crianca"
        className="mt-2 inline-flex h-11 items-center gap-2 self-start rounded-pill px-5 font-display text-sm font-semibold text-white shadow-soft [background-image:var(--grad-brand)]"
      >
        <Stethoscope className="size-4" aria-hidden />
        Contate um pediatra cadastrado
      </Link>
    </section>
  )
}

function AgendaGestante({ dpp }: { dpp: Date }) {
  const semanas = semanasGestacionais(dpp)
  const triAtual = trimestreAtual(semanas)

  return (
    <div className="flex flex-col gap-lg">
      <div className="rounded-2xl border border-line bg-paper p-lg shadow-soft">
        <p className="font-display text-sm font-semibold text-indigo">Sua gestação</p>
        <p className="font-display text-2xl font-bold text-ink">
          Aproximadamente {semanas} semanas
        </p>
        <p className="text-sm text-ink-soft">
          Você está no <strong>{triAtual}º trimestre</strong>. Parto previsto para {dpp.toLocaleDateString('pt-BR')}.
        </p>
      </div>

      {EXAMES_PRENATAL.map((tri) => (
        <section
          key={tri.trimestre}
          className={cn(
            'rounded-2xl border p-lg shadow-soft',
            tri.trimestre === triAtual ? 'border-[var(--color-lilas)] bg-paper' : 'border-line bg-paper',
          )}
        >
          <div className="flex items-center justify-between gap-2">
            <h2 className="inline-flex items-center gap-2 text-lg">
              <TestTube2 className="size-5 text-indigo" aria-hidden />
              {tri.titulo}
            </h2>
            {tri.trimestre === triAtual && (
              <span className="rounded-pill [background-image:var(--grad-brand-soft)] px-3 py-1 text-xs font-semibold text-indigo">
                Agora
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-ink-mute">{tri.janela}</p>
          <ul className="mt-md flex flex-col gap-2">
            {tri.exames.map((ex) => (
              <li key={ex.nome} className="flex items-start gap-2 text-sm">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full [background-image:var(--grad-brand)]" aria-hidden />
                <span>
                  <span className="font-semibold text-ink">{ex.nome}</span>
                  <span className="block text-ink-mute">{ex.motivo}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <Link
        to="/app/profissionais?objetivo=consulta-gestante"
        className="inline-flex h-11 items-center gap-2 self-start rounded-pill px-5 font-display text-sm font-semibold text-white shadow-soft [background-image:var(--grad-brand)]"
      >
        <Stethoscope className="size-4" aria-hidden />
        Contate um obstetra ou enfermeira
      </Link>

      <p className="rounded-xl bg-paper-2 p-md text-xs text-ink-mute">
        Fonte: {REFERENCIA_PRENATAL} Conteúdo informativo — a solicitação e a leitura dos exames são sempre da sua equipe.
      </p>
    </div>
  )
}
