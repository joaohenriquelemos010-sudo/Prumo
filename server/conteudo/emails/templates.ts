/**
 * Os e-mails do Prumo.
 *
 * HTML de e-mail é um mundo próprio: sem flexbox confiável, sem CSS externo,
 * sem `gap`. Tudo aqui é tabela e estilo inline, que é o que o Gmail, o Outlook
 * e o app de e-mail do celular renderizam igual.
 *
 * Toda mensagem carrega um `texto` de verdade — não é fallback decorativo:
 * clientes que bloqueiam HTML, leitores de tela e filtros de spam leem essa
 * versão, e um texto vazio derruba a entregabilidade.
 */

const LILAS = '#b58bfd'
const AZUL = '#5b81fb'
const INDIGO = '#36408c'
const INK = '#2d3363'
const MUTE = '#6b6f96'
const PAPER = '#fdfcff'
const PAPER2 = '#f6f4fc'
const LINE = '#e4e2f2'

export interface EmailMontado {
  assunto: string
  html: string
  texto: string
}

interface Corpo {
  titulo: string
  /** Parágrafos. Cada string vira um `<p>`. */
  paragrafos: string[]
  acao?: { rotulo: string; url: string }
  rodapeExtra?: string
  urlDescadastro: string
}

function escapar(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** O invólucro de todo e-mail: marca, corpo, ação e saída. */
export function montar(corpo: Corpo): { html: string; texto: string } {
  const paragrafos = corpo.paragrafos
    .map(
      (p) =>
        `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:${INK};">${escapar(p)}</p>`,
    )
    .join('')

  const acao = corpo.acao
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0;">
         <tr><td style="border-radius:999px;background:${LILAS};">
           <a href="${corpo.acao.url}" style="display:inline-block;padding:12px 26px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:999px;">${escapar(corpo.acao.rotulo)}</a>
         </td></tr>
       </table>`
    : ''

  const html = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${PAPER2};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAPER2};padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:${PAPER};border:1px solid ${LINE};border-radius:16px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;">
        <tr><td style="height:4px;background:linear-gradient(90deg,${LILAS},${AZUL});font-size:0;line-height:0;">&nbsp;</td></tr>
        <tr><td style="padding:24px 28px 8px;">
          <p style="margin:0;font-size:18px;font-weight:bold;color:${INDIGO};letter-spacing:-0.3px;">Prumo</p>
        </td></tr>
        <tr><td style="padding:4px 28px 24px;">
          <h1 style="margin:0 0 12px;font-size:21px;line-height:1.25;color:${INK};">${escapar(corpo.titulo)}</h1>
          ${paragrafos}
          ${acao}
          ${corpo.rodapeExtra ? `<p style="margin:14px 0 0;font-size:13px;line-height:1.5;color:${MUTE};">${escapar(corpo.rodapeExtra)}</p>` : ''}
        </td></tr>
        <tr><td style="padding:16px 28px 22px;border-top:1px solid ${LINE};">
          <p style="margin:0;font-size:12px;line-height:1.5;color:${MUTE};">
            Você recebe este e-mail porque acompanha sua jornada no Prumo.
            <a href="${corpo.urlDescadastro}" style="color:${INDIGO};">Ajustar ou parar de receber</a> — um clique, sem login.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`

  const texto = [
    'PRUMO',
    '',
    corpo.titulo,
    '',
    ...corpo.paragrafos,
    corpo.acao ? `\n${corpo.acao.rotulo}: ${corpo.acao.url}` : '',
    corpo.rodapeExtra ? `\n${corpo.rodapeExtra}` : '',
    '',
    '---',
    `Ajustar ou parar de receber: ${corpo.urlDescadastro}`,
  ]
    .filter(Boolean)
    .join('\n')

  return { html, texto }
}

export interface DadosTemplate {
  nome?: string
  base: string
  urlDescadastro: string
  carga: Record<string, unknown>
}

const primeiroNome = (nome?: string) => (nome ?? '').split(' ')[0] || 'oi'

function quando(iso: unknown): string {
  if (typeof iso !== 'string') return ''
  return new Date(iso).toLocaleString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Um template por tipo de lembrete.
 *
 * O tom é o mesmo do produto: lembra sem cobrar, explica sem assustar, e sempre
 * oferece a saída. Nenhum assunto usa urgência falsa — "não perca", "última
 * chance" e afins treinam a pessoa a ignorar o próximo, que pode ser o que
 * importava.
 */
export const TEMPLATES: Record<string, (d: DadosTemplate) => EmailMontado> = {
  consulta: (d) => {
    const data = quando(d.carga.inicio)
    const profissional = String(d.carga.profissionalNome ?? 'sua equipe')
    const { html, texto } = montar({
      titulo: 'Sua consulta é amanhã',
      paragrafos: [
        `${primeiroNome(d.nome)}, passando para lembrar: você tem consulta com ${profissional} ${data}.`,
        'Se precisar remarcar, dá para fazer pelo Prumo — quanto antes, mais fácil encontrar outro horário.',
      ],
      acao: { rotulo: 'Ver na agenda', url: `${d.base}/app/agenda` },
      urlDescadastro: d.urlDescadastro,
    })
    return { assunto: `Consulta amanhã, ${data}`, html, texto }
  },

  checklist: (d) => {
    const item = String(d.carga.titulo ?? 'um item do seu checklist')
    const { html, texto } = montar({
      titulo: 'Chegou a hora de um passo da sua trilha',
      paragrafos: [
        `${primeiroNome(d.nome)}, chegou a janela de "${item}".`,
        String(d.carga.porqueImporta ?? 'Está tudo explicado na sua trilha, no seu tempo.'),
      ],
      acao: { rotulo: 'Abrir minha trilha', url: `${d.base}/app/trilha` },
      rodapeExtra: 'Sem pressa — a trilha espera por você.',
      urlDescadastro: d.urlDescadastro,
    })
    return { assunto: `Hora de: ${item}`, html, texto }
  },

  exame: (d) => {
    const { html, texto } = montar({
      titulo: 'Um exame entrou na janela',
      paragrafos: [
        `${primeiroNome(d.nome)}, ${String(d.carga.titulo ?? 'um exame do pré-natal')} costuma ser feito por volta de agora.`,
        'Se sua médica já pediu, é só marcar. Se ainda não, vale perguntar na próxima consulta.',
      ],
      acao: { rotulo: 'Ver na trilha', url: `${d.base}/app/trilha` },
      urlDescadastro: d.urlDescadastro,
    })
    return { assunto: 'Um exame entrou na janela', html, texto }
  },

  vacina: (d) => {
    const { html, texto } = montar({
      titulo: 'Uma vacina está chegando',
      paragrafos: [
        `${primeiroNome(d.nome)}, ${String(d.carga.titulo ?? 'uma dose do calendário')} está prevista para agora.`,
        'O calendário completo, com o que já foi tomado, está no Prumo.',
      ],
      acao: { rotulo: 'Ver as vacinas', url: `${d.base}/app/vacinas` },
      urlDescadastro: d.urlDescadastro,
    })
    return { assunto: 'Uma vacina está chegando', html, texto }
  },

  resumo: (d) => {
    /*
     * A próxima consulta vai no MESMO e-mail.
     *
     * Mandar o resumo hoje e a data do retorno num e-mail separado dobra o
     * número de mensagens e divide a informação que só faz sentido junta: o que
     * ficou combinado, e quando vocês se veem de novo. Quando não há retorno
     * marcado, a frase muda em vez de sumir — "sem retorno marcado" é
     * exatamente o que a paciente precisa saber para ligar.
     */
    const proxima = d.carga.proximaConsulta ? quando(d.carga.proximaConsulta) : null
    const evolucao = Number(d.carga.consultasAnteriores ?? 0)

    const paragrafos = [
      `${primeiroNome(d.nome)}, sua médica deixou um resumo do que vocês conversaram.`,
    ]
    if (evolucao > 0) {
      paragrafos.push(
        `No Prumo ele aparece junto das suas ${evolucao === 1 ? 'outra consulta' : `outras ${evolucao} consultas`}, para você ver a evolução em vez de páginas soltas.`,
      )
    }
    paragrafos.push(
      proxima
        ? `Sua próxima consulta está marcada para ${proxima}.`
        : 'Você ainda não tem a próxima consulta marcada — dá para agendar por aqui quando quiser.',
    )

    const { html, texto } = montar({
      titulo: 'O resumo da sua consulta está pronto',
      paragrafos,
      acao: { rotulo: 'Ler o resumo', url: `${d.base}/app/consultas` },
      urlDescadastro: d.urlDescadastro,
    })
    return { assunto: 'O resumo da sua consulta está pronto', html, texto }
  },

  sequencia: (d) => {
    const { html, texto } = montar({
      titulo: 'Faz uns dias que a gente não se vê',
      paragrafos: [
        `${primeiroNome(d.nome)}, sua trilha continua aqui, do jeito que você deixou.`,
        'Nenhum progresso se perde e nada aqui é cobrança — quando der, a gente continua.',
      ],
      acao: { rotulo: 'Abrir minha trilha', url: `${d.base}/app/trilha` },
      // A "soneca" do Duolingo, sem a culpa: quem quer sumir uma semana tem
      // uma porta que não é o descadastro.
      rodapeExtra: 'Quer uma pausa? Dá para pausar os lembretes por uma semana no link abaixo.',
      urlDescadastro: d.urlDescadastro,
    })
    return { assunto: 'Sua trilha continua aqui', html, texto }
  },

  digest: (d) => {
    const itens = Array.isArray(d.carga.itens) ? (d.carga.itens as string[]) : []
    const { html, texto } = montar({
      titulo: `${itens.length} coisas da sua semana`,
      paragrafos: [
        `${primeiroNome(d.nome)}, juntamos tudo num e-mail só para não encher sua caixa.`,
        ...itens.map((i) => `• ${i}`),
      ],
      acao: { rotulo: 'Abrir o Prumo', url: `${d.base}/app` },
      urlDescadastro: d.urlDescadastro,
    })
    return { assunto: `${itens.length} coisas da sua semana`, html, texto }
  },
}

export function montarEmail(tipo: string, dados: DadosTemplate): EmailMontado | null {
  const fn = TEMPLATES[tipo]
  return fn ? fn(dados) : null
}
