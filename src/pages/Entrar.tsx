import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Blob } from '@/components/Blob'
import { Logo } from '@/components/Logo'
import { Button } from '@/components/Button'
import { useAuth } from '@/lib/stores/auth'
import { useTrilha } from '@/lib/stores/trilha'
import { checkRateLimit } from '@/lib/rate-limit'

export default function EntrarPage() {
  const login = useAuth((s) => s.login)
  const resetDemo = useTrilha((s) => s.resetDemo)
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function entrar(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)

    const limite = checkRateLimit('login-submit', 8, 60_000)
    if (!limite.allowed) {
      setErro(`Muitas tentativas. Tente de novo em ${limite.retryAfter}s.`)
      return
    }

    setEnviando(true)
    const result = await login(email.trim(), senha)
    setEnviando(false)

    if (result.ok) {
      resetDemo()
      navigate('/app')
    } else {
      setErro(result.error ?? 'Não foi possível entrar.')
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
        <p className="mt-1 text-ink-soft">Entre para continuar sua trilha.</p>

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
          <p role="alert" className="mt-3 text-sm font-semibold text-warn">
            {erro}
          </p>
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
