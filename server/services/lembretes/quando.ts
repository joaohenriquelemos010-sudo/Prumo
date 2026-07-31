/**
 * De "semana 24 da gestação" para uma data no calendário.
 *
 * Puro, sem banco e com o relógio injetado — mesma forma de `slots.ts`, e pelo
 * mesmo motivo: é aritmética de datas com regra clínica dentro, o tipo de código
 * que erra em silêncio e só aparece quando alguém recebe um lembrete três
 * semanas atrasado.
 */

export interface JanelaChecklist {
  desdeSemana?: number | null
  ateSemana?: number | null
  desdeMes?: number | null
  ateMes?: number | null
}

export interface AncoraJornada {
  /** Data provável do parto. Âncora da contagem em semanas. */
  dpp?: Date | null
  /** Nascimento. Âncora da contagem em meses de vida. */
  nascimento?: Date | null
}

const DIA = 86_400_000

/** A data em que a gestação completa `semana` semanas, contando de trás da DPP. */
export function dataDaSemanaGestacional(dpp: Date, semana: number): Date {
  // 40 semanas é a DPP; a semana N acontece (40 − N) semanas antes dela.
  return new Date(dpp.getTime() - (40 - semana) * 7 * DIA)
}

/** A data em que a criança completa `mes` meses. */
export function dataDoMesDeVida(nascimento: Date, mes: number): Date {
  const d = new Date(nascimento)
  d.setMonth(d.getMonth() + mes)
  return d
}

/**
 * Quando lembrar desta janela — ou `null` se não faz sentido lembrar.
 *
 * Devolve `null` em dois casos, e a diferença entre eles importa:
 *
 * - **Sem âncora.** A jornada não tem DPP nem data de nascimento, então "semana
 *   24" não aponta para nenhum dia. Nada a agendar.
 * - **Janela fechada.** O fim da janela já passou. Este é o caso que evita o
 *   defeito mais provável de todos: atribuir um checklist na semana 30 e
 *   disparar, de uma vez, o lembrete de cada grupo das semanas 1 a 29. Um
 *   lembrete atrasado não ajuda ninguém e ensina a pessoa a ignorar o próximo.
 */
export function quandoLembrar(
  janela: JanelaChecklist | undefined,
  antecedenciaDias: number,
  ancora: AncoraJornada,
  agora = new Date(),
): Date | null {
  if (!janela) return null

  let abertura: Date | null = null
  let fechamento: Date | null = null

  if (janela.desdeSemana != null && ancora.dpp) {
    abertura = dataDaSemanaGestacional(ancora.dpp, janela.desdeSemana)
    if (janela.ateSemana != null) {
      // A janela vale até o **fim** da semana informada.
      fechamento = dataDaSemanaGestacional(ancora.dpp, janela.ateSemana + 1)
    }
  } else if (janela.desdeMes != null && ancora.nascimento) {
    abertura = dataDoMesDeVida(ancora.nascimento, janela.desdeMes)
    if (janela.ateMes != null) {
      fechamento = dataDoMesDeVida(ancora.nascimento, janela.ateMes + 1)
    }
  }

  if (!abertura) return null
  if (fechamento && fechamento.getTime() <= agora.getTime()) return null

  const alvo = new Date(abertura.getTime() - Math.max(0, antecedenciaDias) * DIA)

  // Janela já aberta: lembra agora, não retroativamente. Quem entra no Prumo na
  // semana 30 deve receber o que é da semana 30, e não o histórico dela.
  return alvo.getTime() < agora.getTime() ? new Date(agora) : alvo
}
