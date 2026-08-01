/**
 * Insights de pacientes — o consultório visto de cima.
 *
 * Puro de propósito: a agregação vem do banco em `routes/vinculos.ts`, e o que
 * *significa* fica aqui, testável sem subir nada. Um painel de números errados é
 * pior que painel nenhum — ele muda decisão de agenda com confiança injustificada.
 *
 * O corte não é estatístico, é operacional. Cada número existe para responder
 * uma pergunta que muda o que o médico faz hoje:
 *
 *  - quantas estão no 3º trimestre → quantas consultas quinzenais vêm por aí;
 *  - quantas estão sem retorno marcado → quem vai sumir se ninguém ligar;
 *  - quantas ainda não têm conta → quanto do produto ainda é invisível para as
 *    pacientes, que é a métrica do modelo B2B2C inteiro.
 */

export interface PacienteBruto {
  jornada: string
  nome: string
  momento: 'planejando' | 'gestante' | 'ja-nasceu' | null
  dpp: Date | null
  dataNascimento: Date | null
  temConta: boolean
  /** Próximo agendamento futuro com este médico, se houver. */
  proximo: Date | null
  ultimaConsulta: Date | null
  alertas: number
}

export interface Insights {
  total: number
  gestantes: { total: number; primeiro: number; segundo: number; terceiro: number }
  criancas: { total: number; ate6meses: number; ate2anos: number; maiores: number }
  semConta: number
  semRetorno: number
  /** Sem consulta há mais de 90 dias e sem retorno marcado. */
  emRisco: { jornada: string; nome: string; diasSemConsulta: number }[]
  comAlerta: number
  /** Quantas entram em trabalho de parto nos próximos 30 dias. */
  partosProximos: number
}

const DIA = 24 * 60 * 60 * 1000

/** Uma gestação a termo tem 280 dias contados da DUM. */
const GESTACAO_DIAS = 280

/**
 * Semanas de gestação numa data, a partir da DPP.
 *
 * Local e não importado: é uma subtração, e trazê-la de outro módulo só para
 * economizar três linhas ataria este cálculo a mudanças de um arquivo de fuso
 * horário que não tem nada a ver com obstetrícia.
 */
function semanasDeGestacao(dpp: Date, agora: Date): number {
  const diasAteDpp = (dpp.getTime() - agora.getTime()) / DIA
  return Math.floor((GESTACAO_DIAS - diasAteDpp) / 7)
}

/** 90 dias sem aparecer e sem nada marcado é quando alguém some de verdade. */
const DIAS_ABANDONO = 90

export function calcularInsights(pacientes: PacienteBruto[], agora = new Date()): Insights {
  const r: Insights = {
    total: pacientes.length,
    gestantes: { total: 0, primeiro: 0, segundo: 0, terceiro: 0 },
    criancas: { total: 0, ate6meses: 0, ate2anos: 0, maiores: 0 },
    semConta: 0,
    semRetorno: 0,
    emRisco: [],
    comAlerta: 0,
    partosProximos: 0,
  }

  for (const p of pacientes) {
    if (!p.temConta) r.semConta++
    if (p.alertas > 0) r.comAlerta++

    const temRetornoMarcado = p.proximo !== null && p.proximo.getTime() > agora.getTime()
    if (!temRetornoMarcado) r.semRetorno++

    if (p.momento === 'gestante' && p.dpp) {
      r.gestantes.total++
      const semanas = semanasDeGestacao(p.dpp, agora)
      // Os trimestres reais da obstetrícia, não terços do calendário.
      if (semanas <= 13) r.gestantes.primeiro++
      else if (semanas <= 27) r.gestantes.segundo++
      else r.gestantes.terceiro++

      const faltam = (p.dpp.getTime() - agora.getTime()) / DIA
      if (faltam >= 0 && faltam <= 30) r.partosProximos++
    }

    if (p.momento === 'ja-nasceu' && p.dataNascimento) {
      r.criancas.total++
      const meses = (agora.getTime() - p.dataNascimento.getTime()) / (DIA * 30.44)
      if (meses <= 6) r.criancas.ate6meses++
      else if (meses <= 24) r.criancas.ate2anos++
      else r.criancas.maiores++
    }

    /*
     * Em risco de abandono. A gestante que não volta é o desfecho que o
     * pré-natal existe para evitar, e é invisível numa lista ordenada por
     * urgência: quem não tem horário marcado simplesmente não aparece.
     */
    if (!temRetornoMarcado && p.ultimaConsulta) {
      const dias = Math.floor((agora.getTime() - p.ultimaConsulta.getTime()) / DIA)
      if (dias >= DIAS_ABANDONO) {
        r.emRisco.push({ jornada: p.jornada, nome: p.nome, diasSemConsulta: dias })
      }
    }
  }

  // Quem sumiu há mais tempo primeiro — é quem se perde de vez se ninguém ligar.
  r.emRisco.sort((a, b) => b.diasSemConsulta - a.diasSemConsulta)
  r.emRisco = r.emRisco.slice(0, 20)

  return r
}
