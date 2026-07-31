import { useState } from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import {
  CalendarPlus,
  Check,
  X,
  Clock,
  MapPin as MapPinIcon,
  Play,
  Repeat,
  UserCheck,
  UserX,
  Video,
} from 'lucide-react'
import {
  MODALIDADE_ICON,
  MODALIDADE_LABEL,
  OBJETIVO_ICON,
  OBJETIVO_LABEL,
  STATUS_STYLE,
  distanciaHumana,
  horaCurta,
  quandoPorExtenso,
} from './agenda'
import type { Agendamento } from './agenda'
import { baixarIcs } from './ics'
import { useMovimento } from '@/lib/motion'
import { cn } from '@/lib/cn'

interface CardAgendamentoProps {
  agendamento: Agendamento
  /** How the viewer relates to this appointment — decides which actions show. */
  papel: 'paciente' | 'profissional' | 'admin'
  ocupado?: boolean
  onConfirmar?: (id: string) => void
  onRecusar?: (id: string, motivo: string) => void
  onCancelar?: (id: string) => void
  onRemarcar?: (a: Agendamento) => void
  onRealizado?: (id: string, compareceu: boolean) => void
  /** Show the patient's name instead of the professional's (doctor/admin view). */
  mostrarPaciente?: boolean
}

export function CardAgendamento({
  agendamento: a,
  papel,
  ocupado,
  onConfirmar,
  onRecusar,
  onCancelar,
  onRemarcar,
  onRealizado,
  mostrarPaciente,
}: CardAgendamentoProps) {
  const [recusando, setRecusando] = useState(false)
  const [motivo, setMotivo] = useState('')
  const { ativo: movimento, mola } = useMovimento()

  const ObjetivoIcon = OBJETIVO_ICON[a.objetivo]
  const ModalidadeIcon = MODALIDADE_ICON[a.modalidade]
  const status = STATUS_STYLE[a.status]
  const ativo = a.status === 'pendente' || a.status === 'confirmado'
  const jaPassou = new Date(a.inicio).getTime() < Date.now()
  const podeFechar = papel !== 'paciente' && a.status === 'confirmado' && jaPassou

  /**
   * "Iniciar atendimento" só aparece para quem vai atender, num confirmado, e
   * dentro de ±4h do horário. A janela é o que impede o botão de significar a
   * consulta errada numa agenda cheia — cedo o bastante para quem adianta,
   * tarde o bastante para quem atrasou.
   */
  const podeIniciar =
    papel === 'profissional' &&
    a.status === 'confirmado' &&
    Math.abs(new Date(a.inicio).getTime() - Date.now()) <= 4 * 60 * 60 * 1000

  /**
   * A sala de teleconsulta, para os **dois** lados.
   *
   * A janela é a mesma do servidor — abre 15 minutos antes e fecha 30 depois do
   * fim. Mostrar o botão fora dela seria oferecer uma porta que responde 425 ou
   * 410, e a paciente não tem como saber que o problema é a hora.
   */
  const inicioMs = new Date(a.inicio).getTime()
  const podeEntrarNaSala =
    a.modalidade === 'teleconsulta' &&
    a.status === 'confirmado' &&
    Date.now() >= inicioMs - 15 * 60_000 &&
    Date.now() <= inicioMs + (a.duracaoMin + 30) * 60_000

  const titulo = mostrarPaciente ? a.pacienteNome : a.profissionalNome

  /**
   * `layout` é o que importa aqui, e não um gesto.
   *
   * A tentação era swipe-to-reveal — mas este cartão já mostra todas as ações
   * como botões visíveis, e esconder o que está visível atrás de um gesto que
   * ninguém descobre seria trocar clareza por sofisticação. Quem usa isto é uma
   * obstetra entre duas consultas e uma gestante que não sabe o que clicar.
   *
   * O que de fato faltava: confirmar ou cancelar tira o cartão de um grupo e
   * põe em outro, e a lista **saltava**. Com `layout`, os vizinhos deslizam para
   * a posição nova e o olho acompanha para onde o cartão foi — que é a única
   * pergunta que a pessoa tem naquele instante.
   */
  return (
    <motion.li
      layout={movimento ? 'position' : false}
      transition={mola('suave')}
      className="rounded-2xl border border-line bg-paper p-md shadow-soft"
    >
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl [background-image:var(--grad-brand-soft)] text-indigo">
          <ObjetivoIcon className="size-5" aria-hidden />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-display font-semibold text-ink">{titulo}</p>
              <p className="text-xs text-ink-mute">{OBJETIVO_LABEL[a.objetivo]}</p>
            </div>
            <span
              className={cn('shrink-0 rounded-pill px-2.5 py-1 text-xs font-semibold', status.chip)}
            >
              {status.label}
            </span>
          </div>

          <p className="mt-2 font-display font-semibold text-indigo">
            <Clock className="mr-1 inline size-4 align-[-2px]" aria-hidden />
            {quandoPorExtenso(a.inicio)}
            <span className="ml-1 font-normal text-ink-mute">
              às {horaCurta(a.fim)} · {ativo ? distanciaHumana(a.inicio) : ''}
            </span>
          </p>

          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-mute">
            <span className="inline-flex items-center gap-1">
              <ModalidadeIcon className="size-3.5" aria-hidden />
              {MODALIDADE_LABEL[a.modalidade]}
            </span>
            {a.local && (
              <span className="inline-flex items-center gap-1">
                <MapPinIcon className="size-3.5" aria-hidden />
                {a.local}
              </span>
            )}
            {a.convenio && <span>Plano: {a.convenio}</span>}
          </p>

          {a.mensagem && <p className="mt-2 text-sm text-ink-soft">“{a.mensagem}”</p>}

          {a.status !== 'confirmado' && (
            <p className="mt-2 text-xs text-ink-soft">{status.explicacao}</p>
          )}
          {a.motivo && (
            <p className="mt-1 text-xs text-ink-soft">
              <strong>Motivo:</strong> {a.motivo}
            </p>
          )}

          {/* Actions */}
          <div className="mt-3 flex flex-wrap gap-2">
            {podeEntrarNaSala && (
              <Link
                to={`/app/teleconsulta/${a.id}`}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-pill px-4 text-sm font-semibold text-white shadow-soft [background-image:var(--grad-brand)]"
              >
                <Video className="size-4" aria-hidden />
                Entrar na consulta
              </Link>
            )}

            {podeIniciar && (
              <Link
                to={`/app/atendimento/novo?agendamento=${a.id}`}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-pill px-4 text-sm font-semibold text-white shadow-soft [background-image:var(--grad-brand)]"
              >
                <Play className="size-4" aria-hidden />
                Iniciar atendimento
              </Link>
            )}

            {a.status === 'confirmado' && (
              <button
                type="button"
                onClick={() => baixarIcs(a)}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-pill border border-line px-3 text-sm font-semibold text-indigo hover:bg-paper-2"
              >
                <CalendarPlus className="size-4" aria-hidden />
                Adicionar ao calendário
              </button>
            )}

            {papel !== 'paciente' && a.status === 'pendente' && onConfirmar && (
              <button
                type="button"
                disabled={ocupado}
                onClick={() => onConfirmar(a.id)}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-pill px-4 text-sm font-semibold text-white shadow-soft [background-image:var(--grad-brand)] disabled:opacity-60"
              >
                <Check className="size-4" aria-hidden />
                Confirmar
              </button>
            )}

            {papel !== 'paciente' && a.status === 'pendente' && onRecusar && !recusando && (
              <button
                type="button"
                disabled={ocupado}
                onClick={() => setRecusando(true)}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-pill border border-line px-3 text-sm font-semibold text-ink-soft hover:text-warn-ink disabled:opacity-60"
              >
                <X className="size-4" aria-hidden />
                Recusar
              </button>
            )}

            {ativo && onRemarcar && (
              <button
                type="button"
                disabled={ocupado}
                onClick={() => onRemarcar(a)}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-pill border border-line px-3 text-sm font-semibold text-ink-soft hover:text-indigo disabled:opacity-60"
              >
                <Repeat className="size-4" aria-hidden />
                Remarcar
              </button>
            )}

            {ativo && onCancelar && (
              <button
                type="button"
                disabled={ocupado}
                onClick={() => onCancelar(a.id)}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-pill px-3 text-sm font-semibold text-ink-mute hover:text-warn-ink disabled:opacity-60"
              >
                Cancelar
              </button>
            )}

            {podeFechar && onRealizado && (
              <>
                <button
                  type="button"
                  disabled={ocupado}
                  onClick={() => onRealizado(a.id, true)}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-pill border border-line px-3 text-sm font-semibold text-success-ink hover:bg-paper-2 disabled:opacity-60"
                >
                  <UserCheck className="size-4" aria-hidden />
                  Compareceu
                </button>
                <button
                  type="button"
                  disabled={ocupado}
                  onClick={() => onRealizado(a.id, false)}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-pill border border-line px-3 text-sm font-semibold text-ink-soft hover:text-warn-ink disabled:opacity-60"
                >
                  <UserX className="size-4" aria-hidden />
                  Faltou
                </button>
              </>
            )}
          </div>

          {recusando && onRecusar && (
            <div className="mt-3 rounded-xl bg-paper-2 p-3">
              <label className="text-sm font-semibold text-ink" htmlFor={`motivo-${a.id}`}>
                Conte o motivo — a família vê essa mensagem
              </label>
              <input
                id={`motivo-${a.id}`}
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Ex.: cirurgia marcada nesse horário"
                maxLength={200}
                className="input mt-2"
              />
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={ocupado}
                  onClick={() => {
                    onRecusar(a.id, motivo)
                    setRecusando(false)
                    setMotivo('')
                  }}
                  className="inline-flex min-h-9 items-center rounded-pill px-4 text-sm font-semibold text-white [background-image:var(--grad-brand)] disabled:opacity-60"
                >
                  Enviar recusa
                </button>
                <button
                  type="button"
                  onClick={() => setRecusando(false)}
                  className="inline-flex min-h-9 items-center rounded-pill px-3 text-sm font-semibold text-ink-soft hover:bg-paper"
                >
                  Voltar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.li>
  )
}
