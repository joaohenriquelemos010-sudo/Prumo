import { Router } from 'express'
import { User } from '../models/User'
import { Crianca } from '../models/Crianca'
import { Prontuario } from '../models/Prontuario'
import { Duvida } from '../models/Duvida'
import { Consulta } from '../models/Consulta'
import { Exame } from '../models/Exame'
import { registerSchema, loginSchema } from '../validation'
import { hashPassword, verifyPassword, issueSession, clearSession, requireAuth } from '../auth'
import { rateLimit } from '../rate-limit'
import type { SessionUser } from '../types'

/** For a doctor, seed a realistic (fictional) patient so the pages have content. */
async function seedDemoPatient(userId: string) {
  const nascimento = new Date()
  nascimento.setMonth(nascimento.getMonth() - 4)
  const crianca = await Crianca.create({
    responsavel: userId,
    nome: 'Bebê M. (exemplo)',
    momento: 'ja-nasceu',
    dataNascimento: nascimento,
    vacinasAplicadas: ['bcg', 'hepb-nascer', 'penta-1', 'vip-1', 'pneumo-1', 'rota-1', 'meningo-1'],
  })
  await Prontuario.create({
    crianca: crianca._id,
    tipoSanguineo: 'O+',
    alergias: 'Sem alergias registradas',
    resumoGestacional: 'Gestação a termo (39s). Diabetes gestacional controlada no 2º trimestre. Parto sem intercorrências.',
    condicoes: ['Diabetes gestacional (resolvida no pós-parto)'],
    eventos: [
      { data: nascimento, autorNome: 'Maternidade', autorPapel: 'medico', texto: 'Recém-nascido a termo, Apgar 9/10. Triagem neonatal normal.' },
    ],
  })
  // A couple of example shared questions, as if written by the family.
  await Duvida.create([
    { crianca: crianca._id, autorId: '', autorNome: 'Família (exemplo)', texto: 'É normal o bebê mamar de novo tão pouco tempo depois?', compartilhada: true },
    { crianca: crianca._id, autorId: '', autorNome: 'Família (exemplo)', texto: 'Depois da vacina ele ficou com uma febrinha. Até quando é esperado?', compartilhada: true },
  ])
  // Example consultation + exam so the clinical journey has content.
  await Consulta.create({
    crianca: crianca._id,
    autorId: userId,
    autorNome: 'Consulta anterior',
    tipo: 'pediatrica',
    subjetivo: 'Mãe relata boa aceitação do peito, sono tranquilo.',
    objetivo: 'Ativo, reativo, corado. Peso e estatura no p60.',
    avaliacao: 'Lactente hígido, desenvolvimento adequado para 4 meses.',
    plano: 'Manter aleitamento exclusivo. Retorno em 2 meses. Vacinas de 4m em dia.',
    peso: '6,8 kg',
    altura: '63 cm',
    pressao: '',
  })
  await Exame.create({
    crianca: crianca._id,
    autorId: '',
    autorNome: 'Maternidade (exemplo)',
    nome: 'Triagem neonatal (teste do pezinho)',
    categoria: 'triagem',
    dataExame: nascimento,
    observacoes: 'Resultado normal para todas as condições rastreadas.',
  })
}

export const authRouter = Router()

function toSessionUser(doc: { _id: unknown; papel: string; nome: string }): SessionUser {
  return { id: String(doc._id), papel: doc.papel as SessionUser['papel'], nome: doc.nome }
}

// POST /api/auth/register
authRouter.post('/register', rateLimit({ key: 'register', limit: 5, windowMs: 60_000 }), async (req, res) => {
  const parsed = registerSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Confere os dados, por favor.' })
    return
  }
  const { nome, email, senha, papel, cpf, crm, crmUf } = parsed.data

  const existing = await User.findOne({ email }).lean()
  if (existing) {
    res.status(409).json({ error: 'Já existe uma conta com esse e-mail. Que tal entrar?' })
    return
  }

  const senhaHash = await hashPassword(senha)
  const user = await User.create({
    nome,
    email,
    senhaHash,
    papel,
    // Doctor identity: stored server-side only, verification starts pending.
    cpf: papel === 'medico' ? cpf : undefined,
    crm: papel === 'medico' ? crm : undefined,
    crmUf: papel === 'medico' ? crmUf : undefined,
    verificacaoStatus: papel === 'medico' ? 'pendente' : 'nao_aplicavel',
  })

  // Everyone gets a journey: a mother her own baby, a doctor a demo patient.
  if (papel === 'medico') {
    await seedDemoPatient(String(user._id))
  } else {
    await Crianca.create({ responsavel: user._id, momento: 'gestante' })
  }

  const sessionUser = toSessionUser(user)
  issueSession(res, sessionUser)
  res.status(201).json({ user: sessionUser })
})

// POST /api/auth/login
authRouter.post('/login', rateLimit({ key: 'login', limit: 10, windowMs: 60_000 }), async (req, res) => {
  const parsed = loginSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Confere os dados, por favor.' })
    return
  }
  const { email, senha } = parsed.data

  const user = await User.findOne({ email })
  if (!user || !(await verifyPassword(senha, user.senhaHash))) {
    // Same message either way — never reveal whether the e-mail exists.
    res.status(401).json({ error: 'E-mail ou senha não conferem. Tenta de novo?' })
    return
  }

  const sessionUser = toSessionUser(user)
  issueSession(res, sessionUser)
  res.json({ user: sessionUser })
})

// POST /api/auth/logout
authRouter.post('/logout', (_req, res) => {
  clearSession(res)
  res.status(204).end()
})

// GET /api/auth/me
authRouter.get('/me', requireAuth, async (req, res) => {
  const user = await User.findById(req.user!.id).lean()
  if (!user) {
    clearSession(res)
    res.status(401).json({ error: 'Conta não encontrada.' })
    return
  }
  // CPF is never returned (it's `select: false` and excluded here on purpose).
  res.json({
    user: {
      id: String(user._id),
      nome: user.nome,
      email: user.email,
      papel: user.papel,
      crm: user.crm || undefined,
      crmUf: user.crmUf || undefined,
      verificacaoStatus: user.verificacaoStatus,
    },
  })
})
