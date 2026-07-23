import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { Share2, Copy, Check, QrCode, Link2, UserMinus, ShieldCheck } from 'lucide-react'
import { api } from '@/lib/api/client'
import { useAuth } from '@/lib/stores/auth'
import { Button } from '@/components/Button'

interface Vinculo {
  id: string
  nome: string
  papel: 'medico' | 'paciente'
  crianca?: string
}

export default function AppCompartilhar() {
  const papel = useAuth((s) => s.user?.papel)
  const isMedico = papel === 'medico'
  const [vinculos, setVinculos] = useState<Vinculo[]>([])
  const [loading, setLoading] = useState(true)

  async function recarregar() {
    try {
      const { vinculos: v } = await api.get<{ vinculos: Vinculo[] }>('/vinculos')
      setVinculos(v)
    } catch {
      /* keep list */
    }
  }

  useEffect(() => {
    recarregar().finally(() => setLoading(false))
  }, [])

  return (
    <div className="flex flex-col gap-lg">
      <header className="flex flex-col gap-1">
        <p className="u-eyebrow">Conexão segura</p>
        <h1 className="text-3xl sm:text-4xl">
          {isMedico ? 'Conecte-se aos seus pacientes' : 'Compartilhe com seu médico'}
        </h1>
        <p className="text-ink-soft">
          {isMedico
            ? 'Gere um convite (link ou QR Code) para o paciente confirmar — ou abra o link que ele te enviar. Depois você acompanha exames e prontuário dele pela Prumo.'
            : 'Gere um link ou QR Code e mostre para o seu médico. Ao conectar, ele passa a ver seus exames e o histórico do bebê — e você pode desfazer quando quiser.'}
        </p>
      </header>

      <GerarConvite isMedico={isMedico} />

      <section className="rounded-2xl border border-line bg-paper p-lg shadow-soft">
        <h2 className="inline-flex items-center gap-2 text-lg">
          <ShieldCheck className="size-5 text-indigo" aria-hidden />
          {isMedico ? 'Pacientes conectados' : 'Médicos conectados'}
        </h2>
        {loading ? (
          <p className="mt-md text-sm text-ink-mute">Carregando…</p>
        ) : vinculos.length === 0 ? (
          <p className="mt-md text-sm text-ink-mute">Ninguém conectado ainda. Gere um convite acima para começar.</p>
        ) : (
          <ul className="mt-md flex flex-col gap-2">
            {vinculos.map((v) => (
              <li key={v.id} className="flex items-center justify-between gap-3 rounded-xl bg-paper-2 px-3 py-2.5">
                <span className="inline-flex items-center gap-2">
                  <span className="grid size-8 place-items-center rounded-full [background-image:var(--grad-brand-soft)] text-xs font-bold text-indigo">
                    {v.nome?.charAt(0).toUpperCase() ?? '?'}
                  </span>
                  <span className="font-semibold text-ink">{v.nome || 'Sem nome'}</span>
                </span>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await api.del(`/vinculos/${v.id}`)
                      setVinculos((prev) => prev.filter((x) => x.id !== v.id))
                    } catch {
                      /* ignore */
                    }
                  }}
                  className="inline-flex items-center gap-1 rounded-pill px-3 py-1.5 text-sm font-semibold text-warn hover:bg-paper"
                >
                  <UserMinus className="size-4" aria-hidden /> Desconectar
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function GerarConvite({ isMedico }: { isMedico: boolean }) {
  const [url, setUrl] = useState('')
  const [qr, setQr] = useState('')
  const [gerando, setGerando] = useState(false)
  const [copiado, setCopiado] = useState(false)

  async function gerar() {
    setGerando(true)
    try {
      const { path } = await api.post<{ token: string; path: string }>('/vinculos/convite')
      const full = `${window.location.origin}${path}`
      setUrl(full)
      setQr(await QRCode.toDataURL(full, { margin: 1, width: 240 }))
    } catch {
      /* ignore */
    } finally {
      setGerando(false)
    }
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(url)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 1800)
    } catch {
      /* clipboard may be blocked */
    }
  }

  return (
    <section className="rounded-2xl border border-line bg-paper p-lg shadow-soft">
      <h2 className="inline-flex items-center gap-2 text-lg">
        <Share2 className="size-5 text-indigo" aria-hidden />
        Gerar convite de conexão
      </h2>

      {!url ? (
        <>
          <p className="mt-1 text-sm text-ink-soft">
            {isMedico
              ? 'Crie um link/QR e peça para o paciente abrir e confirmar.'
              : 'Crie um link/QR e mostre para o seu médico (ele escaneia ou abre).'}
          </p>
          <div className="mt-md">
            <Button loading={gerando} iconLeft={<QrCode className="size-4" aria-hidden />} onClick={gerar}>
              Gerar link e QR Code
            </Button>
          </div>
        </>
      ) : (
        <div className="mt-md flex flex-col items-center gap-md sm:flex-row sm:items-start">
          {qr && (
            <img src={qr} alt="QR Code do convite" className="size-40 rounded-xl border border-line bg-white p-2" />
          )}
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <p className="text-sm font-semibold text-ink">Seu link de conexão</p>
            <div className="flex items-center gap-2 rounded-xl bg-paper-2 p-2">
              <Link2 className="size-4 shrink-0 text-ink-mute" aria-hidden />
              <span className="truncate text-sm text-ink-soft">{url}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="md" variant="secondary" iconLeft={copiado ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />} onClick={copiar}>
                {copiado ? 'Copiado!' : 'Copiar link'}
              </Button>
              <Button size="md" variant="ghost" onClick={gerar}>
                Gerar outro
              </Button>
            </div>
            <p className="text-xs text-ink-mute">O convite vale por 7 dias e serve para uma conexão.</p>
          </div>
        </div>
      )}
    </section>
  )
}
