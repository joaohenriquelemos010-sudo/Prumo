import { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Mail, Bell, Moon, Pause } from 'lucide-react'
import { api } from '@/lib/api/client'
import { AlertaErro } from '@/components/AlertaErro'
import { NoCelular } from '@/features/lembretes/NoCelular'
import { molas } from '@/lib/motion'
import { cn } from '@/lib/cn'

export interface PreferenciasLembretes {
  canais: { email: boolean; inapp: boolean; push: boolean }
  silencio: { de: string; ate: string; fuso: string }
  limites: { porDia: number; porSemana: number }
  tipos: Record<string, boolean>
  pausadoAte: string | null
}

/**
 * O que cada tipo significa **para quem recebe**.
 *
 * Não é a lista de tipos do banco: `digest` não aparece porque ninguém escolhe
 * receber um resumo — ele é a consequência de ter escolhido receber as coisas
 * que ele resume. Oferecer um interruptor para isso seria oferecer uma escolha
 * que não existe.
 */
const TIPOS: { id: string; rotulo: string; ajuda: string }[] = [
  {
    id: 'consulta',
    rotulo: 'Consultas marcadas',
    ajuda: 'Um aviso na véspera e outro no dia. É o único que passa por cima do limite.',
  },
  {
    id: 'checklist',
    rotulo: 'Passos da sua trilha',
    ajuda: 'Quando chega a época de um exame, de uma vacina ou de uma conversa.',
  },
  { id: 'exame', rotulo: 'Exames', ajuda: 'Quando um exame entra na janela em que costuma ser feito.' },
  { id: 'vacina', rotulo: 'Vacinas', ajuda: 'Quando uma dose do calendário está prevista.' },
  {
    id: 'resumo',
    rotulo: 'Resumo da consulta',
    ajuda: 'Quando sua médica deixa um resumo do que vocês conversaram.',
  },
  {
    id: 'sequencia',
    rotulo: 'Um oi quando você some',
    ajuda: 'No máximo uma vez por semana, sem cobrança. Vem desligado.',
  },
]

const PAUSAS = [
  { dias: 7, rotulo: 'Uma semana' },
  { dias: 30, rotulo: 'Um mês' },
]

/**
 * Um interruptor que dá o retorno no **pointer-down**, e não no release.
 *
 * A diferença é imperceptível de descrever e enorme de usar: o dedo encosta e a
 * interface já respondeu, então o toque parece direto em vez de parecer um
 * pedido que o sistema atendeu depois.
 */
function Interruptor({
  ligado,
  onChange,
  rotulo,
}: {
  ligado: boolean
  onChange: (v: boolean) => void
  rotulo: string
}) {
  const reduzido = useReducedMotion()

  return (
    <motion.button
      type="button"
      role="switch"
      aria-checked={ligado}
      aria-label={rotulo}
      onClick={() => onChange(!ligado)}
      whileTap={reduzido ? undefined : { scale: 0.94 }}
      transition={reduzido ? { duration: 0 } : molas.rapida}
      className={cn(
        'relative h-7 w-12 shrink-0 rounded-pill border transition-colors duration-[var(--dur-fast)]',
        'focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus)]',
        ligado ? 'border-transparent [background-image:var(--grad-brand)]' : 'border-line bg-paper-2',
      )}
    >
      <motion.span
        layout
        transition={reduzido ? { duration: 0 } : molas.firme}
        className={cn(
          'absolute top-1/2 block h-5 w-5 -translate-y-1/2 rounded-full bg-white shadow-soft',
          ligado ? 'right-1' : 'left-1',
        )}
      />
    </motion.button>
  )
}

function Linha({
  titulo,
  ajuda,
  icone,
  children,
}: {
  titulo: string
  ajuda?: string
  icone?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="flex min-w-0 items-start gap-3">
        {icone ? <span className="mt-0.5 text-lilas">{icone}</span> : null}
        <div className="min-w-0">
          <p className="font-display font-semibold text-indigo">{titulo}</p>
          {ajuda ? <p className="text-sm text-ink-soft">{ajuda}</p> : null}
        </div>
      </div>
      {children}
    </div>
  )
}

/**
 * O painel de preferências de lembrete.
 *
 * Ele existe para responder uma pergunta só: *quanto* o Prumo pode falar com
 * você. Por isso o limite de frequência fica na mesma tela dos interruptores, e
 * não escondido num "avançado" — é a configuração que mais muda a experiência e
 * a que mais gente quer mexer.
 */
export function Preferencias({
  valor,
  onChange,
}: {
  valor: PreferenciasLembretes
  onChange: (p: PreferenciasLembretes) => void
}) {
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const reduzido = useReducedMotion()

  async function salvar(mudanca: Record<string, unknown>, otimista: PreferenciasLembretes) {
    // Escrita otimista: a interface anda na hora e o servidor confirma depois.
    // Se falhar, o estado fica como ela deixou e o aviso explica — desfazer a
    // escolha dela por causa de uma rede ruim é pior do que avisar.
    onChange(otimista)
    setSalvando(true)
    setErro('')
    try {
      const r = await api.put<{ preferencias: PreferenciasLembretes }>('/lembretes/preferencias', mudanca)
      onChange(r.preferencias)
    } catch {
      setErro('Não conseguimos salvar agora. Sua escolha está aqui, e tentamos de novo no próximo toque.')
    } finally {
      setSalvando(false)
    }
  }

  const pausado = valor.pausadoAte ? new Date(valor.pausadoAte) > new Date() : false

  return (
    <div className="flex flex-col gap-lg">
      <NoCelular />

      <section className="rounded-2xl border border-line bg-paper p-5 shadow-soft">
        <h3 className="font-display text-lg font-semibold text-indigo">Por onde falamos com você</h3>
        <div className="mt-2 divide-y divide-line">
          <Linha titulo="E-mail" icone={<Mail size={18} />}>
            <Interruptor
              rotulo="Receber por e-mail"
              ligado={valor.canais.email}
              onChange={(v) =>
                salvar({ canais: { email: v } }, { ...valor, canais: { ...valor.canais, email: v } })
              }
            />
          </Linha>
          <Linha
            titulo="Aqui dentro do Prumo"
            ajuda="Aparece nesta tela quando você abrir. Não interrompe nada."
            icone={<Bell size={18} />}
          >
            <Interruptor
              rotulo="Receber dentro do Prumo"
              ligado={valor.canais.inapp}
              onChange={(v) =>
                salvar({ canais: { inapp: v } }, { ...valor, canais: { ...valor.canais, inapp: v } })
              }
            />
          </Linha>
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-paper p-5 shadow-soft">
        <h3 className="font-display text-lg font-semibold text-indigo">Sobre o que</h3>
        <div className="mt-2 divide-y divide-line">
          {TIPOS.map((t) => (
            <Linha key={t.id} titulo={t.rotulo} ajuda={t.ajuda}>
              <Interruptor
                rotulo={t.rotulo}
                ligado={valor.tipos[t.id] !== false}
                onChange={(v) =>
                  salvar({ tipos: { [t.id]: v } }, { ...valor, tipos: { ...valor.tipos, [t.id]: v } })
                }
              />
            </Linha>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-paper p-5 shadow-soft">
        <h3 className="font-display text-lg font-semibold text-indigo">Quanto</h3>
        <p className="mt-1 text-sm text-ink-soft">
          Quando várias coisas caem no mesmo dia, elas chegam num e-mail só. Consulta marcada é a única
          que passa por cima desse limite.
        </p>

        <Linha titulo="No máximo por dia" icone={<Bell size={18} />}>
          <div className="flex gap-1">
            {[1, 2, 3].map((n) => (
              <motion.button
                key={n}
                type="button"
                whileTap={reduzido ? undefined : { scale: 0.94 }}
                transition={reduzido ? { duration: 0 } : molas.rapida}
                onClick={() =>
                  salvar(
                    { limites: { porDia: n } },
                    { ...valor, limites: { ...valor.limites, porDia: n } },
                  )
                }
                className={cn(
                  'h-9 w-9 rounded-pill border font-display text-sm font-semibold',
                  valor.limites.porDia === n
                    ? 'border-transparent text-white [background-image:var(--grad-brand)]'
                    : 'border-line bg-paper text-indigo hover:bg-paper-2',
                )}
              >
                {n}
              </motion.button>
            ))}
          </div>
        </Linha>

        <Linha
          titulo="Silêncio"
          ajuda={`Nada chega entre ${valor.silencio.de} e ${valor.silencio.ate}. O que estava na fila espera a manhã.`}
          icone={<Moon size={18} />}
        >
          <span className="rounded-pill bg-paper-2 px-3 py-1 font-display text-sm font-semibold text-indigo">
            {valor.silencio.de}–{valor.silencio.ate}
          </span>
        </Linha>
      </section>

      <section className="rounded-2xl border border-line bg-paper p-5 shadow-soft">
        <h3 className="flex items-center gap-2 font-display text-lg font-semibold text-indigo">
          <Pause size={18} className="text-lilas" />
          Pausar tudo
        </h3>
        <p className="mt-1 text-sm text-ink-soft">
          {pausado
            ? `Pausado até ${new Date(valor.pausadoAte!).toLocaleDateString('pt-BR')}. Nada se perde — o que ficou na fila volta quando a pausa acabar.`
            : 'Precisa de silêncio por um tempo? Nada se perde: os lembretes esperam e voltam depois.'}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {pausado ? (
            <motion.button
              type="button"
              whileTap={reduzido ? undefined : { scale: 0.97 }}
              transition={reduzido ? { duration: 0 } : molas.rapida}
              onClick={() => salvar({ pausarDias: 0 }, { ...valor, pausadoAte: null })}
              className="rounded-pill border border-line bg-paper px-4 py-2 font-display text-sm font-semibold text-indigo hover:bg-paper-2"
            >
              Voltar a receber
            </motion.button>
          ) : (
            PAUSAS.map((p) => (
              <motion.button
                key={p.dias}
                type="button"
                whileTap={reduzido ? undefined : { scale: 0.97 }}
                transition={reduzido ? { duration: 0 } : molas.rapida}
                onClick={() =>
                  salvar(
                    { pausarDias: p.dias },
                    { ...valor, pausadoAte: new Date(Date.now() + p.dias * 864e5).toISOString() },
                  )
                }
                className="rounded-pill border border-line bg-paper px-4 py-2 font-display text-sm font-semibold text-indigo hover:bg-paper-2"
              >
                {p.rotulo}
              </motion.button>
            ))
          )}
        </div>
      </section>

      <div aria-live="polite" className="min-h-[1.25rem]">
        {erro ? (
          <AlertaErro>{erro}</AlertaErro>
        ) : salvando ? (
          <p className="text-sm text-ink-soft">Salvando…</p>
        ) : null}
      </div>
    </div>
  )
}

/**
 * O mesmo painel, buscando os próprios dados.
 *
 * Existe para o perfil, onde não há uma lista de lembretes por perto de onde
 * herdar o estado. A página de lembretes continua passando o valor por prop:
 * ela já carregou tudo num request só, e buscar de novo aqui seria pedir a
 * mesma coisa duas vezes na mesma tela.
 */
export function PainelPreferencias() {
  const [valor, setValor] = useState<PreferenciasLembretes | null>(null)

  useEffect(() => {
    let ativo = true
    api
      .get<{ preferencias: PreferenciasLembretes }>('/lembretes')
      .then((r) => ativo && setValor(r.preferencias))
      .catch(() => {})
    return () => {
      ativo = false
    }
  }, [])

  if (!valor) return null
  return <Preferencias valor={valor} onChange={setValor} />
}
