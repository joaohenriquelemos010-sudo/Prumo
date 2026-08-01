/**
 * A geometria do calendário.
 *
 * Tudo aqui é função pura sobre minutos — nada de DOM, nada de React. Calendário
 * é o tipo de tela em que o defeito não aparece como erro: um evento desenhado
 * meia hora acima do lugar continua sendo um retângulo bonito, e ninguém percebe
 * até alguém perder a consulta. Por isso a matemática mora separada da pintura,
 * e é testada valor a valor.
 *
 * ## Fuso
 *
 * Os cálculos usam o relógio **local do navegador**, via `getHours()`. É o mesmo
 * que todo o resto do cliente já faz (`horaCurta`, `dataCurta`), e é o certo para
 * quem está no consultório: a médica em São Paulo vê 09:00 porque são 09:00 para
 * ela. O servidor guarda instantes UTC e continua sendo a autoridade sobre
 * conflito de horário.
 */

export interface EventoGrade {
  id: string
  inicio: string
  duracaoMin: number
}

/** Onde o bloco fica dentro da coluna do dia, em porcentagem da altura. */
export interface Posicao {
  topo: number
  altura: number
}

/** Um evento já resolvido: onde fica na vertical e que fatia da largura ocupa. */
export interface Posicionado<T> {
  evento: T
  posicao: Posicao
  /** Índice da coluna dentro do grupo que se sobrepõe. */
  coluna: number
  /** Quantas colunas o grupo tem. 1 = ocupa a largura inteira. */
  colunas: number
}

export interface Faixa {
  /** Minuto do dia em que a grade começa (ex.: 420 = 07:00). */
  de: number
  /** Minuto do dia em que a grade termina. */
  ate: number
}

export const MINUTOS_DIA = 24 * 60

/** Minuto do dia de um instante, no relógio local. */
export function minutoDoDia(iso: string | Date): number {
  const d = typeof iso === 'string' ? new Date(iso) : d0(iso)
  return d.getHours() * 60 + d.getMinutes()
}

function d0(d: Date): Date {
  return d
}

/** 'HH:MM' → minuto do dia. Devolve `null` para o que não for hora. */
export function horaParaMinuto(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim())
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (h > 23 || min > 59) return null
  return h * 60 + min
}

export function minutoParaHora(minuto: number): string {
  const h = Math.floor(minuto / 60)
  const m = minuto % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/**
 * De que hora a que hora a grade é desenhada.
 *
 * A faixa **só cresce, nunca encolhe**. Parte do padrão de um dia de
 * consultório, é ampliada pelo horário de trabalho configurado, e é ampliada de
 * novo por qualquer atendimento fora dele — o encaixe das 20h precisa aparecer,
 * senão a agenda deixa de ser o registro do dia e vira o registro do que estava
 * planejado.
 *
 * ## O bug que esta regra conserta
 *
 * A primeira versão calculava mínimo e máximo **só** do que existia. Um médico
 * recém-cadastrado (sem expediente configurado) com um único atendimento às
 * 23:30 via a grade inteira virar uma faixa de uma hora: 23:00–24:00, o dia de
 * trabalho inteiro fora da tela. Nada quebrava — a agenda só ficava inútil, e
 * parecia quebrada. Começar do padrão e apenas expandir torna esse estado
 * impossível de alcançar.
 *
 * Arredonda para a hora cheia nas duas pontas, porque uma grade que começa em
 * 07:23 não tem linha de referência que ajude o olho.
 */
export function faixaDeHoras(
  eventos: EventoGrade[],
  horariosDeTrabalho: { inicio: string; fim: string }[],
  padrao: Faixa = { de: 7 * 60, ate: 19 * 60 },
): Faixa {
  // O piso é o padrão. Tudo o que vem depois só pode alargar.
  let de = padrao.de
  let ate = padrao.ate

  for (const h of horariosDeTrabalho) {
    const i = horaParaMinuto(h.inicio)
    const f = horaParaMinuto(h.fim)
    if (i !== null) de = Math.min(de, i)
    if (f !== null) ate = Math.max(ate, f)
  }

  for (const e of eventos) {
    const i = minutoDoDia(e.inicio)
    if (!Number.isFinite(i)) continue
    de = Math.min(de, i)
    ate = Math.max(ate, i + e.duracaoMin)
  }

  return {
    de: Math.max(0, Math.floor(de / 60) * 60),
    ate: Math.min(MINUTOS_DIA, Math.ceil(ate / 60) * 60),
  }
}

/**
 * Onde o bloco começa e que altura tem, em % da coluna.
 *
 * Porcentagem e não pixels: a mesma função serve à semana (colunas estreitas) e
 * ao dia (coluna larga), e a altura da grade vira uma decisão de CSS em vez de
 * um número espalhado pelo cálculo.
 *
 * Um evento que ultrapassa o fim da faixa é **cortado**, não estendido: melhor
 * um bloco que termina na borda do que um que escapa do container e cobre o
 * rodapé.
 */
export function posicao(evento: EventoGrade, faixa: Faixa): Posicao {
  const total = faixa.ate - faixa.de
  const inicio = minutoDoDia(evento.inicio)
  const fim = inicio + evento.duracaoMin

  const topo = ((inicio - faixa.de) / total) * 100
  const alturaCrua = ((Math.min(fim, faixa.ate) - Math.max(inicio, faixa.de)) / total) * 100

  return {
    topo: Math.max(0, Math.min(100, topo)),
    // Um piso de altura: uma consulta de 5 minutos vira uma linha ilegível, e a
    // agenda existe para ser lida de longe.
    altura: Math.max(1.5, Math.min(100, alturaCrua)),
  }
}

/**
 * Distribui eventos que se sobrepõem em colunas lado a lado.
 *
 * Sem isto, dois horários no mesmo minuto se desenham um em cima do outro e o de
 * baixo some — que é o pior defeito possível numa agenda, porque o esquecido é
 * invisível. Duplo agendamento acontece de verdade (encaixe, retorno rápido), e
 * a tela tem que mostrar os dois.
 *
 * O algoritmo é o clássico de varredura: eventos ordenados por início formam
 * grupos enquanto houver sobreposição; dentro do grupo, cada um vai para a
 * primeira coluna livre; no fim, todos do grupo dividem a largura igualmente.
 */
export function distribuirColunas<T extends EventoGrade>(eventos: T[]): Posicionado<T>[] {
  const ordenados = [...eventos].sort((a, b) => {
    const ia = minutoDoDia(a.inicio)
    const ib = minutoDoDia(b.inicio)
    if (ia !== ib) return ia - ib
    // Empate no início: o mais longo primeiro, para o curto ficar por cima.
    return b.duracaoMin - a.duracaoMin
  })

  const saida: Posicionado<T>[] = []
  let grupo: Posicionado<T>[] = []
  let fimDoGrupo = -Infinity
  /** Minuto em que cada coluna do grupo atual fica livre. */
  let colunas: number[] = []

  const fecharGrupo = () => {
    const largura = colunas.length || 1
    for (const item of grupo) item.colunas = largura
    saida.push(...grupo)
    grupo = []
    colunas = []
    fimDoGrupo = -Infinity
  }

  for (const e of ordenados) {
    const inicio = minutoDoDia(e.inicio)
    const fim = inicio + e.duracaoMin

    // Não encosta em nada do grupo atual → o grupo acabou.
    if (inicio >= fimDoGrupo) fecharGrupo()

    let coluna = colunas.findIndex((livreEm) => livreEm <= inicio)
    if (coluna === -1) {
      coluna = colunas.length
      colunas.push(fim)
    } else {
      colunas[coluna] = fim
    }

    grupo.push({ evento: e, posicao: { topo: 0, altura: 0 }, coluna, colunas: 1 })
    fimDoGrupo = Math.max(fimDoGrupo, fim)
  }
  fecharGrupo()

  return saida
}

/** As duas coisas juntas: a posição vertical e a fatia horizontal. */
export function posicionar<T extends EventoGrade>(eventos: T[], faixa: Faixa): Posicionado<T>[] {
  return distribuirColunas(eventos).map((p) => ({ ...p, posicao: posicao(p.evento, faixa) }))
}

/** As horas cheias desenhadas como linha de referência. */
export function linhasDeHora(faixa: Faixa): number[] {
  const saida: number[] = []
  for (let m = faixa.de; m <= faixa.ate; m += 60) saida.push(m)
  return saida
}

/** Domingo da semana de `data`, no relógio local. */
export function inicioDaSemana(data: Date): Date {
  const d = new Date(data.getFullYear(), data.getMonth(), data.getDate())
  d.setDate(d.getDate() - d.getDay())
  return d
}

export function diasDaSemana(inicio: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(inicio)
    d.setDate(d.getDate() + i)
    return d
  })
}

/**
 * O número da semana **da faixa exibida**, e não o do primeiro dia dela.
 *
 * A grade começa no domingo, mas a norma ISO começa a semana na segunda — então
 * o domingo de 26/07/2026 pertence à semana 30, enquanto os outros seis dias na
 * tela são a semana 31. Passar `dias[0]` direto para `semanaDoAno` mostrava o
 * número da semana **anterior** o tempo todo, o ano inteiro.
 *
 * A quinta-feira decide, porque é o dia que a ISO usa para desempatar a que ano
 * (e portanto a que semana) um intervalo pertence.
 */
export function semanaExibida(dias: Date[]): number {
  const quinta = dias.find((d) => d.getDay() === 4) ?? dias[Math.floor(dias.length / 2)] ?? dias[0]
  return semanaDoAno(quinta)
}

/**
 * O número da semana no ano (ISO 8601), que é o que aparece no cabeçalho.
 *
 * ISO e não "semana desde 1º de janeiro": é o padrão que agenda de consultório e
 * escala hospitalar usam, e diverge do ingênuo justamente na virada do ano —
 * onde ninguém confere.
 */
export function semanaDoAno(data: Date): number {
  const d = new Date(Date.UTC(data.getFullYear(), data.getMonth(), data.getDate()))
  // Quinta-feira decide a que ano a semana pertence, pela regra ISO.
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7))
  const inicioAno = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d.getTime() - inicioAno.getTime()) / 86_400_000 + 1) / 7)
}
