import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  BellRing,
  CalendarClock,
  ClipboardList,
  FlaskConical,
  Syringe,
  FileText,
  Sparkles,
  Check,
  Clock,
  BellOff,
  Settings2,
} from 'lucide-react'
import { api } from '@/lib/api/client'
import { molas } from '@/lib/motion'
import { EmptyState } from '@/components/EmptyState'
import { Skeleton } from '@/components/Skeleton'
import { Preferencias } from '@/features/lembretes/Preferencias'
import type { PreferenciasLembretes } from '@/features/lembretes/Preferencias'
import { cn } from '@/lib/cn'

interface Lembrete {
  id: string
  tipo: string
  canal: string
  estado: string
  agendadoPara: string
  enviadoEm: string | null
  carga: Record<string, unknown>
}

interface Resposta {
  envioAtivo: boolean
  preferencias: PreferenciasLembretes
  lembretes: Lembrete[]
}

/** Cada tipo com o rosto que ele tem para quem recebe. */
const ROSTO: Record<string, { icone: typeof BellRing; rotulo: string }> = {
  consulta: { icone: CalendarClock, rotulo: 'Consulta marcada' },
  checklist: { icone: ClipboardList, rotulo: 'Um passo da sua trilha' },
  exame: { icone: FlaskConical, rotulo: 'Exame' },
  vacina: { icone: Syringe, rotulo: 'Vacina' },
  resumo: { icone: FileText, rotulo: 'Resumo da consulta' },
  sequencia: { icone: Sparkles, rotulo: 'Um oi' },
  digest: { icone: BellRing, rotulo: 'Resumo da semana' },
}

function quandoLegivel(iso: string): string {
  const data = new Date(iso)
  const dias = Math.round((data.getTime() - Date.now()) / 86_400_000)
  if (dias === 0) return 'hoje'
  if (dias === 1) return 'amanhã'
  if (dias === -1) return 'ontem'
  if (dias > 1 && dias < 7) return `em ${dias} dias`
  return data.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })
}

/**
 * Um item da linha do tempo.
 *
 * As três ações — **Adiar**, **Já fiz**, **Não me lembre disso** — não são
 * decoração: um lembrete que só oferece "OK" transforma cada aviso numa
 * cobrança que a pessoa não pode responder. Aqui ela sempre pode responder, e é
 * isso que separa um lembrete de uma notificação.
 */
function ItemLembrete({
  l,
  onAdiar,
  onConcluir,
  onDesligarTipo,
}: {
  l: Lembrete
  onAdiar: () => void
  onConcluir: () => void
  onDesligarTipo: () => void
}) {
  const { icone: Icone, rotulo } = ROSTO[l.tipo] ?? { icone: BellRing, rotulo: 'Lembrete' }
  const titulo = typeof l.carga.titulo === 'string' && l.carga.titulo ? l.carga.titulo : rotulo
  const pendente = l.estado === 'agendado'

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0, marginBottom: 0 }}
      transition={molas.suave}
      className={cn(
        'overflow-hidden rounded-2xl border bg-paper p-4 shadow-soft',
        pendente ? 'border-line' : 'border-transparent bg-paper-2',
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            'mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-full',
            pendente ? 'text-white [background-image:var(--grad-brand)]' : 'bg-paper-3 text-ink-mute',
          )}
        >
          <Icone size={18} />
        </span>

        <div className="min-w-0 flex-1">
          <p className="u-eyebrow">{rotulo}</p>
          <p className="font-display font-semibold text-indigo">{titulo}</p>
          <p className="text-sm text-ink-soft">
            {pendente ? quandoLegivel(l.agendadoPara) : `enviado ${quandoLegivel(l.enviadoEm ?? l.agendadoPara)}`}
            {l.canal === 'inapp' ? ' · aqui no Prumo' : ' · por e-mail'}
          </p>
        </div>
      </div>

      {pendente ? (
        <div className="mt-3 flex flex-wrap gap-2 pl-[3.25rem]">
          <Acao icone={<Check size={14} />} onClick={onConcluir}>
            Já fiz
          </Acao>
          <Acao icone={<Clock size={14} />} onClick={onAdiar}>
            Me lembre depois
          </Acao>
          <Acao icone={<BellOff size={14} />} onClick={onDesligarTipo}>
            Não me lembre disso
          </Acao>
        </div>
      ) : null}
    </motion.li>
  )
}

function Acao({
  children,
  icone,
  onClick,
}: {
  children: React.ReactNode
  icone: React.ReactNode
  onClick: () => void
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.96 }}
      transition={molas.rapida}
      className="inline-flex items-center gap-1.5 rounded-pill border border-line bg-paper px-3 py-1.5 font-display text-[0.8125rem] font-semibold text-indigo hover:bg-paper-2 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus)]"
    >
      {icone}
      {children}
    </motion.button>
  )
}

/**
 * A área de lembretes.
 *
 * Ela responde duas perguntas, nesta ordem: *o que vem por aí* e *quanto o
 * Prumo pode falar comigo*. A segunda vive na mesma tela de propósito — quem
 * abre esta página com a sensação de estar recebendo demais precisa achar o
 * controle sem procurar por ele em outro lugar.
 */
export default function AppLembretes() {
  const [dados, setDados] = useState<Resposta | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [aba, setAba] = useState<'proximos' | 'ajustes'>('proximos')

  useEffect(() => {
    let ativo = true
    api
      .get<Resposta>('/lembretes')
      .then((r) => ativo && setDados(r))
      .catch(() => {})
      .finally(() => ativo && setCarregando(false))
    return () => {
      ativo = false
    }
  }, [])

  function remover(id: string) {
    setDados((d) => (d ? { ...d, lembretes: d.lembretes.filter((l) => l.id !== id) } : d))
  }

  async function concluir(id: string) {
    remover(id)
    await api.post(`/lembretes/${id}/concluir`).catch(() => {})
  }

  async function adiar(id: string) {
    remover(id)
    await api.post(`/lembretes/${id}/adiar`, { dias: 3 }).catch(() => {})
  }

  async function desligarTipo(tipo: string) {
    setDados((d) =>
      d
        ? {
            ...d,
            preferencias: { ...d.preferencias, tipos: { ...d.preferencias.tipos, [tipo]: false } },
            lembretes: d.lembretes.filter((l) => l.tipo !== tipo),
          }
        : d,
    )
    await api.put('/lembretes/preferencias', { tipos: { [tipo]: false } }).catch(() => {})
  }

  const pendentes = (dados?.lembretes ?? []).filter((l) => l.estado === 'agendado')
  const passados = (dados?.lembretes ?? []).filter((l) => l.estado !== 'agendado').slice(0, 10)

  return (
    <div className="flex flex-col gap-lg">
      <header className="flex flex-col gap-1">
        <p className="u-eyebrow">Lembretes</p>
        <h1 className="font-display text-3xl font-bold text-indigo sm:text-4xl">O que vem por aí</h1>
        <p className="text-ink-soft">
          Só o que ajuda, na hora que ajuda. Você decide o quanto — e pode mudar de ideia a qualquer
          momento.
        </p>
      </header>

      {dados && !dados.envioAtivo ? (
        <p className="rounded-2xl border border-line bg-paper-2 p-4 text-sm text-ink-soft">
          O envio por e-mail ainda não está ligado. Seus lembretes continuam sendo organizados aqui, e
          nada se perde — quando o envio ligar, eles seguem estas preferências.
        </p>
      ) : null}

      <div className="flex gap-1 self-start rounded-pill border border-line bg-paper p-1">
        {(
          [
            { id: 'proximos', rotulo: 'O que vem aí', icone: BellRing },
            { id: 'ajustes', rotulo: 'Ajustes', icone: Settings2 },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setAba(t.id)}
            className={cn(
              'relative inline-flex items-center gap-2 rounded-pill px-4 py-2 font-display text-sm font-semibold transition-colors',
              aba === t.id ? 'text-white' : 'text-indigo hover:bg-paper-2',
            )}
          >
            {aba === t.id ? (
              <motion.span
                layoutId="aba-lembretes"
                transition={molas.firme}
                className="absolute inset-0 rounded-pill [background-image:var(--grad-brand)]"
              />
            ) : null}
            <t.icone size={15} className="relative" />
            <span className="relative">{t.rotulo}</span>
          </button>
        ))}
      </div>

      {carregando ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
        </div>
      ) : aba === 'ajustes' && dados ? (
        <Preferencias
          valor={dados.preferencias}
          onChange={(p) => setDados((d) => (d ? { ...d, preferencias: p } : d))}
        />
      ) : pendentes.length === 0 && passados.length === 0 ? (
        <EmptyState
          icon={<BellRing size={28} />}
          titulo="Nada na fila"
          descricao="Quando uma consulta for marcada ou um passo da sua trilha chegar na época certa, ele aparece aqui."
        />
      ) : (
        <div className="flex flex-col gap-lg">
          {pendentes.length > 0 ? (
            <ul className="flex flex-col gap-3">
              <AnimatePresence initial={false}>
                {pendentes.map((l) => (
                  <ItemLembrete
                    key={l.id}
                    l={l}
                    onConcluir={() => concluir(l.id)}
                    onAdiar={() => adiar(l.id)}
                    onDesligarTipo={() => desligarTipo(l.tipo)}
                  />
                ))}
              </AnimatePresence>
            </ul>
          ) : (
            <p className="text-ink-soft">Nada esperando por você agora.</p>
          )}

          {passados.length > 0 ? (
            <section>
              <h2 className="u-eyebrow mb-2">Já passou</h2>
              <ul className="flex flex-col gap-3">
                {passados.map((l) => (
                  <ItemLembrete key={l.id} l={l} onConcluir={() => {}} onAdiar={() => {}} onDesligarTipo={() => {}} />
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      )}
    </div>
  )
}
