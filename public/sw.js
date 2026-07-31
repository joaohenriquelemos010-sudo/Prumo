/* eslint-env serviceworker */

/**
 * O service worker do Prumo — escrito à mão, e de propósito.
 *
 * Workbox resolveria isto em cinco linhas de configuração e traria junto um
 * comportamento de cache que ninguém no time leu. Um service worker é o único
 * código do produto que **sobrevive ao deploy**: um bug de cache aqui serve a
 * versão velha do app para quem já instalou, indefinidamente, e o caminho de
 * volta é pedir para a pessoa desinstalar. Numa plataforma de saúde isso quer
 * dizer uma gestante lendo a orientação de duas versões atrás.
 *
 * Por isso a superfície é minúscula e as regras cabem na cabeça:
 *
 * 1. **Nada de dado de saúde em cache.** Requisição para `/api/` nunca passa
 *    por aqui — vai direto para a rede. O cache do navegador é disco não
 *    cifrado; o prontuário não vai para lá.
 * 2. **HTML sempre da rede primeiro.** É o que garante que um deploy chegue.
 *    O cache do HTML só serve como resposta de offline.
 * 3. **Assets com hash no nome são imutáveis** — esses sim, cache primeiro,
 *    porque o nome muda quando o conteúdo muda.
 */

const VERSAO = 'prumo-v1'
const CACHE_ESTATICO = `${VERSAO}-estatico`
const CACHE_HTML = `${VERSAO}-html`

/** O mínimo para a casca abrir offline. */
const ESSENCIAIS = ['/', '/manifest.webmanifest', '/icones/icone-192.png']

self.addEventListener('install', (evento) => {
  evento.waitUntil(
    caches
      .open(CACHE_ESTATICO)
      .then((cache) => cache.addAll(ESSENCIAIS))
      // Um asset que falhou não pode impedir o worker de instalar.
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((chaves) =>
        Promise.all(
          // Tudo que não é da versão atual sai. É o que impede o cache de
          // crescer para sempre a cada deploy.
          chaves.filter((c) => !c.startsWith(VERSAO)).map((c) => caches.delete(c)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

function ehNavegacao(request) {
  return request.mode === 'navigate'
}

/** Assets do Vite têm hash no nome: `index-Cq3QtxzL.js`. */
function ehImutavel(url) {
  return /\/assets\/.+-[A-Za-z0-9_-]{8,}\.(js|css|woff2?|ttf|png|svg|jpg|webp)$/.test(url.pathname)
}

self.addEventListener('fetch', (evento) => {
  const { request } = evento
  if (request.method !== 'GET') return

  const url = new URL(request.url)

  // Regra 1. Outra origem também passa direto — não é nosso para guardar.
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/api/')) return

  // Regra 2: rede primeiro, cache como rede de segurança.
  if (ehNavegacao(request)) {
    evento.respondWith(
      fetch(request)
        .then((resposta) => {
          const copia = resposta.clone()
          caches.open(CACHE_HTML).then((cache) => cache.put('/', copia))
          return resposta
        })
        .catch(() =>
          caches.match('/').then(
            (cacheada) =>
              cacheada ??
              new Response(
                '<!doctype html><meta charset="utf-8"><title>Prumo</title>' +
                  '<p style="font-family:system-ui;padding:2rem">Você está sem conexão. ' +
                  'Assim que a internet voltar, é só recarregar.</p>',
                { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
              ),
          ),
        ),
    )
    return
  }

  // Regra 3: imutável → cache primeiro.
  if (ehImutavel(url)) {
    evento.respondWith(
      caches.match(request).then(
        (cacheada) =>
          cacheada ??
          fetch(request).then((resposta) => {
            const copia = resposta.clone()
            caches.open(CACHE_ESTATICO).then((cache) => cache.put(request, copia))
            return resposta
          }),
      ),
    )
  }
})

/* ------------------------------- Web Push -------------------------------- */

/**
 * A notificação que chega no celular.
 *
 * O corpo do push **nunca traz conteúdo clínico** — nem nome de exame, nem
 * medida, nem diagnóstico. Uma notificação aparece na tela bloqueada, à vista de
 * quem estiver por perto, e o servidor não tem como saber quem é. Ela diz que há
 * algo para ver e leva até lá; o conteúdo fica atrás do login.
 */
self.addEventListener('push', (evento) => {
  let dados = {}
  try {
    dados = evento.data ? evento.data.json() : {}
  } catch {
    dados = {}
  }

  const titulo = dados.titulo || 'Prumo'
  const opcoes = {
    body: dados.corpo || 'Você tem uma novidade no Prumo.',
    icon: '/icones/icone-192.png',
    badge: '/icones/icone-192.png',
    lang: 'pt-BR',
    // Mesma `tag` substitui a notificação anterior em vez de empilhar: duas
    // sobre a mesma consulta são uma cobrança, não um lembrete.
    tag: dados.tag || 'prumo',
    renotify: false,
    data: { url: dados.url || '/app' },
  }

  evento.waitUntil(self.registration.showNotification(titulo, opcoes))
})

self.addEventListener('notificationclick', (evento) => {
  evento.notification.close()
  const destino = evento.notification.data?.url || '/app'

  evento.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((janelas) => {
      // Reaproveita uma aba do Prumo já aberta em vez de abrir a quinta.
      for (const janela of janelas) {
        if (janela.url.includes(self.location.origin) && 'focus' in janela) {
          janela.navigate?.(destino)
          return janela.focus()
        }
      }
      return self.clients.openWindow(destino)
    }),
  )
})
