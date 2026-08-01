import { useState } from 'react'
import { Copy, KeyRound, RefreshCw, X } from 'lucide-react'
import { api } from '@/lib/api/client'
import { Button } from '@/components/Button'
import { AlertaErro } from '@/components/AlertaErro'
import type { Paciente } from './tipos'

/**
 * O convite para a paciente virar dona do próprio prontuário.
 *
 * A direção é deliberada: **quem digita o código é a paciente**. O caminho mais
 * óbvio seria o médico apontar a jornada para um e-mail — e um erro de digitação
 * ali entregaria um prontuário inteiro para outra pessoa, sem que ninguém
 * notasse. Com o código em mãos, o registro só encontra dono quando alguém que
 * esteve na consulta age.
 *
 * O código aparece grande e em blocos porque na vida real ele é ditado em voz
 * alta no balcão, ou fotografado.
 */
export function VincularConta({
  paciente,
  onMudou,
}: {
  paciente: Paciente
  onMudou: (p: Paciente) => void
}) {
  const [erro, setErro] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const codigo = paciente.vinculacao.codigo

  async function chamar(metodo: 'post' | 'delete') {
    setErro(null)
    setOcupado(true)
    try {
      const d =
        metodo === 'post'
          ? await api.post<{ paciente: Paciente }>(`/pacientes/${paciente.id}/codigo`, {})
          : await api.del<{ paciente: Paciente }>(`/pacientes/${paciente.id}/codigo`)
      onMudou(d.paciente)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui agora.')
    } finally {
      setOcupado(false)
    }
  }

  return (
    <section className="rounded-2xl border border-line bg-paper-2 p-md">
      <h2 className="inline-flex items-center gap-2 font-display text-base font-semibold text-ink">
        <KeyRound className="size-4 text-indigo" aria-hidden />
        Passar o acompanhamento para o app dela
      </h2>

      {erro && <AlertaErro className="mt-2">{erro}</AlertaErro>}

      {codigo ? (
        <>
          <p className="mt-1 text-sm text-ink-soft">
            Ela cria a conta, entra em <strong>Conectar</strong> e digita este código. Todo o
            histórico que você já registrou passa a aparecer para ela — nada é digitado de novo.
          </p>
          <p className="mt-3 font-display text-3xl font-bold tracking-[0.18em] text-indigo">
            {codigo}
          </p>
          {paciente.vinculacao.expiraEm && (
            <p className="mt-1 text-xs text-ink-mute">
              Vale até {new Date(paciente.vinculacao.expiraEm).toLocaleDateString('pt-BR')}.
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="secondary"
              iconLeft={<Copy className="size-4" aria-hidden />}
              onClick={() => void navigator.clipboard?.writeText(codigo)}
            >
              Copiar
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={ocupado}
              iconLeft={<RefreshCw className="size-4" aria-hidden />}
              onClick={() => void chamar('post')}
            >
              Gerar outro
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={ocupado}
              iconLeft={<X className="size-4" aria-hidden />}
              onClick={() => void chamar('delete')}
            >
              Cancelar convite
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="mt-1 text-sm text-ink-soft">
            Quando ela quiser acompanhar pelo celular, gere um código. Enquanto isso, o atendimento
            acontece normalmente — o cadastro dela não é condição para nada.
          </p>
          <Button
            className="mt-3"
            size="sm"
            variant="secondary"
            disabled={ocupado}
            onClick={() => void chamar('post')}
          >
            {ocupado ? 'Gerando…' : 'Gerar código de vinculação'}
          </Button>
        </>
      )}
    </section>
  )
}
