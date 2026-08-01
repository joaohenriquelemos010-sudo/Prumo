import {
  ZONA_PADRAO,
  chaveDia,
  diaSemanaDaChave,
  minutosDoDia,
  partesDaData,
  somarDias,
  zonaParaUtc,
} from './fuso.js'

/**
 * Expands weekly availability rules into concrete, bookable slots.
 *
 * Pure on purpose: no database, no clock of its own. The routes hand it the
 * doctor's rules, the appointments already on the books and "now", and it answers
 * with what is actually free. The same function decides what the family sees and
 * whether a booking is allowed — so the list can never disagree with the check.
 */

export interface RegraDisponibilidade {
  diaSemana: number
  inicio: string
  fim: string
  modalidades: string[]
  local?: string
}

export interface BloqueioDisponibilidade {
  de: Date
  ate: Date
}

/** Uma faixa 'HH:MM' que se repete toda semana no relógio do consultório. */
export interface FaixaSemanal {
  diaSemana: number
  inicio: string
  fim: string
  motivo?: string
}

export interface ConfigDisponibilidade {
  ativo: boolean
  /**
   * O intervalo do almoço, em 'HH:MM' no relógio do consultório.
   *
   * Dava para expressar isso com duas regras no mesmo dia (09:00–12:00 e
   * 14:00–18:00) — e era o que existia. Só que ninguém descobre sozinho, e o
   * resultado prático era agenda aberta na hora do almoço. Um campo explícito
   * custa dez linhas e resolve para todos os dias de uma vez.
   */
  almoco?: { inicio: string; fim: string } | null
  duracaoPadraoMin: number
  antecedenciaMinHoras: number
  janelaMaxDias: number
  fuso: string
  regras: RegraDisponibilidade[]
  bloqueios: BloqueioDisponibilidade[]
  /** Pausas por dia. O almoço de terça pode não ser o de quinta. */
  intervalos?: FaixaSemanal[]
  /** Compromisso fixo que volta toda semana — a manhã de cirurgia. */
  bloqueiosSemanais?: FaixaSemanal[]
  /** Janelas extras fora do período, para remarcar quem perdeu a consulta. */
  reposicoes?: FaixaSemanal[]
}

export interface IntervaloOcupado {
  inicio: Date
  duracaoMin: number
}

export interface Slot {
  /** UTC instant, ISO — what the client posts back to book. */
  inicio: string
  duracaoMin: number
  modalidades: string[]
  local: string
  /** Veio de uma janela de reposição, e não do período normal de atendimento. */
  reposicao: boolean
}

export interface DiaComSlots {
  /** 'YYYY-MM-DD' in the clinic's timezone. */
  dia: string
  slots: Slot[]
}

const MINUTO = 60_000

function seSobrepoe(aInicio: number, aFim: number, bInicio: number, bFim: number): boolean {
  return aInicio < bFim && bInicio < aFim
}

interface FaixaMinutos {
  inicio: number
  fim: number
}

/**
 * As faixas de um dia da semana, já em minutos e já descartando o que não fecha.
 *
 * Uma faixa invertida ('18:00' às '08:00') é erro de digitação, não intenção. No
 * lugar de um período que atravessa a meia-noite ela vira nada — o mesmo que o
 * expansor já fazia com uma regra invertida.
 */
function faixasDoDia(faixas: FaixaSemanal[] | undefined, diaSemana: number): FaixaMinutos[] {
  const saida: FaixaMinutos[] = []
  for (const f of faixas ?? []) {
    if (f.diaSemana !== diaSemana) continue
    const inicio = minutosDoDia(f.inicio)
    const fim = minutosDoDia(f.fim)
    if (inicio === null || fim === null || fim <= inicio) continue
    saida.push({ inicio, fim })
  }
  return saida
}

/**
 * Free slots between two calendar days, inclusive, grouped by day.
 *
 * `de` and `ate` are 'YYYY-MM-DD' in the clinic's zone. A slot survives only if
 * it clears every guard: inside a rule's window, not inside a block, far enough
 * ahead to respect the notice period, within the open booking horizon, and not
 * overlapping an appointment that already holds the time.
 */
export function expandirSlots(
  config: ConfigDisponibilidade,
  de: string,
  ate: string,
  ocupados: IntervaloOcupado[],
  agora: Date = new Date(),
): DiaComSlots[] {
  // Uma agenda só de reposição é estranha, mas é uma agenda: quem só abre
  // encaixes de fim de tarde não deve ficar sem horário nenhum.
  if (!config.ativo) return []
  if (config.regras.length === 0 && (config.reposicoes ?? []).length === 0) return []
  if (!partesDaData(de) || !partesDaData(ate)) return []

  const zona = config.fuso || ZONA_PADRAO
  const duracao = config.duracaoPadraoMin
  const naoAntesDe = agora.getTime() + config.antecedenciaMinHoras * 60 * MINUTO
  const naoDepoisDe = agora.getTime() + config.janelaMaxDias * 24 * 60 * MINUTO

  const janelasOcupadas = ocupados.map((o) => ({
    inicio: o.inicio.getTime(),
    fim: o.inicio.getTime() + o.duracaoMin * MINUTO,
  }))
  const bloqueios = config.bloqueios.map((b) => ({
    inicio: new Date(b.de).getTime(),
    fim: new Date(b.ate).getTime(),
  }))

  const dias: DiaComSlots[] = []
  // A hard stop so a malformed range can never spin: the horizon is the limit.
  const maxDias = Math.min(config.janelaMaxDias + 1, 366)

  let chave = de
  const almocoInicio = config.almoco?.inicio ? minutosDoDia(config.almoco.inicio) : null
  const almocoFim = config.almoco?.fim ? minutosDoDia(config.almoco.fim) : null

  for (let i = 0; i < maxDias && chave <= ate; i++, chave = somarDias(chave, 1)) {
    const partes = partesDaData(chave)
    if (!partes) break
    const diaSemana = diaSemanaDaChave(chave)
    const slots: Slot[] = []

    /*
     * Os vácuos do dia. Intervalos e bloqueios semanais são a mesma coisa para o
     * motor — minutos em que não se atende —, e só se separam na tela, porque
     * "almoço" e "manhã de cirurgia" não se preenchem com a mesma cabeça.
     *
     * O almoço legado entra aqui como mais uma faixa: quem configurou a agenda
     * antes da grade semanal continua com o almoço fechado sem precisar reabrir
     * a configuração.
     */
    const vazios: FaixaMinutos[] = [
      ...(almocoInicio !== null && almocoFim !== null && almocoFim > almocoInicio
        ? [{ inicio: almocoInicio, fim: almocoFim }]
        : []),
      ...faixasDoDia(config.intervalos, diaSemana),
      ...faixasDoDia(config.bloqueiosSemanais, diaSemana),
    ]

    /*
     * Período de atendimento primeiro, reposição depois — a ordem é o critério de
     * desempate. Duas janelas que se sobrepõem geram o mesmo instante duas vezes,
     * e oferecer o mesmo horário duas vezes é oferecer uma consulta fantasma.
     */
    const janelas: { regra: RegraDisponibilidade; reposicao: boolean }[] = [
      ...config.regras.filter((r) => r.diaSemana === diaSemana).map((regra) => ({ regra, reposicao: false })),
      ...(config.reposicoes ?? [])
        .filter((r) => r.diaSemana === diaSemana)
        .map((r) => ({
          regra: {
            diaSemana: r.diaSemana,
            inicio: r.inicio,
            fim: r.fim,
            modalidades: ['presencial'],
            local: '',
          } as RegraDisponibilidade,
          reposicao: true,
        })),
    ]

    const jaOferecidos = new Set<string>()

    for (const { regra, reposicao } of janelas) {
      const inicioMin = minutosDoDia(regra.inicio)
      const fimMin = minutosDoDia(regra.fim)
      if (inicioMin === null || fimMin === null || fimMin <= inicioMin) continue

      for (let m = inicioMin; m + duracao <= fimMin; m += duracao) {
        // Vácuos valem por minuto do dia, então são comparados antes de virar
        // instante — a conta não custa fuso e não erra no horário de verão.
        if (vazios.some((v) => seSobrepoe(m, m + duracao, v.inicio, v.fim))) continue

        const inicio = zonaParaUtc(partes.ano, partes.mes, partes.dia, Math.floor(m / 60), m % 60, zona)
        const t = inicio.getTime()
        const fim = t + duracao * MINUTO
        const iso = inicio.toISOString()

        if (jaOferecidos.has(iso)) continue
        if (t < naoAntesDe || t > naoDepoisDe) continue
        if (bloqueios.some((b) => seSobrepoe(t, fim, b.inicio, b.fim))) continue
        if (janelasOcupadas.some((o) => seSobrepoe(t, fim, o.inicio, o.fim))) continue

        jaOferecidos.add(iso)
        slots.push({
          inicio: iso,
          duracaoMin: duracao,
          modalidades: regra.modalidades.length > 0 ? regra.modalidades : ['presencial'],
          local: regra.local ?? '',
          reposicao,
        })
      }
    }

    if (slots.length > 0) {
      slots.sort((a, b) => a.inicio.localeCompare(b.inicio))
      dias.push({ dia: chave, slots })
    }
  }

  return dias
}

/**
 * Whether one specific instant is bookable. The booking route asks this instead
 * of trusting the slot the client sends back — the list it was picked from may
 * be seconds stale, and two people can want the same 09:00.
 */
export function slotDisponivel(
  config: ConfigDisponibilidade,
  inicio: Date,
  ocupados: IntervaloOcupado[],
  agora: Date = new Date(),
): boolean {
  const dia = chaveDia(inicio, config.fuso || ZONA_PADRAO)
  const dias = expandirSlots(config, dia, dia, ocupados, agora)
  const alvo = inicio.toISOString()
  return dias.some((d) => d.slots.some((s) => s.inicio === alvo))
}
