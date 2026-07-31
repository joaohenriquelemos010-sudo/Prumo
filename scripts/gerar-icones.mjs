/**
 * Gera os ícones do PWA a partir do SVG da marca.
 *
 * Rasteriza com o Chromium do Playwright, que já está no projeto para os smokes
 * — nenhuma dependência nova, e o resultado é **reproduzível**: qualquer pessoa
 * roda `node scripts/gerar-icones.mjs` e obtém byte a byte o mesmo arquivo. Um
 * PNG exportado à mão de um editor não tem essa propriedade, e é assim que o
 * ícone do app fica desatualizado em relação à marca sem ninguém perceber.
 *
 * ## Dois tipos de ícone, e a diferença importa
 *
 * - **`any`** — fundo transparente, a marca inteira visível. É o que aparece na
 *   lista de apps do desktop e nas abas.
 * - **`maskable`** — fundo cheio e a marca dentro da *safe zone* (80% do lado,
 *   centralizada). O Android recorta o ícone na forma do launcher — círculo,
 *   squircle, gota — e um ícone transparente vira uma marca cortada dentro de um
 *   quadrado branco. A safe zone é o que garante que nada essencial seja cortado
 *   em nenhuma das formas.
 *
 * Uso: node scripts/gerar-icones.mjs
 */
import { chromium } from 'playwright'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'

const RAIZ = process.cwd()
const ORIGEM = join(RAIZ, 'public/img/logo_sem_fundo_so_com_desenho.svg')
const DESTINO = join(RAIZ, 'public/icones')

/** O gradiente da marca, o mesmo de `--grad-brand`. */
const GRAD = 'linear-gradient(135deg, #b58bfd 0%, #5b81fb 100%)'

const ALVOS = [
  { arquivo: 'icone-192.png', lado: 192, mascaravel: false },
  { arquivo: 'icone-512.png', lado: 512, mascaravel: false },
  { arquivo: 'icone-maskable-192.png', lado: 192, mascaravel: true },
  { arquivo: 'icone-maskable-512.png', lado: 512, mascaravel: true },
  // iOS ignora o manifest para o ícone da tela de início e usa este.
  { arquivo: 'apple-touch-icon.png', lado: 180, mascaravel: true },
]

function pagina(svgDataUri, lado, mascaravel) {
  // 80% é a safe zone da especificação de ícone maskable. O ícone `any` usa a
  // largura quase inteira, com uma folga mínima para não encostar na borda.
  const escala = mascaravel ? 0.62 : 0.9
  return `<!doctype html><meta charset="utf-8">
<style>
  html, body { margin: 0; padding: 0; }
  body {
    width: ${lado}px; height: ${lado}px;
    display: grid; place-items: center;
    background: ${mascaravel ? GRAD : 'transparent'};
  }
  img { width: ${Math.round(lado * escala)}px; height: auto; display: block; ${
    mascaravel ? 'filter: brightness(0) invert(1);' : ''
  } }
</style>
<img src="${svgDataUri}">`
}

const svg = await readFile(ORIGEM, 'utf8')
const dataUri = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`

await mkdir(DESTINO, { recursive: true })

/**
 * O Chromium do ambiente, não o que a versão do Playwright espera.
 *
 * `PLAYWRIGHT_BROWSERS_PATH` aponta para uma instalação compartilhada, e o
 * número de build dela nem sempre casa com o que o pacote instalado procura.
 * Apontar o executável resolve sem baixar 150 MB de navegador de novo.
 */
const navegador = await chromium.launch({
  executablePath: process.env.CHROMIUM_BIN || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
})
try {
  for (const alvo of ALVOS) {
    const ctx = await navegador.newContext({
      viewport: { width: alvo.lado, height: alvo.lado },
      // 1: o viewport já está no tamanho final. Escalar aqui daria um PNG
      // maior do que o `sizes` declarado no manifest, e o navegador acredita
      // no que o manifest diz.
      deviceScaleFactor: 1,
    })
    const page = await ctx.newPage()
    await page.setContent(pagina(dataUri, alvo.lado, alvo.mascaravel))
    await page.waitForLoadState('networkidle')

    const buffer = await page.screenshot({
      omitBackground: !alvo.mascaravel,
      type: 'png',
    })
    await writeFile(join(DESTINO, alvo.arquivo), buffer)
    console.info(`[icones] ${alvo.arquivo} — ${alvo.lado}px${alvo.mascaravel ? ' (maskable)' : ''}`)
    await ctx.close()
  }
} finally {
  await navegador.close()
}
