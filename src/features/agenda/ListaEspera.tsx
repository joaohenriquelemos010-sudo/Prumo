import { useEffect, useState } from 'react'
import { Clock3, PhoneCall, Plus, Users } from 'lucide-react'
import { api } from '@/lib/api/client'
import { Button } from '@/components/Button'
import { Sheet } from '@/components/Sheet'
import { Skeleton } from '@/components/Skeleton'
import { AlertaErro } from '@/components/AlertaErro'
import { BotaoExcluir } from '@/components/BotaoExcluir'
import { cn } from '@/lib/cn'

interface Item {
  id: string
  jornada: string | null
  nome: string
  telefone: string
  tipoNome: string
  prioridade: number
  disponibilidade: string
  observacao: string
  estado: 'aguardando' | 'chamado' | 'agendado' | 'desistiu'
  chamadoEm: string | null
  esperandoDesde: string | null
}

const PRIORIDADES = [
  { valor: 1, rotulo: 'Urgente', classe: 'text-warn-ink' },
  { valor: 2, rotulo: 'Preferencial', classe: 'text-indigo' },
  { valor: 3, rotulo: 'Quando der', classe: 'text-ink-mute' },
]

function espera(desde: string | null): string {
  if (!desde) return ''
  const dias = Math.floor((Date.now() - new Date(desde).getTime()) / 86_400_000)
  if (dias === 0) return 'hoje'
  if (dias === 1) return 'há 1 dia'
  return `há ${dias} dias`
}

/**
 * A lista de espera.
 *
 * Existe para um momento só, e ele é sempre o mesmo: alguém cancela na quinta e
 * a secretária precisa saber **quem chamar primeiro** sem abrir a caixa de
 * mensagens. Sem isso o horário vago é perdido — o buraco mais caro de uma
 * agenda cheia, porque custa faturamento e custa atendimento a quem esperava.
 *
 * A ordem é urgente primeiro e, dentro da mesma prioridade, quem espera há mais
 * tempo. É a ordem que se usaria no papel, e é a única que não precisa ser
 * explicada.
 */
export function ListaEspera() {
  const [fila, setFila] = useState<Item[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [abrindo, setAbrindo] = useState(false)
  const [novo, setNovo] = useState({
    nome: '',
    telefone: '',
    prioridade: 3,
    disponibilidade: '',
    observacao: '',
  })

  async function carregar() {
    try {
      const d = await api.get<{ fila: Item[] }>('/lista-espera')
      setFila(d.fila)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível carregar.')
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    void carregar()
  }, [])

  async function adicionar() {
    try {
      await api.post('/lista-espera', novo)
      setNovo({ nome: '', telefone: '', prioridade: 3, disponibilidade: '', observacao: '' })
      setAbrindo(false)
      await carregar()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui adicionar.')
    }
  }

  async function mudar(id: string, estado: Item['estado']) {
    try {
      await api.patch(`/lista-espera/${id}`, { estado })
      await carregar()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui atualizar.')
    }
  }

  async function remover(id: string) {
    try {
      await api.del(`/lista-espera/${id}`)
      await carregar()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui remover.')
    }
  }

  return (
    <section className="rounded-2xl border border-line bg-paper p-lg shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-md">
        <div>
          <h2 className="inline-flex items-center gap-2 text-lg">
            <Users className="size-5 text-indigo" aria-hidden />
            Lista de espera
          </h2>
          <p className="mt-1 text-sm text-ink-soft">
            Quem chamar quando abrir um horário. Urgente primeiro; empate, quem espera há mais
            tempo.
          </p>
        </div>
        <Button
          size="sm"
          variant="secondary"
          iconLeft={<Plus className="size-4" aria-hidden />}
          onClick={() => setAbrindo(true)}
        >
          Adicionar
        </Button>
      </div>

      {erro && <AlertaErro className="mt-3">{erro}</AlertaErro>}

      {carregando ? (
        <Skeleton className="mt-md h-20" />
      ) : fila.length === 0 ? (
        <p className="mt-md text-sm text-ink-mute">
          Ninguém esperando. Quando a agenda encher, adicione aqui em vez de deixar no WhatsApp.
        </p>
      ) : (
        <ul className="mt-md flex flex-col gap-2">
          {fila.map((i) => {
            const p = PRIORIDADES.find((x) => x.valor === i.prioridade) ?? PRIORIDADES[2]
            return (
              <li key={i.id} className="rounded-xl border border-line bg-paper-2 p-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-display text-sm font-semibold text-ink">{i.nome}</p>
                  <span className={cn('text-xs font-semibold', p.classe)}>{p.rotulo}</span>
                </div>
                <p className="mt-0.5 text-xs text-ink-mute">
                  <Clock3 className="mr-1 inline size-3" aria-hidden />
                  esperando {espera(i.esperandoDesde)}
                  {i.telefone && ` · ${i.telefone}`}
                  {i.disponibilidade && ` · ${i.disponibilidade}`}
                </p>
                {i.observacao && <p className="mt-1 text-xs text-ink-soft">{i.observacao}</p>}

                <div className="mt-2 flex flex-wrap gap-2">
                  {i.estado === 'aguardando' && (
                    <Button
                      size="sm"
                      variant="secondary"
                      iconLeft={<PhoneCall className="size-4" aria-hidden />}
                      onClick={() => void mudar(i.id, 'chamado')}
                    >
                      Chamei
                    </Button>
                  )}
                  {i.estado === 'chamado' && (
                    <>
                      <span className="self-center text-xs text-ink-mute">
                        chamada em{' '}
                        {i.chamadoEm ? new Date(i.chamadoEm).toLocaleDateString('pt-BR') : ''}
                      </span>
                      <Button size="sm" onClick={() => void mudar(i.id, 'agendado')}>
                        Marcou
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => void mudar(i.id, 'desistiu')}>
                        Desistiu
                      </Button>
                    </>
                  )}
                  <BotaoExcluir
                    onConfirm={() => void remover(i.id)}
                    titulo="Tirar da lista?"
                    size="sm"
                  />
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <Sheet aberto={abrindo} onFechar={() => setAbrindo(false)} titulo="Entrar na lista de espera">
        <div className="flex flex-col gap-3">
          <label className="text-sm">
            Nome
            <input
              value={novo.nome}
              onChange={(e) => setNovo({ ...novo, nome: e.target.value })}
              className="input mt-1"
              maxLength={80}
              autoFocus
            />
          </label>
          <label className="text-sm">
            Telefone
            <input
              value={novo.telefone}
              onChange={(e) => setNovo({ ...novo, telefone: e.target.value })}
              className="input mt-1"
              maxLength={20}
              inputMode="tel"
            />
          </label>
          <label className="text-sm">
            Prioridade
            <select
              value={novo.prioridade}
              onChange={(e) => setNovo({ ...novo, prioridade: Number(e.target.value) })}
              className="input mt-1"
            >
              {PRIORIDADES.map((p) => (
                <option key={p.valor} value={p.valor}>
                  {p.rotulo}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Quando ela pode vir
            <input
              value={novo.disponibilidade}
              onChange={(e) => setNovo({ ...novo, disponibilidade: e.target.value })}
              className="input mt-1"
              maxLength={160}
              placeholder="Ex.: só de manhã, qualquer dia menos terça"
            />
          </label>
          <label className="text-sm">
            Observação
            <input
              value={novo.observacao}
              onChange={(e) => setNovo({ ...novo, observacao: e.target.value })}
              className="input mt-1"
              maxLength={300}
            />
          </label>

          <div className="mt-1 flex gap-2">
            <Button onClick={() => void adicionar()} disabled={novo.nome.trim().length < 2}>
              Adicionar
            </Button>
            <Button variant="ghost" onClick={() => setAbrindo(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      </Sheet>
    </section>
  )
}
