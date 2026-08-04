import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { CheckCircle2, Lock, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/Button'
import { Skeleton } from '@/components/Skeleton'
import { AlertaErro } from '@/components/AlertaErro'
import { CaixaAceite } from '@/components/Campo'
import { Logo } from '@/components/Logo'
import { FormularioPaciente } from '@/features/pacientes/FormularioPaciente'
import {
  PACIENTE_VAZIA,
  paraApi,
  secaoDoErro,
  temErro,
  validarPaciente,
} from '@/features/cadastro/paciente'
import type { DadosPaciente, ErrosPaciente, IdSecao } from '@/features/cadastro/paciente'

interface Clinica {
  medicoNome: string
  especialidade: string
  nomeClinica: string
}

/**
 * O pré-cadastro — a ficha que a paciente preenche no próprio celular.
 *
 * Página pública, sem conta e sem senha: exigir cadastro para poder se cadastrar
 * é o círculo que faz a pessoa desistir e a recepção digitar tudo de novo.
 *
 * O que esta tela **não** faz: não mostra nada. Ela só escreve. Não há consulta,
 * não há prontuário, não há "confira seus dados" — quem tem o link consegue
 * mandar uma ficha, e mais nada. Essa assimetria é o que torna um endereço
 * público aceitável num produto de saúde.
 *
 * Feita para o polegar: uma coluna, campos grandes e teclado certo por campo
 * (`inputMode`).
 */
export default function PreCadastro() {
  const { token = '' } = useParams()
  const [clinica, setClinica] = useState<Clinica | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [dados, setDados] = useState<DadosPaciente>(PACIENTE_VAZIA)
  const [erros, setErros] = useState<ErrosPaciente>({})
  const [aceite, setAceite] = useState(false)
  const [erroAceite, setErroAceite] = useState<string | undefined>()
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [secoes] = useState(() => new Map<IdSecao, HTMLElement>())

  useEffect(() => {
    let vivo = true
    /*
     * `fetch` direto, e não o cliente de API: aquele manda `credentials:
     * 'include'` em toda chamada, e esta página não tem sessão nenhuma para
     * oferecer — nem deve criar uma.
     */
    fetch(`/api/pre-cadastro/publico/${encodeURIComponent(token)}`)
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? 'Link inválido.')
        return r.json() as Promise<Clinica>
      })
      .then((d) => vivo && setClinica(d))
      .catch((e) => vivo && setErro(e instanceof Error ? e.message : 'Esse link não está valendo.'))
      .finally(() => vivo && setCarregando(false))
    return () => {
      vivo = false
    }
  }, [token])

  const quem = useMemo(() => {
    if (!clinica) return ''
    return clinica.nomeClinica || clinica.medicoNome || 'seu consultório'
  }, [clinica])

  async function enviar() {
    const encontrados = validarPaciente(dados)
    setErros(encontrados)
    setErroAceite(undefined)

    if (temErro(encontrados)) {
      secoes.get(secaoDoErro(Object.keys(encontrados)[0]))?.scrollIntoView({ block: 'start' })
      setErro('Faltou conferir alguns campos — marquei em vermelho.')
      return
    }
    if (!aceite) {
      setErroAceite('Para enviar, é preciso concordar com o uso dos seus dados.')
      return
    }

    setErro(null)
    setEnviando(true)
    try {
      const resposta = await fetch(`/api/pre-cadastro/publico/${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...paraApi(dados), aceite: true }),
      })
      if (!resposta.ok) {
        const corpo = (await resposta.json().catch(() => ({}))) as { error?: string }
        throw new Error(corpo.error ?? 'Não consegui enviar agora. Tenta de novo?')
      }
      setEnviado(true)
      window.scrollTo({ top: 0 })
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui enviar agora. Tenta de novo?')
    } finally {
      setEnviando(false)
    }
  }

  if (carregando) {
    return (
      <div className="u-shell flex flex-col gap-md py-2xl">
        <Skeleton className="h-16 w-2/3" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!clinica) {
    return (
      <div className="u-shell grid min-h-[60vh] place-items-center py-2xl">
        <div className="flex max-w-md flex-col items-center gap-3 text-center">
          <h1 className="text-3xl">Esse link não está valendo</h1>
          <p className="text-ink-soft">
            {erro ?? 'Peça um link novo ao consultório — este pode ter sido substituído.'}
          </p>
        </div>
      </div>
    )
  }

  if (enviado) {
    return (
      <div className="u-shell grid min-h-[60vh] place-items-center py-2xl">
        <div className="flex max-w-md flex-col items-center gap-3 text-center">
          <CheckCircle2 className="size-14 text-success-ink" aria-hidden />
          <h1 className="text-3xl">Cadastro enviado</h1>
          <p className="text-ink-soft">
            Pronto, {dados.nome.split(' ')[0]}. {quem} já recebeu seus dados — na consulta é só
            confirmar. Você não precisa fazer mais nada agora.
          </p>
          <p className="text-sm text-ink-mute">Pode fechar esta página com tranquilidade.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="u-shell flex max-w-3xl flex-col gap-md pb-2xl pt-xl">
      <header className="flex flex-col gap-2">
        <Logo variant="wordmark" className="h-7 self-start" label="Prumo" />
        <h1 className="text-3xl sm:text-4xl">Seu cadastro</h1>
        <p className="text-ink-soft">
          Preencha antes da consulta com {quem}
          {clinica.especialidade ? ` · ${clinica.especialidade}` : ''}. Leva menos de três minutos e
          poupa a fila da recepção.
        </p>
        <p className="flex items-start gap-2 rounded-xl border border-line bg-paper-2 px-3 py-2 text-sm text-ink-soft">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-indigo" aria-hidden />
          Seus dados vão criptografados direto para o consultório. Esta página não mostra nenhuma
          informação sua — ela só envia.
        </p>
      </header>

      {erro && <AlertaErro>{erro}</AlertaErro>}

      <FormularioPaciente
        valor={dados}
        onChange={(v) => setDados(v)}
        erros={erros}
        publico
        registrarSecao={(id, el) => {
          if (el) secoes.set(id, el)
          else secoes.delete(id)
        }}
      />

      {/*
        O envio fica **no fim do formulário**, e não numa barra fixa. Uma barra
        colada no rodapé disputaria espaço com o aviso de privacidade do site e
        com a barra do próprio navegador do celular — e o botão que some atrás de
        outra coisa é o único jeito de perder um cadastro já preenchido.
      */}
      <div className="rounded-2xl border border-line bg-paper p-md shadow-soft">
        <CaixaAceite checked={aceite} onChange={setAceite} erro={erroAceite}>
          Concordo que estes dados sejam usados por {quem} para o meu atendimento, conforme a
          política de privacidade.
        </CaixaAceite>
        <p className="mt-2 flex items-start gap-2 text-xs text-ink-mute">
          <Lock className="mt-0.5 size-3.5 shrink-0 text-indigo" aria-hidden />
          Nada do que você escrever aqui fica visível para outra paciente. As informações clínicas
          você conta na consulta — este formulário é só cadastro.
        </p>

        <Button
          className="mt-md"
          fullWidth
          size="lg"
          loading={enviando}
          onClick={() => void enviar()}
        >
          Enviar cadastro
        </Button>
        <p className="mt-2 text-center text-xs text-ink-mute">
          Os campos com <span className="text-warn-ink">*</span> são obrigatórios.
        </p>
      </div>
    </div>
  )
}
