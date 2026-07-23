import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { HeartHandshake, Baby, Stethoscope, CalendarClock, Sprout, ArrowLeft } from 'lucide-react'
import { useOnboarding } from '@/lib/stores/onboarding'
import type { MomentoGestacao, Perfil } from '@/lib/stores/onboarding'
import { useAuth } from '@/lib/stores/auth'
import { useTrilha } from '@/lib/stores/trilha'
import { Button } from '@/components/Button'
import { Blob } from '@/components/Blob'
import { checkRateLimit } from '@/lib/rate-limit'
import { normalizeField } from '@/lib/sanitize'
import { validarCPF, formatarCPF, UFS } from '@/lib/br-docs'
import { cn } from '@/lib/cn'

const slide = {
  initial: { opacity: 0, x: 24 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -24 },
  transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] as const },
}

export default function OnboardingPage() {
  const { step, perfil, momento, nome, start, setPerfil, setMomento, setNome, next, back, complete, reset } =
    useOnboarding()
  const registrar = useAuth((s) => s.register)
  const resetDemo = useTrilha((s) => s.resetDemo)
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [cpf, setCpf] = useState('')
  const [crm, setCrm] = useState('')
  const [crmUf, setCrmUf] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    start()
    return () => reset()
    // run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const totalSteps = 3
  const progresso = Math.round(((step + 1) / totalSteps) * 100)

  function escolherPerfil(p: Perfil) {
    setPerfil(p)
    // Auto-advance — the choice IS the answer, no "próximo" needed.
    setTimeout(next, 260)
  }

  function escolherMomento(m: MomentoGestacao) {
    setMomento(m)
    setTimeout(next, 260)
  }

  async function finalizar() {
    setErro(null)
    const limite = checkRateLimit('onboarding-submit', 5, 60_000)
    if (!limite.allowed) {
      setErro(`Muitas tentativas. Tente de novo em ${limite.retryAfter}s.`)
      return
    }

    const nomeLimpo = normalizeField(nome, 80)
    if (nomeLimpo.length < 2) {
      setErro('Conta pra gente como podemos te chamar.')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setErro('Esse e-mail parece incompleto. Confere pra mim?')
      return
    }
    if (senha.length < 8) {
      setErro('Crie uma senha com pelo menos 8 caracteres.')
      return
    }
    if (!perfil) {
      setErro('Volte e escolha por onde você entra.')
      return
    }
    if (perfil === 'medico') {
      if (!validarCPF(cpf)) {
        setErro('CPF inválido. Confere os números?')
        return
      }
      // CRM é opcional por enquanto (sem validação oficial).
    }

    setEnviando(true)
    const result = await registrar({
      nome: nomeLimpo,
      email: email.trim(),
      senha,
      papel: perfil,
      ...(perfil === 'medico' ? { cpf, crm, crmUf } : {}),
    })
    setEnviando(false)

    if (!result.ok) {
      setErro(result.error ?? 'Não foi possível criar sua conta.')
      return
    }

    complete()
    resetDemo()
    navigate('/app')
  }

  return (
    <div className="relative min-h-[80vh] overflow-hidden">
      <Blob variant="a" intensity={0.4} className="-left-20 top-0 size-96" />
      <Blob variant="b" intensity={0.35} className="-right-20 bottom-0 size-96" />

      <div className="u-shell flex max-w-2xl flex-col py-2xl">
        {/* progress */}
        <div className="mb-xl flex items-center gap-md">
          {step > 0 && (
            <button
              type="button"
              onClick={back}
              className="grid size-10 shrink-0 place-items-center rounded-pill text-indigo hover:bg-paper-2"
              aria-label="Voltar um passo"
            >
              <ArrowLeft className="size-5" aria-hidden />
            </button>
          )}
          <div className="h-2 flex-1 overflow-hidden rounded-pill bg-paper-3" role="progressbar" aria-valuenow={progresso} aria-valuemin={0} aria-valuemax={100} aria-label="Progresso do cadastro">
            <div
              className="h-full rounded-pill [background-image:var(--grad-brand)] transition-[width] duration-[var(--dur-base)] ease-out"
              style={{ width: `${progresso}%` }}
            />
          </div>
          <span className="shrink-0 font-display text-sm font-semibold text-ink-mute">
            {step + 1} / {totalSteps}
          </span>
        </div>

        <AnimatePresence mode="wait">
          {step === 0 && (
            <motion.div key="perfil" {...slide}>
              <StepHeading titulo="Bem-vinda à Prumo" subtitulo="Para começar, me conta: por onde você entra?" />
              <div className="grid gap-3 sm:grid-cols-3">
                <ChoiceCard icon={HeartHandshake} label="Sou gestante" selected={perfil === 'gestante'} onClick={() => escolherPerfil('gestante')} />
                <ChoiceCard icon={Baby} label="Sou mãe ou pai" selected={perfil === 'mae'} onClick={() => escolherPerfil('mae')} />
                <ChoiceCard icon={Stethoscope} label="Sou médico(a)" selected={perfil === 'medico'} onClick={() => escolherPerfil('medico')} />
              </div>
            </motion.div>
          )}

          {step === 1 && (
            <motion.div key="momento" {...slide}>
              {perfil === 'medico' ? (
                <>
                  <StepHeading titulo="Que bom te ver por aqui" subtitulo="Vamos direto ao ponto: como você quer olhar a trilha?" />
                  <div className="grid gap-3">
                    <ChoiceCard icon={CalendarClock} label="Acompanhar meus pacientes" selected={momento === 'gestante'} onClick={() => escolherMomento('gestante')} />
                    <ChoiceCard icon={Sprout} label="Conhecer a plataforma primeiro" selected={momento === 'ja-nasceu'} onClick={() => escolherMomento('ja-nasceu')} />
                  </div>
                </>
              ) : (
                <>
                  <StepHeading titulo="Em que ponto você está?" subtitulo="Assim a trilha já começa no lugar certo pra você." />
                  <div className="grid gap-3">
                    <ChoiceCard icon={Sprout} label="Estou planejando engravidar" selected={momento === 'planejando'} onClick={() => escolherMomento('planejando')} />
                    <ChoiceCard icon={CalendarClock} label="Estou grávida agora" selected={momento === 'gestante'} onClick={() => escolherMomento('gestante')} />
                    <ChoiceCard icon={Baby} label="Meu bebê já nasceu" selected={momento === 'ja-nasceu'} onClick={() => escolherMomento('ja-nasceu')} />
                  </div>
                </>
              )}
            </motion.div>
          )}

          {step === 2 && (
            <motion.div key="conta" {...slide}>
              <StepHeading titulo="Falta só criar sua conta" subtitulo="Rapidinho — e sua trilha já fica salva de verdade." />
              <div className="flex flex-col gap-3">
                <label htmlFor="nome" className="flex flex-col gap-1.5">
                  <span className="font-display text-sm font-semibold text-ink">Seu nome</span>
                  <input
                    id="nome"
                    type="text"
                    autoComplete="name"
                    value={nome}
                    maxLength={80}
                    onChange={(e) => {
                      setNome(e.target.value)
                      if (erro) setErro(null)
                    }}
                    placeholder="Como podemos te chamar?"
                    className="input"
                  />
                </label>
                <label htmlFor="email" className="flex flex-col gap-1.5">
                  <span className="font-display text-sm font-semibold text-ink">E-mail</span>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value)
                      if (erro) setErro(null)
                    }}
                    placeholder="voce@email.com"
                    className="input"
                  />
                </label>
                <label htmlFor="senha" className="flex flex-col gap-1.5">
                  <span className="font-display text-sm font-semibold text-ink">Senha</span>
                  <input
                    id="senha"
                    type="password"
                    autoComplete="new-password"
                    value={senha}
                    onChange={(e) => {
                      setSenha(e.target.value)
                      if (erro) setErro(null)
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && finalizar()}
                    placeholder="Pelo menos 8 caracteres"
                    className="input"
                  />
                </label>

                {perfil === 'medico' && (
                  <>
                    <label htmlFor="cpf" className="flex flex-col gap-1.5">
                      <span className="font-display text-sm font-semibold text-ink">CPF</span>
                      <input
                        id="cpf"
                        type="text"
                        inputMode="numeric"
                        autoComplete="off"
                        value={cpf}
                        onChange={(e) => {
                          setCpf(formatarCPF(e.target.value))
                          if (erro) setErro(null)
                        }}
                        placeholder="000.000.000-00"
                        className="input"
                      />
                    </label>
                    <div className="grid grid-cols-[1fr_5.5rem] gap-2">
                      <label htmlFor="crm" className="flex flex-col gap-1.5">
                        <span className="font-display text-sm font-semibold text-ink">CRM (opcional)</span>
                        <input
                          id="crm"
                          type="text"
                          inputMode="numeric"
                          value={crm}
                          onChange={(e) => {
                            setCrm(e.target.value.replace(/\D/g, '').slice(0, 6))
                            if (erro) setErro(null)
                          }}
                          placeholder="Número"
                          className="input"
                        />
                      </label>
                      <label htmlFor="crmUf" className="flex flex-col gap-1.5">
                        <span className="font-display text-sm font-semibold text-ink">UF</span>
                        <select
                          id="crmUf"
                          value={crmUf}
                          onChange={(e) => {
                            setCrmUf(e.target.value)
                            if (erro) setErro(null)
                          }}
                          className="input"
                        >
                          <option value="">--</option>
                          {UFS.map((uf) => (
                            <option key={uf} value={uf}>
                              {uf}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <p className="text-xs text-ink-mute">
                      Validamos seu CPF. O CRM é opcional por enquanto. Seus documentos
                      ficam protegidos e nunca são exibidos publicamente.
                    </p>
                  </>
                )}
              </div>

              {erro && (
                <p role="alert" className="mt-3 text-sm font-semibold text-warn">
                  {erro}
                </p>
              )}

              <div className="mt-lg">
                <Button size="lg" fullWidth loading={enviando} onClick={finalizar}>
                  {perfil === 'medico' ? 'Criar conta de médico' : 'Criar conta e ver minha trilha'}
                </Button>
              </div>
              <p className="mt-md text-center text-xs text-ink-mute">
                Ao continuar, você concorda com o cuidado que temos com seus dados.{' '}
                <Link to="/seguranca" className="font-semibold text-indigo underline">
                  Saiba mais
                </Link>
                .
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

function StepHeading({ titulo, subtitulo }: { titulo: string; subtitulo: string }) {
  return (
    <div className="mb-lg flex flex-col gap-2">
      <h1 className="text-3xl sm:text-4xl">{titulo}</h1>
      <p className="text-lg text-ink-soft">{subtitulo}</p>
    </div>
  )
}

interface ChoiceCardProps {
  icon: typeof HeartHandshake
  label: string
  selected: boolean
  onClick: () => void
}

function ChoiceCard({ icon: Icon, label, selected, onClick }: ChoiceCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        'flex items-center gap-4 rounded-2xl border-2 bg-paper p-lg text-left shadow-soft transition-[transform,border-color,box-shadow] duration-[var(--dur-fast)] ease-out hover:-translate-y-0.5 hover:shadow-lift',
        'sm:flex-col sm:items-start sm:gap-3',
        selected ? 'border-[var(--color-lilas)] shadow-glow' : 'border-transparent hover:border-[var(--color-lilas-soft)]',
      )}
    >
      <span className="grid size-12 shrink-0 place-items-center rounded-xl [background-image:var(--grad-brand-soft)] text-indigo">
        <Icon className="size-6" aria-hidden />
      </span>
      <span className="font-display text-lg font-semibold text-ink">{label}</span>
    </button>
  )
}
