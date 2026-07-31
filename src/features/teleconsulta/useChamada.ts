import { useCallback, useEffect, useRef, useState } from 'react'
import { api, ApiError } from '@/lib/api/client'

/**
 * A máquina de estados de uma teleconsulta.
 *
 * Separada da tela de propósito: WebRTC é assíncrono em cinco frentes ao mesmo
 * tempo (permissão de câmera, negociação, ICE, poll de sinalização, saída), e
 * misturar isso com JSX produz o tipo de componente que ninguém consegue
 * consertar depois.
 *
 * ## Como a chamada acontece
 *
 * O vídeo **nunca passa pelo Prumo**. O servidor só entrega as mensagens que os
 * dois navegadores trocam para se encontrar; depois disso a mídia vai direto de
 * um ao outro. É por isso que a teleconsulta não tem custo por minuto.
 *
 * ## Quem faz a oferta
 *
 * O médico, sempre. Alguém precisa começar, e os dois lados ofertando ao mesmo
 * tempo é o *glare* clássico do WebRTC: as ofertas colidem e a negociação
 * reinicia em loop. O servidor decide isso por papel — não por quem entrou
 * primeiro, que seria uma corrida.
 */

export type EstadoChamada =
  | 'inicial'
  | 'pedindo-camera'
  | 'sem-camera'
  | 'esperando'
  | 'conectando'
  | 'em-chamada'
  | 'encerrada'
  | 'cedo'
  | 'erro'

interface Entrada {
  eu: string
  outro: string
  iniciador: boolean
  fechaEm: string
  iceServers: RTCIceServer[]
}

interface Sinal {
  tipo: 'oferta' | 'resposta' | 'candidato' | 'tchau'
  carga: unknown
  em: string
}

/** Poll rápido durante a negociação, lento depois que a mídia está fluindo. */
const POLL_NEGOCIANDO_MS = 1200
const POLL_EM_CHAMADA_MS = 5000

export function useChamada(agendamentoId: string) {
  const [estado, setEstado] = useState<EstadoChamada>('inicial')
  const [erro, setErro] = useState('')
  const [comAudio, setComAudio] = useState(true)
  const [comVideo, setComVideo] = useState(true)

  const localRef = useRef<HTMLVideoElement | null>(null)
  const remotoRef = useRef<HTMLVideoElement | null>(null)

  const pcRef = useRef<RTCPeerConnection | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const desdeRef = useRef<string | null>(null)
  const vivoRef = useRef(true)
  /**
   * Candidatos que chegaram antes da descrição remota existir.
   *
   * `addIceCandidate` falha se a descrição remota ainda não foi aplicada, e a
   * ordem de chegada não é garantida — o outro lado pode mandar candidatos junto
   * com a oferta. Guardar e aplicar depois é o que evita perder metade dos
   * caminhos de rede e a chamada "às vezes não conectar".
   */
  const pendentesRef = useRef<RTCIceCandidateInit[]>([])

  const encerrar = useCallback(
    async (avisar = true) => {
      vivoRef.current = false
      pcRef.current?.close()
      pcRef.current = null
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
      setEstado('encerrada')
      if (avisar) {
        await api.post(`/teleconsulta/${agendamentoId}/sair`).catch(() => {})
      }
    },
    [agendamentoId],
  )

  const enviar = useCallback(
    async (tipo: Sinal['tipo'], carga?: unknown) => {
      await api.post(`/teleconsulta/${agendamentoId}/sinal`, { tipo, carga }).catch(() => {})
    },
    [agendamentoId],
  )

  const entrar = useCallback(async () => {
    setErro('')
    setEstado('pedindo-camera')

    /* ---- 1. a câmera, antes de tudo ---- */
    let local: MediaStream
    try {
      local = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: { echoCancellation: true, noiseSuppression: true },
      })
    } catch {
      setEstado('sem-camera')
      return
    }
    streamRef.current = local
    if (localRef.current) localRef.current.srcObject = local

    /* ---- 2. a sala ---- */
    let entrada: Entrada
    try {
      entrada = await api.post<Entrada>(`/teleconsulta/${agendamentoId}/entrar`)
    } catch (e) {
      local.getTracks().forEach((t) => t.stop())
      /**
       * 425 Too Early: a sala ainda não abriu. É um estado, não um erro — a
       * tela mostra o horário (que ela já tem, do agendamento) em vez de uma
       * mensagem de falha.
       */
      if (e instanceof ApiError && e.status === 425) {
        setEstado('cedo')
        return
      }
      setErro(e instanceof Error ? e.message : 'Não consegui abrir a sala.')
      setEstado('erro')
      return
    }

    /* ---- 3. a conexão ---- */
    const pc = new RTCPeerConnection({ iceServers: entrada.iceServers })
    pcRef.current = pc
    vivoRef.current = true

    local.getTracks().forEach((faixa) => pc.addTrack(faixa, local))

    pc.ontrack = (ev) => {
      if (remotoRef.current) remotoRef.current.srcObject = ev.streams[0]
      setEstado('em-chamada')
    }
    pc.onicecandidate = (ev) => {
      if (ev.candidate) void enviar('candidato', ev.candidate.toJSON())
    }
    pc.onconnectionstatechange = () => {
      if (!vivoRef.current) return
      if (pc.connectionState === 'connected') setEstado('em-chamada')
      if (pc.connectionState === 'failed') {
        /**
         * A falha honesta. Sem TURN, uma parcela das redes não fecha o ponto a
         * ponto — e girar um spinner para sempre faria a pessoa achar que é a
         * internet dela. Dizer o que houve e oferecer o telefone é melhor
         * produto do que fingir que ainda vai conectar.
         */
        setErro(
          'Não foi possível conectar por vídeo nesta rede. Tente pelos dados do celular, ou combinem por telefone.',
        )
        setEstado('erro')
      }
      if (pc.connectionState === 'disconnected') setEstado('conectando')
    }

    setEstado(entrada.iniciador ? 'conectando' : 'esperando')

    if (entrada.iniciador) {
      const oferta = await pc.createOffer()
      await pc.setLocalDescription(oferta)
      await enviar('oferta', oferta)
    }

    /* ---- 4. o correio ---- */
    async function aplicarPendentes() {
      for (const c of pendentesRef.current) {
        await pc.addIceCandidate(c).catch(() => {})
      }
      pendentesRef.current = []
    }

    async function rodada() {
      if (!vivoRef.current) return
      try {
        const url = desdeRef.current
          ? `/teleconsulta/${agendamentoId}/sinais?desde=${encodeURIComponent(desdeRef.current)}`
          : `/teleconsulta/${agendamentoId}/sinais`
        const r = await api.get<{ agora: string; sinais: Sinal[] }>(url)
        desdeRef.current = r.agora

        for (const s of r.sinais) {
          if (s.tipo === 'tchau') {
            await encerrar(false)
            return
          }
          if (s.tipo === 'oferta') {
            await pc.setRemoteDescription(s.carga as RTCSessionDescriptionInit)
            await aplicarPendentes()
            const resposta = await pc.createAnswer()
            await pc.setLocalDescription(resposta)
            await enviar('resposta', resposta)
            setEstado('conectando')
          }
          if (s.tipo === 'resposta') {
            await pc.setRemoteDescription(s.carga as RTCSessionDescriptionInit)
            await aplicarPendentes()
          }
          if (s.tipo === 'candidato') {
            const c = s.carga as RTCIceCandidateInit
            if (pc.remoteDescription) await pc.addIceCandidate(c).catch(() => {})
            else pendentesRef.current.push(c)
          }
        }
      } catch {
        // Uma rodada perdida não é motivo para derrubar a chamada: a próxima
        // pega o que ficou, e a mídia já flui sem passar por aqui.
      }

      if (!vivoRef.current) return
      const intervalo =
        pcRef.current?.connectionState === 'connected' ? POLL_EM_CHAMADA_MS : POLL_NEGOCIANDO_MS
      setTimeout(() => void rodada(), intervalo)
    }

    void rodada()
  }, [agendamentoId, enviar, encerrar])

  /** Fechar a aba avisa o outro lado — senão ele fica olhando uma tela parada. */
  useEffect(() => {
    const aoSair = () => {
      if (!pcRef.current) return
      // `sendBeacon` é o único envio que sobrevive ao unload.
      navigator.sendBeacon?.(`/api/teleconsulta/${agendamentoId}/sair`, new Blob())
    }
    window.addEventListener('pagehide', aoSair)
    return () => {
      window.removeEventListener('pagehide', aoSair)
      vivoRef.current = false
      pcRef.current?.close()
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [agendamentoId])

  function alternarAudio() {
    const faixa = streamRef.current?.getAudioTracks()[0]
    if (!faixa) return
    faixa.enabled = !faixa.enabled
    setComAudio(faixa.enabled)
  }

  function alternarVideo() {
    const faixa = streamRef.current?.getVideoTracks()[0]
    if (!faixa) return
    faixa.enabled = !faixa.enabled
    setComVideo(faixa.enabled)
  }

  return {
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
  }
}
