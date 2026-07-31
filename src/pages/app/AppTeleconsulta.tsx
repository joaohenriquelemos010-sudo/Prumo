import { useEffect, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { Video, VideoOff, Mic, MicOff, PhoneOff, ArrowLeft, ShieldCheck } from 'lucide-react'
import { api } from '@/lib/api/client'
import { molas } from '@/lib/motion'
import { Button } from '@/components/Button'
import { AlertaErro } from '@/components/AlertaErro'
import { useChamada } from '@/features/teleconsulta/useChamada'
import { cn } from '@/lib/cn'

interface Agendamento {
  id: string
  inicio: string
  duracaoMin: number
  modalidade: string
  status: string
  profissionalNome: string
  pacienteNome: string
}

function horaDe(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * A teleconsulta.
 *
 * Tela cheia, fora do shell — como o cockpit de atendimento, e pelo mesmo
 * motivo: no meio de uma consulta ninguém navega para outro lugar, e uma barra
 * de navegação ali só oferece maneiras de estragar a chamada.
 *
 * ## O vídeo não passa pelo Prumo
 *
 * É ponto a ponto entre os dois navegadores. Isso não é detalhe de
 * implementação: é o que torna a teleconsulta gratuita, e é o que faz a conversa
 * não existir em servidor nenhum. A linha na tela diz isso, porque é a pergunta
 * que a paciente tem.
 */
export default function AppTeleconsulta() {
  const { agendamentoId = '' } = useParams()
  const navigate = useNavigate()
  const reduzido = useReducedMotion()

  const [agendamento, setAgendamento] = useState<Agendamento | null>(null)
  const [carregando, setCarregando] = useState(true)

  const {
    estado,
    erro,
    comAudio,
    comVideo,
    localRef,
    remotoRef,
    entrar,
    encerrar,
    alternarAudio,
    alternarVideo,
  } = useChamada(agendamentoId)

  useEffect(() => {
    let vivo = true
    api
      .get<{ agendamentos: Agendamento[] }>('/agendamentos')
      .then((r) => vivo && setAgendamento(r.agendamentos.find((a) => a.id === agendamentoId) ?? null))
      .catch(() => {})
      .finally(() => vivo && setCarregando(false))
    return () => {
      vivo = false
    }
  }, [agendamentoId])

  const outroLado = agendamento
    ? // Quem aparece no cabeçalho é sempre a outra pessoa — quem eu vim ver.
      (agendamento.profissionalNome ?? agendamento.pacienteNome)
    : ''

  const conectado = estado === 'em-chamada'
  const negociando = estado === 'conectando' || estado === 'esperando' || estado === 'pedindo-camera'

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-ink text-white">
      <header className="flex shrink-0 items-center justify-between gap-3 px-md py-3">
        <Link
          to="/app/agenda"
          className="inline-flex items-center gap-2 rounded-pill px-3 py-1.5 text-sm font-semibold text-white/80 hover:bg-white/10"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Agenda
        </Link>

        <div className="min-w-0 text-center">
          <p className="truncate font-display font-semibold">{outroLado || 'Teleconsulta'}</p>
          <p className="text-xs text-white/60">
            {conectado ? 'Conectado' : negociando ? 'Conectando…' : 'Teleconsulta'}
          </p>
        </div>

        <span className="w-[5.5rem]" aria-hidden />
      </header>

      {/* Os vídeos. A remota ocupa a tela; a local é um selo no canto — é assim
          que toda chamada de vídeo se comporta, e contrariar isso não tem
          benefício nenhum. */}
      <div className="relative min-h-0 flex-1">
        <video
          ref={remotoRef}
          autoPlay
          playsInline
          className={cn(
            'h-full w-full bg-black object-cover transition-opacity',
            conectado ? 'opacity-100' : 'opacity-0',
          )}
        />

        {!conectado && (
          <div className="absolute inset-0 grid place-items-center px-lg text-center">
            <Estado
              estado={estado}
              erro={erro}
              carregando={carregando}
              agendamento={agendamento}
              onEntrar={() => void entrar()}
              onVoltar={() => navigate('/app/agenda')}
            />
          </div>
        )}

        <motion.video
          ref={localRef}
          autoPlay
          playsInline
          muted
          initial={reduzido ? false : { opacity: 0, scale: 0.9 }}
          animate={{ opacity: estado === 'inicial' || estado === 'cedo' ? 0 : 1, scale: 1 }}
          transition={reduzido ? { duration: 0 } : molas.suave}
          className="absolute bottom-4 right-4 h-32 w-24 rounded-2xl border-2 border-white/20 bg-black object-cover shadow-lift sm:h-40 sm:w-32"
        />
      </div>

      {/* A barra de controles. Só existe quando há uma chamada para controlar. */}
      {(conectado || negociando) && (
        <div className="flex shrink-0 items-center justify-center gap-3 px-md py-md">
          <Controle
            ativo={comAudio}
            onClick={alternarAudio}
            rotulo={comAudio ? 'Desligar meu microfone' : 'Ligar meu microfone'}
          >
            {comAudio ? <Mic className="size-5" /> : <MicOff className="size-5" />}
          </Controle>

          <Controle
            ativo={comVideo}
            onClick={alternarVideo}
            rotulo={comVideo ? 'Desligar minha câmera' : 'Ligar minha câmera'}
          >
            {comVideo ? <Video className="size-5" /> : <VideoOff className="size-5" />}
          </Controle>

          <motion.button
            type="button"
            onClick={() => void encerrar()}
            aria-label="Encerrar a chamada"
            whileTap={reduzido ? undefined : { scale: 0.94 }}
            transition={reduzido ? { duration: 0 } : molas.rapida}
            className="grid size-14 place-items-center rounded-full bg-warn text-white shadow-lift"
          >
            <PhoneOff className="size-5" aria-hidden />
          </motion.button>
        </div>
      )}

      <p className="shrink-0 px-md pb-3 text-center text-xs text-white/50">
        <ShieldCheck className="mr-1 inline size-3.5" aria-hidden />
        A imagem e o som vão direto de um aparelho ao outro. A conversa não é gravada e não passa
        pelos servidores do Prumo.
      </p>
    </div>
  )
}

function Controle({
  ativo,
  onClick,
  rotulo,
  children,
}: {
  ativo: boolean
  onClick: () => void
  rotulo: string
  children: React.ReactNode
}) {
  const reduzido = useReducedMotion()
  return (
    <motion.button
      type="button"
      onClick={onClick}
      aria-label={rotulo}
      aria-pressed={ativo}
      whileTap={reduzido ? undefined : { scale: 0.94 }}
      transition={reduzido ? { duration: 0 } : molas.rapida}
      className={cn(
        'grid size-14 place-items-center rounded-full transition-colors',
        ativo ? 'bg-white/15 text-white hover:bg-white/25' : 'bg-white text-ink',
      )}
    >
      {children}
    </motion.button>
  )
}

/**
 * Tudo que não é "conectado".
 *
 * Cada estado tem uma saída. Uma tela de chamada que falha e não oferece nada
 * além de um spinner deixa duas pessoas esperando uma pela outra — e a médica
 * tem outra paciente às 15h.
 */
function Estado({
  estado,
  erro,
  carregando,
  agendamento,
  onEntrar,
  onVoltar,
}: {
  estado: string
  erro: string
  carregando: boolean
  agendamento: Agendamento | null
  onEntrar: () => void
  onVoltar: () => void
}) {
  if (carregando) return <p className="text-white/70">Carregando…</p>

  if (!agendamento) {
    return (
      <div className="max-w-sm">
        <p className="font-display text-xl font-semibold">Não encontramos essa consulta</p>
        <p className="mt-2 text-white/70">Ela pode ter sido cancelada ou remarcada.</p>
        <Button className="mt-md" variant="secondary" onClick={onVoltar}>
          Ver minha agenda
        </Button>
      </div>
    )
  }

  if (estado === 'inicial') {
    return (
      <div className="max-w-sm">
        <p className="font-display text-2xl font-semibold">Pronta para entrar?</p>
        <p className="mt-2 text-white/70">
          {horaDe(agendamento.inicio)} · {agendamento.duracaoMin} minutos
        </p>
        <p className="mt-3 text-sm text-white/60">
          Vamos pedir acesso à câmera e ao microfone. Você pode desligar os dois a qualquer momento
          durante a consulta.
        </p>
        <Button className="mt-lg" onClick={onEntrar} iconLeft={<Video className="size-4" />}>
          Entrar na consulta
        </Button>
      </div>
    )
  }

  if (estado === 'cedo') {
    return (
      <div className="max-w-sm">
        <p className="font-display text-xl font-semibold">A sala ainda não abriu</p>
        <p className="mt-2 text-white/70">
          Ela abre 15 minutos antes — {horaDe(agendamento.inicio)}.
        </p>
        <Button className="mt-md" variant="secondary" onClick={onVoltar}>
          Ver minha agenda
        </Button>
      </div>
    )
  }

  if (estado === 'sem-camera') {
    return (
      <div className="max-w-sm">
        <p className="font-display text-xl font-semibold">Precisamos da câmera e do microfone</p>
        <p className="mt-2 text-white/70">
          O navegador bloqueou o acesso. Procure o ícone de câmera na barra de endereço e libere para
          este site — depois é só tentar de novo.
        </p>
        <Button className="mt-md" onClick={onEntrar}>
          Tentar de novo
        </Button>
      </div>
    )
  }

  if (estado === 'erro') {
    return (
      <div className="max-w-sm">
        <AlertaErro>{erro || 'Não consegui abrir a chamada.'}</AlertaErro>
        <div className="mt-md flex flex-wrap justify-center gap-2">
          <Button onClick={onEntrar}>Tentar de novo</Button>
          <Button variant="secondary" onClick={onVoltar}>
            Ver minha agenda
          </Button>
        </div>
      </div>
    )
  }

  if (estado === 'encerrada') {
    return (
      <div className="max-w-sm">
        <p className="font-display text-xl font-semibold">Consulta encerrada</p>
        <p className="mt-2 text-white/70">
          Se sua médica deixar um resumo, ele aparece no Prumo.
        </p>
        <Button className="mt-md" variant="secondary" onClick={onVoltar}>
          Voltar para a agenda
        </Button>
      </div>
    )
  }

  return (
    <div className="max-w-sm">
      <p className="font-display text-xl font-semibold">
        {estado === 'pedindo-camera' ? 'Liberando a câmera…' : 'Esperando do outro lado…'}
      </p>
      <p className="mt-2 text-white/70">
        {estado === 'esperando'
          ? 'Assim que a outra pessoa entrar, a imagem aparece aqui.'
          : 'Um instante.'}
      </p>
    </div>
  )
}
