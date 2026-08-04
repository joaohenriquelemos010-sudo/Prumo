import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, Check, Info, UserRoundSearch } from 'lucide-react'
import { api } from '@/lib/api/client'
import { Button } from '@/components/Button'
import { Skeleton } from '@/components/Skeleton'
import { AlertaErro } from '@/components/AlertaErro'
import { useMedicoContext } from '@/lib/stores/medico-context'
import { FormularioPaciente } from '@/features/pacientes/FormularioPaciente'
import { LinkPreCadastro } from '@/features/pacientes/LinkPreCadastro'
import {
  PACIENTE_VAZIA,
  SECOES,
  daApi,
  paraApi,
  secaoDoErro,
  secoesPreenchidas,
  temErro,
  validarPaciente,
} from '@/features/cadastro/paciente'
import type { DadosPaciente, ErrosPaciente, IdSecao } from '@/features/cadastro/paciente'
import { somenteDigitos } from '@/lib/br-docs'
import { cn } from '@/lib/cn'
import type { Paciente } from '@/features/pacientes/tipos'

interface Duplicata {
  id: string
  nome: string
  dataNascimento: string | null
  por: 'cpf' | 'nome'
}

/**
 * A ficha completa da paciente — cadastrar e corrigir na mesma tela.
 *
 * Uma tela e não duas porque cadastrar e editar são a **mesma** tarefa vista em
 * dois momentos, e telas separadas divergem: o campo novo entra na de cadastro,
 * a de edição fica sem ele, e a correção passa a apagar dado. Aqui a diferença
 * cabe em `jornadaId` existir ou não.
 *
 * Página inteira, e não uma folha por cima da lista: são trinta campos, e uma
 * folha do tamanho da tela é uma página com menos espaço e mais moldura. A folha
 * continua existindo para o cadastro de balcão (`NovoPaciente`), que é outro
 * caso de uso — atender agora, completar depois.
 *
 * ## Como a pressa foi resolvida
 *
 * - **Nada trava por causa do opcional.** Só nome, CPF, nascimento, sexo e
 *   celular seguram o botão. O resto pode ficar para a próxima consulta.
 * - **Erro leva ao campo.** Ao tentar salvar com pendência, a tela rola até a
 *   primeira seção com problema em vez de mostrar uma lista no topo.
 * - **Duplicata aparece antes de salvar.** CPF repetido oferece abrir a ficha que
 *   já existe — o segundo prontuário da mesma pessoa é irreversível na prática.
 * - **`Ctrl+Enter` salva.** Quem preenche isso trinta vezes por dia não deve
 *   caçar o botão com o mouse.
 * - **Sair com alterações pendentes pergunta.**
 */
export default function AppCadastroPaciente() {
  const { jornadaId } = useParams()
  const editando = Boolean(jornadaId)
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const setPacienteAtivo = useMedicoContext((s) => s.setPaciente)

  /*
   * `?nome=` vem do cadastro rápido: quem começou a digitar na folha e decidiu
   * abrir a ficha completa não deve digitar o nome de novo. É o único campo que
   * viaja pela URL — os outros são documento, e documento não vai em endereço
   * que o navegador guarda no histórico.
   */
  const [dados, setDados] = useState<DadosPaciente>(() => ({
    ...PACIENTE_VAZIA,
    nome: params.get('nome') ?? '',
  }))
  const [erros, setErros] = useState<ErrosPaciente>({})
  const [carregando, setCarregando] = useState(editando)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [sujo, setSujo] = useState(false)
  const [duplicatas, setDuplicatas] = useState<Duplicata[]>([])
  const [preCadastroPendente, setPreCadastroPendente] = useState<string | null>(null)

  const secoesRef = useRef(new Map<IdSecao, HTMLElement>())

  useEffect(() => {
    if (!jornadaId) return
    api
      .get<{ paciente: Paciente }>(`/pacientes/${jornadaId}`)
      .then((d) => {
        setDados(daApi(d.paciente))
        if (d.paciente.preCadastro?.recebidoEm && !d.paciente.preCadastro?.revisadoEm) {
          setPreCadastroPendente(d.paciente.preCadastro.recebidoEm)
        }
      })
      .catch((e) => setErro(e instanceof Error ? e.message : 'Não consegui abrir essa ficha.'))
      .finally(() => setCarregando(false))
  }, [jornadaId])

  const preenchidas = useMemo(() => secoesPreenchidas(dados), [dados])

  function alterar(valor: DadosPaciente) {
    setDados(valor)
    setSujo(true)
    // Erro some assim que a pessoa mexe: manter o vermelho enquanto ela corrige
    // é discutir com quem já concordou.
    if (temErro(erros)) setErros(validarPaciente(valor))
  }

  /**
   * A busca por duplicata dispara quando o CPF fica completo, e só então.
   *
   * Consultar a cada tecla gastaria uma varredura por dígito para responder
   * sobre um CPF que ainda não existe. Onze dígitos é o primeiro instante em que
   * a pergunta tem sentido.
   */
  const procurar = useCallback(
    async (cpf: string) => {
      if (somenteDigitos(cpf).length !== 11) {
        setDuplicatas([])
        return
      }
      try {
        const d = await api.get<{ encontradas: Duplicata[] }>(
          `/pacientes/procurar?cpf=${somenteDigitos(cpf)}`,
        )
        // Editar a própria ficha não é encontrar uma duplicata dela.
        setDuplicatas(d.encontradas.filter((e) => e.id !== jornadaId))
      } catch {
        /* a checagem é conveniência: falhar aqui não pode atrapalhar o cadastro */
      }
    },
    [jornadaId],
  )

  useEffect(() => {
    const timer = setTimeout(() => void procurar(dados.cpf), 400)
    return () => clearTimeout(timer)
  }, [dados.cpf, procurar])

  const salvar = useCallback(
    async (abrirDepois: boolean) => {
      const encontrados = validarPaciente(dados)
      setErros(encontrados)
      if (temErro(encontrados)) {
        const primeiro = Object.keys(encontrados)[0]
        secoesRef.current.get(secaoDoErro(primeiro))?.scrollIntoView({ block: 'start' })
        setErro('Faltou conferir alguns campos. Marquei em vermelho o que precisa de atenção.')
        return
      }

      setErro(null)
      setSalvando(true)
      try {
        const corpo = paraApi(dados)
        const d = jornadaId
          ? await api.patch<{ paciente: Paciente }>(`/pacientes/${jornadaId}`, corpo)
          : await api.post<{ paciente: Paciente }>('/pacientes', corpo)

        setSujo(false)
        setPacienteAtivo(d.paciente.id, d.paciente.nome)
        navigate(abrirDepois ? `/app/pacientes/${d.paciente.id}` : '/app/pacientes')
      } catch (e) {
        setErro(e instanceof Error ? e.message : 'Não consegui salvar agora.')
      } finally {
        setSalvando(false)
      }
    },
    [dados, jornadaId, navigate, setPacienteAtivo],
  )

  /** `Ctrl/⌘ + Enter` salva de qualquer campo. */
  useEffect(() => {
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        void salvar(true)
      }
    }
    window.addEventListener('keydown', aoTeclar)
    return () => window.removeEventListener('keydown', aoTeclar)
  }, [salvar])

  /** Recarregar ou fechar a aba no meio da ficha pede confirmação do navegador. */
  useEffect(() => {
    if (!sujo) return
    function aoSair(e: BeforeUnloadEvent) {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', aoSair)
    return () => window.removeEventListener('beforeunload', aoSair)
  }, [sujo])

  function cancelar() {
    if (sujo && !window.confirm('Sair sem salvar? O que você preencheu será perdido.')) return
    navigate(editando && jornadaId ? `/app/pacientes/${jornadaId}` : '/app/pacientes')
  }

  function irPara(id: IdSecao) {
    secoesRef.current.get(id)?.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }

  if (carregando) {
    return (
      <div className="flex flex-col gap-md">
        <Skeleton className="h-16 w-2/3" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-md pb-32">
      <header className="flex flex-col gap-2">
        <Link
          to={editando && jornadaId ? `/app/pacientes/${jornadaId}` : '/app/pacientes'}
          className="inline-flex w-fit items-center gap-1 text-sm text-ink-soft hover:text-indigo"
        >
          <ArrowLeft className="size-4" aria-hidden />
          {editando ? 'Voltar para a paciente' : 'Meus pacientes'}
        </Link>
        <h1 className="text-3xl sm:text-4xl">
          {editando ? 'Editar cadastro' : 'Cadastro de paciente'}
        </h1>
        <p className="text-ink-soft">
          {editando
            ? 'Corrija o que foi digitado às pressas. O histórico clínico não muda aqui.'
            : 'Cadastre as informações pessoais, de contato e administrativas da paciente.'}
        </p>
      </header>

      {preCadastroPendente && (
        <p className="flex items-start gap-2 rounded-2xl border border-[color-mix(in_oklch,var(--color-warn)_35%,transparent)] bg-[color-mix(in_oklch,var(--color-warn)_8%,transparent)] px-4 py-3 text-sm text-ink-soft">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warn-ink" aria-hidden />
          <span>
            <strong className="font-semibold text-ink">Ficha preenchida pela paciente</strong> em{' '}
            {new Date(preCadastroPendente).toLocaleDateString('pt-BR')}. Os dados são declarados e
            ainda não foram conferidos — salvar esta tela marca a conferência.
          </span>
        </p>
      )}

      {erro && <AlertaErro>{erro}</AlertaErro>}

      {duplicatas.length > 0 && (
        <section className="rounded-2xl border border-[color-mix(in_oklch,var(--color-warn)_35%,transparent)] bg-[color-mix(in_oklch,var(--color-warn)_8%,transparent)] p-md">
          <h2 className="inline-flex items-center gap-2 font-display text-sm font-semibold text-warn-ink">
            <UserRoundSearch className="size-4" aria-hidden />
            {duplicatas.length === 1
              ? 'Já existe uma paciente com esse CPF'
              : 'Já existem pacientes com esse CPF'}
          </h2>
          <p className="mt-1 text-sm text-ink-soft">
            Cadastrar de novo cria um segundo prontuário para a mesma pessoa, com metade da história
            em cada um.
          </p>
          <ul className="mt-2 flex flex-col gap-1.5">
            {duplicatas.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center gap-2">
                <span className="font-display text-sm font-semibold text-ink">{d.nome}</span>
                {d.dataNascimento && (
                  <span className="text-xs text-ink-mute">
                    nasc. {new Date(d.dataNascimento).toLocaleDateString('pt-BR')}
                  </span>
                )}
                <Link to={`/app/pacientes/${d.id}`} className="text-sm font-semibold text-indigo hover:underline">
                  Abrir a ficha que já existe
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid gap-md lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex min-w-0 flex-col gap-md">
          <FormularioPaciente
            valor={dados}
            onChange={alterar}
            erros={erros}
            registrarSecao={(id, el) => {
              if (el) secoesRef.current.set(id, el)
              else secoesRef.current.delete(id)
            }}
          />
        </div>

        {/*
          A coluna da direita é contexto, não formulário: índice, o que falta e o
          link de pré-cadastro. Ela desce para baixo do formulário no celular —
          nunca some, porque é onde mora o atalho que evita digitar tudo isto.
        */}
        <aside className="flex flex-col gap-md">
          {/*
            O link de pré-cadastro vem **antes** do índice: ele é o atalho que
            evita digitar esta ficha inteira, e um atalho que aparece depois do
            trabalho não é atalho. Na edição ele some — a ficha desta paciente já
            existe.
          */}
          {!editando && <LinkPreCadastro />}

          <nav
            aria-label="Seções do cadastro"
            className="rounded-2xl border border-line bg-paper p-md shadow-soft lg:sticky lg:top-24"
          >
            <p className="font-display text-sm font-semibold text-ink">Seções</p>
            <ul className="mt-2 flex flex-col gap-0.5">
              {SECOES.map((s, i) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => irPara(s.id)}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-ink-soft hover:bg-paper-2 hover:text-indigo"
                  >
                    <span
                      aria-hidden
                      className={cn(
                        'grid size-5 shrink-0 place-items-center rounded-full text-[0.7rem] font-bold',
                        preenchidas[s.id]
                          ? 'bg-success text-white'
                          : 'border border-line bg-paper-2 text-ink-mute',
                      )}
                    >
                      {preenchidas[s.id] ? <Check className="size-3" aria-hidden /> : i + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{s.rotulo}</span>
                    {!s.obrigatoria && !preenchidas[s.id] && (
                      <span className="shrink-0 text-xs text-ink-mute">opcional</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
            <p className="mt-2 flex items-start gap-2 border-t border-line pt-2 text-xs text-ink-mute">
              <Info className="mt-0.5 size-3.5 shrink-0 text-indigo" aria-hidden />
              As informações clínicas e do pré-natal são registradas no prontuário, durante a
              consulta.
            </p>
          </nav>

        </aside>
      </div>

      {/*
        As ações moram numa barra fixa no rodapé. A ficha é alta, e um botão no
        fim de trinta campos obriga a rolar até o fim para desistir de um campo
        opcional lá do meio.
      */}
      {/*
        No celular a barra senta **acima** da navegação inferior do app, que é
        fixa e mais alta na pilha: sem esse deslocamento, os botões de salvar
        ficariam escondidos atrás dela justamente na tela em que o polegar
        precisa alcançá-los.
      */}
      <div className="fixed inset-x-0 bottom-[calc(var(--nav-h)+env(safe-area-inset-bottom))] z-30 border-t border-line bg-[color-mix(in_oklab,var(--color-paper)_88%,transparent)] backdrop-blur-md md:bottom-0 md:[padding-bottom:env(safe-area-inset-bottom)]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-end gap-2 px-md py-3">
          <span className="mr-auto hidden text-xs text-ink-mute sm:block">
            {sujo ? 'Alterações não salvas' : 'Tudo salvo'} · <kbd>Ctrl</kbd>+<kbd>Enter</kbd> salva
            e abre
          </span>
          <Button variant="ghost" onClick={cancelar} disabled={salvando}>
            Cancelar
          </Button>
          <Button variant="secondary" onClick={() => void salvar(false)} loading={salvando}>
            Salvar
          </Button>
          <Button onClick={() => void salvar(true)} loading={salvando}>
            Salvar e abrir paciente
          </Button>
        </div>
      </div>
    </div>
  )
}
