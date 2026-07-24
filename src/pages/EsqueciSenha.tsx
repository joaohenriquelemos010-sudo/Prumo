import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { MailCheck, ArrowLeft } from 'lucide-react'
import { api } from '@/lib/api/client'
import { Logo } from '@/components/Logo'
import { Button } from '@/components/Button'
import { Blob } from '@/components/Blob'
import { checkRateLimit } from '@/lib/rate-limit'

/**
 * Recover-password flow. Deliberately simple and reassuring for people who are
 * not tech-savvy: one field, one button, and a calm confirmation that doesn't
 * reveal whether the e-mail exists. (Real e-mail sending needs a provider.)
 */
export default function EsqueciSenhaPage() {
  const location = useLocation()
  // Carried over from sign-in / sign-up so nobody retypes their e-mail.
  const [email, setEmail] = useState((location.state as { email?: string } | null)?.email ?? '')
  const [enviado, setEnviado] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)
    const limite = checkRateLimit('esqueci-senha', 5, 60_000)
    if (!limite.allowed) {
      setErro(`Muitas tentativas. Tente de novo em ${limite.retryAfter}s.`)
      return
    }
    setEnviando(true)
    try {
      await api.post('/auth/esqueci-senha', { email: email.trim() })
      setEnviado(true)
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Algo não funcionou. Tenta de novo?')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="relative grid min-h-[85vh] place-items-center overflow-hidden px-md py-2xl">
      <Blob variant="b" intensity={0.4} className="-right-20 top-10 size-96" />

      <div className="w-full max-w-md rounded-2xl border border-line bg-paper p-lg shadow-lift sm:p-xl">
        <Link to="/entrar" className="inline-flex items-center gap-1 text-sm font-semibold text-indigo hover:text-azul">
          <ArrowLeft className="size-4" aria-hidden /> Voltar para entrar
        </Link>

        {enviado ? (
          <div className="mt-lg flex flex-col items-center gap-md text-center">
            <span className="grid size-14 place-items-center rounded-full [background-image:var(--grad-brand-soft)] text-indigo">
              <MailCheck className="size-7" aria-hidden />
            </span>
            <h1 className="text-2xl">Confira seu e-mail</h1>
            <p className="text-ink-soft">
              Se houver uma conta com <strong>{email.trim()}</strong>, enviamos um link para
              você criar uma nova senha. Dá uma olhada na caixa de entrada (e no spam).
            </p>
            <Link to="/entrar" className="mt-xs font-display font-semibold text-indigo underline underline-offset-4">
              Voltar para entrar
            </Link>
          </div>
        ) : (
          <form onSubmit={enviar}>
            <Logo variant="full" className="mt-lg h-8" />
            <h1 className="mt-md text-3xl">Esqueceu a senha?</h1>
            <p className="mt-1 text-ink-soft">Sem problema. Digite seu e-mail e a gente te ajuda a voltar.</p>

            <label htmlFor="email" className="mt-lg flex flex-col gap-1.5">
              <span className="font-display text-sm font-semibold text-ink">Seu e-mail</span>
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
            </label>

            {erro && (
              <p role="alert" className="mt-3 text-sm font-semibold text-warn">
                {erro}
              </p>
            )}

            <div className="mt-lg">
              <Button type="submit" size="lg" fullWidth loading={enviando}>
                Enviar link de recuperação
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
