import { horaParaMinuto } from './grade'

/**
 * A semana de trabalho como dado — sem React, sem tela.
 *
 * Mora fora do componente porque quem salva precisa das mesmas regras de quem
 * desenha: se a validação vivesse dentro da grade, a tela que faz o PUT teria de
 * reimplementá-la, e as duas divergiriam no primeiro caso esquisito.
 */

/** Uma faixa 'HH:MM' que se repete toda semana. 0 = domingo. */
export interface FaixaSemanal {
  diaSemana: number
  inicio: string
  fim: string
  motivo?: string
}

export interface PeriodoSemanal extends FaixaSemanal {
  modalidades: string[]
  local: string
}

export interface SemanaConfig {
  periodos: PeriodoSemanal[]
  intervalos: FaixaSemanal[]
  bloqueios: FaixaSemanal[]
  reposicoes: FaixaSemanal[]
}

/**
 * Uma faixa que termina antes de começar.
 *
 * Não existe faixa que atravessa a meia-noite aqui: o motor de slots também a
 * descarta, e fingir na tela que ela vale seria prometer horário que nunca
 * aparece.
 */
export function faixaInvalida(f: { inicio: string; fim: string }): boolean {
  const i = horaParaMinuto(f.inicio)
  const fim = horaParaMinuto(f.fim)
  return i === null || fim === null || fim <= i
}

/** Quantas faixas da semana não fecham — o que impede salvar. */
export function faixasInvalidas(valor: SemanaConfig): number {
  return [...valor.periodos, ...valor.intervalos, ...valor.bloqueios, ...valor.reposicoes].filter(
    faixaInvalida,
  ).length
}

/** O recorte de `/disponibilidade/me` que a grade entende. */
export interface DisponibilidadeSemana {
  almoco?: { inicio: string; fim: string }
  regras?: PeriodoSemanal[]
  intervalos?: FaixaSemanal[]
  bloqueiosSemanais?: FaixaSemanal[]
  reposicoes?: FaixaSemanal[]
}

/**
 * A disponibilidade do servidor vira o estado da grade.
 *
 * O único ponto sutil é o almoço legado: quem configurou a agenda antes desta
 * grade tem uma pausa só, válida para todos os dias. Ela é convertida em um
 * intervalo por dia atendido — senão o almoço sumiria da tela e continuaria
 * valendo no motor, que é a pior combinação possível.
 */
export function daDisponibilidade(d: DisponibilidadeSemana): SemanaConfig {
  const periodos = (d.regras ?? []).map((r) => ({
    diaSemana: r.diaSemana,
    inicio: r.inicio,
    fim: r.fim,
    modalidades: r.modalidades?.length ? r.modalidades : ['presencial'],
    local: r.local ?? '',
  }))

  let intervalos = d.intervalos ?? []
  const almoco = d.almoco
  if (intervalos.length === 0 && almoco?.inicio && almoco?.fim) {
    const dias = [...new Set(periodos.map((p) => p.diaSemana))]
    intervalos = dias.map((diaSemana) => ({ diaSemana, inicio: almoco.inicio, fim: almoco.fim }))
  }

  return {
    periodos,
    intervalos,
    bloqueios: d.bloqueiosSemanais ?? [],
    reposicoes: d.reposicoes ?? [],
  }
}

/**
 * O corpo do PUT com a semana inteira — e só ela.
 *
 * Nada de duração, antecedência ou convênios: o PUT aplica o que recebe, e mandar
 * campo que esta tela não edita é reescrever com cópia velha o que outra acabou
 * de salvar.
 */
export function paraCorpoApi(semana: SemanaConfig) {
  return {
    regras: semana.periodos.map((p) => ({
      diaSemana: p.diaSemana,
      inicio: p.inicio,
      fim: p.fim,
      modalidades: p.modalidades.length > 0 ? p.modalidades : ['presencial'],
      local: p.local ?? '',
    })),
    intervalos: semana.intervalos.map(faixaApi),
    bloqueiosSemanais: semana.bloqueios.map(faixaApi),
    reposicoes: semana.reposicoes.map(faixaApi),
    /*
     * O almoço global sai de cena assim que a grade salva: ele virou um intervalo
     * por dia na leitura, e deixá-lo preenchido faria a mesma pausa existir em
     * dois lugares — dos quais só um seria editável.
     */
    almoco: { inicio: '', fim: '' },
  }
}

function faixaApi(f: FaixaSemanal) {
  return { diaSemana: f.diaSemana, inicio: f.inicio, fim: f.fim, motivo: f.motivo ?? '' }
}

/** As faixas de um dia, na ordem em que estão. */
export function doDia<T extends FaixaSemanal>(lista: T[], dia: number): T[] {
  return lista.filter((f) => f.diaSemana === dia)
}

/** Troca as faixas de um dia mantendo as dos outros — e a ordem por dia. */
export function substituirDia<T extends FaixaSemanal>(lista: T[], dia: number, novas: T[]): T[] {
  return [...lista.filter((f) => f.diaSemana !== dia), ...novas].sort(
    (a, b) => a.diaSemana - b.diaSemana,
  )
}

/**
 * O dia inteiro copiado para os outros — as quatro listas de uma vez.
 *
 * Uma semana de consultório é quase sempre o mesmo dia repetido: 08:00–18:00 com
 * uma hora de almoço, de segunda a sexta. Configurar isso dia a dia é digitar a
 * mesma coisa cinco vezes, e é onde a quarta-feira acaba com o almoço meia hora
 * fora de lugar sem ninguém perceber.
 *
 * Copia por valor e reescreve `diaSemana`: sem isso, as faixas do destino
 * continuariam apontando para o dia de origem e o motor de slots geraria a
 * segunda-feira sete vezes.
 */
export function repetirDia(
  valor: SemanaConfig,
  origem: number,
  destinos: number[],
): SemanaConfig {
  const alvos = destinos.filter((d) => d !== origem)
  if (alvos.length === 0) return valor

  const espalhar = <T extends FaixaSemanal>(lista: T[]): T[] => {
    const modelo = doDia(lista, origem)
    return alvos.reduce(
      (acc, dia) =>
        substituirDia(
          acc,
          dia,
          modelo.map((f) => ({ ...f, diaSemana: dia })),
        ),
      lista,
    )
  }

  return {
    periodos: espalhar(valor.periodos),
    intervalos: espalhar(valor.intervalos),
    bloqueios: espalhar(valor.bloqueios),
    reposicoes: espalhar(valor.reposicoes),
  }
}
