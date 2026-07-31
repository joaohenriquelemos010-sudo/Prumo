import { createHash } from 'node:crypto'
import type { PacoteClinico } from '../pacoteClinico.js'
import type {
  Bundle,
  Composition,
  Condition,
  DocumentReference,
  Encounter,
  Immunization,
  MedicationRequest,
  Observation,
  Patient,
  Recurso,
  Referencia,
} from './tipos.js'

/**
 * O pacote clínico do Prumo, em FHIR R4.
 *
 * ## Por que isto é só mapeamento
 *
 * Porque a Fase 2 nomeou os campos do pacote como recursos FHIR desde o começo —
 * `encontros` → Encounter, `observacoes` → Observation, `narrativa` →
 * Composition. Aquela decisão de nomenclatura, tomada quando não custava nada, é
 * o motivo de este arquivo ser uma tradução direta em vez de uma reescrita do
 * modelo de dados.
 *
 * ## O que este arquivo NÃO faz, e é importante dizer
 *
 * Ele emite **FHIR R4 base**, estruturalmente válido. Ele **não** emite os
 * perfis da RNDS (`BRIndividuo`, `BRPaciente`, `BRRegistroImunobiologico`…), e
 * não usa a terminologia brasileira (BRVacina, CBO, CID-10 codificado). Isso
 * exige credenciamento no DATASUS e um certificado ICP-Brasil da instituição —
 * e, mais importante, exige mapear cada conceito clínico do Prumo para o código
 * oficial correspondente, que é trabalho de terminologia, não de código.
 *
 * Emitir um Bundle com `meta.profile` da RNDS sem cumprir o perfil seria pior do
 * que não emitir: o servidor da RNDS rejeitaria, e quem lesse o código acharia
 * que está pronto. O que está aqui é honesto sobre o que é — um Bundle FHIR
 * legítimo, que outro sistema de saúde consegue ler hoje, e a base sobre a qual
 * o perfilamento da RNDS entra depois.
 *
 * ## Puro
 *
 * Sem banco, sem relógio implícito. Entra um `PacoteClinico`, sai um `Bundle`.
 * É o que torna cada recurso testável campo a campo — e num formato de
 * interoperabilidade, um campo errado só aparece do outro lado, semanas depois.
 */

const SISTEMA_LOINC = 'http://loinc.org'
const SISTEMA_UCUM = 'http://unitsofmeasure.org'
const SISTEMA_PRUMO = 'https://prumo.app/fhir/CodeSystem'

/**
 * Ids determinísticos, derivados do id do Prumo.
 *
 * O mesmo pacote gerado duas vezes precisa produzir os mesmos ids de recurso —
 * senão cada reenvio para a RNDS cria duplicatas do lado de lá, e não há como
 * saber que são a mesma coisa. Hash em vez do ObjectId cru porque um id FHIR é
 * público por natureza e não deve carregar a chave interna.
 */
function idFhir(prefixo: string, semente: string): string {
  const hash = createHash('sha256').update(`${prefixo}:${semente}`).digest('hex').slice(0, 24)
  return `${prefixo}-${hash}`
}

function ref(recurso: { resourceType: string; id: string }, display?: string): Referencia {
  return { reference: `${recurso.resourceType}/${recurso.id}`, display }
}

/** Só o dia, como FHIR quer em `birthDate`. */
function dataCurta(iso: string | null | undefined): string | undefined {
  return iso ? iso.slice(0, 10) : undefined
}

/* ------------------------------- Patient -------------------------------- */

/**
 * O paciente.
 *
 * **Sem identificador nacional.** O Prumo não coleta CNS nem CPF da paciente — o
 * CPF que existe é do médico, e cifrado. Um `Patient` sem `identifier` é válido
 * em FHIR base, mas é justamente o que a RNDS não aceita: lá o CNS é obrigatório
 * e é a chave de tudo. Está anotado como extensão para quem for implementar não
 * descobrir isso no primeiro envio recusado.
 *
 * A DPP vira extensão, e não um campo qualquer: FHIR base não tem onde guardar
 * data provável de parto num `Patient` — o lugar canônico seria uma `Observation`
 * de idade gestacional (LOINC 11778-8), que é o que também emitimos.
 */
export function mapearPaciente(pacote: PacoteClinico): Patient {
  const p = pacote.paciente as Record<string, unknown>
  const nome = typeof p.nome === 'string' ? p.nome : ''

  const extensoes: Patient['extension'] = []
  if (typeof p.dpp === 'string' && p.dpp) {
    extensoes.push({
      url: 'https://prumo.app/fhir/StructureDefinition/data-provavel-parto',
      valueDate: dataCurta(p.dpp),
    })
  }
  if (typeof p.tipoSanguineo === 'string' && p.tipoSanguineo) {
    extensoes.push({
      url: 'https://prumo.app/fhir/StructureDefinition/tipo-sanguineo',
      valueString: p.tipoSanguineo,
    })
  }

  return {
    resourceType: 'Patient',
    id: idFhir('paciente', pacote.meta.jornada),
    active: true,
    name: nome ? [{ use: 'usual', text: nome }] : undefined,
    birthDate: dataCurta(typeof p.dataNascimento === 'string' ? p.dataNascimento : null),
    extension: extensoes.length > 0 ? extensoes : undefined,
  }
}

/* ------------------------------ Condition -------------------------------- */

/**
 * As condições, como texto.
 *
 * `code.text` sem `coding` é FHIR válido e é o honesto: o Prumo guarda condição
 * como frase livre ("Diabetes gestacional"), e inventar um código CID-10 a partir
 * de texto seria adivinhar um diagnóstico. Um receptor lê o texto; um sistema
 * que exija código sabe que não há.
 */
export function mapearCondicoes(pacote: PacoteClinico, paciente: Patient): Condition[] {
  return pacote.condicoes.map((c, i) => {
    const descricao = (c as { descricao?: string }).descricao ?? ''
    return {
      resourceType: 'Condition',
      id: idFhir('condicao', `${pacote.meta.jornada}:${i}:${descricao}`),
      clinicalStatus: {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
            code: 'active',
          },
        ],
      },
      code: { text: descricao },
      subject: ref(paciente),
    }
  })
}

/* ------------------------------ Encounter -------------------------------- */

export function mapearEncontros(pacote: PacoteClinico, paciente: Patient): Encounter[] {
  return pacote.encontros.map((e) => {
    const c = e as Record<string, unknown>
    const data = typeof c.data === 'string' ? c.data : undefined
    return {
      resourceType: 'Encounter',
      id: idFhir('encontro', String(c.id ?? '')),
      status: 'finished',
      class: {
        system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
        code: 'AMB',
        display: 'ambulatorial',
      },
      type: [{ text: String(c.tipo ?? 'consulta') }],
      subject: ref(paciente),
      period: data ? { start: data } : undefined,
    }
  })
}

/* ----------------------------- Observation ------------------------------- */

/**
 * As medidas, com código LOINC onde ele existe de verdade.
 *
 * Os códigos abaixo foram escolhidos um a um; onde não há LOINC exato — o peso
 * fetal estimado por Hadlock, por exemplo — o recurso sai com código local
 * (`SISTEMA_PRUMO`) e texto legível. Inventar um LOINC "parecido" é pior do que
 * não ter: um receptor confia no código, e um código errado vira o dado errado no
 * prontuário de outra pessoa.
 */
const LOINC: Record<string, { code: string; display: string; unidade: string; ucum: string }> = {
  pesoKg: { code: '29463-7', display: 'Peso corporal', unidade: 'kg', ucum: 'kg' },
  alturaCm: { code: '8302-2', display: 'Estatura', unidade: 'cm', ucum: 'cm' },
  comprimentoCm: { code: '8306-3', display: 'Comprimento deitado', unidade: 'cm', ucum: 'cm' },
  perimetroCefalicoCm: {
    code: '9843-4',
    display: 'Perímetro cefálico',
    unidade: 'cm',
    ucum: 'cm',
  },
  paSistolica: { code: '8480-6', display: 'Pressão sistólica', unidade: 'mmHg', ucum: 'mm[Hg]' },
  paDiastolica: { code: '8462-4', display: 'Pressão diastólica', unidade: 'mmHg', ucum: 'mm[Hg]' },
  bcfBpm: {
    code: '55283-6',
    display: 'Frequência cardíaca fetal',
    unidade: 'bpm',
    ucum: '/min',
  },
  alturaUterinaCm: { code: '11881-0', display: 'Altura uterina', unidade: 'cm', ucum: 'cm' },
}

/** Sem LOINC exato — código local, e dito em voz alta. */
const LOCAL: Record<string, { code: string; display: string; unidade: string; ucum: string }> = {
  pfeG: { code: 'pfe-hadlock', display: 'Peso fetal estimado (Hadlock)', unidade: 'g', ucum: 'g' },
  dbpMm: { code: 'dbp', display: 'Diâmetro biparietal', unidade: 'mm', ucum: 'mm' },
  ccMm: { code: 'cc-fetal', display: 'Circunferência cefálica fetal', unidade: 'mm', ucum: 'mm' },
  caMm: { code: 'ca-fetal', display: 'Circunferência abdominal fetal', unidade: 'mm', ucum: 'mm' },
  cfMm: { code: 'cf', display: 'Comprimento femoral', unidade: 'mm', ucum: 'mm' },
  ilaCm: { code: 'ila', display: 'Índice de líquido amniótico', unidade: 'cm', ucum: 'cm' },
}

function observacaoNumerica(
  chave: string,
  valor: number,
  paciente: Patient,
  semente: string,
  quando?: string,
  encontro?: Referencia,
): Observation | null {
  const loinc = LOINC[chave]
  const local = LOCAL[chave]
  const def = loinc ?? local
  if (!def) return null

  return {
    resourceType: 'Observation',
    id: idFhir('obs', `${semente}:${chave}`),
    status: 'final',
    category: [
      {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/observation-category',
            code: 'vital-signs',
          },
        ],
      },
    ],
    code: {
      coding: [
        { system: loinc ? SISTEMA_LOINC : SISTEMA_PRUMO, code: def.code, display: def.display },
      ],
      text: def.display,
    },
    subject: ref(paciente),
    encounter: encontro,
    effectiveDateTime: quando,
    valueQuantity: { value: valor, unit: def.unidade, system: SISTEMA_UCUM, code: def.ucum },
  }
}

export function mapearObservacoes(pacote: PacoteClinico, paciente: Patient): Observation[] {
  const saida: Observation[] = []

  for (const [i, bruta] of pacote.observacoes.entries()) {
    const o = bruta as Record<string, unknown>
    const quando = typeof o.data === 'string' ? o.data : undefined
    const encontro =
      typeof o.encontro === 'string'
        ? { reference: `Encounter/${idFhir('encontro', o.encontro)}` }
        : undefined
    const semente = `${pacote.meta.jornada}:${i}`

    // Idade gestacional tem LOINC próprio e é o que ancora toda a biometria.
    if (typeof o.semana === 'number') {
      saida.push({
        resourceType: 'Observation',
        id: idFhir('obs', `${semente}:ig`),
        status: 'final',
        code: {
          coding: [{ system: SISTEMA_LOINC, code: '11884-4', display: 'Idade gestacional' }],
          text: 'Idade gestacional',
        },
        subject: ref(paciente),
        effectiveDateTime: quando,
        valueQuantity: { value: o.semana, unit: 'semanas', system: SISTEMA_UCUM, code: 'wk' },
      })
    }

    for (const [chave, valor] of Object.entries(o)) {
      if (typeof valor !== 'number') continue
      if (chave === 'semana') continue
      const obs = observacaoNumerica(chave, valor, paciente, semente, quando, encontro)
      if (obs) saida.push(obs)
    }
  }

  return saida
}

/* ----------------------------- Immunization ------------------------------ */

/**
 * As vacinas.
 *
 * `vaccineCode` sai com código local, e este é o gap de terminologia mais
 * visível do arquivo: a RNDS exige o código BRVacina do imunobiológico, e o
 * Prumo guarda o id do calendário do PNI (`penta-1`, `bcg`). O mapeamento entre
 * os dois é uma tabela de dezenas de linhas que precisa ser conferida por quem
 * entende de imunização — não é código, é conteúdo clínico.
 *
 * `occurrenceString` em vez de `occurrenceDateTime` porque o Prumo registra que
 * a dose foi aplicada, não quando. Mentir uma data aqui seria pior.
 */
export function mapearImunizacoes(pacote: PacoteClinico, paciente: Patient): Immunization[] {
  return pacote.imunizacoes.map((v) => {
    const dose = (v as { dose?: string }).dose ?? ''
    return {
      resourceType: 'Immunization',
      id: idFhir('imunizacao', `${pacote.meta.jornada}:${dose}`),
      status: 'completed',
      vaccineCode: {
        coding: [{ system: `${SISTEMA_PRUMO}/pni`, code: dose }],
        text: dose,
      },
      patient: ref(paciente),
      occurrenceString: 'Registrada na carteira; data não informada.',
    }
  })
}

/* --------------------------- DocumentReference --------------------------- */

/**
 * Os exames — **referência, nunca o binário**.
 *
 * O arquivo fica no GridFS e é buscado pelo app com autenticação. Embutir o PDF
 * do exame em base64 num Bundle transformaria a transferência num anexo de
 * e-mail com dado de saúde dentro, que é exatamente o que este produto existe
 * para evitar.
 */
export function mapearDocumentos(pacote: PacoteClinico, paciente: Patient): DocumentReference[] {
  return pacote.documentos.map((d) => {
    const e = d as Record<string, unknown>
    return {
      resourceType: 'DocumentReference',
      id: idFhir('documento', String(e.id ?? '')),
      status: 'current',
      type: { text: String(e.nome ?? 'Exame') },
      category: [{ text: String(e.categoria ?? 'outro') }],
      subject: ref(paciente),
      date: typeof e.dataExame === 'string' ? e.dataExame : undefined,
      description: typeof e.observacoes === 'string' && e.observacoes ? e.observacoes : undefined,
      content: [
        {
          attachment: {
            contentType: typeof e.mimeType === 'string' && e.mimeType ? e.mimeType : undefined,
            title: typeof e.arquivoNome === 'string' && e.arquivoNome ? e.arquivoNome : undefined,
            size: typeof e.tamanho === 'number' ? e.tamanho : undefined,
          },
        },
      ],
    }
  })
}

/* --------------------------- MedicationRequest --------------------------- */

export function mapearPrescricoes(pacote: PacoteClinico, paciente: Patient): MedicationRequest[] {
  const saida: MedicationRequest[] = []

  for (const bruta of pacote.prescricoes ?? []) {
    const p = bruta as Record<string, unknown>
    const itens = Array.isArray(p.itens) ? (p.itens as Record<string, unknown>[]) : []

    // Uma receita com três medicamentos vira três MedicationRequest: em FHIR o
    // recurso é o pedido de UM medicamento, e agrupar os três num só perderia a
    // posologia de cada um.
    for (const [n, item] of itens.entries()) {
      const nome = String(item.medicamento ?? '')
      if (!nome) continue

      const posologia = [item.dose, item.posologia, item.duracao]
        .filter((x) => typeof x === 'string' && x)
        .join(' · ')

      saida.push({
        resourceType: 'MedicationRequest',
        id: idFhir('prescricao', `${String(p.id ?? '')}:${n}`),
        // Cancelada viaja marcada, e não some: o próximo médico precisa saber
        // que aquilo foi prescrito e desfeito.
        status: p.cancelada ? 'cancelled' : 'active',
        intent: 'order',
        medicationCodeableConcept: { text: nome },
        subject: ref(paciente),
        authoredOn: typeof p.emitidaEm === 'string' ? p.emitidaEm : undefined,
        dosageInstruction: posologia ? [{ text: posologia }] : undefined,
        dispenseRequest:
          typeof p.validaAte === 'string'
            ? {
                validityPeriod: {
                  start: typeof p.emitidaEm === 'string' ? p.emitidaEm : undefined,
                  end: p.validaAte,
                },
              }
            : undefined,
      })
    }
  }

  return saida
}

/* ------------------------------ Composition ------------------------------ */

function escaparXhtml(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * A narrativa — a história clínica encadeada, como um documento.
 *
 * `Composition` é o que transforma um saco de recursos num **documento**: ele diz
 * a ordem, o título e quem assina. Um Bundle `document` sem Composition na
 * primeira posição é inválido em FHIR, e é o erro mais comum de quem começa.
 *
 * O `div` é XHTML, e por isso o texto passa por escape. Um `<` num campo livre
 * de prontuário — "PA < 120/80" — quebraria o documento inteiro do lado do
 * receptor, e é o tipo de defeito que só aparece com dado real.
 */
export function mapearComposicao(
  pacote: PacoteClinico,
  paciente: Patient,
  entradas: Recurso[],
): Composition {
  const narrativa = pacote.narrativa as Record<string, unknown>[]

  const linhas = narrativa
    .map((n) => {
      const em = typeof n.em === 'string' ? n.em.slice(0, 10) : ''
      const autor = typeof n.autorNome === 'string' ? n.autorNome : ''
      const texto = typeof n.texto === 'string' ? n.texto : ''
      return `<p><b>${escaparXhtml(em)}</b> — ${escaparXhtml(autor)}<br/>${escaparXhtml(texto).replace(/\n/g, '<br/>')}</p>`
    })
    .join('')

  return {
    resourceType: 'Composition',
    id: idFhir('composicao', `${pacote.meta.jornada}:${pacote.meta.geradoEm}`),
    status: 'final',
    type: {
      coding: [{ system: SISTEMA_LOINC, code: '11503-0', display: 'Resumo clínico' }],
      text: 'Resumo clínico',
    },
    subject: ref(paciente),
    date: pacote.meta.geradoEm,
    author: [{ reference: `Organization/prumo`, display: 'Prumo' }],
    title: 'Resumo clínico — transferência de cuidado',
    section: [
      {
        title: 'História clínica',
        text: {
          status: 'generated',
          div: `<div xmlns="http://www.w3.org/1999/xhtml">${linhas || '<p>Sem registros.</p>'}</div>`,
        },
        entry: entradas
          .filter((r) => r.resourceType !== 'Patient')
          .map((r) => ({ reference: `${r.resourceType}/${r.id}` })),
      },
    ],
  }
}

/* -------------------------------- Bundle --------------------------------- */

/**
 * O Bundle completo, tipo `document`.
 *
 * A ordem importa: em FHIR, um Bundle `document` **precisa** ter a `Composition`
 * como primeira entrada. Um receptor que siga a especificação recusa o documento
 * se ela não estiver lá — e é o erro mais comum de quem começa em FHIR, porque o
 * conteúdo parece certo.
 */
export function pacoteParaFhir(pacote: PacoteClinico): Bundle {
  const paciente = mapearPaciente(pacote)

  const demais: Recurso[] = [
    ...mapearCondicoes(pacote, paciente),
    ...mapearEncontros(pacote, paciente),
    ...mapearObservacoes(pacote, paciente),
    ...mapearImunizacoes(pacote, paciente),
    ...mapearDocumentos(pacote, paciente),
    ...mapearPrescricoes(pacote, paciente),
  ]

  const composicao = mapearComposicao(pacote, paciente, demais)
  const recursos: Recurso[] = [composicao, paciente, ...demais]

  return {
    resourceType: 'Bundle',
    id: idFhir('bundle', `${pacote.meta.jornada}:${pacote.meta.geradoEm}`),
    type: 'document',
    timestamp: pacote.meta.geradoEm,
    entry: recursos.map((r) => ({
      // `urn:uuid:` seria o correto para um documento sem servidor de origem;
      // usamos a forma relativa porque os ids são estáveis e resolvíveis dentro
      // do próprio Bundle, que é o que um receptor precisa para seguir as
      // referências.
      fullUrl: `${r.resourceType}/${r.id}`,
      resource: r,
    })),
  }
}
