import { Router } from 'express'
import { User } from '../models/User.js'
import { Crianca } from '../models/Crianca.js'
import { Prontuario } from '../models/Prontuario.js'
import { Duvida } from '../models/Duvida.js'
import { Consulta } from '../models/Consulta.js'
import { Exame } from '../models/Exame.js'
import {
  registerSchema,
  loginSchema,
  esqueciSenhaSchema,
  trocarSenhaSchema,
  VERSAO_TERMOS,
} from '../validation.js'
import { auditar, registrar, origem } from '../services/auditoria.js'
import { hashPassword, verifyPassword, issueSession, clearSession, requireAuth } from '../auth.js'
import { rateLimit } from '../rate-limit.js'
import { excluirConta } from '../services/conta.js'
import { montarExportacao } from '../services/exportacao.js'
import { env } from '../env.js'
import type { SessionUser } from '../types.js'

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
  const {
    nome,
    email,
    senha,
    papel,
    cpf,
    telefone,
    dataNascimento,
    aceiteComunicacoes,
    crm,
    crmUf,
    especialidade,
    momento,
    dpp,
    nomeBebe,
    dataNascimentoBebe,
  } = parsed.data

  // The admin account is provisioned/seeded server-side — never via public signup.
  if (papel === 'admin') {
    res.status(400).json({ error: 'Confere os dados, por favor.' })
    return
  }

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
    // CPF é de todo mundo agora, e continua cifrado em repouso e `select: false`:
    // ele entra no cadastro e nunca mais sai pela API.
    cpf,
    telefone,
    dataNascimento: new Date(dataNascimento),
    /** Versão + data: é isso que torna o consentimento auditável. */
    aceiteTermos: { versao: VERSAO_TERMOS, em: new Date() },
    aceiteComunicacoes,
    // Doctor identity: stored server-side only, verification starts pending.
    crm: papel === 'medico' ? crm : undefined,
    crmUf: papel === 'medico' ? crmUf : undefined,
    especialidade: papel === 'medico' ? especialidade : undefined,
    verificacaoStatus: papel === 'medico' ? 'pendente' : 'nao_aplicavel',
  })

  // Everyone gets a journey: a family member their own baby, a doctor a demo patient.
  if (papel === 'medico') {
    await seedDemoPatient(String(user._id))
  } else {
    /**
     * A jornada nasce já com o que a família contou no cadastro. Antes ela
     * nascia sempre como `gestante` vazia, e a pessoa tinha que repetir no
     * perfil o que acabara de digitar — a trilha começava no lugar errado para
     * quem estava planejando ou para quem já tinha o bebê no colo.
     */
    await Crianca.create({
      responsavel: user._id,
      momento: momento ?? 'gestante',
      nome: nomeBebe ?? '',
      dpp: momento === 'gestante' && dpp ? new Date(dpp) : null,
      dataNascimento: momento === 'ja-nasceu' && dataNascimentoBebe ? new Date(dataNascimentoBebe) : null,
    })
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
    /**
     * O log guarda a tentativa, mas **não guarda o e-mail digitado** quando a
     * conta não existe: o log de auditoria viraria uma lista de e-mails
     * testados, e ele é justamente a coleção que mais gente precisa poder ler.
     */
    registrar({
      acao: 'login.falha',
      atorId: user ? String(user._id) : '',
      atorPapel: user?.papel ?? '',
      ...origem(req),
      resultado: 'negado',
      metadados: { contaExiste: Boolean(user) },
    })
    // Same message either way — never reveal whether the e-mail exists.
    res.status(401).json({ error: 'E-mail ou senha não conferem. Tenta de novo?' })
    return
  }

  const sessionUser = toSessionUser(user)
  issueSession(res, sessionUser)
  registrar({
    acao: 'login.sucesso',
    atorId: sessionUser.id,
    atorPapel: sessionUser.papel,
    ...origem(req),
  })
  res.json({ user: sessionUser })
})

// POST /api/auth/logout
authRouter.post('/logout', (_req, res) => {
  clearSession(res)
  res.status(204).end()
})

// POST /api/auth/esqueci-senha — always answers the same, whether or not the
// e-mail exists (no account enumeration). Sending the real reset e-mail needs an
// e-mail provider (see SECURITY.md); here we accept the request and stub it.
authRouter.post('/esqueci-senha', rateLimit({ key: 'esqueci', limit: 5, windowMs: 60_000 }), async (req, res) => {
  const parsed = esqueciSenhaSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Digite um e-mail válido.' })
    return
  }
  if (!env.isProd) {
    const existe = await User.exists({ email: parsed.data.email })
    console.info('[esqueci-senha] pedido para', parsed.data.email, existe ? '(conta existe)' : '(sem conta)')
  }
  // Same response regardless — never reveal whether the account exists.
  res.json({ ok: true })
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
      /** Contato do próprio dono da conta — o CPF continua fora, de propósito. */
      telefone: user.telefone || undefined,
      dataNascimento: user.dataNascimento ? user.dataNascimento.toISOString().slice(0, 10) : undefined,
      crm: user.crm || undefined,
      crmUf: user.crmUf || undefined,
      especialidade: user.especialidade || undefined,
      verificacaoStatus: user.verificacaoStatus,
      /**
       * O cliente precisa saber para poder empurrar a troca. Não é segredo — é
       * um fato sobre a própria conta de quem está pedindo, e escondê-lo só
       * significaria a pessoa não entender por que o app insiste.
       */
      trocaSenhaObrigatoria: Boolean(user.trocaSenhaObrigatoria),
    },
  })
})

/**
 * POST /api/auth/trocar-senha
 *
 * Exige a senha atual mesmo com a sessão já válida. Um cookie roubado não pode
 * virar troca de senha — é assim que um invasor tranca a dona do lado de fora
 * da própria conta, e é a razão de todo produto sério pedir a senha atual aqui.
 *
 * Trocar limpa `trocaSenhaObrigatoria`: é este endpoint que fecha o ciclo da
 * conta de administrador provisionada.
 */
authRouter.post(
  '/trocar-senha',
  requireAuth,
  rateLimit({ key: 'trocar-senha', limit: 5, windowMs: 60_000 }),
  async (req, res) => {
    const parsed = trocarSenhaSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Confere os dados.' })
      return
    }

    const user = await User.findById(req.user!.id)
    if (!user) {
      clearSession(res)
      res.status(401).json({ error: 'Conta não encontrada.' })
      return
    }

    const confere = await verifyPassword(parsed.data.senhaAtual, user.senhaHash)
    if (!confere) {
      registrar({
        acao: 'login.falha',
        atorId: String(user._id),
        atorPapel: user.papel,
        ...origem(req),
        resultado: 'negado',
        metadados: { contexto: 'trocar-senha' },
      })
      res.status(401).json({ error: 'A senha atual não confere.' })
      return
    }

    user.senhaHash = await hashPassword(parsed.data.novaSenha)
    user.trocaSenhaObrigatoria = false
    await user.save()

    res.json({ ok: true })
  },
)

// GET /api/auth/exportar — a full, human-readable copy of everything Prumo
// holds for this account (LGPD data portability). No CPF, no other patients'
// data — only what this account owns or is directly connected to.
authRouter.get('/exportar', requireAuth, auditar('dados.exportar'), async (req, res) => {
  const user = await User.findById(req.user!.id).lean()
  if (!user) {
    clearSession(res)
    res.status(401).json({ error: 'Conta não encontrada.' })
    return
  }
  res.json(await montarExportacao(user, req.user!))
})

// DELETE /api/auth/me — permanently deletes the account and every record tied
// to it (LGPD right to erasure): journeys, clinical records, uploaded exam
// files, connections and invites. Irreversible.
authRouter.delete('/me', requireAuth, async (req, res) => {
  await excluirConta(req.user!.id)
  clearSession(res)
  res.status(204).end()
})
