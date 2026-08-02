import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Blob } from '@/components/Blob'
import { Logo } from '@/components/Logo'
import { Button } from '@/components/Button'
import { AlertaErro } from '@/components/AlertaErro'
import { Vidro } from '@/components/Vidro'
import { Campo, CampoSenha } from '@/components/Campo'
import { useAuth } from '@/lib/stores/auth'
import { useTrilha } from '@/lib/stores/trilha'
import { checkRateLimit } from '@/lib/rate-limit'

/**
 * Entrar.
 *
 * Mesmo material do cadastro — um cartão de vidro sobre o fundo ambiente — para
 * que as duas portas da casa sejam reconhecidamente a mesma casa. O campo de
 * senha tem olho: a alternativa real ao segredo não é segurança, é a pessoa
 * errando a digitação três vezes num teclado de celular e desistindo.
 */
export default function EntrarPage() {
  const login = useAuth((s) => s.login)
  const sessaoExpirada = useAuth((s) => s.sessaoExpirada)
  const resetDemo = useTrilha((s) => s.resetDemo)
  const navigate = useNavigate()
  const location = useLocation()

  /** Vem preenchido quando alguém tentou se cadastrar com um e-mail que já tem
   * conta — não faz sentido pedir que digite de novo. */
  const vindoDoCadastro = (location.state as { email?: string } | null)?.email ?? ''

  const [email, setEmail] = useState(vindoDoCadastro)
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState<{ mensagem: string; status?: number } | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function entrar(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)

    const limite = checkRateLimit('login-submit', 8, 60_000)
    if (!limite.allowed) {
      setErro({ mensagem: `Muitas tentativas. Tente de novo em ${limite.retryAfter}s.` })
      return
    }

    setEnviando(true)
    const result = await login(email.trim(), senha)
    setEnviando(false)

    if (result.ok) {
      resetDemo()
      setSenha('')
      navigate('/app')
    } else {
      setErro({ mensagem: result.error ?? 'Não foi possível entrar.', status: result.status })
    }
  }

  return (
    <div className="relative grid min-h-[85vh] place-items-center overflow-clip px-md py-2xl">
      <Blob variant="b" intensity={0.48} className="-right-24 top-6 size-[28rem]" />
      <Blob variant="a" intensity={0.4} className="-left-24 bottom-0 size-[28rem]" />

      <Vidro as="form" peso="denso" onSubmit={entrar} className="w-full max-w-md p-lg sm:p-xl">
        <Link to="/" aria-label="Prumo — início" className="inline-block">
          <Logo variant="full" className="h-9" />
        </Link>
        <h1 className="mt-lg text-3xl">Que bom te ver de novo</h1>
        <p className="mt-1 text-ink-soft">
          {sessaoExpirada
            ? 'Por segurança, sua sessão foi encerrada depois de um tempo parada. Entre de novo para continuar de onde parou.'
            : vindoDoCadastro
              ? 'Você já tem uma conta com esse e-mail. É só colocar a senha para continuar.'
              : 'Entre para continuar sua trilha.'}
        </p>

        <div className="mt-lg flex flex-col gap-3">
          <Campo
            rotulo="E-mail"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="voce@email.com"
            required
          />
          <CampoSenha
            rotulo="Senha"
            autoComplete="current-password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            placeholder="Sua senha"
            required
          />
        </div>

        {erro && (
          <AlertaErro
            acao={
              erro.status === 401 ? (
                <>
                  <Link
                    to="/esqueci-senha"
                    state={{ email: email.trim() }}
                    className="text-sm font-semibold text-indigo underline underline-offset-4"
                  >
                    Recuperar minha senha
                  </Link>
                  <span aria-hidden className="text-ink-mute">
                    ·
                  </span>
                  <Link to="/onboarding" className="text-sm font-semibold text-indigo underline underline-offset-4">
                    Criar uma conta nova
                  </Link>
                </>
              ) : undefined
            }
          >
            {erro.mensagem}
          </AlertaErro>
        )}

        <div className="mt-2 text-right">
          <Link to="/esqueci-senha" className="text-sm font-semibold text-indigo hover:text-azul">
            Esqueci minha senha
          </Link>
        </div>

        <div className="mt-md">
          <Button type="submit" size="lg" fullWidth loading={enviando}>
            Entrar
          </Button>
        </div>

        <p className="mt-md text-center text-sm text-ink-soft">
          Ainda não tem conta?{' '}
          <Link to="/onboarding" className="font-semibold text-indigo underline underline-offset-4">
            Criar minha conta
          </Link>
        </p>
      </Vidro>
    </div>
  )
}
