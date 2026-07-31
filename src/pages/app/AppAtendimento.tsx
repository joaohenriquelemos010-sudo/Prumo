import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useAtendimento } from '@/lib/stores/atendimento'
import { ContextoPaciente } from '@/features/atendimento/ContextoPaciente'
import { PainelSOAP } from '@/features/atendimento/PainelSOAP'
import { RoteiroLateral } from '@/features/atendimento/RoteiroLateral'
import { MedidasRapidas } from '@/features/atendimento/MedidasRapidas'
import { PreviaFamilia } from '@/features/atendimento/PreviaFamilia'
import { Receituario } from '@/features/atendimento/Receituario'
import { BarraAtendimento } from '@/features/atendimento/BarraAtendimento'
import type { CampoSOAP, Medidas } from '@/features/atendimento/tipos'
import { roteiroParaSemana } from '@/features/clinico/diretrizes-prenatal'
import { ROTEIRO_PEDIATRICO } from '@/features/clinico/diretrizes-pediatria'
import { idadeGestacional } from '@/features/clinico/schedule'
import { Button } from '@/components/Button'
import { AlertaErro } from '@/components/AlertaErro'
import { Skeleton } from '@/components/Skeleton'
import { cn } from '@/lib/cn'

type Painel = 'paciente' | 'nota' | 'roteiro'

const PAINEIS: { chave: Painel; rotulo: string }[] = [
  { chave: 'paciente', rotulo: 'Paciente' },
  { chave: 'nota', rotulo: 'Anotação' },
  { chave: 'roteiro', rotulo: 'Roteiro' },
]

/** Número do input (aceita vírgula) → número ou null, como o servidor espera. */
function paraNumero(v: string): number | null {
  const limpo = v.replace(',', '.').trim()
  if (limpo === '') return null
  const n = Number(limpo)
  return Number.isFinite(n) ? n : null
}

/**
 * O cockpit de atendimento.
 *
 * Uma tela onde antes eram cinco. A médica chega da agenda por *Iniciar
 * atendimento* e sai por *Finalizar* — no meio, tudo que ela precisa está
 * visível ao mesmo tempo: quem é a paciente à esquerda, a anotação no centro, o
 * roteiro da diretriz à direita.
 *
 * **A página não rola.** Em telas grandes cada coluna tem seu próprio contexto
 * de rolagem dentro de um `h-dvh overflow-hidden`; no celular os três painéis
 * viram um carrossel com encaixe. É requisito, não estética: procurar um campo
 * rolando a página inteira com uma pessoa esperando é exatamente o que faz o
 * médico desistir do prontuário e anotar no papel.
 */
export default function AppAtendimento() {
  const { consultaId } = useParams<{ consultaId: string }>()
  const [params] = useSearchParams()
  const agendamentoId = params.get('agendamento')
  const navigate = useNavigate()

  const { cockpit, carregando, erro, salvando, salvoEm, finalizando, pendente } = useAtendimento()
  const { iniciar, editar, finalizar, limpar, salvarAgora } = useAtendimento()

  const [painel, setPainel] = useState<Painel>('nota')
  const [previa, setPrevia] = useState(false)
  const [medidasBrutas, setMedidasBrutas] = useState<Record<string, string>>({})

  // Abre pelo agendamento. O :consultaId da URL é o resultado, não a entrada —
  // por isso a rota aceita os dois e o store é idempotente.
  useEffect(() => {
    if (!agendamentoId || cockpit) return
    void iniciar(agendamentoId).then((r) => {
      if (r.ok && r.consultaId && r.consultaId !== consultaId) {
        navigate(`/app/atendimento/${r.consultaId}?agendamento=${agendamentoId}`, { replace: true })
      }
    })
  }, [agendamentoId, cockpit, consultaId, iniciar, navigate])

  // Sair da tela não pode custar o último parágrafo.
  useEffect(() => {
    return () => {
      void salvarAgora()
      limpar()
    }
  }, [limpar, salvarAgora])

  // Semeia as medidas locais a partir do que o servidor já tinha.
  useEffect(() => {
    if (!cockpit) return
    const m = cockpit.consulta.medidas ?? {}
    setMedidasBrutas(
      Object.fromEntries(
        Object.entries(m)
          .filter(([, v]) => v !== null && v !== undefined)
          .map(([k, v]) => [k, String(v)]),
      ),
    )
  }, [cockpit?.consulta.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const consulta = cockpit?.consulta
  const campos: Record<CampoSOAP, string> = {
    subjetivo: (pendente.subjetivo ?? consulta?.subjetivo ?? '') as string,
    objetivo: (pendente.objetivo ?? consulta?.objetivo ?? '') as string,
    avaliacao: (pendente.avaliacao ?? consulta?.avaliacao ?? '') as string,
    plano: (pendente.plano ?? consulta?.plano ?? '') as string,
  }
  const notasPrivadas = (pendente.notasPrivadas ?? consulta?.notasPrivadas ?? '') as string
  const resumo = (pendente.resumoParaFamilia ?? consulta?.resumoParaFamilia ?? '') as string
  const avaliacaoPrivada = pendente.avaliacaoPrivada ?? consulta?.avaliacaoPrivada ?? false
  const checklist = pendente.checklist ?? consulta?.checklist ?? []

  const blocos = useMemo(() => {
    if (!cockpit) return []
    if (cockpit.consulta.tipo === 'pediatrica') return ROTEIRO_PEDIATRICO
    const ig = cockpit.paciente.dpp ? idadeGestacional(new Date(cockpit.paciente.dpp)) : null
    return roteiroParaSemana(ig?.semanas ?? 0)
  }, [cockpit])

  function mudarMedida(chave: string, valor: string) {
    const proximas = { ...medidasBrutas, [chave]: valor }
    setMedidasBrutas(proximas)
    const numericas: Medidas = {}
    for (const [k, v] of Object.entries(proximas)) {
      numericas[k as keyof Medidas] = paraNumero(v)
    }
    editar({ medidas: numericas })
  }

  function alternarItem(id: string, feito: boolean) {
    const outros = checklist.filter((i) => i.id !== id)
    editar({ checklist: [...outros, { id, feito }] })
  }

  async function aoFinalizar() {
    const r = await finalizar(resumo.trim().length > 0)
    if (r.ok) navigate('/app', { replace: true })
  }

  if (carregando && !cockpit) {
    return (
      <div className="flex flex-col gap-md p-md">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!cockpit) {
    return (
      <div className="p-md">
        <AlertaErro>{erro ?? 'Não encontramos esse atendimento.'}</AlertaErro>
        <Button className="mt-md" variant="secondary" onClick={() => navigate('/app')}>
          Voltar para Meu dia
        </Button>
      </div>
    )
  }

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden">
      {/* Cabeçalho enxuto: quem, e como sair. Wayfinding sem custar altura. */}
      <header className="flex shrink-0 items-center gap-3 border-b border-line px-md py-2.5">
        <button
          type="button"
          onClick={() => navigate('/app')}
          className="grid size-9 shrink-0 place-items-center rounded-pill text-ink-soft hover:bg-paper-2"
          aria-label="Sair do atendimento"
        >
          <ArrowLeft className="size-5" aria-hidden />
        </button>
        <div className="min-w-0">
          <p className="truncate font-display text-sm font-semibold tracking-title text-ink">
            Atendendo {cockpit.paciente.nome || 'paciente'}
          </p>
          <p className="truncate text-xs text-ink-mute">
            {new Date(cockpit.agendamento.inicio).toLocaleString('pt-BR', {
              day: '2-digit',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            })}{' '}
            · {cockpit.agendamento.modalidade}
          </p>
        </div>
      </header>

      {/* Seletor de painel — só no celular, onde as três colunas não cabem. */}
      <div className="shrink-0 border-b border-line px-md py-2 lg:hidden">
        <div role="tablist" className="flex gap-1 rounded-pill bg-paper-2 p-1">
          {PAINEIS.map((p) => (
            <button
              key={p.chave}
              role="tab"
              aria-selected={painel === p.chave}
              onClick={() => setPainel(p.chave)}
              className={cn(
                'flex-1 rounded-pill px-3 py-1.5 text-sm font-semibold transition-colors',
                painel === p.chave ? 'bg-paper text-ink shadow-soft' : 'text-ink-soft',
              )}
            >
              {p.rotulo}
            </button>
          ))}
        </div>
      </div>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[280px_1fr_300px]">
        {/* Contexto */}
        <aside
          className={cn(
            'min-h-0 overflow-y-auto overscroll-contain border-line p-md lg:block lg:border-r',
            painel === 'paciente' ? 'block' : 'hidden',
          )}
        >
          <ContextoPaciente
            paciente={cockpit.paciente}
            prontuario={cockpit.prontuario}
            alertas={cockpit.alertas}
            duvidas={cockpit.duvidas}
            anteriores={cockpit.consultasAnteriores}
          />
        </aside>

        {/* Anotação */}
        <main
          className={cn(
            'min-h-0 overflow-y-auto overscroll-contain p-md lg:block',
            painel === 'nota' ? 'block' : 'hidden',
          )}
        >
          <div className="mx-auto flex max-w-2xl flex-col gap-md">
            <PainelSOAP
              valores={campos}
              onChange={(campo, valor) => editar({ [campo]: valor })}
              avaliacaoPrivada={avaliacaoPrivada}
              onAvaliacaoPrivada={(v) => editar({ avaliacaoPrivada: v })}
              notasPrivadas={notasPrivadas}
              onNotasPrivadas={(v) => editar({ notasPrivadas: v })}
            />

            {previa && (
              <PreviaFamilia
                campos={campos}
                avaliacaoPrivada={avaliacaoPrivada}
                temNotas={notasPrivadas.trim().length > 0}
                resumo={resumo}
                onResumo={(v) => editar({ resumoParaFamilia: v })}
              />
            )}

            {erro && <AlertaErro>{erro}</AlertaErro>}
          </div>
        </main>

        {/* Roteiro + medidas */}
        <aside
          className={cn(
            'min-h-0 overflow-y-auto overscroll-contain border-line p-md lg:block lg:border-l',
            painel === 'roteiro' ? 'block' : 'hidden',
          )}
        >
          <div className="flex flex-col gap-lg">
            <MedidasRapidas
              tipo={cockpit.consulta.tipo}
              valores={medidasBrutas}
              onChange={mudarMedida}
            />
            {/* Prescrever acontece DURANTE a consulta, com a paciente na
                frente. Numa tela própria, a médica teria que salvar, navegar,
                procurar a paciente de novo e voltar — e continuaria escrevendo
                no bloquinho. */}
            <Receituario
              jornadaQuery={`?crianca=${cockpit.paciente.id}`}
              consultaId={cockpit.consulta.id}
              pacienteNome={cockpit.paciente.nome}
            />
            <RoteiroLateral blocos={blocos} marcados={checklist} onToggle={alternarItem} />
          </div>
        </aside>
      </div>

      <BarraAtendimento
        iniciadaEm={cockpit.consulta.iniciadaEm}
        salvando={salvando}
        salvoEm={salvoEm}
        temErro={Boolean(erro)}
        previaAberta={previa}
        onPrevia={() => setPrevia((v) => !v)}
        onFinalizar={aoFinalizar}
        finalizando={finalizando}
      />
    </div>
  )
}
