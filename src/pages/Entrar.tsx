import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Blob } from '@/components/Blob'
import { Logo } from '@/components/Logo'
import { Button } from '@/components/Button'
import { AlertaErro } from '@/components/AlertaErro'
import { useAuth } from '@/lib/stores/auth'
import { useTrilha } from '@/lib/stores/trilha'
import { checkRateLimit } from '@/lib/rate-limit'

export default function EntrarPage() {
  const login = useAuth((s) => s.login)
  const sessaoExpirada = useAuth((s) => s.sessaoExpirada)
  const resetDemo = useTrilha((s) => s.resetDemo)
  const navigate = useNavigate()
  const location = useLocation()

  /** Carried over when someone tried to sign up with an e-mail that already has
   * an account — they shouldn't have to type it again. */
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
      navigate('/app')
    } else {
      setErro({ mensagem: result.error ?? 'Não foi possível entrar.', status: result.status })
    }
  }

  return (
    <div className="relative grid min-h-[85vh] place-items-center overflow-hidden px-md py-2xl">
      <Blob variant="b" intensity={0.4} className="-right-20 top-10 size-96" />
      <Blob variant="a" intensity={0.35} className="-left-20 bottom-0 size-96" />

      <form onSubmit={entrar} className="w-full max-w-md rounded-2xl border border-line bg-paper p-lg shadow-lift sm:p-xl">
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
          <Field label="E-mail" htmlFor="email">
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@email.com"
              className="input"
              required
            />
          </Field>
          <Field label="Senha" htmlFor="senha">
            <input
              id="senha"
              type="password"
              autoComplete="current-password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="Sua senha"
              className="input"
              required
            />
          </Field>
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
            Comece a trilha
          </Link>
        </p>
      </form>
    </div>
  )
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="flex flex-col gap-1.5">
      <span className="font-display text-sm font-semibold text-ink">{label}</span>
      {children}
    </label>
  )
}
