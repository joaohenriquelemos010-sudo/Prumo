import { api } from '@/lib/api/client'

/**
 * O lado do navegador do PWA: service worker, instalação e Web Push.
 *
 * Fora do React de propósito. Registrar um service worker é um efeito global do
 * documento, não do ciclo de vida de um componente — pendurá-lo num `useEffect`
 * significa registrar de novo a cada remontagem em desenvolvimento e competir
 * com o próprio Vite.
 */

const CAMINHO_SW = '/sw.js'

export function suportaServiceWorker(): boolean {
  return typeof navigator !== 'undefined' && 'serviceWorker' in navigator
}

export function suportaPush(): boolean {
  return (
    suportaServiceWorker() && typeof window !== 'undefined' && 'PushManager' in window && 'Notification' in window
  )
}

/**
 * Registra o service worker.
 *
 * **Só em produção.** Em desenvolvimento o Vite serve módulos com HMR, e um
 * worker interceptando `fetch` transforma "salvei o arquivo e não mudou nada" no
 * bug mais caro de diagnosticar do dia.
 */
export async function registrarServiceWorker(): Promise<void> {
  if (!suportaServiceWorker() || !import.meta.env.PROD) return
  try {
    await navigator.serviceWorker.register(CAMINHO_SW, { scope: '/' })
  } catch {
    // Um PWA que não instala não pode impedir o site de funcionar.
  }
}

/* ------------------------------ instalação ------------------------------- */

interface EventoInstalacao extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let eventoGuardado: EventoInstalacao | null = null
const ouvintes = new Set<(disponivel: boolean) => void>()

/**
 * O Chrome dispara `beforeinstallprompt` **uma vez**, cedo, e o prompt só pode
 * ser aberto a partir de um gesto do usuário. Guardar o evento é o que permite
 * oferecer "instalar" no momento em que faz sentido — e não numa barra que
 * aparece antes de a pessoa saber o que é o Prumo.
 */
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    eventoGuardado = e as EventoInstalacao
    ouvintes.forEach((fn) => fn(true))
  })

  window.addEventListener('appinstalled', () => {
    eventoGuardado = null
    ouvintes.forEach((fn) => fn(false))
  })
}

export function podeInstalar(): boolean {
  return eventoGuardado !== null
}

export function ouvirInstalacao(fn: (disponivel: boolean) => void): () => void {
  ouvintes.add(fn)
  return () => ouvintes.delete(fn)
}

export async function instalar(): Promise<boolean> {
  if (!eventoGuardado) return false
  await eventoGuardado.prompt()
  const { outcome } = await eventoGuardado.userChoice
  // O evento é de uso único: depois do prompt ele não serve mais, tenha a
  // pessoa aceitado ou não.
  eventoGuardado = null
  ouvintes.forEach((f) => f(false))
  return outcome === 'accepted'
}

/** Já está rodando instalado? */
export function rodandoInstalado(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS não implementa display-mode e usa esta propriedade não-padrão.
    (navigator as unknown as { standalone?: boolean }).standalone === true
  )
}

/* --------------------------------- push ---------------------------------- */

/**
 * VAPID vem em base64url; a API do navegador quer bytes.
 *
 * O `ArrayBuffer` explícito não é cerimônia de tipos: `Uint8Array` genérico
 * aceita um `SharedArrayBuffer`, e `applicationServerKey` não. Construir o
 * buffer primeiro deixa isso resolvido na origem em vez de num cast.
 */
function base64UrlParaBytes(base64: string): Uint8Array<ArrayBuffer> {
  const preenchido = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=')
  const normal = preenchido.replace(/-/g, '+').replace(/_/g, '/')
  const bruto = atob(normal)
  const buffer = new ArrayBuffer(bruto.length)
  const bytes = new Uint8Array(buffer)
  for (let i = 0; i < bruto.length; i++) bytes[i] = bruto.charCodeAt(i)
  return bytes
}

export type EstadoPush = 'sem-suporte' | 'desligado' | 'negado' | 'ligado' | 'indisponivel'

export async function estadoPush(): Promise<EstadoPush> {
  if (!suportaPush()) return 'sem-suporte'

  const { ativo } = await api
    .get<{ ativo: boolean; chave: string }>('/push/chave')
    .catch(() => ({ ativo: false, chave: '' }))
  // O servidor ainda não tem chaves VAPID: não faz sentido pedir a permissão.
  if (!ativo) return 'indisponivel'

  if (Notification.permission === 'denied') return 'negado'

  const registro = await navigator.serviceWorker.getRegistration()
  const assinatura = await registro?.pushManager.getSubscription()
  return assinatura ? 'ligado' : 'desligado'
}

/**
 * Pede a permissão e inscreve este aparelho.
 *
 * `userVisibleOnly: true` é obrigatório nos navegadores baseados em Chromium, e
 * é a promessa que sustenta a permissão: todo push que chega vira uma
 * notificação que a pessoa vê. Push silencioso seria rastreamento.
 */
export async function ligarPush(): Promise<EstadoPush> {
  if (!suportaPush()) return 'sem-suporte'

  const { ativo, chave } = await api
    .get<{ ativo: boolean; chave: string }>('/push/chave')
    .catch(() => ({ ativo: false, chave: '' }))
  if (!ativo || !chave) return 'indisponivel'

  const permissao = await Notification.requestPermission()
  if (permissao !== 'granted') return permissao === 'denied' ? 'negado' : 'desligado'

  const registro = await navigator.serviceWorker.ready
  const assinatura =
    (await registro.pushManager.getSubscription()) ??
    (await registro.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlParaBytes(chave),
    }))

  const json = assinatura.toJSON() as { endpoint?: string; keys?: { p256dh: string; auth: string } }
  if (!json.endpoint || !json.keys) return 'desligado'

  await api.post('/push/assinar', { endpoint: json.endpoint, keys: json.keys })
  return 'ligado'
}

/** Desinscreve **este** aparelho. Os outros continuam recebendo. */
export async function desligarPush(): Promise<EstadoPush> {
  if (!suportaPush()) return 'sem-suporte'

  const registro = await navigator.serviceWorker.getRegistration()
  const assinatura = await registro?.pushManager.getSubscription()

  if (assinatura) {
    // Avisa o servidor antes de cancelar: depois do `unsubscribe` o endpoint
    // some do navegador e não haveria mais o que apagar do outro lado.
    await api.post('/push/cancelar', { endpoint: assinatura.endpoint }).catch(() => {})
    await assinatura.unsubscribe()
  }

  return 'desligado'
}
