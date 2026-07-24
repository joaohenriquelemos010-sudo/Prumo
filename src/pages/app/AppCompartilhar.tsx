import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { Share2, Copy, Check, QrCode, Link2, UserMinus, ShieldCheck, Users, Stethoscope, X } from 'lucide-react'
import { api } from '@/lib/api/client'
import { useAuth } from '@/lib/stores/auth'
import { Button } from '@/components/Button'

interface Vinculo {
  id: string
  nome: string
  papel: 'medico' | 'paciente'
  crianca?: string
}

interface Responsavel {
  id: string
  nome: string
}

export default function AppCompartilhar() {
  const papel = useAuth((s) => s.user?.papel)
  const isMedico = papel === 'medico'
  return isMedico ? <MedicoView /> : <FamiliaView />
}

/* ---------------------------------------------------------------- Family --- */

function FamiliaView() {
  const [vinculos, setVinculos] = useState<Vinculo[]>([])
  const [responsaveis, setResponsaveis] = useState<Responsavel[]>([])
  const [minhaCrianca, setMinhaCrianca] = useState<string>('')
  const [loading, setLoading] = useState(true)

  async function recarregar() {
    try {
      const [{ vinculos: v }, familia] = await Promise.all([
        api.get<{ vinculos: Vinculo[] }>('/vinculos'),
        api.get<{ minhaCrianca: string; responsaveis: Responsavel[] }>('/familia'),
      ])
      setVinculos(v)
      setResponsaveis(familia.responsaveis)
      setMinhaCrianca(familia.minhaCrianca)
    } catch {
      /* keep list */
    }
  }

  useEffect(() => {
    recarregar().finally(() => setLoading(false))
  }, [])

  async function desconectarMedico(id: string) {
    try {
      await api.del(`/vinculos/${id}`)
      setVinculos((prev) => prev.filter((x) => x.id !== id))
    } catch {
      /* ignore */
    }
  }

  async function desvincularResponsavel(id: string) {
    try {
      await api.del(`/familia/${minhaCrianca}/coresponsavel/${id}`)
      setResponsaveis((prev) => prev.filter((x) => x.id !== id))
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="flex flex-col gap-lg">
      <header className="flex flex-col gap-1">
        <p className="u-eyebrow">Conexão segura</p>
        <h1 className="text-3xl sm:text-4xl">Compartilhe com quem cuida de vocês</h1>
        <p className="text-ink-soft">
          Conecte seu médico e o outro responsável (mãe/pai). Quem você conecta passa a acompanhar exames,
          prontuário, caderninho e trilha — e você pode desfazer quando quiser.
        </p>
      </header>

      <GerarConvite
        titulo="Conectar meu médico"
        descricao="Crie um link/QR e mostre para o seu médico (ele escaneia ou abre e confirma)."
      />

      <GerarConvite
        tipo="coparent"
        titulo="Convidar o outro responsável (mãe/pai)"
        descricao="Crie um link/QR para o outro responsável acessar a mesma jornada do bebê."
      />

      <SolicitacoesParaAprovar onChange={recarregar} />

      <ListaConexoes
        titulo="Médicos conectados"
        icon={Stethoscope}
        loading={loading}
        vazio="Nenhum médico conectado ainda. Gere um convite acima para começar."
        itens={vinculos.map((v) => ({ id: v.id, nome: v.nome, onRemover: () => desconectarMedico(v.id), rotuloRemover: 'Desconectar' }))}
      />

      <ListaConexoes
        titulo="Responsáveis"
        icon={Users}
        loading={loading}
        vazio="Nenhum outro responsável conectado. Use o convite acima para incluir a mãe ou o pai."
        itens={responsaveis.map((r) => ({ id: r.id, nome: r.nome, onRemover: () => desvincularResponsavel(r.id), rotuloRemover: 'Desvincular' }))}
      />
    </div>
  )
}

/* ---------------------------------------------------------------- Doctor --- */

function MedicoView() {
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

  async function desconectar(id: string) {
    try {
      await api.del(`/vinculos/${id}`)
      setVinculos((prev) => prev.filter((x) => x.id !== id))
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="flex flex-col gap-lg">
      <header className="flex flex-col gap-1">
        <p className="u-eyebrow">Conexão segura</p>
        <h1 className="text-3xl sm:text-4xl">Conecte-se aos seus pacientes</h1>
        <p className="text-ink-soft">
          Gere um convite (link ou QR Code) para o paciente confirmar — ou abra o link que ele te enviar.
          Depois você acompanha exames e prontuário dele pela Prumo.
        </p>
      </header>

      <GerarConvite
        titulo="Convidar um paciente"
        descricao="Crie um link/QR e peça para o paciente abrir e confirmar."
      />

      <ListaConexoes
        titulo="Pacientes conectados"
        icon={ShieldCheck}
        loading={loading}
        vazio="Ninguém conectado ainda. Gere um convite acima para começar."
        itens={vinculos.map((v) => ({ id: v.id, nome: v.nome, onRemover: () => desconectar(v.id), rotuloRemover: 'Desconectar' }))}
      />

      <CompartilharComOutroMedico pacientes={vinculos} />
    </div>
  )
}

/* ------------------------------------------------------------ Components --- */

function GerarConvite({ tipo, titulo, descricao }: { tipo?: 'coparent'; titulo: string; descricao: string }) {
  const [url, setUrl] = useState('')
  const [qr, setQr] = useState('')
  const [gerando, setGerando] = useState(false)
  const [copiado, setCopiado] = useState(false)

  async function gerar() {
    setGerando(true)
    try {
      const { path } = await api.post<{ token: string; path: string }>('/vinculos/convite', tipo ? { tipo } : {})
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
        {titulo}
      </h2>

      {!url ? (
        <>
          <p className="mt-1 text-sm text-ink-soft">{descricao}</p>
          <div className="mt-md">
            <Button loading={gerando} iconLeft={<QrCode className="size-4" aria-hidden />} onClick={gerar}>
              Gerar link e QR Code
            </Button>
          </div>
        </>
      ) : (
        <div className="mt-md flex flex-col items-center gap-md sm:flex-row sm:items-start">
          {qr && <img src={qr} alt="QR Code do convite" className="size-40 rounded-xl border border-line bg-white p-2" />}
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

interface ItemConexao {
  id: string
  nome: string
  onRemover: () => void
  rotuloRemover: string
}

function ListaConexoes({
  titulo,
  icon: Icon,
  loading,
  vazio,
  itens,
}: {
  titulo: string
  icon: typeof Users
  loading: boolean
  vazio: string
  itens: ItemConexao[]
}) {
  return (
    <section className="rounded-2xl border border-line bg-paper p-lg shadow-soft">
      <h2 className="inline-flex items-center gap-2 text-lg">
        <Icon className="size-5 text-indigo" aria-hidden />
        {titulo}
      </h2>
      {loading ? (
        <p className="mt-md text-sm text-ink-mute">Carregando…</p>
      ) : itens.length === 0 ? (
        <p className="mt-md text-sm text-ink-mute">{vazio}</p>
      ) : (
        <ul className="mt-md flex flex-col gap-2">
          {itens.map((it) => (
            <li key={it.id} className="flex items-center justify-between gap-3 rounded-xl bg-paper-2 px-3 py-2.5">
              <span className="inline-flex items-center gap-2">
                <span className="grid size-8 place-items-center rounded-full [background-image:var(--grad-brand-soft)] text-xs font-bold text-indigo">
                  {it.nome?.charAt(0).toUpperCase() ?? '?'}
                </span>
                <span className="font-semibold text-ink">{it.nome || 'Sem nome'}</span>
              </span>
              <button
                type="button"
                onClick={it.onRemover}
                className="inline-flex items-center gap-1 rounded-pill px-3 py-1.5 text-sm font-semibold text-warn hover:bg-paper"
              >
                <UserMinus className="size-4" aria-hidden /> {it.rotuloRemover}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/* ----------------------------------------- Doctor → doctor share request --- */

interface SolicitacaoComp {
  id: string
  criancaNome: string
  medicoOrigemNome: string
  medicoDestinoNome: string
  medicoDestinoEmail: string
  especialidadeDestino: string
  status: 'pendente' | 'aprovada' | 'recusada'
}

function CompartilharComOutroMedico({ pacientes }: { pacientes: Vinculo[] }) {
  const [criancaId, setCriancaId] = useState('')
  const [email, setEmail] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [msg, setMsg] = useState<{ tom: 'ok' | 'erro'; texto: string } | null>(null)
  const [enviadas, setEnviadas] = useState<SolicitacaoComp[]>([])

  async function carregar() {
    try {
      const { enviadas: e } = await api.get<{ enviadas: SolicitacaoComp[] }>('/compartilhamentos')
      setEnviadas(e)
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    carregar()
  }, [])

  async function enviar() {
    setMsg(null)
    if (!criancaId) {
      setMsg({ tom: 'erro', texto: 'Escolha o paciente.' })
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setMsg({ tom: 'erro', texto: 'Informe o e-mail do outro médico.' })
      return
    }
    setEnviando(true)
    try {
      await api.post('/compartilhamentos', { criancaId, email: email.trim() })
      setMsg({ tom: 'ok', texto: 'Solicitação enviada. O responsável precisa aprovar.' })
      setEmail('')
      setCriancaId('')
      carregar()
    } catch (e) {
      setMsg({ tom: 'erro', texto: e instanceof Error ? e.message : 'Não consegui enviar.' })
    } finally {
      setEnviando(false)
    }
  }

  const statusLabel: Record<SolicitacaoComp['status'], string> = {
    pendente: 'Aguardando aprovação do responsável',
    aprovada: 'Aprovada — médico conectado',
    recusada: 'Recusada pelo responsável',
  }

  return (
    <section className="rounded-2xl border border-line bg-paper p-lg shadow-soft">
      <h2 className="inline-flex items-center gap-2 text-lg">
        <Stethoscope className="size-5 text-indigo" aria-hidden />
        Compartilhar paciente com outro médico
      </h2>
      <p className="mt-1 text-sm text-ink-soft">
        Indique o e-mail de outro médico da Prumo. O responsável (mãe/pai) recebe a solicitação para aprovar,
        vendo para qual médico e qual especialidade o acesso será liberado.
      </p>

      <div className="mt-md flex flex-col gap-2">
        <select value={criancaId} onChange={(e) => setCriancaId(e.target.value)} className="input">
          <option value="">Escolha o paciente…</option>
          {pacientes.map((p) => (
            <option key={p.id} value={p.crianca}>
              {p.nome || 'Paciente'}
            </option>
          ))}
        </select>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@do-outro-medico.com"
            className="input"
          />
          <Button size="md" loading={enviando} onClick={enviar}>
            Solicitar
          </Button>
        </div>
        {msg && (
          <p role="alert" className={`text-sm font-semibold ${msg.tom === 'ok' ? 'text-success' : 'text-warn'}`}>
            {msg.texto}
          </p>
        )}
        {pacientes.length === 0 && (
          <p className="text-xs text-ink-mute">Conecte um paciente primeiro para poder compartilhá-lo.</p>
        )}
      </div>

      {enviadas.length > 0 && (
        <ul className="mt-md flex flex-col gap-2">
          {enviadas.map((s) => (
            <li key={s.id} className="rounded-xl bg-paper-2 px-3 py-2.5 text-sm">
              <p className="font-semibold text-ink">
                {s.medicoDestinoNome || s.medicoDestinoEmail} · {s.especialidadeDestino || 'Especialidade não informada'}
              </p>
              <p className="text-ink-soft">
                Paciente: {s.criancaNome || 'Bebê'} — {statusLabel[s.status]}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function SolicitacoesParaAprovar({ onChange }: { onChange: () => void }) {
  const [pendentes, setPendentes] = useState<SolicitacaoComp[]>([])
  const [processando, setProcessando] = useState<string | null>(null)

  async function carregar() {
    try {
      const { pendentes: p } = await api.get<{ pendentes: SolicitacaoComp[] }>('/compartilhamentos')
      setPendentes(p)
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    carregar()
  }, [])

  async function resolver(id: string, acao: 'aprovar' | 'recusar') {
    setProcessando(id)
    try {
      await api.post(`/compartilhamentos/${id}/${acao}`)
      setPendentes((prev) => prev.filter((x) => x.id !== id))
      if (acao === 'aprovar') onChange()
    } catch {
      /* ignore */
    } finally {
      setProcessando(null)
    }
  }

  if (pendentes.length === 0) return null

  return (
    <section className="rounded-2xl border border-[var(--color-lilas-soft)] bg-paper p-lg shadow-soft">
      <h2 className="inline-flex items-center gap-2 text-lg">
        <Stethoscope className="size-5 text-indigo" aria-hidden />
        Solicitações de compartilhamento
      </h2>
      <p className="mt-1 text-sm text-ink-soft">
        Um médico pediu para compartilhar a jornada do bebê com outro médico. Aprove apontando para quem vai o acesso.
      </p>
      <ul className="mt-md flex flex-col gap-2">
        {pendentes.map((s) => (
          <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-paper-2 px-3 py-2.5">
            <div className="min-w-0">
              <p className="font-semibold text-ink">
                {s.medicoDestinoNome || s.medicoDestinoEmail} · {s.especialidadeDestino || 'Especialidade não informada'}
              </p>
              <p className="text-sm text-ink-soft">
                Solicitado por {s.medicoOrigemNome || 'médico'} · paciente {s.criancaNome || 'Bebê'}
              </p>
            </div>
            <div className="flex gap-2">
              <Button size="md" loading={processando === s.id} iconLeft={<Check className="size-4" aria-hidden />} onClick={() => resolver(s.id, 'aprovar')}>
                Aprovar
              </Button>
              <Button size="md" variant="ghost" iconLeft={<X className="size-4" aria-hidden />} onClick={() => resolver(s.id, 'recusar')}>
                Recusar
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
