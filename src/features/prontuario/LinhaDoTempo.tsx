import { useState } from 'react'
import { FileHeart, Plus, PencilLine, ShieldCheck, Lock, CornerDownRight } from 'lucide-react'
import { api } from '@/lib/api/client'
import { useAuth } from '@/lib/stores/auth'
import { criancaQuery, useMedicoContext } from '@/lib/stores/medico-context'
import { Button } from '@/components/Button'
import { AlertaErro } from '@/components/AlertaErro'
import { cn } from '@/lib/cn'

export interface Evolucao {
  id: string
  ordem: number
  tipo: 'admissao' | 'consulta' | 'evolucao' | 'resultado' | 'transferencia' | 'intercorrencia'
  em: string
  autorId: string
  autorNome: string
  autorPapel: string
  autorCrm?: string
  autorEspecialidade?: string
  texto: string
  consultaId?: string
  retificadaPor?: string
  retificacaoDe?: string
  visibilidade?: 'familia' | 'equipe'
  hash?: string
}

const ROTULO_TIPO: Record<Evolucao['tipo'], string> = {
  admissao: 'Admissão',
  consulta: 'Consulta',
  evolucao: 'Evolução',
  resultado: 'Resultado',
  transferencia: 'Transferência',
  intercorrencia: 'Intercorrência',
}

/**
 * A história clínica.
 *
 * O que mudou em relação à versão anterior não é visual, é o contrato: um
 * prontuário **não se edita e não se apaga**. Onde havia lápis e lixeira agora
 * há *Retificar* — que escreve uma entrada nova apontando para a antiga, e
 * deixa as duas visíveis.
 *
 * Parece mais burocrático, e é: é assim que um prontuário funciona no papel há
 * um século, e é o que a Res. CFM 1.821/2007 e o nível NGS2 da SBIS cobram de
 * quem quer ser 100% digital. A entrada corrigida continua na tela, esmaecida e
 * ligada à correção, porque o que se registrou na hora também é história.
 */
export function LinhaDoTempo({
  evolucoes,
  onMudou,
}: {
  evolucoes: Evolucao[]
  onMudou: (lista: Evolucao[]) => void
}) {
  const userId = useAuth((s) => s.user?.id)
  const papel = useAuth((s) => s.user?.papel)
  const criancaAtiva = useMedicoContext((s) => s.criancaAtiva)

  const [texto, setTexto] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [retificandoId, setRetificandoId] = useState<string | null>(null)
  const [textoRetificacao, setTextoRetificacao] = useState('')

  const porId = new Map(evolucoes.map((e) => [e.id, e]))

  async function anotar() {
    setErro(null)
    if (texto.trim().length < 2) {
      setErro('Escreva a anotação.')
      return
    }
    setSalvando(true)
    try {
      const d = await api.post<{ evolucoes: Evolucao[] }>(
        `/prontuario/evento${criancaQuery(criancaAtiva)}`,
        { texto },
      )
      onMudou(d.evolucoes)
      setTexto('')
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui salvar a anotação.')
    } finally {
      setSalvando(false)
    }
  }

  async function retificar(id: string) {
    if (textoRetificacao.trim().length < 2) return
    setErro(null)
    try {
      const d = await api.post<{ evolucoes: Evolucao[] }>(
        `/prontuario/evolucao/${id}/retificacao${criancaQuery(criancaAtiva)}`,
        { texto: textoRetificacao },
      )
      onMudou(d.evolucoes)
      setRetificandoId(null)
      setTextoRetificacao('')
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui registrar a retificação.')
    }
  }

  return (
    <section className="rounded-2xl border border-line bg-paper p-lg shadow-soft">
      <h2 className="inline-flex items-center gap-2 text-lg">
        <FileHeart className="size-5 text-indigo" aria-hidden />
        História clínica
      </h2>
      <p className="mt-1 text-sm text-ink-soft">
        Cada entrada fica registrada com autor e data. Correções entram como retificação — nada
        é apagado.
      </p>

      <div className="mt-md flex flex-col gap-2 sm:flex-row">
        <input
          value={texto}
          onChange={(e) => {
            setTexto(e.target.value)
            if (erro) setErro(null)
          }}
          onKeyDown={(e) => e.key === 'Enter' && anotar()}
          placeholder="Adicionar uma anotação…"
          className="input"
          maxLength={2000}
        />
        <Button loading={salvando} iconLeft={<Plus className="size-4" aria-hidden />} onClick={anotar}>
          Anotar
        </Button>
      </div>

      {erro && <AlertaErro className="mt-2">{erro}</AlertaErro>}

      {evolucoes.length === 0 ? (
        <p className="mt-md text-sm text-ink-mute">
          Ainda não há registros. O primeiro pode ser agora.
        </p>
      ) : (
        <ol className="mt-md flex flex-col gap-4 border-l-2 border-line pl-4">
          {evolucoes.map((ev) => {
            // Só o autor retifica — o servidor recusa o resto com 403, e
            // oferecer um botão que vai falhar é pior que não oferecer.
            const meu = Boolean(userId) && ev.autorId === userId && papel === 'medico'
            const foiRetificada = Boolean(ev.retificadaPor)
            const corrige = ev.retificacaoDe ? porId.get(ev.retificacaoDe) : null
            const emRetificacao = retificandoId === ev.id

            return (
              <li key={ev.id} className="relative">
                <span
                  aria-hidden
                  className={cn(
                    'absolute -left-[1.4rem] top-1.5 size-2.5 rounded-full',
                    foiRetificada ? 'bg-line' : '[background-image:var(--grad-brand)]',
                  )}
                />

                <div className={cn('min-w-0', foiRetificada && 'opacity-60')}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-pill bg-paper-2 px-2 py-0.5 text-xs font-semibold text-indigo">
                      {ROTULO_TIPO[ev.tipo]}
                    </span>
                    {ev.visibilidade === 'equipe' && (
                      <span className="inline-flex items-center gap-1 text-xs text-ink-mute">
                        <Lock className="size-3" aria-hidden />
                        só a equipe
                      </span>
                    )}
                    {foiRetificada && (
                      <span className="text-xs font-semibold text-warn-ink">retificada</span>
                    )}
                  </div>

                  {corrige && (
                    <p className="mt-1 inline-flex items-start gap-1 text-xs text-ink-mute">
                      <CornerDownRight className="mt-0.5 size-3 shrink-0" aria-hidden />
                      Retifica a entrada #{corrige.ordem}: “{corrige.texto.slice(0, 80)}
                      {corrige.texto.length > 80 ? '…' : ''}”
                    </p>
                  )}

                  <p className="mt-1 whitespace-pre-line text-sm text-ink">{ev.texto}</p>

                  <p className="mt-0.5 text-xs text-ink-mute">
                    {new Date(ev.em).toLocaleString('pt-BR', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                    {ev.autorNome && ` · ${ev.autorNome}`}
                    {ev.autorCrm && ` · CRM ${ev.autorCrm}`}
                    {ev.hash && (
                      <span className="ml-1.5 inline-flex items-center gap-1" title="Elo da cadeia de integridade">
                        <ShieldCheck className="size-3" aria-hidden />
                        {ev.hash}
                      </span>
                    )}
                  </p>

                  {meu && !foiRetificada && !emRetificacao && (
                    <button
                      type="button"
                      onClick={() => {
                        setRetificandoId(ev.id)
                        setTextoRetificacao(ev.texto)
                      }}
                      className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-indigo hover:underline"
                    >
                      <PencilLine className="size-3" aria-hidden />
                      Retificar
                    </button>
                  )}
                </div>

                {emRetificacao && (
                  <div className="mt-2 rounded-xl border border-line bg-paper-2 p-3">
                    <p className="text-xs text-ink-soft">
                      A entrada acima continua no prontuário. Esta correção entra como um
                      registro novo, com sua assinatura e a data de hoje.
                    </p>
                    <textarea
                      value={textoRetificacao}
                      onChange={(e) => setTextoRetificacao(e.target.value)}
                      className="input mt-2 min-h-20 resize-y"
                      maxLength={2000}
                      autoFocus
                    />
                    <div className="mt-2 flex gap-2">
                      <Button size="sm" onClick={() => retificar(ev.id)}>
                        Registrar retificação
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setRetificandoId(null)}>
                        Cancelar
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}
