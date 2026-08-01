/**
 * Smoke test — drives the real app in a real browser.
 *
 * Not a unit-test suite: it walks the journeys that span frontend, API and
 * database, where the seams actually break. Run the dev server first
 * (`npm run dev`), then `node scripts/smoke.mjs`.
 *
 *   BASE=http://localhost:5173 node scripts/smoke.mjs
 *   SHOTS=1 node scripts/smoke.mjs     # also write screenshots to .smoke/
 */

import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'

const BASE = process.env.BASE ?? 'http://localhost:5173'
const SHOTS = process.env.SHOTS === '1'
const SHOT_DIR = '.smoke'

const MOBILE = { width: 390, height: 844 }
const DESKTOP = { width: 1280, height: 900 }

let falhas = 0
let checks = 0

function ok(nome) {
  checks++
  console.log(`  \x1b[32m✓\x1b[0m ${nome}`)
}
function falhou(nome, detalhe) {
  checks++
  falhas++
  console.log(`  \x1b[31m✗\x1b[0m ${nome}`)
  if (detalhe) console.log(`    ${detalhe}`)
}
function afirmar(cond, nome, detalhe) {
  if (cond) ok(nome)
  else falhou(nome, detalhe)
}
function secao(titulo) {
  console.log(`\n\x1b[1m${titulo}\x1b[0m`)
}

const carimbo = Date.now()
let sequencia = 0
/**
 * A fresh account every call. The name is unique too, not just the e-mail: the
 * suite runs against a live database that keeps earlier runs, so a test that
 * looks for "the first doctor in the results" would otherwise grab someone else's.
 */
const conta = (papel) => {
  const n = sequencia++
  // The API accepts letters only in names, so the unique suffix is spelled out.
  const sufixo = `${carimbo}${n}`.replace(/\d/g, (d) => 'abcdefghij'[Number(d)])
  return {
    nome: papel === 'medico' ? `Ana ${sufixo}` : `Marina ${sufixo}`,
    email: `${papel}.${carimbo}.${n}@exemplo.test`,
    senha: 'prumo-teste-123',
    papel,
  }
}

/** Registers straight through the API — the UI flow is covered separately. */
async function registrar(request, dados) {
  const corpo = { ...dados }
  if (dados.papel === 'medico') {
    corpo.cpf = '11144477735' // valid check digits
    corpo.especialidade = 'Obstetrícia'
    corpo.crm = '123456'
    corpo.crmUf = 'SP'
  }
  const res = await request.post(`${BASE}/api/auth/register`, { data: corpo })
  if (!res.ok()) throw new Error(`registro falhou (${res.status()}): ${await res.text()}`)
  return res
}

async function shot(page, nome) {
  if (!SHOTS) return
  await page.screenshot({ path: `${SHOT_DIR}/${nome}.png`, fullPage: false })
}

// CHROME_PATH lets a machine point at a Chromium it already has, instead of
// making Playwright download its own pinned build.
const navegador = await chromium.launch(
  process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {},
)

try {
  if (SHOTS) await mkdir(SHOT_DIR, { recursive: true })

  /* ------------------------------------------------------------------ *
   * Mobile navigation parity — every rail destination must be reachable
   * by thumb. This is the regression that hid five screens on the phone.
   * ------------------------------------------------------------------ */
  secao('Paridade de navegação: desktop ↔ mobile')

  for (const papel of ['gestante', 'medico']) {
    const ctx = await navegador.newContext({ viewport: DESKTOP })
    const page = await ctx.newPage()
    await registrar(ctx.request, conta(papel))
    await page.goto(`${BASE}/app`)
    await page.waitForSelector('aside nav a')

    const noRail = await page.$$eval('aside nav a', (as) => as.map((a) => a.getAttribute('href')))
    afirmar(noRail.length > 0, `${papel}: rail do desktop lista ${noRail.length} destinos`)

    await page.setViewportSize(MOBILE)
    await page.waitForTimeout(200)

    const nasAbas = await page.$$eval('nav[aria-label="Área da plataforma"] a', (as) =>
      as.filter((a) => a.offsetParent !== null).map((a) => a.getAttribute('href')),
    )

    // Anything not a primary tab has to live behind "Mais".
    const botaoMais = page.locator('button:has-text("Mais")')
    let naSheet = []
    if (await botaoMais.isVisible().catch(() => false)) {
      await botaoMais.click()
      await page.waitForSelector('[role="dialog"] a')
      naSheet = await page.$$eval('[role="dialog"] a', (as) => as.map((a) => a.getAttribute('href')))
      await shot(page, `mobile-sheet-${papel}`)
      await page.keyboard.press('Escape')
    }

    const alcancaveis = new Set([...nasAbas, ...naSheet])
    const perdidos = noRail.filter((h) => !alcancaveis.has(h))
    afirmar(
      perdidos.length === 0,
      `${papel}: todos os ${noRail.length} destinos alcançáveis no celular`,
      perdidos.length ? `inalcançáveis: ${perdidos.join(', ')}` : '',
    )

    await ctx.close()
  }

  /* ------------------------------------------------------------------ *
   * The sheet is the app's only dialog — it owes focus trapping,
   * a scroll lock and Escape.
   * ------------------------------------------------------------------ */
  secao('Bottom sheet: comportamento de diálogo')
  {
    const ctx = await navegador.newContext({ viewport: MOBILE })
    const page = await ctx.newPage()
    await registrar(ctx.request, conta('gestante'))
    await page.goto(`${BASE}/app`)

    await page.locator('button:has-text("Mais")').click()
    await page.waitForSelector('[role="dialog"]')

    afirmar(
      (await page.getAttribute('[role="dialog"]', 'aria-modal')) === 'true',
      'sheet marca aria-modal',
    )
    afirmar(
      await page.evaluate(() => getComputedStyle(document.body).overflow === 'hidden'),
      'sheet trava o scroll da página atrás',
    )

    await page.keyboard.press('Escape')
    await page.waitForTimeout(350)
    afirmar((await page.locator('[role="dialog"]').count()) === 0, 'Escape fecha o sheet')
    afirmar(
      await page.evaluate(() => getComputedStyle(document.body).overflow !== 'hidden'),
      'scroll volta ao fechar',
    )
    await ctx.close()
  }

  /* ------------------------------------------------------------------ *
   * Theme: the toggle must exist inside /app (it only lived in the
   * public header) and must actually flip the attribute.
   * ------------------------------------------------------------------ */
  secao('Tema claro e escuro')
  {
    const ctx = await navegador.newContext({ viewport: DESKTOP })
    const page = await ctx.newPage()
    await registrar(ctx.request, conta('gestante'))
    await page.goto(`${BASE}/app`)

    const toggle = page.locator('aside button[aria-pressed]').first()
    await toggle.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {})
    afirmar(await toggle.isVisible(), 'existe toggle de tema dentro de /app')

    await shot(page, 'app-light')
    await toggle.click()
    await page.waitForTimeout(150)
    afirmar(
      (await page.getAttribute('html', 'data-theme')) === 'dark',
      'toggle liga o tema escuro',
    )
    await shot(page, 'app-dark')

    // The accent ink has to lift in dark, or 142 sites go unreadable.
    const indigo = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--color-indigo').trim(),
    )
    const l = Number(indigo.match(/oklch\(([\d.]+)/)?.[1] ?? 0)
    afirmar(l > 0.6, `--color-indigo sobe no escuro (L=${l})`, `valor: ${indigo}`)

    await ctx.close()
  }

  const contexto = { navegador, BASE, MOBILE, DESKTOP, secao, afirmar, registrar, conta, shot }

  const { registrarTestesDeAgenda } = await import('./smoke-agenda.mjs')
  await registrarTestesDeAgenda(contexto)

  const { registrarTestesClinicos } = await import('./smoke-clinico.mjs')
  await registrarTestesClinicos(contexto)

  const { registrarTestesDeAtendimento } = await import('./smoke-atendimento.mjs')
  await registrarTestesDeAtendimento(contexto)

  const { registrarTestesDeProntuario } = await import('./smoke-prontuario.mjs')
  await registrarTestesDeProntuario(contexto)

  const { registrarTestesDeChecklist } = await import('./smoke-checklist.mjs')
  await registrarTestesDeChecklist(contexto)

  const { registrarTestesDeLembretes } = await import('./smoke-lembretes.mjs')
  await registrarTestesDeLembretes(contexto)

  const { registrarTestesDeBebe } = await import('./smoke-bebe.mjs')
  await registrarTestesDeBebe(contexto)

  const { registrarTestesDePwa } = await import('./smoke-pwa.mjs')
  await registrarTestesDePwa(contexto)

  const { registrarTestesDeTeleconsulta } = await import('./smoke-teleconsulta.mjs')
  await registrarTestesDeTeleconsulta(contexto)

  const { registrarTestesDeReceita } = await import('./smoke-receita.mjs')
  await registrarTestesDeReceita(contexto)

  const { registrarTestesDeFinanceiro } = await import('./smoke-financeiro.mjs')
  await registrarTestesDeFinanceiro(contexto)

  const { registrarTestesDePacientes } = await import('./smoke-pacientes.mjs')
  await registrarTestesDePacientes(contexto)
} catch (e) {
  falhou('execução do smoke', e instanceof Error ? e.message : String(e))
} finally {
  await navegador.close()
}

console.log(`\n${falhas === 0 ? '\x1b[32m' : '\x1b[31m'}${checks - falhas}/${checks} checagens passaram\x1b[0m`)
process.exit(falhas === 0 ? 0 : 1)
