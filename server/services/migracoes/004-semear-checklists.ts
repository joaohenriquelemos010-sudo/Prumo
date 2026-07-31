import { seedConteudo } from '../seedConteudo.js'

/**
 * Publica os templates de checklist.
 *
 * Roda como migração, e não como seed solto, para ficar registrado: o conteúdo
 * é parte da forma dos dados, e uma instalação nova precisa dele antes da
 * primeira requisição. `seedConteudo` é idempotente por `{chave, versao}`, então
 * reexecutar é atualizar, nunca duplicar.
 */
export async function up(): Promise<void> {
  await seedConteudo()
}
