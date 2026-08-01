import { useEffect, useState } from 'react'
import { Search, UserPlus } from 'lucide-react'
import { api } from '@/lib/api/client'
import { Sheet } from '@/components/Sheet'
import { Button } from '@/components/Button'
import { AlertaErro } from '@/components/AlertaErro'
import { NovoPaciente } from '@/features/pacientes/NovoPaciente'
import { cn } from '@/lib/cn'

interface PacienteBusca {
  jornada: string
  nome: string
  telefone: string
  momento: string
  temConta: boolean
}

export interface TipoOpcao {
  id: string
  nome: string
  cor: string
  duracaoMin: number
}

/** 'YYYY-MM-DDTHH:MM' para o `datetime-local`, no relógio de quem está olhando. */
function paraInputLocal(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

/**
 * Marcar um horário, do lado do consultório.
 *
 * O caminho que já existia é o da família pedindo: nasce pendente e espera
 * resposta. Este é o oposto — quem marca é a autoridade sobre a própria agenda,
 * então o horário nasce confirmado.
 *
 * A ordem dos campos é a da conversa no balcão: quem é a paciente, que tipo de
 * consulta, e só então o horário. Perguntar o horário primeiro obrigaria a
 * secretária a decidir a duração antes de saber do que se trata.
 */
export function NovoAgendamento({
  aberto,
  onFechar,
  onMarcado,
  tipos,
  quandoInicial,
}: {
  aberto: boolean
  onFechar: () => void
  onMarcado: () => void
  tipos: TipoOpcao[]
  /** Preenchido quando veio de um clique num espaço vago da grade. */
  quandoInicial?: Date | null
}) {
  const [busca, setBusca] = useState('')
  const [resultados, setResultados] = useState<PacienteBusca[]>([])
  const [paciente, setPaciente] = useState<PacienteBusca | null>(null)
  const [tipoId, setTipoId] = useState('')
  const [quando, setQuando] = useState('')
  const [modalidade, setModalidade] = useState<'presencial' | 'teleconsulta' | 'domiciliar'>('presencial')
  const [cobertura, setCobertura] = useState<'particular' | 'convenio' | 'sus'>('particular')
  const [observacao, setObservacao] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [conflito, setConflito] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [cadastrando, setCadastrando] = useState(false)

  // Reabrir o painel não pode trazer de volta o que foi digitado da vez passada.
  useEffect(() => {
    if (!aberto) return
    setBusca('')
    setPaciente(null)
    setErro(null)
    setConflito(false)
    setObservacao('')
    setTipoId(tipos[0]?.id ?? '')
    setQuando(paraInputLocal(quandoInicial ?? proximaMeiaHora()))
  }, [aberto, quandoInicial, tipos])

  useEffect(() => {
    if (!aberto) return
    // Debounce curto: o campo é usado com a paciente esperando no telefone.
    const t = setTimeout(() => {
      void api
        .get<{ pacientes: PacienteBusca[] }>(`/agenda/pacientes?q=${encodeURIComponent(busca)}`)
        .then((d) => setResultados(d.pacientes))
        .catch(() => {})
    }, 200)
    return () => clearTimeout(t)
  }, [busca, aberto])

  const tipo = tipos.find((t) => t.id === tipoId)

  async function marcar(permitirConflito = false) {
    if (!paciente) return
    setSalvando(true)
    setErro(null)
    try {
      await api.post('/agenda/marcar', {
        jornadaId: paciente.jornada,
        // `datetime-local` não tem fuso; `new Date` o interpreta no relógio de
        // quem digitou, que é exatamente o que a secretária quis dizer.
        inicio: new Date(quando).toISOString(),
        tipoAtendimentoId: tipoId || undefined,
        modalidade,
        cobertura,
        observacao,
        permitirConflito,
      })
      onMarcado()
      onFechar()
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Não consegui marcar.'
      setErro(msg)
      // O 409 vira uma escolha, não um beco: encaixe por cima existe.
      setConflito(msg.includes('já tem'))
    } finally {
      setSalvando(false)
    }
  }

  return (
    <>
      <Sheet aberto={aberto} onFechar={onFechar} titulo="Novo agendamento">
        <div className="flex flex-col gap-3">
          {erro && <AlertaErro>{erro}</AlertaErro>}
          {conflito && (
            <Button
              size="sm"
              variant="secondary"
              disabled={salvando}
              onClick={() => void marcar(true)}
            >
              Marcar mesmo assim (encaixe)
            </Button>
          )}

          {/* 1. Quem */}
          {paciente ? (
            <div className="flex items-center justify-between gap-2 rounded-xl border border-line bg-paper-2 p-3">
              <div className="min-w-0">
                <p className="truncate font-display text-sm font-semibold text-ink">
                  {paciente.nome}
                </p>
                <p className="truncate text-xs text-ink-mute">
                  {paciente.telefone || 'sem telefone'}
                  {!paciente.temConta && ' · sem conta'}
                </p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setPaciente(null)}>
                Trocar
              </Button>
            </div>
          ) : (
            <div>
              <label className="relative block text-sm">
                Paciente
                <Search
                  className="pointer-events-none absolute left-3 top-[34px] size-4 text-ink-mute"
                  aria-hidden
                />
                <input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  className="input mt-1 pl-9"
                  placeholder="Nome ou telefone"
                  autoFocus
                />
              </label>

              <ul className="mt-2 max-h-48 overflow-y-auto rounded-xl border border-line">
                {resultados.length === 0 ? (
                  <li className="p-3 text-sm text-ink-mute">
                    {busca ? 'Ninguém com esse nome.' : 'Digite para buscar.'}
                  </li>
                ) : (
                  resultados.map((p) => (
                    <li key={p.jornada}>
                      <button
                        type="button"
                        onClick={() => setPaciente(p)}
                        className="flex w-full items-baseline justify-between gap-2 px-3 py-2 text-left hover:bg-paper-2"
                      >
                        <span className="truncate text-sm text-ink">{p.nome}</span>
                        <span className="shrink-0 text-xs text-ink-mute">{p.telefone}</span>
                      </button>
                    </li>
                  ))
                )}
              </ul>

              {/* A paciente que não existe ainda é o caso comum no balcão. */}
              <Button
                className="mt-2"
                size="sm"
                variant="ghost"
                iconLeft={<UserPlus className="size-4" aria-hidden />}
                onClick={() => setCadastrando(true)}
              >
                Cadastrar paciente nova
              </Button>
            </div>
          )}

          {/* 2. Do que se trata */}
          <fieldset>
            <legend className="text-sm font-semibold text-ink">Tipo de consulta</legend>
            <div className="mt-1 flex flex-wrap gap-2">
              {tipos.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  aria-pressed={tipoId === t.id}
                  onClick={() => setTipoId(t.id)}
                  className={cn(
                    'rounded-pill border px-3 py-1.5 text-sm',
                    tipoId === t.id
                      ? 'border-indigo bg-[var(--color-lilas-soft)] font-semibold text-indigo'
                      : 'border-line text-ink-soft hover:bg-paper-2',
                  )}
                >
                  {t.nome}
                  <span className="ml-1 text-xs text-ink-mute">{t.duracaoMin}min</span>
                </button>
              ))}
            </div>
          </fieldset>

          {/* 3. Quando */}
          <label className="text-sm">
            Data e hora
            <input
              type="datetime-local"
              value={quando}
              onChange={(e) => setQuando(e.target.value)}
              className="input mt-1"
            />
            {tipo && (
              <span className="mt-0.5 block text-xs text-ink-mute">
                Ocupa {tipo.duracaoMin} minutos.
              </span>
            )}
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              Modalidade
              <select
                value={modalidade}
                onChange={(e) => setModalidade(e.target.value as typeof modalidade)}
                className="input mt-1"
              >
                <option value="presencial">Presencial</option>
                <option value="teleconsulta">Teleconsulta</option>
                <option value="domiciliar">Domiciliar</option>
              </select>
            </label>
            <label className="text-sm">
              Cobertura
              <select
                value={cobertura}
                onChange={(e) => setCobertura(e.target.value as typeof cobertura)}
                className="input mt-1"
              >
                <option value="particular">Particular</option>
                <option value="convenio">Convênio</option>
                <option value="sus">SUS</option>
              </select>
            </label>
          </div>

          <label className="text-sm">
            Observação
            <input
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              className="input mt-1"
              maxLength={500}
            />
          </label>

          <div className="mt-1 flex gap-2">
            <Button onClick={() => void marcar()} disabled={salvando || !paciente || !quando}>
              {salvando ? 'Marcando…' : 'Marcar'}
            </Button>
            <Button variant="ghost" onClick={onFechar}>
              Cancelar
            </Button>
          </div>
        </div>
      </Sheet>

      <NovoPaciente
        aberto={cadastrando}
        onFechar={() => setCadastrando(false)}
        onCriado={(p) => {
          setCadastrando(false)
          // Já entra selecionada: quem acabou de cadastrar quer marcar para ela.
          setPaciente({ jornada: p.id, nome: p.nome, telefone: '', momento: '', temConta: false })
        }}
      />
    </>
  )
}

/** O próximo :00 ou :30 — o palpite que acerta na maioria das vezes. */
function proximaMeiaHora(): Date {
  const d = new Date()
  d.setSeconds(0, 0)
  d.setMinutes(d.getMinutes() > 30 ? 60 : 30)
  return d
}
