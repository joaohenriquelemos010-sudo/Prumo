import { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Smartphone, BellRing, Download, Check } from 'lucide-react'
import { molas } from '@/lib/motion'
import {
  estadoPush,
  ligarPush,
  desligarPush,
  instalar,
  ouvirInstalacao,
  podeInstalar,
  rodandoInstalado,
} from '@/lib/pwa'
import type { EstadoPush } from '@/lib/pwa'
import { cn } from '@/lib/cn'

/**
 * "No celular" — instalar o Prumo e receber aviso na tela.
 *
 * ## Por que fica junto das preferências de lembrete
 *
 * Porque é a mesma pergunta: *quanto o Prumo pode falar comigo, e por onde*.
 * Uma seção de "instalar o app" solta em outro lugar viraria propaganda; aqui
 * ela é a resposta a uma decisão que a pessoa já está tomando.
 *
 * ## O que esta tela nunca faz
 *
 * Pedir a permissão de notificação sozinha, ao abrir. Uma permissão negada por
 * reflexo é quase irreversível — o navegador passa a bloquear o pedido em
 * silêncio e a única saída é um menu de configurações que ninguém encontra. O
 * pedido sai de um toque num botão que diz o que vai acontecer.
 */
const TEXTO_ESTADO: Record<EstadoPush, string> = {
  'sem-suporte': 'Este navegador não recebe avisos na tela. No celular, costuma funcionar.',
  indisponivel: 'Os avisos na tela ainda não estão ligados aqui no Prumo. Em breve.',
  negado:
    'Você bloqueou os avisos para o Prumo neste aparelho. Para voltar atrás, é nas configurações do navegador — o site não consegue perguntar de novo.',
  desligado: 'Receba um toque quando tiver consulta marcada ou algo da sua trilha chegar.',
  ligado: 'Ligado neste aparelho. Você pode desligar quando quiser.',
}

export function NoCelular() {
  const [estado, setEstado] = useState<EstadoPush | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [instalavel, setInstalavel] = useState(podeInstalar())
  const instalado = rodandoInstalado()
  const reduzido = useReducedMotion()

  useEffect(() => {
    let vivo = true
    void estadoPush().then((e) => vivo && setEstado(e))
    const parar = ouvirInstalacao(setInstalavel)
    return () => {
      vivo = false
      parar()
    }
  }, [])

  async function alternar() {
    setOcupado(true)
    try {
      setEstado(estado === 'ligado' ? await desligarPush() : await ligarPush())
    } finally {
      setOcupado(false)
    }
  }

  // Nada a oferecer: nem instalar, nem avisar. Some em vez de ocupar espaço
  // explicando por que não faz nada.
  if (!instalavel && !instalado && (estado === 'sem-suporte' || estado === null)) return null

  const podeAlternar = estado === 'desligado' || estado === 'ligado'

  return (
    <section className="rounded-2xl border border-line bg-paper p-5 shadow-soft">
      <h3 className="flex items-center gap-2 font-display text-lg font-semibold text-indigo">
        <Smartphone size={18} className="text-lilas" />
        No celular
      </h3>

      {instalavel && !instalado && (
        <div className="mt-3 rounded-xl bg-paper-2 p-md">
          <p className="font-display font-semibold text-ink">Deixe o Prumo na tela de início</p>
          <p className="mt-1 text-sm text-ink-soft">
            Abre como um app, sem barra de navegador, e continua abrindo mesmo com internet ruim.
          </p>
          <motion.button
            type="button"
            onClick={() => void instalar()}
            whileTap={reduzido ? undefined : { scale: 0.97 }}
            transition={reduzido ? { duration: 0 } : molas.rapida}
            className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-pill px-5 font-display text-sm font-semibold text-white shadow-soft [background-image:var(--grad-brand)]"
          >
            <Download size={16} aria-hidden />
            Instalar o Prumo
          </motion.button>
        </div>
      )}

      {instalado && (
        <p className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-success-ink">
          <Check size={15} aria-hidden />
          Instalado neste aparelho.
        </p>
      )}

      <div className="mt-md flex items-start justify-between gap-4 border-t border-line pt-md">
        <div className="min-w-0">
          <p className="inline-flex items-center gap-2 font-display font-semibold text-indigo">
            <BellRing size={16} className="text-lilas" />
            Avisos na tela
          </p>
          <p className="mt-1 text-sm text-ink-soft">
            {estado ? TEXTO_ESTADO[estado] : 'Verificando…'}
          </p>
          {estado === 'ligado' && (
            <p className="mt-1 text-xs text-ink-mute">
              O aviso nunca mostra o conteúdo — só diz que tem algo para ver, e leva até lá. O que é
              seu fica atrás do seu login.
            </p>
          )}
        </div>

        {podeAlternar && (
          <motion.button
            type="button"
            role="switch"
            aria-checked={estado === 'ligado'}
            aria-label="Receber avisos na tela"
            disabled={ocupado}
            onClick={() => void alternar()}
            whileTap={reduzido ? undefined : { scale: 0.94 }}
            transition={reduzido ? { duration: 0 } : molas.rapida}
            className={cn(
              'relative h-7 w-12 shrink-0 rounded-pill border transition-colors duration-[var(--dur-fast)]',
              'focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus)]',
              'disabled:opacity-60',
              estado === 'ligado'
                ? 'border-transparent [background-image:var(--grad-brand)]'
                : 'border-line bg-paper-2',
            )}
          >
            <motion.span
              layout
              transition={reduzido ? { duration: 0 } : molas.firme}
              className={cn(
                'absolute top-1/2 block h-5 w-5 -translate-y-1/2 rounded-full bg-white shadow-soft',
                estado === 'ligado' ? 'right-1' : 'left-1',
              )}
            />
          </motion.button>
        )}
      </div>
    </section>
  )
}
