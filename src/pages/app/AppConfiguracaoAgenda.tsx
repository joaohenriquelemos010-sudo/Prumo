import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarRange, Check, Clock, Info, Stethoscope } from 'lucide-react'
import { api } from '@/lib/api/client'
import { Button } from '@/components/Button'
import { Skeleton } from '@/components/Skeleton'
import { AlertaErro } from '@/components/AlertaErro'
import { GradeSemanal } from '@/features/agenda/GradeSemanal'
import { daDisponibilidade, faixasInvalidas, paraCorpoApi } from '@/features/agenda/semana'
import type { DisponibilidadeSemana, SemanaConfig } from '@/features/agenda/semana'
import { TiposAtendimento } from '@/features/agenda/TiposAtendimento'
import { useConfiguracao } from '@/lib/stores/configuracao'
import { cn } from '@/lib/cn'

type Aba = 'horarios' | 'tipos'

/**
 * Configuração da agenda — a semana inteira numa tela só.
 *
 * A configuração morava espalhada: os dias num passo do onboarding, o almoço num
 * campo global, os bloqueios numa lista de datas. Cada pedaço fazia sentido
 * sozinho e nenhum respondia a pergunta que a médica faz de verdade — *como é a
 * minha semana?*. Aqui ela é uma grade: sete colunas, uma pergunta por linha, e
 * o resultado inteiro visível sem rolar.
 *
 * Desktop primeiro, e sem culpa: esta tela se preenche uma vez, sentada, no
 * computador do consultório. A grade rola na horizontal em telas estreitas em vez
 * de se dobrar em sete acordeões — espremer sete dias num celular devolveria
 * exatamente o formulário sequencial que ela veio substituir.
 */
export default function AppConfiguracaoAgenda() {
  const navigate = useNavigate()
  const marcarConfigurada = useConfiguracao((s) => s.marcarConfigurada)
  const [aba, setAba] = useState<Aba>('horarios')
  const [semana, setSemana] = useState<SemanaConfig | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [sujo, setSujo] = useState(false)
  const [salvo, setSalvo] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    api
      .get<{ disponibilidade: DisponibilidadeSemana }>('/disponibilidade/me')
      .then((d) => setSemana(daDisponibilidade(d.disponibilidade)))
      .catch((e) => setErro(e instanceof Error ? e.message : 'Não consegui carregar sua agenda.'))
      .finally(() => setCarregando(false))
  }, [])

  const invalidas = useMemo(() => (semana ? faixasInvalidas(semana) : 0), [semana])

  function mudar(v: SemanaConfig) {
    setSemana(v)
    setSujo(true)
    setSalvo(false)
  }

  async function salvar(fechar: boolean) {
    if (!semana || invalidas > 0) return
    setSalvando(true)
    setErro(null)
    try {
      await api.put('/disponibilidade/me', {
        // Configurar a agenda e não publicá-la seria configurar para ninguém.
        // Quem quiser fechar depois tem o interruptor em Agenda → Configurar.
        ativo: true,
        ...paraCorpoApi(semana),
      })
      marcarConfigurada()
      setSujo(false)
      setSalvo(true)
      if (fechar) navigate('/app/agenda')
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui salvar agora.')
    } finally {
      setSalvando(false)
    }
  }

  function cancelar() {
    if (sujo && !window.confirm('Sair sem salvar? As mudanças desta tela serão perdidas.')) return
    navigate('/app/agenda')
  }

  return (
    <div className="flex flex-col gap-md">
      <header className="flex flex-wrap items-start justify-between gap-md">
        <div>
          <h1 className="text-3xl sm:text-4xl">Configuração da agenda</h1>
          <p className="mt-1 text-ink-soft">
            Defina os dias, turnos, intervalos, bloqueios e tipos de procedimento na sua agenda.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {salvo && !sujo && (
            <span
              className="inline-flex items-center gap-1 text-sm font-semibold text-success-ink"
              role="status"
            >
              <Check className="size-4" aria-hidden /> Salvo
            </span>
          )}
          <Button variant="ghost" onClick={cancelar}>
            Cancelar
          </Button>
          <Button
            variant="secondary"
            loading={salvando}
            disabled={invalidas > 0}
            onClick={() => void salvar(false)}
          >
            Salvar
          </Button>
          <Button loading={salvando} disabled={invalidas > 0} onClick={() => void salvar(true)}>
            Salvar e fechar
          </Button>
        </div>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-md">
        <div className="flex gap-1 rounded-pill bg-paper-2 p-1" role="tablist">
          <AbaBtn ativa={aba === 'horarios'} onClick={() => setAba('horarios')} icon={Clock}>
            Horários
          </AbaBtn>
          <AbaBtn ativa={aba === 'tipos'} onClick={() => setAba('tipos')} icon={Stethoscope}>
            Tipos de consulta
          </AbaBtn>
        </div>
        {aba === 'horarios' && (
          <Button
            variant="secondary"
            iconLeft={<CalendarRange className="size-4" aria-hidden />}
            onClick={() => setAba('tipos')}
          >
            Ir para tipos de procedimentos
          </Button>
        )}
      </div>

      {erro && <AlertaErro>{erro}</AlertaErro>}

      {aba === 'horarios' &&
        (carregando ? (
          <Skeleton className="h-96 w-full" />
        ) : semana ? (
          <>
            <GradeSemanal valor={semana} onChange={mudar} />

            {invalidas > 0 && (
              <AlertaErro>
                {invalidas === 1
                  ? 'Uma faixa termina antes de começar — confira o horário marcado em vermelho.'
                  : `${invalidas} faixas terminam antes de começar — confira os horários marcados em vermelho.`}
              </AlertaErro>
            )}

            <p className="flex items-start gap-2 rounded-2xl border border-line bg-paper-2 px-4 py-3 text-sm text-ink-soft">
              <Info className="mt-0.5 size-4 shrink-0 text-indigo" aria-hidden />
              <span>
                <strong className="font-semibold text-ink">Importante:</strong> os intervalos e
                bloqueios criam os vácuos no seu período de atendimento. As reposições abrem
                horários extras fora dele.
              </span>
            </p>
          </>
        ) : null)}

      {aba === 'tipos' && <TiposAtendimento />}
    </div>
  )
}

function AbaBtn({
  ativa,
  onClick,
  icon: Icon,
  children,
}: {
  ativa: boolean
  onClick: () => void
  icon: typeof Clock
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={ativa}
      onClick={onClick}
      className={cn(
        'inline-flex min-h-11 items-center gap-2 rounded-pill px-4 font-display text-sm font-semibold transition-colors',
        ativa
          ? 'text-white shadow-soft [background-image:var(--grad-brand)]'
          : 'text-ink-soft hover:text-indigo',
      )}
    >
      <Icon className="size-4 shrink-0" aria-hidden />
      {children}
    </button>
  )
}
