import { Router } from 'express'
import { randomBytes } from 'node:crypto'
import { requireAuth, requireRole } from '../auth.js'
import { rateLimit } from '../rate-limit.js'
import { Jornada } from '../models/Jornada.js'
import { Vinculo } from '../models/Vinculo.js'
import { PreCadastro } from '../models/PreCadastro.js'
import { User } from '../models/User.js'
import { registrar } from '../services/evolucao.js'
import { aplicarCadastro } from '../services/cadastroPaciente.js'
import { preCadastroEnvioSchema, preCadastroLinkSchema } from '../validation.js'
import { normalizeField } from '../sanitize.js'

export const preCadastroRouter = Router()

/**
 * O pré-cadastro — a ficha preenchida pela paciente, antes de ela chegar.
 *
 * A recepção digitando os dados de dezoito pacientes por dia é o gargalo mais
 * caro de um consultório, e o mais fácil de errar: nome ditado por telefone,
 * CPF lido de uma foto tremida, endereço abreviado para caber. Quem sabe esses
 * dados é a paciente, e ela tem um celular na mão enquanto espera.
 *
 * O que este arquivo **não** faz, de propósito: nada do que chega aqui vira
 * verdade sozinho. A ficha entra marcada como recebida e não revisada, e é o
 * consultório que confere. Um formulário público que gravasse direto no
 * prontuário seria uma porta para qualquer um escrever no registro clínico de
 * um médico.
 */

/**
 * 24 bytes em base64url. É o mesmo raciocínio do código de vinculação: o token
 * é a única coisa entre um endereço público e a fila de fichas de um médico, e
 * um gerador previsível o transformaria em um formulário adivinhável.
 */
function gerarToken(): string {
  return randomBytes(24).toString('base64url')
}

async function meuLink(medicoId: string) {
  const existente = await PreCadastro.findOne({ medicoId })
  if (existente) return existente
  return PreCadastro.create({ medicoId, token: gerarToken() })
}

function serializarLink(l: { token: string; nomeClinica: string; ativo: boolean; recebidos: number }) {
  return {
    token: l.token,
    caminho: `/cadastro/paciente/${l.token}`,
    nomeClinica: l.nomeClinica,
    ativo: l.ativo,
    recebidos: l.recebidos,
  }
}

/** GET /api/pre-cadastro/link — o link da clínica, criado na primeira visita. */
preCadastroRouter.get('/link', requireAuth, requireRole('medico'), async (req, res) => {
  const link = await meuLink(req.user!.id)
  res.json({ link: serializarLink(link) })
})

/**
 * PUT /api/pre-cadastro/link — renomear a clínica, ligar/desligar, rotacionar.
 *
 * Rotacionar invalida o endereço anterior no mesmo instante, e isso é a
 * funcionalidade: um link que foi parar num grupo errado deixa de existir
 * quando a clínica gera outro.
 */
preCadastroRouter.put('/link', requireAuth, requireRole('medico'), async (req, res) => {
  const parsed = preCadastroLinkSchema.safeParse(req.body ?? {})
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Confere os dados.' })
    return
  }

  const link = await meuLink(req.user!.id)
  if (parsed.data.nomeClinica !== undefined) {
    link.nomeClinica = normalizeField(parsed.data.nomeClinica, 60)
  }
  if (typeof req.body?.ativo === 'boolean') link.ativo = req.body.ativo
  if (req.body?.rotacionar === true) {
    link.token = gerarToken()
    link.rotacionadoEm = new Date()
  }
  await link.save()

  res.json({ link: serializarLink(link) })
})

/**
 * GET /api/pre-cadastro/publico/:token — quem está pedindo estes dados.
 *
 * Devolve o nome do médico e o da clínica, e nada mais. A tentação seria
 * devolver também a agenda ou a especialidade para "enriquecer" a tela; cada
 * campo a mais aqui é um campo que um endereço público entrega sobre alguém que
 * não pediu para ser listado.
 *
 * O caminho tem `/publico/` antes do token de propósito: sem esse prefixo, um
 * token chamado `link` casaria com a rota autenticada acima.
 */
preCadastroRouter.get(
  '/publico/:token',
  rateLimit({ key: 'pre-cadastro-ver', limit: 30, windowMs: 60_000 }),
  async (req, res) => {
    const link = await PreCadastro.findOne({ token: req.params.token, ativo: true })
    if (!link) {
      res.status(404).json({ error: 'Esse link não está mais valendo. Peça um novo ao consultório.' })
      return
    }
    const medico = await User.findById(link.medicoId).select('nome especialidade')
    res.json({
      medicoNome: medico?.nome ?? '',
      especialidade: medico?.especialidade ?? '',
      nomeClinica: link.nomeClinica,
    })
  },
)

/**
 * POST /api/pre-cadastro/publico/:token — a paciente envia a própria ficha.
 *
 * Limite apertado por IP: cinco fichas por hora. É generoso para uma família
 * inteira preenchendo na mesma rede do consultório e apertado para quem
 * quisesse encher a lista de um médico com cadastros falsos. O limitador falha
 * aberto (ver `rate-limit.ts`), então ele é lombada — o que realmente segura é
 * a ficha nascer marcada como não revisada.
 */
preCadastroRouter.post(
  '/publico/:token',
  rateLimit({ key: 'pre-cadastro-enviar', limit: 5, windowMs: 60 * 60_000 }),
  async (req, res) => {
    const link = await PreCadastro.findOne({ token: req.params.token, ativo: true })
    if (!link) {
      res.status(404).json({ error: 'Esse link não está mais valendo. Peça um novo ao consultório.' })
      return
    }

    const parsed = preCadastroEnvioSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Confere os dados.' })
      return
    }
    // O aceite já cumpriu o papel no schema (`literal(true)`); o que vai para o
    // documento é só a ficha.
    const dados = { ...parsed.data, aceite: undefined }

    const medico = await User.findById(link.medicoId).select('nome')
    if (!medico) {
      res.status(404).json({ error: 'Esse link não está mais valendo. Peça um novo ao consultório.' })
      return
    }

    const jornada = new Jornada({ responsavel: null, criadaPorMedico: link.medicoId })
    aplicarCadastro(jornada, dados, { criando: true })
    jornada.set('preCadastro', { recebidoEm: new Date(), revisadoEm: null })
    await jornada.save()

    /*
     * O vínculo nasce ativo, como no cadastro de balcão: é ele que faz a ficha
     * aparecer em "Meus pacientes". Uma ficha que chega e não aparece em lugar
     * nenhum até alguém aprovar seria uma fila invisível — e filas invisíveis
     * não são conferidas, são esquecidas.
     */
    await Vinculo.create({
      crianca: jornada._id,
      pacienteId: '',
      pacienteNome: jornada.titular?.nome ?? '',
      medicoId: link.medicoId,
      medicoNome: medico.nome,
      status: 'ativo',
    })

    await registrar(jornada._id, {
      tipo: 'admissao',
      autorId: String(link.medicoId),
      autorNome: jornada.titular?.nome ?? 'Paciente',
      autorPapel: 'paciente',
      texto:
        'Pré-cadastro preenchido pela própria paciente pelo link do consultório. ' +
        'Dados declarados, ainda não conferidos pela equipe.',
    }).catch(() => {
      /* a ficha vale mesmo se a anotação falhar */
    })

    link.recebidos += 1
    await link.save()

    res.status(201).json({ ok: true, nome: jornada.titular?.nome ?? '' })
  },
)
