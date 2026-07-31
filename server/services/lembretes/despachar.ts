import { randomBytes } from 'node:crypto'
import { Lembrete } from '../../models/Lembrete.js'
import type { LembreteDoc } from '../../models/Lembrete.js'
import { PreferenciasNotificacao, normalizarPreferencias } from '../../models/PreferenciasNotificacao.js'
import { User } from '../../models/User.js'
import { podeEnviar, deveColapsar } from './politica.js'
import type { Preferencias } from './politica.js'
import { enviar, envioAtivo } from '../email/index.js'
import { montarEmail } from '../../conteudo/emails/templates.js'
import { env } from '../../env.js'

/** Lease do worker. Um `enviando` mais velho que isso volta para a fila. */
const LEASE_MS = 90_000
/** Teto por execução, para o cron nunca estourar o tempo da função. */
const MAX_POR_RODADA = 50
/** Margem para fechar a rodada com folga antes do timeout. */
const ORCAMENTO_MS = 20_000

export interface ResultadoRodada {
  processados: number
  enviados: number
  adiados: number
  suprimidos: number
  falhas: number
  /** `false` enquanto o SMTP não estiver configurado. */
  envioAtivo: boolean
}

/**
 * Reivindica **um** lembrete devido, atomicamente.
 *
 * `findOneAndUpdate` com filtro em `estado` e `travadoAte` é o que garante que
 * duas execuções sobrepostas do cron nunca peguem o mesmo item. O lease resolve
 * o outro lado: um worker que morre no meio não deixa o lembrete travado para
 * sempre — depois de LEASE_MS ele volta a ser reivindicável.
 *
 * Um `find` seguido de `updateMany` não daria nenhuma das duas garantias, e é
 * exatamente assim que sistemas de notificação passam a mandar e-mail duplicado.
 */
async function reivindicar(agora: Date) {
  return Lembrete.findOneAndUpdate(
    {
      estado: 'agendado',
      agendadoPara: { $lte: agora },
      travadoAte: { $lt: agora },
    },
    {
      $set: { estado: 'enviando', travadoAte: new Date(agora.getTime() + LEASE_MS) },
      $inc: { tentativas: 1 },
    },
    { sort: { prioridade: 1, agendadoPara: 1 }, returnDocument: 'after' },
  )
}

/** As preferências da pessoa, ou os defaults do schema se ela nunca mexeu. */
async function preferenciasDe(userId: string): Promise<Preferencias & { tokenDescadastro: string }> {
  let doc = await PreferenciasNotificacao.findOne({ userId })

  if (!doc) {
    doc = await PreferenciasNotificacao.create({
      userId,
      tokenDescadastro: randomBytes(24).toString('hex'),
    })
  } else if (!doc.tokenDescadastro) {
    doc.tokenDescadastro = randomBytes(24).toString('hex')
    await doc.save()
  }

  return { ...normalizarPreferencias(doc), tokenDescadastro: doc.tokenDescadastro }
}

/**
 * Reivindica os outros lembretes devidos da mesma pessoa, para virarem um resumo.
 *
 * Mesma mecânica de lease do `reivindicar`: cada irmão é tirado da fila
 * atomicamente antes de entrar no resumo, então nenhum deles pode ser pego por
 * uma execução paralela do cron e sair também sozinho.
 *
 * Consultas e resumos ficam fora do filtro: têm horário e ação próprios, e
 * diluí-los num "3 coisas da sua semana" é perder exatamente o que faz o aviso
 * funcionar.
 */
async function reivindicarIrmaos(l: LembreteDoc, agora: Date, max = 4): Promise<LembreteDoc[]> {
  const irmaos: LembreteDoc[] = []

  for (let i = 0; i < max; i++) {
    const outro = await Lembrete.findOneAndUpdate(
      {
        _id: { $ne: l._id },
        destinatarioId: l.destinatarioId,
        canal: 'email',
        estado: 'agendado',
        agendadoPara: { $lte: agora },
        travadoAte: { $lt: agora },
        tipo: { $nin: ['consulta', 'resumo', 'digest'] },
        prioridade: { $gt: 2 },
      },
      { $set: { estado: 'enviando', travadoAte: new Date(agora.getTime() + LEASE_MS) } },
      { sort: { agendadoPara: 1 }, returnDocument: 'after' },
    )
    if (!outro) break
    irmaos.push(outro)
  }

  return irmaos
}

/** Devolve os irmãos para a fila. Usado quando o resumo não vai acontecer. */
async function soltarIrmaos(irmaos: LembreteDoc[]): Promise<void> {
  if (irmaos.length === 0) return
  await Lembrete.updateMany(
    { _id: { $in: irmaos.map((i) => i._id) } },
    { $set: { estado: 'agendado', travadoAte: new Date(0) } },
  )
}

/** Uma linha do resumo, na voz de quem lê — nunca o nome técnico do tipo. */
function linhaDoResumo(l: LembreteDoc): string {
  const titulo = typeof l.carga?.titulo === 'string' ? l.carga.titulo : ''
  if (titulo) return titulo

  const fallback: Record<string, string> = {
    checklist: 'Um passo da sua trilha entrou na janela',
    exame: 'Um exame entrou na janela',
    vacina: 'Uma vacina está chegando',
    sequencia: 'Sua trilha continua aqui',
  }
  return fallback[l.tipo] ?? 'Uma coisa da sua semana'
}

async function historicoDe(userId: string, agora: Date) {
  const umDia = new Date(agora.getTime() - 24 * 60 * 60 * 1000)
  const umaSemana = new Date(agora.getTime() - 7 * 24 * 60 * 60 * 1000)

  const [noDia, naSemana] = await Promise.all([
    Lembrete.countDocuments({ destinatarioId: userId, estado: 'enviado', enviadoEm: { $gte: umDia } }),
    Lembrete.countDocuments({ destinatarioId: userId, estado: 'enviado', enviadoEm: { $gte: umaSemana } }),
  ])

  return { noDia, naSemana }
}

async function despacharUm(lembrete: LembreteDoc, agora: Date, r: ResultadoRodada) {
  const prefs = await preferenciasDe(lembrete.destinatarioId)
  const historico = await historicoDe(lembrete.destinatarioId, agora)

  const decisao = podeEnviar(
    {
      canal: lembrete.canal,
      tipo: lembrete.tipo,
      prioridade: lembrete.prioridade,
      agendadoPara: new Date(lembrete.agendadoPara),
    },
    prefs,
    historico,
    agora,
  )

  if (decisao.acao === 'suprimir') {
    await Lembrete.updateOne(
      { _id: lembrete._id },
      { $set: { estado: 'suprimido', motivoSupressao: decisao.motivo, travadoAte: new Date(0) } },
    )
    r.suprimidos++
    return
  }

  if (decisao.acao === 'adiar') {
    await Lembrete.updateOne(
      { _id: lembrete._id },
      {
        $set: {
          estado: 'agendado',
          agendadoPara: decisao.para,
          motivoSupressao: decisao.motivo,
          travadoAte: new Date(0),
        },
      },
    )
    r.adiados++
    return
  }

  // Canal in-app não tem entrega: existe estando lá quando ela abrir o Prumo.
  if (lembrete.canal !== 'email') {
    await Lembrete.updateOne(
      { _id: lembrete._id },
      { $set: { estado: 'enviado', enviadoEm: agora, travadoAte: new Date(0) } },
    )
    r.enviados++
    return
  }

  const usuario = await User.findById(lembrete.destinatarioId).select('nome email')
  if (!usuario?.email) {
    await Lembrete.updateOne(
      { _id: lembrete._id },
      { $set: { estado: 'suprimido', motivoSupressao: 'sem-email', travadoAte: new Date(0) } },
    )
    r.suprimidos++
    return
  }

  /**
   * Colapso: dois ou mais lembretes devidos hoje viram **um** e-mail.
   *
   * A diferença entre "o Prumo me lembra" e "o Prumo fica me mandando e-mail" é
   * essa — mesma informação, um toque só. Os irmãos são reivindicados antes de
   * qualquer envio, e devolvidos à fila se o resumo não sair.
   *
   * Só vale para e-mail, e por isso hoje quase não roda: com o envio encostado,
   * todo grupo do checklist pede `canal: 'inapp'`, e in-app não colapsa — uma
   * lista de itens numa tela que a pessoa abriu não interrompe ninguém, então
   * juntá-los só esconderia informação. Quando o SMTP entrar e o conteúdo
   * migrar os grupos para e-mail, este caminho passa a ser o normal.
   */
  let irmaos: LembreteDoc[] = []
  const colapsavel = lembrete.tipo !== 'consulta' && lembrete.tipo !== 'resumo' && lembrete.prioridade > 2

  if (colapsavel) {
    irmaos = await reivindicarIrmaos(lembrete, agora)
    // A política decide com a lista inteira em mãos, incluindo o que puxou o lote.
    if (!deveColapsar([lembrete, ...irmaos])) {
      await soltarIrmaos(irmaos)
      irmaos = []
    }
  }

  const email =
    irmaos.length > 0
      ? montarEmail('digest', {
          nome: usuario.nome,
          base: env.APP_URL,
          urlDescadastro: `${env.APP_URL}/api/lembretes/preferencias/${prefs.tokenDescadastro}`,
          carga: { itens: [lembrete, ...irmaos].map(linhaDoResumo) },
        })
      : montarEmail(lembrete.tipo, {
          nome: usuario.nome,
          base: env.APP_URL,
          urlDescadastro: `${env.APP_URL}/api/lembretes/preferencias/${prefs.tokenDescadastro}`,
          carga: (lembrete.carga as Record<string, unknown>) ?? {},
        })

  if (!email) {
    await soltarIrmaos(irmaos)
    await Lembrete.updateOne(
      { _id: lembrete._id },
      { $set: { estado: 'suprimido', motivoSupressao: 'sem-template', travadoAte: new Date(0) } },
    )
    r.suprimidos++
    return
  }

  const resultado = await enviar({
    para: usuario.email,
    assunto: email.assunto,
    html: email.html,
    texto: email.texto,
    cabecalhos: {
      /**
       * Descadastro de um clique. Sem estes cabeçalhos, o Gmail e o Outlook
       * escondem o botão de "cancelar inscrição" e a pessoa usa o de spam — o
       * que derruba a reputação do domínio inteiro.
       */
      'List-Unsubscribe': `<${env.APP_URL}/api/lembretes/descadastrar/${prefs.tokenDescadastro}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  })

  /**
   * Com o transporte `noop` (SMTP ainda não configurado) o lembrete é marcado
   * como enviado mesmo assim. É de propósito: os limites de frequência e a
   * deduplicação continuam se exercitando de verdade, então quando o envio for
   * ligado o comportamento já é o observado, e não uma estreia.
   */
  if (resultado.entregue || resultado.transporte === 'noop') {
    await Lembrete.updateOne(
      { _id: lembrete._id },
      { $set: { estado: 'enviado', enviadoEm: agora, travadoAte: new Date(0), erro: '' } },
    )
    r.enviados++

    /**
     * Os irmãos entram como `suprimido`, e não como `enviado`, de propósito: o
     * limite de frequência conta **toques**, não itens. Três coisas num resumo
     * são um toque, e marcá-las como enviadas queimaria a cota da semana inteira
     * num e-mail só.
     */
    if (irmaos.length > 0) {
      await Lembrete.updateMany(
        { _id: { $in: irmaos.map((i) => i._id) } },
        {
          $set: {
            estado: 'suprimido',
            motivoSupressao: 'colapsado-em-resumo',
            enviadoEm: agora,
            travadoAte: new Date(0),
          },
        },
      )
      r.suprimidos += irmaos.length
      r.processados += irmaos.length
    }
    return
  }

  // Falha real de SMTP: volta para a fila até três tentativas, com espera.
  await soltarIrmaos(irmaos)
  const desiste = lembrete.tentativas >= 3
  await Lembrete.updateOne(
    { _id: lembrete._id },
    {
      $set: {
        estado: desiste ? 'falhou' : 'agendado',
        agendadoPara: new Date(agora.getTime() + 15 * 60_000),
        travadoAte: new Date(0),
        erro: (resultado.erro ?? '').slice(0, 300),
      },
    },
  )
  r.falhas++
}

/**
 * Uma rodada de despacho. Chamada pelo cron externo (cron-job.org).
 *
 * Para por orçamento de tempo e por teto de itens, nunca por fim de fila: o que
 * sobrar é pego na próxima rodada, porque cada item já está persistido com sua
 * hora. Uma rodada que tenta esvaziar tudo é uma rodada que um dia estoura o
 * timeout no meio de um envio.
 */
export async function despacharLembretes(agora = new Date()): Promise<ResultadoRodada> {
  const r: ResultadoRodada = {
    processados: 0,
    enviados: 0,
    adiados: 0,
    suprimidos: 0,
    falhas: 0,
    envioAtivo: envioAtivo(),
  }

  const limite = Date.now() + ORCAMENTO_MS

  while (r.processados < MAX_POR_RODADA && Date.now() < limite) {
    const lembrete = await reivindicar(agora)
    if (!lembrete) break

    r.processados++
    try {
      await despacharUm(lembrete, agora, r)
    } catch (err) {
      r.falhas++
      await Lembrete.updateOne(
        { _id: lembrete._id },
        {
          $set: {
            estado: lembrete.tentativas >= 3 ? 'falhou' : 'agendado',
            travadoAte: new Date(0),
            erro: (err instanceof Error ? err.message : String(err)).slice(0, 300),
          },
        },
      )
    }
  }

  return r
}
