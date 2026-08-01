import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, CalendarDays, Check, Clock, Stethoscope } from 'lucide-react'
import { api } from '@/lib/api/client'
import { Button } from '@/components/Button'
import { Skeleton } from '@/components/Skeleton'
import { AlertaErro } from '@/components/AlertaErro'
import { SemanaInterativa } from '@/features/agenda/SemanaInterativa'
import type { RegraDia } from '@/features/agenda/SemanaInterativa'
import { TiposAtendimento } from '@/features/agenda/TiposAtendimento'
import { useAuth } from '@/lib/stores/auth'
import { useConfiguracao } from '@/lib/stores/configuracao'
import { cn } from '@/lib/cn'

interface Disponibilidade {
  ativo: boolean
  almoco: { inicio: string; fim: string }
  duracaoPadraoMin: number
  antecedenciaMinHoras: number
  janelaMaxDias: number
  regras: RegraDia[]
  bloqueios: { de: string; ate: string; motivo: string }[]
  conveniosAtendidos: string[]
  atendeParticular: boolean
  atendeSus: boolean
}

type Passo = 'semana' | 'tipos' | 'pronto'

const PASSOS: { id: Passo; rotulo: string; icone: typeof CalendarDays }[] = [
  { id: 'semana', rotulo: 'Quando você atende', icone: CalendarDays },
  { id: 'tipos', rotulo: 'Tipos de consulta', icone: Stethoscope },
  { id: 'pronto', rotulo: 'Pronto', icone: Check },
]

/**
 * Configure sua agenda — o passo entre criar a conta e usar o produto.
 *
 * É literalmente o que o fluxo do consultório pede: **cria conta → configura a
 * agenda → vai para as funcionalidades**. Sem esse passo, o médico entrava num
 * app que parecia quebrado: calendário vazio, nenhum horário disponível, nenhum
 * tipo de consulta, e nenhuma pista de que faltava configurar alguma coisa. O
 * produto funcionava; ele é que não tinha como saber por onde começar.
 *
 * Dois passos, e só dois, porque são os dois de que tudo o mais depende: **os
 * dias e horários** geram os horários que a paciente enxerga, e os **tipos de
 * consulta** decidem a duração de cada horário e qual formulário de prontuário
 * abre no atendimento. O resto (almoço, antecedência, convênios) tem valor
 * padrão razoável e mora em *Configurar*, para quem quiser mexer.
 */
export default function AppConfigurarAgenda() {
  const navigate = useNavigate()
  const nome = useAuth((s) => s.user?.nome ?? '')
  const marcarConfigurada = useConfiguracao((s) => s.marcarConfigurada)
  const [passo, setPasso] = useState<Passo>('semana')
  const [disp, setDisp] = useState<Disponibilidade | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    api
      .get<{ disponibilidade: Disponibilidade }>('/disponibilidade/me')
      .then((d) => setDisp(d.disponibilidade))
      .catch((e) => setErro(e instanceof Error ? e.message : 'Não consegui carregar.'))
      .finally(() => setCarregando(false))
  }, [])

  const valido = useMemo(() => (disp?.regras ?? []).length > 0, [disp])

  async function salvarSemana() {
    if (!disp) return
    setSalvando(true)
    setErro(null)
    try {
      await api.put('/disponibilidade/me', {
        // Publicar junto: configurar a agenda e não ligá-la seria configurar
        // para ninguém. Quem quiser fechar depois tem o interruptor em Configurar.
        ativo: true,
        duracaoPadraoMin: disp.duracaoPadraoMin,
        almoco: disp.almoco,
        antecedenciaMinHoras: disp.antecedenciaMinHoras,
        janelaMaxDias: disp.janelaMaxDias,
        regras: disp.regras.map((r) => ({
          diaSemana: r.diaSemana,
          inicio: r.inicio,
          fim: r.fim,
          modalidades: ['presencial'],
          local: '',
        })),
        bloqueios: disp.bloqueios,
        conveniosAtendidos: disp.conveniosAtendidos,
        atendeParticular: disp.atendeParticular,
        atendeSus: disp.atendeSus,
      })
      /*
       * O portão de rota lê este store. Sem marcar aqui, o próximo clique em
       * qualquer link do menu jogaria o médico de volta para esta mesma tela —
       * ele acabou de configurar, e o cliente ainda acharia que não.
       */
      marcarConfigurada()
      setPasso('tipos')
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui salvar.')
    } finally {
      setSalvando(false)
    }
  }

  if (carregando) {
    return (
      <div className="flex flex-col gap-md">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-lg">
      <header className="flex flex-col gap-1">
        <p className="u-eyebrow">Configure sua agenda</p>
        <h1 className="text-3xl sm:text-4xl">
          {passo === 'pronto' ? 'Tudo pronto' : `Vamos começar, Dr(a). ${nome.split(' ')[0]}`}
        </h1>
        <p className="text-ink-soft">
          {passo === 'pronto'
            ? 'Sua agenda está no ar. A partir daqui é só atender.'
            : 'Duas coisas e você já pode marcar a primeira consulta.'}
        </p>
      </header>

      {/* Onde estou, quanto falta. */}
      <ol className="flex flex-wrap items-center gap-2">
        {PASSOS.map((p, i) => {
          const indice = PASSOS.findIndex((x) => x.id === passo)
          const feito = i < indice
          const atual = p.id === passo
          return (
            <li key={p.id} className="inline-flex items-center gap-2">
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-pill px-3 py-1.5 text-sm font-semibold',
                  atual && 'bg-indigo text-white',
                  feito && 'bg-[color-mix(in_oklab,var(--color-success)_28%,var(--color-paper))] text-success-ink',
                  !atual && !feito && 'text-ink-mute',
                )}
              >
                {feito ? <Check className="size-4" aria-hidden /> : <p.icone className="size-4" aria-hidden />}
                {p.rotulo}
              </span>
              {i < PASSOS.length - 1 && <span className="text-ink-mute">·</span>}
            </li>
          )
        })}
      </ol>

      {erro && <AlertaErro>{erro}</AlertaErro>}

      {passo === 'semana' && disp && (
        <section className="rounded-2xl border border-line bg-paper p-lg shadow-soft">
          <h2 className="text-lg">Em que dias você atende?</h2>
          <p className="mt-1 text-sm text-ink-soft">
            É o que gera os horários que suas pacientes veem para marcar.
          </p>

          <div className="mt-md">
            <SemanaInterativa
              regras={disp.regras}
              onChange={(regras) => setDisp({ ...disp, regras })}
            />
          </div>

          <div className="mt-lg flex flex-wrap items-end gap-3 border-t border-line pt-md">
            <label className="text-sm">
              <span className="inline-flex items-center gap-1.5 text-ink">
                <Clock className="size-4 text-indigo" aria-hidden />
                Almoço — de
              </span>
              <input
                type="time"
                value={disp.almoco?.inicio ?? ''}
                onChange={(e) =>
                  setDisp({ ...disp, almoco: { ...disp.almoco, inicio: e.target.value } })
                }
                className="input mt-1"
              />
            </label>
            <label className="text-sm">
              até
              <input
                type="time"
                value={disp.almoco?.fim ?? ''}
                onChange={(e) => setDisp({ ...disp, almoco: { ...disp.almoco, fim: e.target.value } })}
                className="input mt-1"
              />
            </label>
            <p className="w-full text-xs text-ink-mute">
              Vale para todos os dias. Em branco significa que você atende direto.
            </p>
          </div>

          <Button
            className="mt-lg"
            disabled={!valido || salvando}
            iconRight={<ArrowRight className="size-4" aria-hidden />}
            onClick={() => void salvarSemana()}
          >
            {salvando ? 'Salvando…' : 'Continuar'}
          </Button>
          {!valido && (
            <p className="mt-2 text-xs text-ink-mute">Escolha pelo menos um dia para continuar.</p>
          )}
        </section>
      )}

      {passo === 'tipos' && (
        <>
          <div className="rounded-2xl border border-line bg-paper-2 p-md">
            <p className="text-sm text-ink-soft">
              Já deixamos os tipos mais comuns da sua especialidade prontos. Cada um tem a própria
              duração — é ela que define o tamanho do horário na agenda — e o próprio formulário de
              prontuário, que é o que faz a primeira consulta abrir a anamnese completa e o retorno
              abrir só o acompanhamento.
            </p>
          </div>

          <TiposAtendimento />

          <div className="flex flex-wrap gap-2">
            <Button
              iconRight={<ArrowRight className="size-4" aria-hidden />}
              onClick={() => setPasso('pronto')}
            >
              Está bom assim
            </Button>
            <Button variant="ghost" onClick={() => setPasso('semana')}>
              Voltar
            </Button>
          </div>
        </>
      )}

      {passo === 'pronto' && (
        <section className="rounded-2xl border border-line bg-paper p-lg text-center shadow-soft">
          <span className="mx-auto grid size-14 place-items-center rounded-xl [background-image:var(--grad-brand-soft)] text-indigo">
            <Check className="size-7" aria-hidden />
          </span>
          <h2 className="mt-3 font-display text-xl font-semibold text-ink">Sua agenda está no ar</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-ink-soft">
            Agora você pode marcar horários, cadastrar pacientes — inclusive quem ainda não tem
            conta — e atender com o prontuário do lado.
          </p>
          <div className="mt-md flex flex-wrap justify-center gap-2">
            <Button onClick={() => navigate('/app/agenda')}>Ver minha agenda</Button>
            <Button variant="secondary" onClick={() => navigate('/app/pacientes')}>
              Cadastrar uma paciente
            </Button>
          </div>
        </section>
      )}
    </div>
  )
}
