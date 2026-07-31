/**
 * O app da paciente: manifest, service worker e Web Push.
 *
 * Este é o diferencial competitivo, não paridade — o lado paciente das
 * plataformas concorrentes é fino, e a obstetra escolhe o Prumo porque as
 * pacientes dela gostam. Então o que se verifica aqui é o que faz um PWA
 * *instalável de verdade*, e não "tem um manifest".
 *
 * A regra mais importante é a última: **nada de dado de saúde em cache**. O
 * cache do navegador é disco não cifrado, e um service worker que guarda
 * resposta de `/api/` deixa o prontuário no aparelho de quem pegar o celular.
 */

export async function registrarTestesDePwa({
  navegador,
  BASE,
  DESKTOP,
  secao,
  afirmar,
  registrar,
  conta,
}) {
  secao('PWA: manifest, service worker e push')

  const ctx = await navegador.newContext({ viewport: DESKTOP })
  await registrar(ctx.request, conta('gestante'))

  /* ---- o manifest existe e é instalável ---- */
  const res = await ctx.request.get(`${BASE}/manifest.webmanifest`)
  afirmar(res.ok(), 'o manifest é servido', `status ${res.status()}`)

  const manifest = JSON.parse(await res.text())
  afirmar(manifest.name && manifest.short_name, 'tem nome e nome curto')
  afirmar(manifest.display === 'standalone', 'abre como app, sem barra de navegador')
  afirmar(manifest.start_url === '/app', 'abre direto na área da paciente, e não na home pública')

  const tamanhos = (manifest.icons ?? []).map((i) => i.sizes)
  afirmar(
    tamanhos.includes('192x192') && tamanhos.includes('512x512'),
    'tem os dois tamanhos que o Chrome exige para oferecer a instalação',
  )
  afirmar(
    (manifest.icons ?? []).some((i) => i.purpose === 'maskable'),
    'tem ícone maskable — sem ele o Android corta a marca dentro de um quadrado branco',
  )

  /* ---- os ícones existem de verdade ---- */
  for (const icone of manifest.icons ?? []) {
    const r = await ctx.request.get(`${BASE}${icone.src}`)
    afirmar(r.ok(), `${icone.src} existe`, `status ${r.status()}`)
    const bytes = (await r.body()).length
    afirmar(bytes > 1000, `${icone.src} não é um arquivo vazio (${bytes} bytes)`)
  }

  const apple = await ctx.request.get(`${BASE}/icones/apple-touch-icon.png`)
  afirmar(
    apple.ok(),
    'apple-touch-icon existe — o iOS ignora o manifest e sem ele usa uma captura da página',
  )

  /* ---- o service worker é servido e não guarda dado de saúde ---- */
  const sw = await ctx.request.get(`${BASE}/sw.js`)
  afirmar(sw.ok(), 'o service worker é servido', `status ${sw.status()}`)
  const fonte = await sw.text()

  afirmar(
    fonte.includes("url.pathname.startsWith('/api/')"),
    'o service worker NÃO passa requisição de /api/ pelo cache',
  )
  afirmar(
    fonte.includes('self.skipWaiting') && fonte.includes('clients.claim'),
    'um deploy novo assume o controle em vez de esperar todas as abas fecharem',
  )
  afirmar(fonte.includes("addEventListener('push'"), 'o worker sabe receber push')
  afirmar(
    fonte.includes("addEventListener('notificationclick'"),
    'tocar na notificação leva para dentro do app',
  )

  /* ---- a chave VAPID: honesta sobre estar encostada ---- */
  const chave = await ctx.request.get(`${BASE}/api/push/chave`)
  afirmar(chave.ok(), 'GET /push/chave responde', `status ${chave.status()}`)
  const { ativo } = await chave.json()
  afirmar(
    typeof ativo === 'boolean',
    'a resposta diz se o push está ligado, em vez de deixar o cliente pedir uma permissão inútil',
  )

  /* ---- a inscrição é validada ---- */
  const lixo = await ctx.request.post(`${BASE}/api/push/assinar`, {
    data: { endpoint: 'não-é-url', keys: { p256dh: 'x', auth: 'y' } },
  })
  afirmar(lixo.status() === 400, 'uma inscrição malformada é recusada', `status ${lixo.status()}`)

  const boa = await ctx.request.post(`${BASE}/api/push/assinar`, {
    data: {
      endpoint: 'https://fcm.googleapis.com/fcm/send/exemplo-do-smoke',
      keys: { p256dh: 'chave-publica-de-exemplo', auth: 'segredo-de-exemplo' },
    },
  })
  afirmar(boa.status() === 201, 'uma inscrição válida é aceita', `status ${boa.status()}`)

  // Assinar liga o canal: a permissão do sistema já é o consentimento.
  const prefs = await (await ctx.request.get(`${BASE}/api/lembretes`)).json()
  afirmar(prefs.preferencias.canais.push === true, 'assinar liga o canal push nas preferências')

  // Idempotente: reabrir o app não pode criar uma segunda inscrição.
  const denovo = await ctx.request.post(`${BASE}/api/push/assinar`, {
    data: {
      endpoint: 'https://fcm.googleapis.com/fcm/send/exemplo-do-smoke',
      keys: { p256dh: 'chave-publica-de-exemplo', auth: 'segredo-de-exemplo' },
    },
  })
  afirmar(denovo.status() === 201, 'assinar o mesmo aparelho de novo é idempotente')

  /* ---- cancelar um aparelho não cala os outros ---- */
  await ctx.request.post(`${BASE}/api/push/assinar`, {
    data: {
      endpoint: 'https://fcm.googleapis.com/fcm/send/segundo-aparelho',
      keys: { p256dh: 'outra-chave', auth: 'outro-segredo' },
    },
  })

  const cancelouUm = await ctx.request.post(`${BASE}/api/push/cancelar`, {
    data: { endpoint: 'https://fcm.googleapis.com/fcm/send/exemplo-do-smoke' },
  })
  const { aparelhos } = await cancelouUm.json()
  afirmar(aparelhos === 1, `tirar um aparelho deixa o outro (${aparelhos})`)

  const aindaLigado = await (await ctx.request.get(`${BASE}/api/lembretes`)).json()
  afirmar(
    aindaLigado.preferencias.canais.push === true,
    'com um aparelho restante o canal continua ligado — tirar o notebook não cala o celular',
  )

  const cancelouTudo = await ctx.request.post(`${BASE}/api/push/cancelar`, { data: {} })
  afirmar((await cancelouTudo.json()).aparelhos === 0, 'cancelar sem endpoint tira todos')

  const desligado = await (await ctx.request.get(`${BASE}/api/lembretes`)).json()
  afirmar(
    desligado.preferencias.canais.push === false,
    'sem nenhum aparelho, o canal é desligado sozinho',
  )

  /* ---- a tela oferece isso ---- */
  const page = await ctx.newPage()
  await page.goto(`${BASE}/app/lembretes`)
  await page.waitForSelector('h1', { timeout: 15000 })
  await page.locator('button:has-text("Ajustes")').first().click()
  await page.waitForSelector('[role="switch"]', { timeout: 15000 })
  afirmar(
    (await page.locator('body').innerText()).includes('Por onde falamos'),
    'os ajustes de canal estão na mesma tela',
  )

  await ctx.close()
}
