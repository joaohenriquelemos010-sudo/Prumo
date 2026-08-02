import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import type { LucideIcon } from 'lucide-react'
import { ArrowLeft, ArrowRight, Check, ChevronRight, Stethoscope, UserRound } from 'lucide-react'
import { useOnboarding, progressoDe } from '@/lib/stores/onboarding'
import type { MomentoGestacao, Perfil } from '@/lib/stores/onboarding'
import { useAuth } from '@/lib/stores/auth'
import { useTrilha } from '@/lib/stores/trilha'
import { Button } from '@/components/Button'
import { AlertaErro } from '@/components/AlertaErro'
import { Blob } from '@/components/Blob'
import { Logo } from '@/components/Logo'
import { Vidro, HaloIcone } from '@/components/Vidro'
import { Campo, CampoSelect, CampoSenha, CaixaAceite } from '@/components/Campo'
import { checkRateLimit } from '@/lib/rate-limit'
import { formatarCPF, formatarTelefone, hojeISO, somenteDigitos, UFS } from '@/lib/br-docs'
import { useMovimento } from '@/lib/motion'
import { cn } from '@/lib/cn'
import { ESPECIALIDADES, PERFIS, PERFIS_FAMILIA } from '@/features/cadastro/perfis'
import {
  DADOS_VAZIOS,
  dadosParaPerfil,
  paraRegistro,
  temErro,
  validarIdentidade,
  validarSeguranca,
} from '@/features/cadastro/formulario'
import type { DadosCadastro, Erros } from '@/features/cadastro/formulario'

/**
 * O fluxo de acesso.
 *
 * Cinco telas de vidro sobre o fundo ambiente da marca: escolher o caminho,
 * conhecer a conta, dizer quem você é, criar o acesso, chegar. Duas coisas
 * governam o desenho:
 *
 * - **A escolha é a resposta.** Onde a tela oferece opções, tocar numa avança —
 *   não existe "próximo" para confirmar o que a pessoa acabou de tocar.
 * - **O formulário se divide onde a natureza do que se pede muda**: primeiro
 *   quem você é, depois como você entra. Doze campos numa tela só viram um
 *   scroll que ninguém termina.
 */
export default function OnboardingPage() {
  const { passo, acesso, perfil, start, escolherAcesso, escolherPerfil, avancar, voltar, complete, reset } =
    useOnboarding()
  const registrar = useAuth((s) => s.register)
  const resetDemo = useTrilha((s) => s.resetDemo)
  const navigate = useNavigate()

  const [dados, setDados] = useState<DadosCadastro>(DADOS_VAZIOS)
  const [erros, setErros] = useState<Erros>({})
  /** `status` carrega o código HTTP para oferecer a saída certa (409 → entrar). */
  const [erroGeral, setErroGeral] = useState<{
    mensagem: string
    status?: number
  } | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [outraEsp, setOutraEsp] = useState(false)

  const inicioRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    start()
    return () => reset()
    // roda uma vez na montagem
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /**
   * Cada passo recomeça no topo, e o foco vai junto.
   *
   * Sem isso, quem apertou "Continuar" no fim de um formulário longo cai no meio
   * da tela seguinte — e quem usa leitor de tela continua lendo de onde estava,
   * numa tela que não existe mais. A primeira tela fica de fora: ninguém acabou
   * de agir ali, e roubar a rolagem de quem só chegou é um susto.
   */
  useEffect(() => {
    if (passo === 'acesso') return
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
    /**
     * `preventScroll` não é zelo: o foco padrão rola **todo** ancestral rolável
     * para trazer o alvo à vista, e os blobs ambientes deixam o container mais
     * largo que a tela. Sem isto, dar foco empurrava o cartão inteiro 53px para
     * a esquerda a cada passo.
     */
    inicioRef.current?.focus({ preventScroll: true })
  }, [passo])

  /** Escrever num campo apaga o erro dele — e só o dele. */
  function mudar<C extends keyof DadosCadastro>(campo: C, valor: DadosCadastro[C]) {
    setDados((atual) => ({ ...atual, [campo]: valor }))
    setErros((atuais) => (campo in atuais ? { ...atuais, [campo]: undefined } : atuais))
    if (erroGeral) setErroGeral(null)
  }

  function abrirCadastro(escolhido: Perfil) {
    setDados((atual) => dadosParaPerfil(atual, escolhido))
    escolherPerfil(escolhido)
  }

  function voltarPasso() {
    setErros({})
    setErroGeral(null)
    // Voltar da primeira bifurcação é desfazê-la, não só recuar um passo.
    if (passo === 'perfil') reset()
    else voltar()
  }

  function continuarIdentidade() {
    const encontrados = validarIdentidade(dados)
    setErros(encontrados)
    if (!temErro(encontrados)) avancar()
  }

  async function finalizar() {
    if (!perfil) return
    setErroGeral(null)

    const encontrados = validarSeguranca(dados, perfil)
    setErros(encontrados)
    if (temErro(encontrados)) return

    const limite = checkRateLimit('onboarding-submit', 5, 60_000)
    if (!limite.allowed) {
      setErroGeral({
        mensagem: `Muitas tentativas. Tente de novo em ${limite.retryAfter}s.`,
      })
      return
    }

    setEnviando(true)
    const resultado = await registrar(paraRegistro(dados, perfil))
    setEnviando(false)

    if (!resultado.ok) {
      setErroGeral({
        mensagem: resultado.error ?? 'Não foi possível criar sua conta.',
        status: resultado.status,
      })
      return
    }

    resetDemo()
    // A senha some da memória assim que deixa de ser necessária.
    setDados((atual) => ({ ...atual, senha: '', confirmarSenha: '' }))
    complete()
  }

  const copia = perfil ? PERFIS[perfil] : null

  /*
   * `overflow-clip`, e não `hidden`: os dois cortam igual, mas `hidden` deixa o
   * container **rolável** — e um container rolável é o que qualquer scroll
   * programático encontra e empurra. Com os blobs ambientes o container mede
   * 516px numa tela de 420, então dar foco no passo seguinte arrastava o cartão
   * inteiro 53px para a esquerda.
   */
  return (
    <div className="relative min-h-[85vh] overflow-clip px-md py-xl">
      <Blob variant="a" intensity={0.5} className="-left-24 -top-10 size-[28rem]" />
      <Blob variant="b" intensity={0.42} className="-right-24 bottom-0 size-[28rem]" />
      <Blob variant="c" intensity={0.22} className="left-1/3 top-1/3 size-[22rem]" />

      <div className="mx-auto flex w-full max-w-lg flex-col">
        {passo !== 'sucesso' && (
          <Cabecalho passo={passo} mostrarVoltar={passo !== 'acesso'} onVoltar={voltarPasso} />
        )}

        <div ref={inicioRef} tabIndex={-1} className="outline-none">
          <AnimatePresence mode="wait">
            {passo === 'acesso' && (
              <Tela key="acesso">
                <TelaAcesso onEscolher={escolherAcesso} />
              </Tela>
            )}

            {passo === 'perfil' && acesso === 'medico' && (
              <Tela key="medico">
                <TelaBoasVindasMedico onContinuar={avancar} />
              </Tela>
            )}

            {passo === 'perfil' && acesso === 'paciente' && (
              <Tela key="paciente">
                <TelaQuemEVoce onEscolher={abrirCadastro} />
              </Tela>
            )}

            {passo === 'dados' && copia && (
              <Tela key="dados">
                <Vidro peso="denso" className="p-lg sm:p-xl">
                  <CabecalhoPerfil copia={copia} />
                  <ChipsBeneficios copia={copia} />

                  <div className="mt-lg flex flex-col gap-3">
                    <Campo
                      rotulo="Nome completo"
                      placeholder="Digite seu nome"
                      autoComplete="name"
                      maxLength={80}
                      value={dados.nome}
                      erro={erros.nome}
                      onChange={(e) => mudar('nome', e.target.value)}
                    />
                    <Campo
                      rotulo="E-mail"
                      type="email"
                      inputMode="email"
                      placeholder="voce@email.com"
                      autoComplete="email"
                      value={dados.email}
                      erro={erros.email}
                      onChange={(e) => mudar('email', e.target.value)}
                    />
                    <Campo
                      rotulo="Celular (WhatsApp)"
                      type="tel"
                      inputMode="tel"
                      placeholder="(11) 91234-5678"
                      autoComplete="tel-national"
                      value={dados.telefone}
                      erro={erros.telefone}
                      ajuda="É por aqui que chegam os lembretes de consulta."
                      onChange={(e) => mudar('telefone', formatarTelefone(e.target.value))}
                    />
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Campo
                        rotulo="CPF"
                        inputMode="numeric"
                        placeholder="000.000.000-00"
                        autoComplete="off"
                        value={dados.cpf}
                        erro={erros.cpf}
                        onChange={(e) => mudar('cpf', formatarCPF(e.target.value))}
                      />
                      <Campo
                        rotulo="Data de nascimento"
                        type="date"
                        max={hojeISO()}
                        autoComplete="bday"
                        value={dados.dataNascimento}
                        erro={erros.dataNascimento}
                        onChange={(e) => mudar('dataNascimento', e.target.value)}
                      />
                    </div>
                    <p className="px-1 text-xs text-ink-mute">
                      Seu CPF é guardado cifrado, nunca aparece para outras pessoas e nunca sai da Prumo.{' '}
                      <Link
                        to="/seguranca"
                        className="font-semibold text-indigo underline underline-offset-2"
                      >
                        Como cuidamos disso
                      </Link>
                      .
                    </p>
                  </div>

                  <div className="mt-lg">
                    <Button
                      size="lg"
                      fullWidth
                      iconRight={<ArrowRight className="size-4" aria-hidden />}
                      onClick={continuarIdentidade}
                    >
                      Continuar
                    </Button>
                  </div>
                </Vidro>
              </Tela>
            )}

            {passo === 'seguranca' && copia && perfil && (
              <Tela key="seguranca">
                <Vidro peso="denso" className="p-lg sm:p-xl">
                  <CabecalhoPerfil
                    copia={copia}
                    titulo="Falta só criar seu acesso"
                    subtitulo="Depois disso sua trilha já fica salva de verdade."
                  />

                  <div className="mt-lg flex flex-col gap-3">
                    <CampoSenha
                      rotulo="Senha"
                      medidor
                      placeholder="Mínimo 8 caracteres"
                      autoComplete="new-password"
                      value={dados.senha}
                      erro={erros.senha}
                      onChange={(e) => mudar('senha', e.target.value)}
                    />
                    <CampoSenha
                      rotulo="Confirmar senha"
                      placeholder="Digite de novo"
                      autoComplete="new-password"
                      value={dados.confirmarSenha}
                      erro={erros.confirmarSenha}
                      onChange={(e) => mudar('confirmarSenha', e.target.value)}
                    />

                    {perfil === 'medico' ? (
                      <CamposMedico
                        dados={dados}
                        erros={erros}
                        outraEsp={outraEsp}
                        setOutraEsp={setOutraEsp}
                        mudar={mudar}
                      />
                    ) : (
                      <CamposFamilia perfil={perfil} dados={dados} erros={erros} mudar={mudar} />
                    )}

                    <div className="mt-xs flex flex-col gap-2 border-t border-line pt-md">
                      <CaixaAceite
                        checked={dados.aceiteTermos}
                        onChange={(v) => mudar('aceiteTermos', v)}
                        erro={erros.aceiteTermos}
                      >
                        Li e concordo com os{' '}
                        <Link
                          to="/seguranca"
                          className="font-semibold text-indigo underline underline-offset-2"
                        >
                          Termos de Uso e a Política de Privacidade
                        </Link>
                        .
                      </CaixaAceite>
                      <CaixaAceite
                        checked={dados.aceiteComunicacoes}
                        onChange={(v) => mudar('aceiteComunicacoes', v)}
                      >
                        Quero receber novidades e conteúdos da Prumo por e-mail.{' '}
                        <span className="text-ink-mute">(opcional)</span>
                      </CaixaAceite>
                    </div>
                  </div>

                  {erroGeral && (
                    <AlertaErro
                      acao={
                        erroGeral.status === 409 ? (
                          <>
                            <Button
                              size="md"
                              iconRight={<ArrowRight className="size-4" aria-hidden />}
                              onClick={() =>
                                navigate('/entrar', {
                                  state: { email: dados.email.trim() },
                                })
                              }
                            >
                              Entrar com esse e-mail
                            </Button>
                            <Link
                              to="/esqueci-senha"
                              state={{ email: dados.email.trim() }}
                              className="text-sm font-semibold text-indigo underline underline-offset-4"
                            >
                              Esqueci minha senha
                            </Link>
                          </>
                        ) : undefined
                      }
                    >
                      {erroGeral.mensagem}
                    </AlertaErro>
                  )}

                  <div className="mt-lg">
                    <Button size="lg" fullWidth loading={enviando} onClick={finalizar}>
                      {copia.acao}
                    </Button>
                  </div>
                </Vidro>
              </Tela>
            )}

            {passo === 'sucesso' && copia && (
              <Tela key="sucesso">
                <TelaSucesso
                  copia={copia}
                  onComecar={() => navigate('/app')}
                  onDepois={() => navigate('/')}
                />
              </Tela>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Telas                                                                       */
/* -------------------------------------------------------------------------- */

function TelaAcesso({ onEscolher }: { onEscolher: (acesso: 'medico' | 'paciente') => void }) {
  return (
    <div className="flex flex-col items-center">
      <Logo variant="full" className="h-11" />
      <p className="mt-md max-w-xs text-center text-lg text-ink-soft">
        Conecta gestantes, mães e pais a médicos.
      </p>

      <Vidro peso="denso" className="mt-lg w-full p-lg sm:p-xl">
        <h1 className="text-2xl">Como você deseja acessar?</h1>
        <p className="mt-1 text-ink-soft">Escolha o perfil que melhor te representa para continuarmos.</p>

        <div className="mt-lg flex flex-col gap-3">
          <OpcaoLinha icone={Stethoscope} titulo="Sou médico(a)" onClick={() => onEscolher('medico')} />
          <OpcaoLinha icone={UserRound} titulo="Sou paciente" onClick={() => onEscolher('paciente')} />
        </div>

        <p className="mt-lg text-center text-sm text-ink-soft">
          Já tem uma conta?{' '}
          <Link to="/entrar" className="font-semibold text-indigo underline underline-offset-4">
            Entrar
          </Link>
        </p>
      </Vidro>
    </div>
  )
}

function TelaBoasVindasMedico({ onContinuar }: { onContinuar: () => void }) {
  const copia = PERFIS.medico

  return (
    <Vidro peso="denso" className="p-lg sm:p-xl">
      <div className="flex flex-col items-center text-center">
        <HaloIcone tom={copia.tom}>
          <copia.icone className="size-7" aria-hidden />
        </HaloIcone>
        <h1 className="mt-md text-2xl">Bem-vindo(a), médico(a)!</h1>
        <p className="mt-1 text-ink-soft">{copia.subtitulo}</p>
      </div>

      <ul className="mt-lg flex flex-col gap-1 rounded-xl bg-paper p-2">
        {copia.beneficios.map((beneficio) => (
          <li key={beneficio.texto} className="flex items-center gap-3 rounded-lg px-3 py-2.5">
            <span className="grid size-8 shrink-0 place-items-center rounded-lg [background-image:var(--grad-brand-soft)] text-indigo">
              <beneficio.icone className="size-4" aria-hidden />
            </span>
            <span className="text-sm font-semibold text-ink">{beneficio.texto}</span>
          </li>
        ))}
      </ul>

      <div className="mt-lg">
        <Button size="lg" fullWidth onClick={onContinuar}>
          Criar minha conta
        </Button>
      </div>
      <p className="mt-md text-center text-sm text-ink-soft">
        Já tem uma conta?{' '}
        <Link to="/entrar" className="font-semibold text-indigo underline underline-offset-4">
          Entrar
        </Link>
      </p>
    </Vidro>
  )
}

function TelaQuemEVoce({ onEscolher }: { onEscolher: (perfil: Perfil) => void }) {
  return (
    <Vidro peso="denso" className="p-lg sm:p-xl">
      <div className="flex flex-col items-center text-center">
        <HaloIcone>
          <UserRound className="size-7" aria-hidden />
        </HaloIcone>
        <h1 className="mt-md text-2xl">Para te oferecer a melhor experiência, quem é você?</h1>
        <p className="mt-1 text-ink-soft">Escolha uma opção para continuarmos.</p>
      </div>

      <div className="mt-lg flex flex-col gap-3">
        {PERFIS_FAMILIA.map((opcao) => (
          <OpcaoLinha
            key={opcao.perfil}
            icone={opcao.icone}
            titulo={opcao.titulo}
            nota={opcao.nota}
            onClick={() => onEscolher(opcao.perfil)}
          />
        ))}
      </div>

      <p className="mt-lg text-center text-sm text-ink-mute">Tudo bem, você pode alterar depois.</p>
    </Vidro>
  )
}

function TelaSucesso({
  copia,
  onComecar,
  onDepois,
}: {
  copia: (typeof PERFIS)[Perfil]
  onComecar: () => void
  onDepois: () => void
}) {
  const { mola } = useMovimento()

  return (
    <Vidro peso="denso" className="p-lg text-center sm:p-xl">
      <div className="flex flex-col items-center">
        <motion.span
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          /**
           * Aqui o overshoot é bem-vindo: é o único momento do fluxo em que algo
           * chega, e não em que algo é pedido.
           */
          transition={mola('firme')}
        >
          <HaloIcone tom={copia.tom} tamanho="lg">
            <Check className="size-9" aria-hidden strokeWidth={2.5} />
          </HaloIcone>
        </motion.span>
        <h1 className="mt-lg text-2xl">Conta criada com sucesso!</h1>
        <p className="mt-md font-display text-lg font-semibold text-indigo">{copia.sucesso.saudacao}</p>
        <p className="mt-1 text-ink-soft">{copia.sucesso.texto}</p>
      </div>

      <div className="mt-lg flex flex-col gap-2">
        <Button size="lg" fullWidth onClick={onComecar}>
          Começar agora
        </Button>
        <Button variant="ghost" size="md" fullWidth onClick={onDepois}>
          Explorar depois
        </Button>
      </div>
    </Vidro>
  )
}

/* -------------------------------------------------------------------------- */
/* Blocos de campo                                                             */
/* -------------------------------------------------------------------------- */

interface CamposProps {
  dados: DadosCadastro
  erros: Erros
  mudar: <C extends keyof DadosCadastro>(campo: C, valor: DadosCadastro[C]) => void
}

function CamposMedico({
  dados,
  erros,
  outraEsp,
  setOutraEsp,
  mudar,
}: CamposProps & { outraEsp: boolean; setOutraEsp: (v: boolean) => void }) {
  return (
    <>
      <div className="grid grid-cols-[1fr_6rem] gap-3">
        <Campo
          rotulo="CRM"
          inputMode="numeric"
          placeholder="Número do registro"
          value={dados.crm}
          erro={erros.crm}
          onChange={(e) => mudar('crm', somenteDigitos(e.target.value).slice(0, 6))}
        />
        <CampoSelect rotulo="UF" value={dados.crmUf} onChange={(e) => mudar('crmUf', e.target.value)}>
          <option value="">--</option>
          {UFS.map((uf) => (
            <option key={uf} value={uf}>
              {uf}
            </option>
          ))}
        </CampoSelect>
      </div>

      <CampoSelect
        rotulo="Especialidade"
        value={outraEsp ? 'Outra' : dados.especialidade}
        erro={erros.especialidade}
        onChange={(e) => {
          const valor = e.target.value
          setOutraEsp(valor === 'Outra')
          mudar('especialidade', valor === 'Outra' ? '' : valor)
        }}
      >
        <option value="">Selecione…</option>
        {ESPECIALIDADES.map((esp) => (
          <option key={esp} value={esp}>
            {esp}
          </option>
        ))}
      </CampoSelect>
      {outraEsp && (
        <Campo
          rotulo="Qual é a sua especialidade?"
          maxLength={60}
          value={dados.especialidade}
          onChange={(e) => mudar('especialidade', e.target.value)}
        />
      )}

      <p className="px-1 text-xs text-ink-mute">
        Conferimos seu CPF e guardamos o CRM para a verificação profissional, que fica pendente até a
        validação junto ao conselho. Seus documentos nunca aparecem publicamente.
      </p>
    </>
  )
}

function CamposFamilia({ perfil, dados, erros, mudar }: CamposProps & { perfil: Perfil }) {
  const gestante = perfil === 'gestante'

  return (
    <>
      {!gestante && (
        <CampoSelect
          rotulo="Em que ponto vocês estão?"
          value={dados.momento}
          onChange={(e) => mudar('momento', e.target.value as MomentoGestacao)}
        >
          <option value="ja-nasceu">Meu bebê já nasceu</option>
          <option value="gestante">Estamos esperando um bebê</option>
          <option value="planejando">Estamos planejando</option>
        </CampoSelect>
      )}

      {dados.momento === 'gestante' && (
        <Campo
          rotulo="Data provável do parto (opcional)"
          type="date"
          value={dados.dpp}
          erro={erros.dpp}
          ajuda="Se ainda não sabe, tudo bem — dá para preencher depois."
          onChange={(e) => mudar('dpp', e.target.value)}
        />
      )}

      {dados.momento === 'ja-nasceu' && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo
            rotulo="Nome do bebê (opcional)"
            maxLength={80}
            placeholder="Como vocês chamam"
            value={dados.nomeBebe}
            onChange={(e) => mudar('nomeBebe', e.target.value)}
          />
          <Campo
            rotulo="Nascimento do bebê"
            type="date"
            max={hojeISO()}
            value={dados.dataNascimentoBebe}
            erro={erros.dataNascimentoBebe}
            onChange={(e) => mudar('dataNascimentoBebe', e.target.value)}
          />
        </div>
      )}
    </>
  )
}

/* -------------------------------------------------------------------------- */
/* Peças                                                                       */
/* -------------------------------------------------------------------------- */

function Cabecalho({
  passo,
  mostrarVoltar,
  onVoltar,
}: {
  passo: Parameters<typeof progressoDe>[0]
  mostrarVoltar: boolean
  onVoltar: () => void
}) {
  const progresso = progressoDe(passo)

  return (
    <div className="mb-lg flex items-center gap-3">
      {mostrarVoltar ? (
        <button
          type="button"
          onClick={onVoltar}
          className="grid size-10 shrink-0 place-items-center rounded-pill text-indigo transition-colors duration-[var(--dur-fast)] hover:bg-paper-2"
          aria-label="Voltar um passo"
        >
          <ArrowLeft className="size-5" aria-hidden />
        </button>
      ) : (
        <span className="size-10 shrink-0" aria-hidden />
      )}
      <div
        className="h-1.5 flex-1 overflow-hidden rounded-pill bg-paper-3"
        role="progressbar"
        aria-valuenow={progresso}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Progresso do cadastro"
      >
        <div
          className="h-full rounded-pill [background-image:var(--grad-brand)] transition-[width] duration-[var(--dur-base)] ease-out"
          style={{ width: `${progresso}%` }}
        />
      </div>
      <span className="w-10 shrink-0" aria-hidden />
    </div>
  )
}

/**
 * A transição entre passos.
 *
 * O vidro **se materializa**: blur e escala animam juntos, para a superfície ler
 * como um material chegando em vez de uma opacidade subindo. Sob movimento
 * reduzido sobra só o cross-fade — que é o equivalente gentil, não a ausência de
 * feedback.
 */
function Tela({ children }: { children: React.ReactNode }) {
  const { ativo, mola, duracao } = useMovimento()

  return (
    <motion.div
      initial={ativo ? { opacity: 0, y: 18, scale: 0.985, filter: 'blur(8px)' } : { opacity: 0 }}
      animate={ativo ? { opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' } : { opacity: 1 }}
      exit={ativo ? { opacity: 0, y: -14, scale: 0.99, filter: 'blur(6px)' } : { opacity: 0 }}
      transition={ativo ? mola('suave') : duracao(0.18)}
    >
      {children}
    </motion.div>
  )
}

function OpcaoLinha({
  icone: Icone,
  titulo,
  nota,
  onClick,
}: {
  icone: LucideIcon
  titulo: string
  nota?: string
  onClick: () => void
}) {
  const { ativo, mola } = useMovimento()

  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={ativo ? { scale: 0.985 } : undefined}
      transition={mola('rapida')}
      className={cn(
        'group flex w-full items-center gap-3 rounded-xl border border-line bg-paper p-3.5 text-left shadow-soft',
        'transition-[border-color,box-shadow] duration-[var(--dur-fast)] ease-out',
        'hover:border-[var(--color-lilas-soft)] hover:shadow-lift',
        'focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus)]',
      )}
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-lg [background-image:var(--grad-brand-soft)] text-indigo">
        <Icone className="size-5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-display font-semibold text-ink">{titulo}</span>
        {nota && <span className="block text-sm text-ink-mute">{nota}</span>}
      </span>
      <ChevronRight
        className="size-5 shrink-0 text-ink-mute transition-transform duration-[var(--dur-fast)] group-hover:translate-x-0.5"
        aria-hidden
      />
    </motion.button>
  )
}

function CabecalhoPerfil({
  copia,
  titulo,
  subtitulo,
}: {
  copia: (typeof PERFIS)[Perfil]
  titulo?: string
  subtitulo?: string
}) {
  return (
    <div className="flex flex-col items-center text-center">
      <HaloIcone tom={copia.tom}>
        <copia.icone className="size-7" aria-hidden />
      </HaloIcone>
      <h1 className="mt-md text-2xl">{titulo ?? copia.titulo}</h1>
      <p className="mt-1 text-ink-soft">{subtitulo ?? copia.subtitulo}</p>
    </div>
  )
}

function ChipsBeneficios({ copia }: { copia: (typeof PERFIS)[Perfil] }) {
  return (
    <ul className="mt-lg grid grid-cols-2 gap-2">
      {copia.beneficios.map((beneficio) => (
        <li
          key={beneficio.texto}
          className="flex items-center gap-2 rounded-lg bg-paper px-3 py-2 text-[0.8rem] font-semibold leading-tight text-ink shadow-soft"
        >
          <beneficio.icone className="size-4 shrink-0 text-indigo" aria-hidden />
          {/* Sem `truncate`: um benefício cortado no meio ("Acompanh…") não é
              um benefício — é ruído. Melhor a linha quebrar. */}
          <span className="min-w-0">{beneficio.texto}</span>
        </li>
      ))}
    </ul>
  )
}
