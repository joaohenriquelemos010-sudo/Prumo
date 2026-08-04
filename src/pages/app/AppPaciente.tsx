import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ClipboardCheck, KeyRound, Pencil, Play, UserRoundCheck } from 'lucide-react'
import { api } from '@/lib/api/client'
import { useMedicoContext } from '@/lib/stores/medico-context'
import { Button } from '@/components/Button'
import { Skeleton } from '@/components/Skeleton'
import { AlertaErro } from '@/components/AlertaErro'
import { AbasPaciente } from '@/features/pacientes/AbasPaciente'
import type { Aba } from '@/features/pacientes/AbasPaciente'
import { VincularConta } from '@/features/pacientes/VincularConta'
import type { Paciente } from '@/features/pacientes/tipos'
import { PainelClinico } from '@/features/painel/PainelClinico'
import { idadeGestacional } from '@/features/clinico/schedule'

/*
 * As abas são as páginas que já existem, renderizadas com `embutido`.
 *
 * Escrever telas novas para o mesmo conteúdo criaria duas versões do prontuário
 * para manter em dia — e a que o médico não estivesse olhando seria a que ficaria
 * para trás. O hub muda a **navegação**, não o conteúdo: é exatamente por isso
 * que ele cabe num arquivo.
 */
const AppProntuario = lazy(() => import('@/pages/app/AppProntuario'))
const AppConsultas = lazy(() => import('@/pages/app/AppConsultas'))
const AppExames = lazy(() => import('@/pages/app/AppExames'))
const AppBebe = lazy(() => import('@/pages/app/AppBebe'))
const AppVacinas = lazy(() => import('@/pages/app/AppVacinas'))
const AppCaderninho = lazy(() => import('@/pages/app/AppCaderninho'))

const ABAS: (Aba & { render: () => JSX.Element })[] = [
  { id: 'resumo', rotulo: 'Resumo', render: () => <PainelClinico /> },
  { id: 'prontuario', rotulo: 'Prontuário', render: () => <AppProntuario embutido /> },
  { id: 'consultas', rotulo: 'Consultas', render: () => <AppConsultas embutido /> },
  { id: 'exames', rotulo: 'Exames', render: () => <AppExames embutido /> },
  { id: 'bebe', rotulo: 'Bebê', render: () => <AppBebe embutido /> },
  { id: 'vacinas', rotulo: 'Vacinas', render: () => <AppVacinas embutido /> },
  { id: 'duvidas', rotulo: 'Dúvidas', render: () => <AppCaderninho embutido /> },
]

function descrever(p: Paciente): string {
  if (p.momento === 'gestante' && p.dpp) {
    const ig = idadeGestacional(new Date(p.dpp))
    return `${ig.semanas} semanas e ${ig.dias} dias de gestação`
  }
  if (p.dataNascimento) {
    const n = new Date(p.dataNascimento)
    const hoje = new Date()
    const meses = Math.max(
      0,
      (hoje.getFullYear() - n.getFullYear()) * 12 + (hoje.getMonth() - n.getMonth()),
    )
    return `bebê com ${meses} ${meses === 1 ? 'mês' : 'meses'}`
  }
  return p.momento === 'planejando' ? 'planejando engravidar' : 'jornada aberta'
}

/**
 * O hub da paciente — uma tela por pessoa, no lugar de sete no menu.
 *
 * Antes, prontuário, consultas, exames, bebê, vacinas e dúvidas eram destinos
 * globais que agiam sobre uma "paciente ativa" invisível guardada em memória. O
 * médico trocava de aba sem saber de quem era o que estava vendo, e o menu
 * mostrava sete portas para a mesma sala.
 *
 * Aqui a paciente está na URL. É ela que decide o contexto, e é por isso que
 * recarregar a página, abrir em outra aba ou mandar o link para um colega
 * continua funcionando — coisas que um estado em memória nunca deu.
 */
export default function AppPaciente() {
  const { jornadaId = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const setPacienteAtivo = useMedicoContext((s) => s.setPaciente)

  const [paciente, setPaciente] = useState<Paciente | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [iniciando, setIniciando] = useState(false)

  const aba = params.get('aba') ?? 'resumo'
  const atual = ABAS.find((a) => a.id === aba) ?? ABAS[0]

  const carregar = useCallback(async () => {
    try {
      const d = await api.get<{ paciente: Paciente }>(`/pacientes/${jornadaId}`)
      setPaciente(d.paciente)
      /*
       * As páginas embutidas leem a paciente do store, não da URL. Espelhar aqui
       * é o que faz o hub funcionar sem reescrever seis telas — e o store passa a
       * ser consequência da URL, nunca a fonte.
       */
      setPacienteAtivo(d.paciente.id, d.paciente.nome)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível abrir essa paciente.')
    } finally {
      setCarregando(false)
    }
  }, [jornadaId, setPacienteAtivo])

  useEffect(() => {
    void carregar()
  }, [carregar])

  async function iniciarAtendimento() {
    setErro(null)
    setIniciando(true)
    try {
      // Sem agendamento: a paciente chegou e vai ser atendida. O servidor abre o
      // agendamento correspondente para que agenda e financeiro não fiquem cegos.
      const d = await api.post<{ consulta: { id: string } }>('/atendimento/iniciar', {
        jornadaId,
      })
      navigate(`/app/atendimento/${d.consulta.id}`)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui abrir o atendimento.')
      setIniciando(false)
    }
  }

  if (carregando) {
    return (
      <div className="flex flex-col gap-lg">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!paciente) {
    return (
      <div className="flex flex-col gap-md">
        <AlertaErro>{erro ?? 'Não encontramos essa paciente.'}</AlertaErro>
        <Link to="/app/pacientes" className="u-link">
          Voltar para Meus pacientes
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-lg">
      <header className="flex flex-col gap-3">
        <Link
          to="/app/pacientes"
          className="inline-flex w-fit items-center gap-1 text-sm text-ink-soft hover:text-indigo"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Meus pacientes
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-md">
          <div>
            <h1 className="text-3xl sm:text-4xl">{paciente.nome}</h1>
            <p className="mt-1 text-ink-soft">
              {descrever(paciente)}
              {paciente.titular.telefone ? ` · ${paciente.titular.telefone}` : ''}
            </p>
            {/*
              O estado da conta fica no cabeçalho, e não escondido numa aba: é a
              diferença entre "ela vê o que eu escrevo" e "isto ainda é só meu".
            */}
            <p className="mt-1 inline-flex items-center gap-1.5 text-sm">
              {paciente.temConta ? (
                <>
                  <UserRoundCheck className="size-4 text-success-ink" aria-hidden />
                  <span className="text-ink-soft">Conta vinculada — ela acompanha pelo app.</span>
                </>
              ) : (
                <>
                  <KeyRound className="size-4 text-warn-ink" aria-hidden />
                  <span className="text-ink-soft">Sem conta ainda — só você vê este registro.</span>
                </>
              )}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link to={`/app/pacientes/${paciente.id}/editar`}>
              <Button variant="secondary" iconLeft={<Pencil className="size-4" aria-hidden />}>
                Editar cadastro
              </Button>
            </Link>
            <Button
              onClick={() => void iniciarAtendimento()}
              disabled={iniciando}
              iconLeft={<Play className="size-4" aria-hidden />}
            >
              {iniciando ? 'Abrindo…' : 'Iniciar atendimento'}
            </Button>
          </div>
        </div>
      </header>

      {erro && <AlertaErro>{erro}</AlertaErro>}

      {/*
        A ficha veio da paciente e ninguém conferiu. Fica no topo do hub, e não
        escondido numa aba: enquanto isso não for revisado, o CPF que está ali é
        o que ela digitou no celular — declarado, não verificado.
      */}
      {paciente.preCadastro?.recebidoEm && !paciente.preCadastro?.revisadoEm && (
        <section className="flex flex-wrap items-center gap-3 rounded-2xl border border-[color-mix(in_oklch,var(--color-warn)_35%,transparent)] bg-[color-mix(in_oklch,var(--color-warn)_8%,transparent)] p-md">
          <ClipboardCheck className="size-5 shrink-0 text-warn-ink" aria-hidden />
          <p className="min-w-0 flex-1 text-sm text-ink-soft">
            <strong className="font-semibold text-ink">Ficha preenchida pela paciente</strong> em{' '}
            {new Date(paciente.preCadastro.recebidoEm).toLocaleDateString('pt-BR')}. Confira os
            dados antes de usá-los para convênio ou documento.
          </p>
          <Link to={`/app/pacientes/${paciente.id}/editar`}>
            <Button size="sm" variant="secondary">
              Conferir cadastro
            </Button>
          </Link>
        </section>
      )}

      {/*
        Cadastro pela metade não trava nada, mas custa na hora de faturar e de
        mandar lembrete. O aviso aparece só quando falta bastante — abaixo disso
        seria cobrança por um campo opcional.
      */}
      {paciente.completude < 60 && (
        <p className="flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-paper-2 px-4 py-3 text-sm text-ink-soft">
          <span className="min-w-0 flex-1">
            O cadastro desta paciente está {paciente.completude}% completo. Endereço, convênio e
            contato são o que faltam para emitir guia e mandar lembrete.
          </span>
          <Link
            to={`/app/pacientes/${paciente.id}/editar`}
            className="font-semibold text-indigo hover:underline"
          >
            Completar agora
          </Link>
        </p>
      )}

      {!paciente.temConta && <VincularConta paciente={paciente} onMudou={setPaciente} />}

      <AbasPaciente
        abas={ABAS}
        ativa={atual.id}
        onTrocar={(id) => setParams({ aba: id }, { replace: true })}
      />

      <Suspense fallback={<Skeleton className="h-64 w-full" />}>{atual.render()}</Suspense>
    </div>
  )
}
