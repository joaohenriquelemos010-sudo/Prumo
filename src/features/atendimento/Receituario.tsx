import { lazy, Suspense, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Pill, Plus, Trash2, Check } from 'lucide-react'
import { api } from '@/lib/api/client'
import { molas } from '@/lib/motion'
import { Button } from '@/components/Button'
import { AlertaErro } from '@/components/AlertaErro'
import { cn } from '@/lib/cn'

const BaixarReceita = lazy(() =>
  import('@/features/pdf/documents').then((m) => ({ default: m.BaixarReceita })),
)

export interface ItemReceita {
  medicamento: string
  dose: string
  posologia: string
  duracao: string
  quantidade: string
}

export interface PrescricaoSalva {
  id: string
  tipo: 'simples' | 'antimicrobiano' | 'especial'
  vias: number
  itens: ItemReceita[]
  orientacoes?: string
  emitidaEm: string
  validaAte: string
  pacienteNome?: string
  medicoNome: string
  medicoCrm?: string
  medicoCrmUf?: string
  medicoEspecialidade?: string
}

const VAZIO: ItemReceita = {
  medicamento: '',
  dose: '',
  posologia: '',
  duracao: '',
  quantidade: '',
}

/**
 * Os três tipos que existem na prática, com a consequência de cada um dita.
 *
 * O tipo não é categoria de arquivo: ele decide quantas vias saem e por quanto
 * tempo a receita vale. Escolher errado faz a farmácia recusar — e quem descobre
 * é a paciente, no balcão. Por isso a consequência aparece ao lado da escolha, e
 * não escondida num tooltip.
 */
const TIPOS = [
  { id: 'simples' as const, rotulo: 'Simples', nota: '1 via · vale 30 dias' },
  { id: 'antimicrobiano' as const, rotulo: 'Antimicrobiano', nota: '2 vias · vale 10 dias' },
  { id: 'especial' as const, rotulo: 'Controle especial', nota: '2 vias · vale 30 dias' },
]

/**
 * O receituário, dentro do atendimento.
 *
 * ## Por que aqui e não numa tela própria
 *
 * Porque prescrever acontece **durante** a consulta, com a paciente na frente. A
 * médica não vai salvar o atendimento, navegar para "Receitas", procurar a
 * paciente de novo e voltar. Um receituário que exige isso é um receituário que
 * ninguém usa — e o médico continua escrevendo no bloquinho.
 *
 * ## O primeiro campo é o único obrigatório
 *
 * Existe receita de "Ácido fólico 5 mg, 1 comprimido ao dia" e existe "Retomar o
 * anti-hipertensivo de uso contínuo". Exigir posologia nas duas transformaria o
 * campo numa formalidade preenchida com ponto.
 */
export function Receituario({
  jornadaQuery,
  consultaId,
  pacienteNome,
}: {
  /** `?crianca=<id>` ou vazio — a mesma convenção do resto do cockpit. */
  jornadaQuery: string
  consultaId: string
  pacienteNome?: string
}) {
  const reduzido = useReducedMotion()
  const [aberto, setAberto] = useState(false)
  const [tipo, setTipo] = useState<'simples' | 'antimicrobiano' | 'especial'>('simples')
  const [itens, setItens] = useState<ItemReceita[]>([{ ...VAZIO }])
  const [orientacoes, setOrientacoes] = useState('')
  const [emitindo, setEmitindo] = useState(false)
  const [erro, setErro] = useState('')
  const [emitidas, setEmitidas] = useState<PrescricaoSalva[]>([])

  function mudar(i: number, campo: keyof ItemReceita, valor: string) {
    setItens((ant) => ant.map((it, n) => (n === i ? { ...it, [campo]: valor } : it)))
  }

  const podeEmitir = itens.some((i) => i.medicamento.trim().length >= 2)

  async function emitir() {
    setErro('')
    setEmitindo(true)
    try {
      const { prescricao } = await api.post<{ prescricao: PrescricaoSalva & { medicoNome: string } }>(
        `/prescricoes${jornadaQuery}`,
        {
          consultaId,
          pacienteNome,
          tipo,
          itens: itens.filter((i) => i.medicamento.trim().length >= 2),
          orientacoes: orientacoes || undefined,
        },
      )
      // A receita emitida entra na lista com o botão de PDF do lado: prescrever
      // e entregar são o mesmo gesto na cabeça de quem atende.
      setEmitidas((ant) => [prescricao, ...ant])
      setItens([{ ...VAZIO }])
      setOrientacoes('')
      setAberto(false)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui emitir agora.')
    } finally {
      setEmitindo(false)
    }
  }

  return (
    <section className="rounded-2xl border border-line bg-paper p-md shadow-soft">
      <div className="flex items-center justify-between gap-2">
        <h3 className="inline-flex items-center gap-2 font-display text-sm font-bold text-indigo">
          <Pill className="size-4" aria-hidden />
          Receita
        </h3>
        {!aberto && (
          <Button size="sm" variant="secondary" onClick={() => setAberto(true)}>
            Prescrever
          </Button>
        )}
      </div>

      {emitidas.length > 0 && (
        <ul className="mt-3 flex flex-col gap-2">
          {emitidas.map((p) => (
            <motion.li
              key={p.id}
              initial={reduzido ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={reduzido ? { duration: 0 } : molas.suave}
              className="rounded-xl bg-paper-2 p-3"
            >
              <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-success-ink">
                <Check className="size-3.5" aria-hidden />
                {p.itens.length === 1 ? '1 item' : `${p.itens.length} itens`} · {p.vias}{' '}
                {p.vias === 1 ? 'via' : 'vias'}
              </p>
              <p className="mt-0.5 truncate text-xs text-ink-mute">
                {p.itens.map((i) => i.medicamento).join(', ')}
              </p>
              <div className="mt-2">
                <Suspense fallback={<span className="text-xs text-ink-mute">Preparando…</span>}>
                  <BaixarReceita
                    dados={{
                      id: p.id,
                      pacienteNome: p.pacienteNome ?? pacienteNome,
                      tipo: p.tipo,
                      vias: p.vias,
                      itens: p.itens,
                      orientacoes: p.orientacoes,
                      emitidaEm: p.emitidaEm,
                      validaAte: p.validaAte,
                      medico: {
                        nome: p.medicoNome,
                        crm: p.medicoCrm,
                        crmUf: p.medicoCrmUf,
                        especialidade: p.medicoEspecialidade,
                      },
                    }}
                  />
                </Suspense>
              </div>
            </motion.li>
          ))}
        </ul>
      )}

      {aberto && (
        <div className="mt-3 flex flex-col gap-3">
          <div className="flex flex-wrap gap-1.5">
            {TIPOS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTipo(t.id)}
                aria-pressed={tipo === t.id}
                className={cn(
                  'rounded-xl border px-3 py-1.5 text-left text-xs font-semibold',
                  tipo === t.id
                    ? 'border-transparent text-white [background-image:var(--grad-brand)]'
                    : 'border-line bg-paper text-indigo hover:bg-paper-2',
                )}
              >
                <span className="block">{t.rotulo}</span>
                <span className={cn('block text-[0.65rem] font-normal', tipo === t.id ? 'text-white/80' : 'text-ink-mute')}>
                  {t.nota}
                </span>
              </button>
            ))}
          </div>

          {itens.map((item, i) => (
            <div key={i} className="rounded-xl border border-line p-2.5">
              <div className="flex items-start gap-2">
                <input
                  className="input flex-1"
                  placeholder="Medicamento e concentração"
                  value={item.medicamento}
                  onChange={(e) => mudar(i, 'medicamento', e.target.value)}
                />
                {itens.length > 1 && (
                  <button
                    type="button"
                    aria-label="Remover este item"
                    onClick={() => setItens((ant) => ant.filter((_, n) => n !== i))}
                    className="mt-1 shrink-0 text-ink-mute hover:text-warn-ink"
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                )}
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <input
                  className="input"
                  placeholder="Dose (1 comprimido)"
                  value={item.dose}
                  onChange={(e) => mudar(i, 'dose', e.target.value)}
                />
                <input
                  className="input"
                  placeholder="Posologia (8/8h)"
                  value={item.posologia}
                  onChange={(e) => mudar(i, 'posologia', e.target.value)}
                />
                <input
                  className="input"
                  placeholder="Duração (7 dias)"
                  value={item.duracao}
                  onChange={(e) => mudar(i, 'duracao', e.target.value)}
                />
                <input
                  className="input"
                  placeholder="Quantidade"
                  value={item.quantidade}
                  onChange={(e) => mudar(i, 'quantidade', e.target.value)}
                />
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={() => setItens((ant) => [...ant, { ...VAZIO }])}
            className="inline-flex items-center gap-1.5 self-start rounded-pill border border-line px-3 py-1.5 text-xs font-semibold text-indigo hover:bg-paper-2"
          >
            <Plus className="size-3.5" aria-hidden />
            Outro medicamento
          </button>

          <textarea
            className="input min-h-16 resize-y"
            placeholder="Orientações para a paciente (opcional)"
            maxLength={1000}
            value={orientacoes}
            onChange={(e) => setOrientacoes(e.target.value)}
          />

          {erro && <AlertaErro>{erro}</AlertaErro>}

          <div className="flex flex-wrap gap-2">
            <Button size="sm" loading={emitindo} disabled={!podeEmitir} onClick={() => void emitir()}>
              Emitir receita
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setAberto(false)}>
              Cancelar
            </Button>
          </div>

          <p className="text-[0.7rem] leading-snug text-ink-mute">
            A receita sai em PDF pronta para imprimir e assinar. Para valer sem a sua presença, ela
            precisa da sua assinatura digital ICP-Brasil — o assinador do gov.br é gratuito.
          </p>
        </div>
      )}
    </section>
  )
}
