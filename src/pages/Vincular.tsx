import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Link2, Check, ShieldCheck } from 'lucide-react'
import { api } from '@/lib/api/client'
import { useAuth } from '@/lib/stores/auth'
import { Logo } from '@/components/Logo'
import { Button } from '@/components/Button'
import { Blob } from '@/components/Blob'

interface ConviteInfo {
  criadorNome: string
  criadorPapel: 'gestante' | 'mae' | 'pai' | 'medico'
  tipo: 'medico' | 'coparent'
  aceitaPor: 'medico' | 'paciente' | 'familia'
}

/**
 * Confirmation screen for a share link/QR. The person opening it sees who wants
 * to connect and confirms. Requires being logged in — a clear path is offered
 * when they aren't (a common stumbling point for less tech-savvy users).
 */
export default function VincularPage() {
  const { token } = useParams<{ token: string }>()
  const status = useAuth((s) => s.status)
  const bootstrap = useAuth((s) => s.bootstrap)
  const user = useAuth((s) => s.user)
  const navigate = useNavigate()

  const [info, setInfo] = useState<ConviteInfo | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [aceitando, setAceitando] = useState(false)
  const [feito, setFeito] = useState(false)

  useEffect(() => {
    void bootstrap()
  }, [bootstrap])

  useEffect(() => {
    if (status !== 'authed' || !token) return
    api
      .get<ConviteInfo>(`/vinculos/convite/${token}`)
      .then(setInfo)
      .catch((e) => setErro(e instanceof Error ? e.message : 'Convite inválido.'))
      .finally(() => setCarregando(false))
  }, [status, token])

  async function aceitar() {
    setErro(null)
    setAceitando(true)
    try {
      await api.post(`/vinculos/aceitar/${token}`)
      setFeito(true)
      setTimeout(() => navigate('/app'), 1400)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui conectar.')
    } finally {
      setAceitando(false)
    }
  }

  const isCoparent = info?.tipo === 'coparent'
  const papelLabel = isCoparent
    ? 'outro responsável'
    : info?.criadorPapel === 'medico'
      ? 'médico(a)'
      : 'paciente'

  return (
    <div className="relative grid min-h-[80vh] place-items-center overflow-hidden px-md py-2xl">
      <Blob variant="a" intensity={0.4} className="-left-20 top-10 size-96" />

      <div className="w-full max-w-md rounded-2xl border border-line bg-paper p-lg text-center shadow-lift sm:p-xl">
        <Logo variant="symbol" className="mx-auto h-12" />

        {status === 'guest' ? (
          <>
            <h1 className="mt-md text-2xl">Entre para confirmar a conexão</h1>
            <p className="mt-1 text-ink-soft">Você precisa estar na sua conta Prumo para aceitar este convite.</p>
            <div className="mt-lg flex flex-col gap-2">
              <Link to="/entrar" className="inline-flex h-12 items-center justify-center rounded-pill px-6 font-display font-semibold text-white [background-image:var(--grad-brand)]">
                Entrar
              </Link>
              <Link to="/onboarding" className="text-sm font-semibold text-indigo underline underline-offset-4">
                Ainda não tenho conta
              </Link>
            </div>
            <p className="mt-md text-xs text-ink-mute">Depois de entrar, abra o link do convite de novo.</p>
          </>
        ) : feito ? (
          <>
            <span className="mx-auto mt-md grid size-14 place-items-center rounded-full [background-image:var(--grad-brand)] text-white">
              <Check className="size-7" aria-hidden />
            </span>
            <h1 className="mt-md text-2xl">Conectado! 🎉</h1>
            <p className="mt-1 text-ink-soft">Levando você para a sua área…</p>
          </>
        ) : carregando ? (
          <p className="mt-lg text-ink-mute">Carregando convite…</p>
        ) : erro ? (
          <>
            <h1 className="mt-md text-2xl">Convite indisponível</h1>
            <p className="mt-1 text-ink-soft">{erro}</p>
            <Link to="/app" className="mt-lg inline-block font-display font-semibold text-indigo underline underline-offset-4">
              Ir para minha área
            </Link>
          </>
        ) : info ? (
          <>
            <span className="mx-auto mt-md grid size-12 place-items-center rounded-full [background-image:var(--grad-brand-soft)] text-indigo">
              <Link2 className="size-6" aria-hidden />
            </span>
            <h1 className="mt-md text-2xl">
              {info.criadorNome} quer se conectar
            </h1>
            <p className="mt-1 text-ink-soft">
              {isCoparent
                ? `${papelLabel} · Ao aceitar, você passa a acompanhar a mesma jornada (exames, prontuário, caderninho e trilha).`
                : `${papelLabel} · Ao aceitar, vocês compartilham o acompanhamento pela Prumo.`}
              {info.aceitaPor === 'medico' && user?.papel !== 'medico' && ' Este convite é para um médico.'}
              {info.aceitaPor === 'paciente' && user?.papel === 'medico' && ' Este convite é para o paciente.'}
              {info.aceitaPor === 'familia' && user?.papel === 'medico' && ' Este convite é para o outro responsável, não para um médico.'}
            </p>
            <div className="mt-lg">
              <Button size="lg" fullWidth loading={aceitando} iconLeft={<ShieldCheck className="size-5" aria-hidden />} onClick={aceitar}>
                Aceitar e conectar
              </Button>
            </div>
            <Link to="/app" className="mt-md inline-block text-sm text-ink-mute hover:text-ink">
              Agora não
            </Link>
          </>
        ) : null}
      </div>
    </div>
  )
}
