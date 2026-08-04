import { Router } from 'express'
import { isValidObjectId } from 'mongoose'
import type { HydratedDocument } from 'mongoose'
import { requireAuth, requireRole } from '../auth.js'
import { auditar, registrar as auditarAgora } from '../services/auditoria.js'
import { Jornada } from '../models/Jornada.js'
import type { JornadaDoc } from '../models/Jornada.js'
import { Vinculo } from '../models/Vinculo.js'
import { Agendamento } from '../models/Agendamento.js'
import { registrar } from '../services/evolucao.js'
import {
  codigoNovo,
  codigoValido,
  formatarCodigo,
  jornadaVazia,
  normalizarCodigo,
  semConta,
} from '../services/pacientes.js'
import { pacienteCreateSchema, pacientePatchSchema, vincularCodigoSchema } from '../validation.js'
import {
  aplicarCadastro,
  completudeCadastro,
  serializarCadastro,
} from '../services/cadastroPaciente.js'

export const pacientesRouter = Router()

/** "José" e "jose" são a mesma paciente — em português, acento não é identidade. */
function normalizarBusca(v: string): string {
  return v
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
}

export function serialize(j: HydratedDocument<JornadaDoc>) {
  const iso = (d?: Date | null) => (d ? new Date(d).toISOString() : null)
  const pendente = codigoValido(j.vinculacao)
  const ficha = serializarCadastro(j)
  return {
    id: String(j._id),
    nome: j.titular?.nome || j.nome || 'Paciente',
    nomeBebe: j.nome ?? '',
    momento: j.momento,
    dpp: iso(j.dpp),
    dataNascimento: iso(j.dataNascimento),
    temConta: !semConta(j),
    /** Quanto da ficha está preenchido — ver `completudeCadastro`. */
    completude: completudeCadastro(j),
    /**
     * A ficha veio da paciente e ainda não foi conferida? A tela precisa dizer
     * isso em voz alta: até alguém do consultório revisar, aqueles dados são
     * declarados, não verificados.
     */
    preCadastro: {
      recebidoEm: iso(j.preCadastro?.recebidoEm),
      revisadoEm: iso(j.preCadastro?.revisadoEm),
    },
    ...ficha,
    /**
     * O código só volta enquanto vale. Um código expirado exibido na tela é uma
     * promessa que a paciente vai tentar cumprir digitando e não vai funcionar.
     */
    vinculacao: {
      codigo: pendente ? formatarCodigo(j.vinculacao!.codigo!) : '',
      expiraEm: pendente ? iso(j.vinculacao?.expiraEm) : null,
      vinculadaEm: iso(j.vinculacao?.vinculadaEm),
    },
  }
}

/**
 * A jornada precisa existir E ser deste médico. As duas coisas, sempre.
 *
 * `+titular.cpf` e `+convenio.numeroCarteirinha` entram aqui de propósito: os
 * dois são `select: false` e esta é a leitura de **uma** ficha, por quem tem
 * vínculo ativo com ela. Sem eles, abrir o cadastro para corrigir um telefone
 * mostraria o CPF em branco — e salvar apagaria o que estava lá.
 */
async function minhaOr404(id: string, medicoId: string) {
  if (!isValidObjectId(id)) return null
  const vinculo = await Vinculo.exists({ crianca: id, medicoId, status: 'ativo' })
  if (!vinculo) return null
  return Jornada.findById(id).select('+titular.cpf +convenio.numeroCarteirinha')
}

/**
 * POST /api/pacientes — abre uma jornada para quem ainda não tem conta.
 *
 * É o cadastro de balcão: o médico digita o nome, atende, e o registro existe.
 * Nasce com `responsavel: null` e um `Vinculo` já ativo — o vínculo é o que faz a
 * paciente aparecer em "Meus pacientes" e o que autoriza o acesso, e não há
 * motivo para essas duas coisas esperarem por um cadastro que talvez nunca venha.
 */
pacientesRouter.post('/', requireAuth, requireRole('medico'), auditar('paciente.criar', 'criancas'), async (req, res) => {
  const parsed = pacienteCreateSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Confere os dados.' })
    return
  }
  const d = parsed.data

  const jornada = new Jornada({ responsavel: null, criadaPorMedico: req.user!.id })
  aplicarCadastro(jornada, d, { criando: true })
  await jornada.save()

  await Vinculo.create({
    crianca: jornada._id,
    pacienteId: '',
    pacienteNome: jornada.titular?.nome ?? '',
    medicoId: req.user!.id,
    medicoNome: req.user!.nome,
    status: 'ativo',
  })

  // A abertura da jornada é o primeiro fato da história dela.
  await registrar(jornada._id, {
    tipo: 'admissao',
    autorId: req.user!.id,
    autorNome: req.user!.nome,
    autorPapel: req.user!.papel,
    texto: `Cadastro aberto no consultório por ${req.user!.nome}, sem conta na plataforma.`,
  }).catch(() => {
    /* o cadastro vale mesmo se a anotação falhar */
  })

  res.status(201).json({ paciente: serialize(jornada) })
})

/**
 * GET /api/pacientes/procurar?cpf=&nome= — essa paciente já está cadastrada?
 *
 * Cadastro duplicado não é erro de digitação: é a mesma pessoa com dois
 * prontuários, metade da história em cada um. A recepção não tem como saber que
 * a "Maria Silva" de hoje é a "Maria da Silva" de dois anos atrás, então quem
 * precisa saber é o formulário — enquanto ela digita, e não depois de salvar.
 *
 * Declarada **antes** de `/:id` de propósito: o Express casa na ordem, e uma
 * rota literal depois de um parâmetro nunca é alcançada.
 *
 * O CPF é comparado depois de decifrado, um a um. Não há como indexar isso: a
 * cifra é aleatória por gravação (IV novo a cada vez), justamente para que dois
 * CPFs iguais não gerem o mesmo texto cifrado. O custo fica no teto de jornadas
 * do médico, e a alternativa — um hash pesquisável do CPF — devolveria a
 * capacidade de confirmar "fulana é paciente daqui" a quem roubasse o banco.
 */
pacientesRouter.get('/procurar', requireAuth, requireRole('medico'), async (req, res) => {
  const cpf = String(req.query.cpf ?? '').replace(/\D/g, '')
  const nome = normalizarBusca(String(req.query.nome ?? ''))

  // Nada específico o bastante para valer uma varredura.
  if (cpf.length !== 11 && nome.length < 4) {
    res.json({ encontradas: [] })
    return
  }

  const vinculos = await Vinculo.find({ medicoId: req.user!.id, status: 'ativo' })
    .select('crianca')
    .limit(2000)
    .lean()

  const jornadas = await Jornada.find({ _id: { $in: vinculos.map((v) => v.crianca) } })
    .select('+titular.cpf')
    .limit(2000)

  const encontradas = jornadas
    .map((j) => {
      const mesmoCpf = cpf.length === 11 && (j.titular?.cpf ?? '').replace(/\D/g, '') === cpf
      const mesmoNome = nome.length >= 4 && normalizarBusca(j.titular?.nome ?? '') === nome
      if (!mesmoCpf && !mesmoNome) return null
      return {
        id: String(j._id),
        nome: j.titular?.nome || j.nome || 'Paciente',
        dataNascimento: j.titular?.dataNascimento
          ? new Date(j.titular.dataNascimento).toISOString()
          : null,
        // O que casou muda a mensagem: CPF igual é a mesma pessoa; nome igual é
        // uma pergunta.
        por: mesmoCpf ? ('cpf' as const) : ('nome' as const),
      }
    })
    .filter((v): v is NonNullable<typeof v> => v !== null)
    .slice(0, 5)

  res.json({ encontradas })
})

/** GET /api/pacientes/:id — o cabeçalho do hub da paciente. */
pacientesRouter.get('/:id', requireAuth, requireRole('medico'), async (req, res) => {
  const jornada = await minhaOr404(req.params.id, req.user!.id)
  if (!jornada) {
    res.status(404).json({ error: 'Não encontramos essa paciente.' })
    return
  }
  res.json({ paciente: serialize(jornada) })
})

/** PATCH /api/pacientes/:id — corrigir o que foi digitado às pressas. */
pacientesRouter.patch('/:id', requireAuth, requireRole('medico'), async (req, res) => {
  const parsed = pacientePatchSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Confere os dados.' })
    return
  }
  const jornada = await minhaOr404(req.params.id, req.user!.id)
  if (!jornada) {
    res.status(404).json({ error: 'Não encontramos essa paciente.' })
    return
  }
  const d = parsed.data

  aplicarCadastro(jornada, d)
  /*
   * Salvar a ficha É a revisão. Não existe um botão "conferi" separado de
   * propósito: um segundo botão viraria um passo que ninguém aperta, e a marca
   * de "não conferido" ficaria para sempre numa ficha já corrigida.
   */
  if (jornada.preCadastro?.recebidoEm && !jornada.preCadastro?.revisadoEm) {
    jornada.set('preCadastro.revisadoEm', new Date())
  }
  await jornada.save()

  // O nome também vive no vínculo, que é o que a lista lê sem abrir a jornada.
  if (d.nome !== undefined) {
    await Vinculo.updateOne(
      { crianca: jornada._id, medicoId: req.user!.id },
      { $set: { pacienteNome: jornada.titular?.nome ?? '' } },
    )
  }

  res.json({ paciente: serialize(jornada) })
})

/**
 * POST /api/pacientes/:id/codigo — gera o código que a paciente vai digitar.
 *
 * Regerar invalida o anterior, e isso é a funcionalidade: um código anotado num
 * papel que se perdeu deixa de existir no momento em que o médico gera outro.
 */
pacientesRouter.post('/:id/codigo', requireAuth, requireRole('medico'), async (req, res) => {
  const jornada = await minhaOr404(req.params.id, req.user!.id)
  if (!jornada) {
    res.status(404).json({ error: 'Não encontramos essa paciente.' })
    return
  }
  if (!semConta(jornada)) {
    res.status(409).json({ error: 'Essa paciente já tem conta vinculada.' })
    return
  }

  jornada.vinculacao = { ...codigoNovo(), vinculadaEm: null }
  await jornada.save()
  res.json({ paciente: serialize(jornada) })
})

/** DELETE /api/pacientes/:id/codigo — o médico corta o convite. */
pacientesRouter.delete('/:id/codigo', requireAuth, requireRole('medico'), async (req, res) => {
  const jornada = await minhaOr404(req.params.id, req.user!.id)
  if (!jornada) {
    res.status(404).json({ error: 'Não encontramos essa paciente.' })
    return
  }
  jornada.vinculacao = { codigo: '', geradoEm: null, expiraEm: null, vinculadaEm: null }
  await jornada.save()
  res.json({ paciente: serialize(jornada) })
})

/**
 * POST /api/pacientes/vincular — a paciente reivindica a própria jornada.
 *
 * Quem age aqui é a paciente, com o código em mãos, e não o médico apontando
 * para um e-mail. A diferença não é de estilo: um erro de digitação do médico
 * entregaria o prontuário inteiro para outra pessoa, e ninguém perceberia. Com o
 * código, o registro só encontra dono quando quem esteve na consulta age.
 *
 * O que acontece por dentro é uma **adoção, não uma cópia**: a jornada do
 * consultório passa a ser a jornada da conta, com o histórico inteiro no lugar.
 * A jornada automática que o cadastro criou é descartada — e só se estiver
 * vazia, verificado coleção por coleção.
 */
pacientesRouter.post('/vincular', requireAuth, async (req, res) => {
  const parsed = vincularCodigoSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Confere o código.' })
    return
  }
  const codigo = normalizarCodigo(parsed.data.codigo)
  if (codigo.length < 6) {
    res.status(400).json({ error: 'Esse código não parece completo.' })
    return
  }

  // Um médico não reivindica jornada para si: ele já tem acesso pelo vínculo, e
  // virar responsável o tornaria a família do próprio paciente.
  if (req.user!.papel === 'medico') {
    res.status(403).json({ error: 'Códigos de vinculação são para a paciente, não para o médico.' })
    return
  }

  const alvo = await Jornada.findOne({ 'vinculacao.codigo': codigo })
  if (!alvo || !semConta(alvo)) {
    res.status(404).json({ error: 'Código não encontrado. Confere com quem te atendeu.' })
    return
  }
  if (!codigoValido(alvo.vinculacao)) {
    res.status(410).json({ error: 'Esse código expirou. Peça um novo ao seu médico.' })
    return
  }

  /*
   * Antes de tocar em qualquer coisa: as jornadas que a conta já tem podem ser
   * descartadas? Perguntar primeiro e só então reivindicar é o que garante que
   * uma recusa aqui deixe tudo exatamente como estava.
   */
  const minhas = await Jornada.find({ responsavel: req.user!.id })
  for (const minha of minhas) {
    if (!(await jornadaVazia(minha._id))) {
      res.status(409).json({
        error:
          'Você já tem uma jornada com registros nesta conta. Peça ao seu médico para transferir o prontuário em vez de vincular.',
      })
      return
    }
  }

  /*
   * A reivindicação é uma escrita condicional só: quem chegar primeiro leva. Ler
   * e depois gravar deixaria duas pessoas com o mesmo código virarem donas da
   * mesma jornada — e a segunda apagaria a primeira sem aviso.
   */
  const jornada = await Jornada.findOneAndUpdate(
    { _id: alvo._id, 'vinculacao.codigo': codigo, responsavel: null },
    {
      $set: {
        responsavel: req.user!.id,
        'vinculacao.codigo': '',
        'vinculacao.expiraEm': null,
        'vinculacao.vinculadaEm': new Date(),
      },
    },
    { returnDocument: 'after' },
  )
  if (!jornada) {
    res.status(409).json({ error: 'Esse código acabou de ser usado.' })
    return
  }

  // Só agora, com a adoção feita, as jornadas vazias saem de cena.
  await Jornada.deleteMany({ _id: { $in: minhas.map((m) => m._id) }, responsavel: req.user!.id })

  /*
   * O que estava marcado como "sem conta" passa a apontar para a conta. Sem isto
   * a paciente entraria e não veria os próprios agendamentos, e o médico veria
   * um nome antigo na lista — o vínculo estaria certo e a tela, errada.
   */
  await Promise.all([
    Vinculo.updateMany(
      { crianca: jornada._id },
      { $set: { pacienteId: req.user!.id, pacienteNome: req.user!.nome } },
    ),
    Agendamento.updateMany(
      { crianca: jornada._id, pacienteId: '' },
      { $set: { pacienteId: req.user!.id, pacienteNome: req.user!.nome } },
    ),
  ])

  await registrar(jornada._id, {
    tipo: 'evolucao',
    autorId: req.user!.id,
    autorNome: req.user!.nome,
    autorPapel: req.user!.papel,
    texto: `${req.user!.nome} vinculou a própria conta a este prontuário.`,
  }).catch(() => {
    /* a vinculação vale mesmo se a anotação falhar */
  })

  auditarAgora({
    acao: 'paciente.vincular',
    atorId: req.user!.id,
    atorPapel: req.user!.papel,
    recurso: { colecao: 'criancas', id: String(jornada._id) },
    jornada: String(jornada._id),
    ip: req.ip,
    userAgent: req.get('user-agent') ?? '',
  })

  res.json({ vinculada: true, jornada: String(jornada._id) })
})
