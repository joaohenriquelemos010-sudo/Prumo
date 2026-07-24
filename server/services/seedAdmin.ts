import { User } from '../models/User.js'
import { hashPassword } from '../auth.js'

/** The single platform administrator account (provisioned, never self-signup). */
const ADMIN_EMAIL = 'admin@prumo.com'
const ADMIN_NOME = 'Prumo ADM'
const ADMIN_SENHA = 'Prumo@*OrgAdm'

/**
 * Ensures the administrator account exists. Idempotent: creates it on first run,
 * and repairs the role/name on an existing account if needed. Runs once per
 * process after the database connects.
 */
export async function seedAdmin(): Promise<void> {
  const existing = await User.findOne({ email: ADMIN_EMAIL })
  if (existing) {
    if (existing.papel !== 'admin' || existing.nome !== ADMIN_NOME) {
      existing.papel = 'admin'
      existing.nome = ADMIN_NOME
      await existing.save()
    }
    return
  }
  const senhaHash = await hashPassword(ADMIN_SENHA)
  await User.create({
    nome: ADMIN_NOME,
    email: ADMIN_EMAIL,
    senhaHash,
    papel: 'admin',
    verificacaoStatus: 'nao_aplicavel',
  })
  console.info('[seed] conta de administrador criada:', ADMIN_EMAIL)
}
