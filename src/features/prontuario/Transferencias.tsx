import { useCallback, useEffect, useState } from 'react'
import { ArrowRightLeft, Check, Clock, Download, ShieldCheck, X } from 'lucide-react'
import { api } from '@/lib/api/client'
import { useAuth } from '@/lib/stores/auth'
import { criancaQuery, useMedicoContext } from '@/lib/stores/medico-context'
import { Button } from '@/components/Button'
import { AlertaErro } from '@/components/AlertaErro'
import { Sheet } from '@/components/Sheet'
import { cn } from '@/lib/cn'

interface Transferencia {
  id: string
  deMedicoNome: string
  paraMedicoEmail: string
  paraMedicoNome: string
  escopo: string[]
  motivo: string
  estado: 'pendente' | 'consentida' | 'recusada' | 'revogada' | 'baixada'
  consentidoEm: string | null
  baixadaEm: string | null
  expiraEm: string | null
  criadaEm: string | null
}

const ESTADO: Record<Transferencia['estado'], { rotulo: string; classe: string }> = {
  pendente: { rotulo: 'Aguardando autorização', classe: 'text-warn-ink' },
  consentida: { rotulo: 'Autorizada', classe: 'text-success-ink' },
  recusada: { rotulo: 'Recusada', classe: 'text-ink-mute' },
  revogada: { rotulo: 'Revogada', classe: 'text-ink-mute' },
  baixada: { rotulo: 'Recebida pelo colega', classe: 'text-success-ink' },
}

const ESCOPOS = [
  { id: 'prontuario', rotulo: 'Prontuário e história clínica' },
  { id: 'consultas', rotulo: 'Consultas' },
  { id: 'exames', rotulo: 'Exames' },
  { id: 'medidas', rotulo: 'Medidas e biometria' },
  { id: 'vacinas', rotulo: 'Vacinas' },
] as const

/**
 * Passar o caso para o próximo médico.
 *
 * Três atos, e a ordem importa: o médico **pede**, a responsável **autoriza**, e
 * só então o colega baixa. Nada de link antes do consentimento — antes disso não
 * existe token, então não há como vazar o que ainda não foi permitido.
 *
 * A mesma tela serve aos dois lados porque é a mesma lista; o que muda é quem
 * pode agir sobre cada item.
 */
export function Transferencias() {
  const papel = useAuth((s) => s.user?.papel)
  const criancaAtiva = useMedicoContext((s) => s.criancaAtiva)
  const ehMedico = papel === 'medico'

  const [lista, setLista] = useState<Transferencia[]>([])
  const [erro, setErro] = useState<string | null>(null)
  const [abrindo, setAbrindo] = useState(false)
  const [email, setEmail] = useState('')
  const [nome, setNome] = useState('')
  const [motivo, setMotivo] = useState('')
  const [escopo, setEscopo] = useState<string[]>(['prontuario', 'consultas', 'exames'])
  const [ocupado, setOcupado] = useState(false)
  const [linkGerado, setLinkGerado] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    try {
      const d = await api.get<{ transferencias: Transferencia[] }>(
        `/transferencias${criancaQuery(criancaAtiva)}`,
      )
      setLista(d.transferencias)
    } catch {
      /* lista vazia é um estado aceitável aqui */
    }
  }, [criancaAtiva])

  useEffect(() => {
    void carregar()
  }, [carregar])

  async function pedir() {
    setErro(null)
    setOcupado(true)
    try {
      await api.post(`/transferencias${criancaQuery(criancaAtiva)}`, {
        paraMedicoEmail: email,
        paraMedicoNome: nome,
        motivo,
        escopo,
      })
      setAbrindo(false)
      setEmail('')
      setNome('')
      setMotivo('')
      await carregar()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível pedir a transferência.')
    } finally {
      setOcupado(false)
    }
  }

  async function responder(id: string, aprovar: boolean) {
    setErro(null)
    try {
      const d = await api.post<{ path?: string }>(`/transferencias/${id}/consentir`, { aprovar })
      if (aprovar && d.path) setLinkGerado(`${window.location.origin}${d.path}`)
      await carregar()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível responder.')
    }
  }

  async function revogar(id: string) {
    try {
      await api.post(`/transferencias/${id}/revogar`, {})
      await carregar()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível revogar.')
    }
  }

  return (
    <section className="rounded-2xl border border-line bg-paper p-lg shadow-soft">
      <h2 className="inline-flex items-center gap-2 text-lg">
        <ArrowRightLeft className="size-5 text-indigo" aria-hidden />
        Passar para outro médico
      </h2>
      <p className="mt-1 text-sm text-ink-soft">
        {ehMedico
          ? 'Peça para enviar o caso a um colega. A responsável autoriza antes de qualquer coisa sair.'
          : 'Quando um médico pedir para passar seu prontuário adiante, a decisão é sua.'}
      </p>

      {erro && <AlertaErro className="mt-2">{erro}</AlertaErro>}

      {ehMedico && (
        <Button
          className="mt-md"
          variant="secondary"
          size="sm"
          iconLeft={<ArrowRightLeft className="size-4" aria-hidden />}
          onClick={() => setAbrindo(true)}
        >
          Pedir transferência
        </Button>
      )}

      {lista.length > 0 && (
        <ul className="mt-md flex flex-col gap-2">
          {lista.map((t) => (
            <li key={t.id} className="rounded-xl border border-line bg-paper-2 p-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-display text-sm font-semibold text-ink">
                  {t.paraMedicoNome || t.paraMedicoEmail}
                </p>
                <span className={cn('text-xs font-semibold', ESTADO[t.estado].classe)}>
                  {ESTADO[t.estado].rotulo}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-ink-mute">
                Pedido por {t.deMedicoNome}
                {t.motivo && ` · ${t.motivo}`}
              </p>
              <p className="mt-0.5 text-xs text-ink-mute">
                {t.escopo.map((e) => ESCOPOS.find((x) => x.id === e)?.rotulo ?? e).join(' · ')}
              </p>

              <div className="mt-2 flex flex-wrap gap-2">
                {/* Só a família autoriza — o solicitante não aprova o próprio pedido. */}
                {!ehMedico && t.estado === 'pendente' && (
                  <>
                    <Button
                      size="sm"
                      iconLeft={<Check className="size-4" aria-hidden />}
                      onClick={() => responder(t.id, true)}
                    >
                      Autorizar
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      iconLeft={<X className="size-4" aria-hidden />}
                      onClick={() => responder(t.id, false)}
                    >
                      Recusar
                    </Button>
                  </>
                )}
                {(t.estado === 'consentida' || t.estado === 'baixada') && (
                  <Button size="sm" variant="ghost" onClick={() => revogar(t.id)}>
                    Revogar acesso
                  </Button>
                )}
                {t.estado === 'baixada' && t.baixadaEm && (
                  <span className="inline-flex items-center gap-1 text-xs text-ink-mute">
                    <Download className="size-3" aria-hidden />
                    Baixado em {new Date(t.baixadaEm).toLocaleDateString('pt-BR')}
                  </span>
                )}
                {t.estado === 'consentida' && t.expiraEm && (
                  <span className="inline-flex items-center gap-1 text-xs text-ink-mute">
                    <Clock className="size-3" aria-hidden />
                    Expira em {new Date(t.expiraEm).toLocaleDateString('pt-BR')}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* O link aparece UMA vez, no momento em que a família autoriza. */}
      <Sheet
        aberto={Boolean(linkGerado)}
        onFechar={() => setLinkGerado(null)}
        titulo="Link gerado"
      >
        <p className="text-sm text-ink-soft">
          Entregue este link ao médico. Ele precisa estar logado como profissional para abrir, e o
          acesso expira em 7 dias. Você pode revogar quando quiser.
        </p>
        <code className="mt-3 block break-all rounded-xl bg-paper-2 p-3 text-xs text-ink">
          {linkGerado}
        </code>
        <Button
          className="mt-3"
          size="sm"
          variant="secondary"
          onClick={() => linkGerado && void navigator.clipboard?.writeText(linkGerado)}
        >
          Copiar link
        </Button>
      </Sheet>

      <Sheet aberto={abrindo} onFechar={() => setAbrindo(false)} titulo="Pedir transferência">
        <div className="flex flex-col gap-3">
          <label className="text-sm">
            E-mail do colega
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              className="input mt-1"
              placeholder="colega@exemplo.com"
            />
          </label>
          <label className="text-sm">
            Nome (opcional)
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="input mt-1"
              maxLength={80}
            />
          </label>
          <label className="text-sm">
            Motivo (opcional)
            <input
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              className="input mt-1"
              maxLength={300}
              placeholder="Ex.: acompanhamento passa para a pediatria."
            />
          </label>

          <fieldset>
            <legend className="text-sm font-semibold text-ink">O que vai junto</legend>
            <div className="mt-1 flex flex-col gap-1">
              {ESCOPOS.map((e) => (
                <label key={e.id} className="flex items-center gap-2 text-sm text-ink-soft">
                  <input
                    type="checkbox"
                    checked={escopo.includes(e.id)}
                    onChange={(ev) =>
                      setEscopo((atual) =>
                        ev.target.checked ? [...atual, e.id] : atual.filter((x) => x !== e.id),
                      )
                    }
                    className="size-4 accent-[var(--color-lilas)]"
                  />
                  {e.rotulo}
                </label>
              ))}
            </div>
          </fieldset>

          <p className="inline-flex items-start gap-1.5 text-xs text-ink-mute">
            <ShieldCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            Suas notas privadas e as avaliações marcadas como “só para mim” não vão no pacote.
          </p>

          <Button loading={ocupado} onClick={pedir} disabled={!email.trim()}>
            Pedir autorização
          </Button>
        </div>
      </Sheet>
    </section>
  )
}
