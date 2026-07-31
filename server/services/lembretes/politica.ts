/**
 * A política de envio: **persuasivo sem ser chato**.
 *
 * Este arquivo é puro de propósito — sem banco, sem relógio implícito, sem rede.
 * É a peça em que a diferença entre um produto que ajuda e um que irrita cabe
 * em regras testáveis, e ela merece ser testável.
 *
 * A ideia por trás de cada regra: a pessoa tem um orçamento de atenção pequeno e
 * não renovável. Gastar esse orçamento com um cutucão de sequência significa não
 * ter crédito quando a consulta de amanhã precisar de um aviso. Então a política
 * não pergunta "posso mandar?", pergunta "isto vale o orçamento?".
 */

export type Decisao =
  | { acao: 'enviar' }
  | { acao: 'suprimir'; motivo: string }
  | { acao: 'adiar'; para: Date; motivo: string }

export interface Preferencias {
  canais: { email: boolean; inapp: boolean; push: boolean }
  silencio: { de: string; ate: string; fuso: string }
  limites: { porDia: number; porSemana: number }
  tipos: Record<string, boolean>
  pausadoAte?: Date | null
}

export interface LembreteParaAvaliar {
  canal: 'email' | 'inapp' | 'push'
  tipo: string
  prioridade: number
  agendadoPara: Date
}

export interface HistoricoEnvios {
  /** Enviados nas últimas 24 h. */
  noDia: number
  /** Enviados nos últimos 7 dias. */
  naSemana: number
}

/**
 * Prioridade até aqui fura os limites de frequência.
 *
 * É só a consulta. Faltar a uma consulta de pré-natal custa mais do que um
 * e-mail a mais numa semana movimentada — mas essa exceção precisa ser estreita,
 * senão vira a regra.
 */
const PRIORIDADE_QUE_FURA_LIMITE = 2

/** Minutos desde a meia-noite, no fuso de quem recebe. */
function minutosNoFuso(data: Date, fuso: string): number {
  try {
    const fmt = new Intl.DateTimeFormat('pt-BR', {
      timeZone: fuso,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
    const [h, m] = fmt.format(data).split(':').map(Number)
    return (h ?? 0) * 60 + (m ?? 0)
  } catch {
    // Fuso inválido não pode impedir um lembrete de sair.
    return data.getHours() * 60 + data.getMinutes()
  }
}

function paraMinutos(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return (h ?? 0) * 60 + (m ?? 0)
}

/** Está dentro da janela de silêncio? Cruza a meia-noite sem drama. */
export function emSilencio(agora: Date, silencio: Preferencias['silencio']): boolean {
  const minutos = minutosNoFuso(agora, silencio.fuso)
  const de = paraMinutos(silencio.de)
  const ate = paraMinutos(silencio.ate)

  // 21:00 → 08:00 cruza a meia-noite: é silêncio depois de `de` OU antes de `ate`.
  if (de > ate) return minutos >= de || minutos < ate
  return minutos >= de && minutos < ate
}

/**
 * O próximo instante em que o silêncio abre.
 *
 * Devolve um `Date`, e é por isso que a regra é **adiar e não suprimir**: um
 * lembrete que chega às 8h ainda serve; um lembrete descartado às 2h não serve
 * a ninguém, e a pessoa nunca soube que ele existiu.
 */
export function fimDoSilencio(agora: Date, silencio: Preferencias['silencio']): Date {
  const minutosAgora = minutosNoFuso(agora, silencio.fuso)
  const ate = paraMinutos(silencio.ate)

  let avancar = ate - minutosAgora
  if (avancar <= 0) avancar += 24 * 60

  return new Date(agora.getTime() + avancar * 60_000)
}

/**
 * Vale mandar isto, agora, para esta pessoa?
 *
 * A ordem das checagens não é arbitrária: primeiro o que é escolha explícita
 * dela (canal, tipo, pausa) — nada fura isso —, depois o horário, e só então os
 * limites de volume, que são os únicos que uma prioridade alta pode atravessar.
 */
export function podeEnviar(
  lembrete: LembreteParaAvaliar,
  prefs: Preferencias,
  historico: HistoricoEnvios,
  agora = new Date(),
): Decisao {
  // 1. Ela desligou o canal.
  if (!prefs.canais[lembrete.canal]) {
    return { acao: 'suprimir', motivo: 'canal-desligado' }
  }

  // 2. Ela desligou este tipo. Um tipo desconhecido é tratado como ligado —
  //    conteúdo novo não deve chegar silenciado por omissão do schema.
  if (prefs.tipos[lembrete.tipo] === false) {
    return { acao: 'suprimir', motivo: 'tipo-desligado' }
  }

  // 3. Pausa: a soneca que substitui o descadastro. Adia, não descarta.
  if (prefs.pausadoAte && prefs.pausadoAte.getTime() > agora.getTime()) {
    return { acao: 'adiar', para: new Date(prefs.pausadoAte), motivo: 'pausado' }
  }

  // 4. Horário silencioso → reagenda para a abertura da janela.
  if (emSilencio(agora, prefs.silencio)) {
    return { acao: 'adiar', para: fimDoSilencio(agora, prefs.silencio), motivo: 'horario-silencioso' }
  }

  // 5. Volume. Só a consulta atravessa.
  const fura = lembrete.prioridade <= PRIORIDADE_QUE_FURA_LIMITE
  if (!fura) {
    if (historico.noDia >= prefs.limites.porDia) {
      return { acao: 'adiar', para: proximoDia(agora), motivo: 'limite-diario' }
    }
    if (historico.naSemana >= prefs.limites.porSemana) {
      return { acao: 'adiar', para: proximoDia(agora, 3), motivo: 'limite-semanal' }
    }
  }

  return { acao: 'enviar' }
}

/** Amanhã, no mesmo horário. Adiar preserva a hora do dia que já passou no filtro. */
function proximoDia(agora: Date, dias = 1): Date {
  return new Date(agora.getTime() + dias * 24 * 60 * 60 * 1000)
}

/**
 * Deveriam virar um resumo só?
 *
 * Dois lembretes no mesmo dia para a mesma pessoa são dois toques. Um resumo
 * com as duas coisas é um toque e a mesma informação — e é o que separa "o
 * Prumo me lembra" de "o Prumo fica me mandando e-mail".
 *
 * Consultas ficam de fora: elas têm horário e ação própria, e diluí-las num
 * "3 coisas da sua semana" é perder o que faz o aviso funcionar.
 */
export function deveColapsar(
  pendentes: { tipo: string; prioridade: number }[],
  minimo = 2,
): boolean {
  const colapsaveis = pendentes.filter((l) => l.tipo !== 'consulta' && l.prioridade > 2)
  return colapsaveis.length >= minimo
}
