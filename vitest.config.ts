import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

/**
 * Testes unitários rodam em Node — os alvos iniciais são módulos puros (slots,
 * fuso, curvas clínicas, agregação), que é onde os testes pagam mais e o que o
 * projeto já sabia escrever bem. Testes de componente entram quando houver
 * componente que justifique; até lá, os smokes do Playwright cobrem a UI.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['server/**/*.test.ts', 'src/**/*.test.ts'],
    /** Os smokes falam com um servidor de verdade; não são trabalho do vitest. */
    exclude: ['node_modules/**', 'scripts/**'],
  },
})
