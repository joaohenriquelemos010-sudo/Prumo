import { randomBytes } from 'node:crypto'
import { User } from '../models/User.js'
import { hashPassword } from '../auth.js'
import { env } from '../env.js'

/**
 * A conta de administrador da plataforma — provisionada, nunca por cadastro.
 *
 * ## A senha não mora mais aqui
 *
 * Antes o e-mail e a senha estavam escritos neste arquivo, o que quer dizer que
 * qualquer pessoa com acesso ao repositório — hoje, ou daqui a três anos num
 * fork, num backup, num histórico de git — tinha a credencial de administrador
 * de uma plataforma de saúde. Não é uma falha teórica: essa senha existia em
 * texto claro e valia em produção.
 *
 * O que vale agora:
 *
 * - **Em produção, sem `ADMIN_SENHA_INICIAL` a conta não é criada.** A escolha é
 *   deliberada e é a menos ruim das duas: um admin faltando é recuperável em um
 *   minuto definindo a variável; um admin com credencial pública numa plataforma
 *   de saúde não tem volta, porque não dá para saber quem entrou.
 * - **Em desenvolvimento**, sem a variável a conta é criada com uma senha
 *   **aleatória impressa uma vez no log**. Rodar o projeto continua não exigindo
 *   configuração, mas ninguém decora essa senha e ela não sobrevive ao próximo
 *   `npm run dev` sem estar anotada.
 * - Em ambos os casos a conta nasce com `trocaSenhaObrigatoria`, e o `/app`
 *   empurra para a troca antes de deixar usar qualquer coisa.
 */
const ADMIN_NOME = 'Prumo ADM'

export async function seedAdmin(): Promise<void> {
  const email = env.ADMIN_EMAIL.toLowerCase().trim()

  const existente = await User.findOne({ email })
  if (existente) {
    // Repara papel e nome, e nada mais. Nunca redefine a senha de uma conta que
    // já existe: um seed que sobrescreve credencial a cada boot é uma porta.
    if (existente.papel !== 'admin' || existente.nome !== ADMIN_NOME) {
      existente.papel = 'admin'
      existente.nome = ADMIN_NOME
      await existente.save()
    }
    return
  }

  const senhaConfigurada = env.ADMIN_SENHA_INICIAL

  if (!senhaConfigurada && env.isProd) {
    console.warn(
      `[seed] conta de administrador NÃO criada: defina ADMIN_SENHA_INICIAL (e ADMIN_EMAIL) e reinicie. ` +
        `Criar um admin com senha conhecida numa plataforma de saúde seria pior do que não ter admin.`,
    )
    return
  }

  const senha = senhaConfigurada || randomBytes(12).toString('base64url')

  await User.create({
    nome: ADMIN_NOME,
    email,
    senhaHash: await hashPassword(senha),
    papel: 'admin',
    verificacaoStatus: 'nao_aplicavel',
    trocaSenhaObrigatoria: true,
  })

  if (senhaConfigurada) {
    console.info('[seed] conta de administrador criada:', email)
  } else {
    // Impressa uma vez, e só em desenvolvimento. Em produção este ramo é
    // inalcançável — o `return` acima já saiu.
    console.info(
      `[seed] conta de administrador criada em desenvolvimento:\n` +
        `       e-mail: ${email}\n` +
        `       senha:  ${senha}   (aleatória — anote agora, não será mostrada de novo)`,
    )
  }
}
