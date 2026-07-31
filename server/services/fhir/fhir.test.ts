import { describe, it, expect } from 'vitest'
import { pacoteParaFhir, mapearPaciente, mapearObservacoes, mapearPrescricoes } from './index.js'
import type { PacoteClinico } from '../pacoteClinico.js'
import type { Bundle, Composition, Observation, Patient } from './tipos.js'

/**
 * O mapeamento FHIR.
 *
 * Num formato de interoperabilidade, um campo errado não quebra nada aqui — ele
 * aparece do outro lado, semanas depois, como um dado errado no prontuário de
 * outra pessoa. Por isso o mapeamento é puro e testado campo a campo, e não
 * "renderiza sem estourar".
 */
function pacote(over: Partial<PacoteClinico> = {}): PacoteClinico {
  return {
    meta: {
      geradoEm: '2026-03-15T10:30:00.000Z',
      versao: 1,
      jornada: '65f0c1a2b3c4d5e6f7a8b9c0',
      programa: 'materno-infantil',
      integridade: { total: 3, integra: true, quebradaEm: null },
    },
    paciente: {
      nome: 'Marina Souza',
      momento: 'gestante',
      dpp: '2026-08-01T00:00:00.000Z',
      dataNascimento: null,
      tipoSanguineo: 'O+',
      alergias: '',
      resumoGestacional: '',
      resumoNascimento: null,
    },
    condicoes: [{ descricao: 'Diabetes gestacional' }],
    encontros: [
      {
        id: 'aaaaaaaaaaaaaaaaaaaaaaaa',
        data: '2026-03-10T14:00:00.000Z',
        tipo: 'pre-natal',
        autorNome: 'Dra. Alice',
        subjetivo: 'Sem queixas.',
        objetivo: '',
        avaliacao: '',
        avaliacaoOmitida: false,
        plano: '',
        medidas: {},
      },
    ],
    observacoes: [
      {
        tipo: 'biometria-fetal',
        semana: 24,
        data: '2026-03-10T14:00:00.000Z',
        dbpMm: 60,
        ccMm: 220,
        caMm: 195,
        cfMm: 44,
        pfeG: 680,
        ilaCm: 12,
        percentis: {},
      },
      {
        tipo: 'antropometria',
        data: '2026-03-10T14:00:00.000Z',
        encontro: 'aaaaaaaaaaaaaaaaaaaaaaaa',
        pesoKg: 68.4,
        paSistolica: 118,
        paDiastolica: 74,
        bcfBpm: 142,
      },
    ],
    imunizacoes: [{ dose: 'dtpa-gestante', calendario: 'PNI' }],
    documentos: [
      {
        id: 'bbbbbbbbbbbbbbbbbbbbbbbb',
        nome: 'Ultrassom morfológico',
        categoria: 'ultrassom',
        dataExame: '2026-03-08T00:00:00.000Z',
        observacoes: 'Sem alterações.',
        arquivoNome: 'usg.pdf',
        mimeType: 'application/pdf',
        tamanho: 240_000,
        temArquivo: true,
      },
    ],
    prescricoes: [
      {
        id: 'cccccccccccccccccccccccc',
        emitidaEm: '2026-03-10T14:10:00.000Z',
        validaAte: '2026-04-09T14:10:00.000Z',
        tipo: 'simples',
        cancelada: false,
        prescritor: 'Dra. Alice · CRM 123456/SP',
        itens: [
          { medicamento: 'Ácido fólico 5 mg', dose: '1 comprimido', posologia: 'ao dia', duracao: '' },
          { medicamento: 'Sulfato ferroso 40 mg', dose: '1 comprimido', posologia: 'em jejum' },
        ],
        orientacoes: '',
      },
    ],
    narrativa: [
      {
        ordem: 1,
        tipo: 'consulta',
        em: '2026-03-10T14:00:00.000Z',
        autorNome: 'Dra. Alice',
        texto: 'S: sem queixas\nO: PA 118/74',
      },
    ],
    ...over,
  } as PacoteClinico
}

function recursosDo(bundle: Bundle, tipo: string) {
  return bundle.entry.filter((e) => e.resource.resourceType === tipo).map((e) => e.resource)
}

describe('Bundle', () => {
  /**
   * A regra que reprova a maioria dos primeiros Bundles: um documento FHIR
   * **precisa** ter a Composition como primeira entrada. O conteúdo parece
   * certo, e o receptor recusa.
   */
  it('a Composition é a primeira entrada', () => {
    const b = pacoteParaFhir(pacote())
    expect(b.type).toBe('document')
    expect(b.entry[0].resource.resourceType).toBe('Composition')
  })

  it('tem exatamente um Patient', () => {
    expect(recursosDo(pacoteParaFhir(pacote()), 'Patient')).toHaveLength(1)
  })

  it('todo recurso tem resourceType e id', () => {
    for (const e of pacoteParaFhir(pacote()).entry) {
      expect(e.resource.resourceType).toBeTruthy()
      expect(e.resource.id).toBeTruthy()
      expect(e.fullUrl).toBe(`${e.resource.resourceType}/${e.resource.id}`)
    }
  })

  /**
   * Ids determinísticos: o mesmo pacote gerado duas vezes tem que produzir os
   * mesmos ids, senão cada reenvio cria duplicatas do lado do receptor e não há
   * como saber que são a mesma coisa.
   */
  it('os ids são estáveis entre gerações', () => {
    const a = pacoteParaFhir(pacote())
    const b = pacoteParaFhir(pacote())
    expect(a.entry.map((e) => e.fullUrl)).toEqual(b.entry.map((e) => e.fullUrl))
  })

  it('jornadas diferentes geram ids diferentes', () => {
    const a = pacoteParaFhir(pacote())
    const b = pacoteParaFhir(
      pacote({ meta: { ...pacote().meta, jornada: '111111111111111111111111' } }),
    )
    expect(a.entry[1].fullUrl).not.toBe(b.entry[1].fullUrl)
  })

  /** O id interno não pode vazar num identificador público. */
  it('o ObjectId do Prumo não aparece nos ids FHIR', () => {
    const b = pacoteParaFhir(pacote())
    const texto = JSON.stringify(b.entry.map((e) => e.fullUrl))
    expect(texto).not.toContain('65f0c1a2b3c4d5e6f7a8b9c0')
    expect(texto).not.toContain('aaaaaaaaaaaaaaaaaaaaaaaa')
  })

  it('toda referência aponta para um recurso que está no Bundle', () => {
    const b = pacoteParaFhir(pacote())
    const existentes = new Set(b.entry.map((e) => e.fullUrl))

    for (const e of b.entry) {
      const json = JSON.stringify(e.resource)
      for (const m of json.matchAll(/"reference":"([^"]+)"/g)) {
        const alvo = m[1]
        // `Organization/prumo` é a única referência externa, e é intencional:
        // o Prumo é o autor do documento, não um recurso dele.
        if (alvo.startsWith('Organization/')) continue
        expect(existentes.has(alvo)).toBe(true)
      }
    }
  })

  it('um pacote vazio ainda produz um documento válido', () => {
    const b = pacoteParaFhir(
      pacote({
        condicoes: [],
        encontros: [],
        observacoes: [],
        imunizacoes: [],
        documentos: [],
        prescricoes: [],
        narrativa: [],
      }),
    )
    expect(b.entry[0].resource.resourceType).toBe('Composition')
    expect(recursosDo(b, 'Patient')).toHaveLength(1)
  })
})

describe('Patient', () => {
  it('leva o nome e o tipo sanguíneo', () => {
    const p = mapearPaciente(pacote())
    expect(p.name?.[0].text).toBe('Marina Souza')
    expect(p.extension?.some((e) => e.valueString === 'O+')).toBe(true)
  })

  it('birthDate é só o dia, e não o instante', () => {
    const p = mapearPaciente(
      pacote({
        paciente: { ...pacote().paciente, dataNascimento: '2026-01-15T13:45:00.000Z' },
      }),
    )
    expect(p.birthDate).toBe('2026-01-15')
  })

  it('sem data de nascimento o campo some, em vez de virar string vazia', () => {
    const p = mapearPaciente(pacote())
    expect(p.birthDate).toBeUndefined()
  })

  /**
   * O gap que quem for implementar RNDS precisa conhecer antes do primeiro
   * envio recusado: lá o CNS é obrigatório, e o Prumo não coleta.
   */
  it('não inventa identificador nacional', () => {
    const p = mapearPaciente(pacote()) as Patient & { identifier?: unknown }
    expect(p.identifier).toBeUndefined()
  })
})

describe('Observation', () => {
  const paciente = mapearPaciente(pacote())
  const obs = mapearObservacoes(pacote(), paciente)

  function acharPorTexto(t: string): Observation | undefined {
    return obs.find((o) => o.code.text === t)
  }

  it('a idade gestacional sai com LOINC e unidade de semana', () => {
    const ig = acharPorTexto('Idade gestacional')
    expect(ig?.code.coding?.[0].system).toBe('http://loinc.org')
    expect(ig?.code.coding?.[0].code).toBe('11884-4')
    expect(ig?.valueQuantity).toEqual({
      value: 24,
      unit: 'semanas',
      system: 'http://unitsofmeasure.org',
      code: 'wk',
    })
  })

  it('os batimentos fetais saem com LOINC e UCUM corretos', () => {
    const bcf = acharPorTexto('Frequência cardíaca fetal')
    expect(bcf?.code.coding?.[0].code).toBe('55283-6')
    expect(bcf?.valueQuantity?.value).toBe(142)
    expect(bcf?.valueQuantity?.code).toBe('/min')
  })

  /**
   * Onde não há LOINC exato, o código sai como local — e isso é a escolha
   * honesta. Um LOINC "parecido" faz o receptor confiar num código errado, e o
   * dado entra torto no prontuário de outra pessoa.
   */
  it('o peso fetal estimado usa código local, e não um LOINC aproximado', () => {
    const pfe = acharPorTexto('Peso fetal estimado (Hadlock)')
    expect(pfe?.code.coding?.[0].system).toContain('prumo.app')
    expect(pfe?.code.coding?.[0].system).not.toContain('loinc')
    expect(pfe?.valueQuantity?.value).toBe(680)
  })

  it('a pressão vira duas observações, e não uma string', () => {
    expect(acharPorTexto('Pressão sistólica')?.valueQuantity?.value).toBe(118)
    expect(acharPorTexto('Pressão diastólica')?.valueQuantity?.value).toBe(74)
  })

  it('a antropometria referencia o encontro de onde veio', () => {
    const peso = acharPorTexto('Peso corporal')
    expect(peso?.encounter?.reference).toMatch(/^Encounter\/encontro-/)
  })

  it('campos sem mapeamento são ignorados em silêncio, e não viram lixo', () => {
    const so = mapearObservacoes(
      pacote({ observacoes: [{ tipo: 'x', data: '2026-03-10T00:00:00.000Z', inventado: 42 }] }),
      paciente,
    )
    expect(so).toHaveLength(0)
  })

  it('percentis não viram observação — são leitura clínica derivada, não medida', () => {
    expect(obs.some((o) => o.code.text?.toLowerCase().includes('percentil'))).toBe(false)
  })
})

describe('MedicationRequest', () => {
  const paciente = mapearPaciente(pacote())

  /** Em FHIR o recurso é o pedido de UM medicamento. Agrupar perderia a posologia. */
  it('uma receita com dois itens vira dois recursos', () => {
    const rx = mapearPrescricoes(pacote(), paciente)
    expect(rx).toHaveLength(2)
    expect(rx[0].medicationCodeableConcept.text).toBe('Ácido fólico 5 mg')
    expect(rx[1].medicationCodeableConcept.text).toBe('Sulfato ferroso 40 mg')
  })

  it('a posologia vira texto legível', () => {
    const rx = mapearPrescricoes(pacote(), paciente)
    expect(rx[0].dosageInstruction?.[0].text).toBe('1 comprimido · ao dia')
  })

  it('a validade vira dispenseRequest', () => {
    const rx = mapearPrescricoes(pacote(), paciente)
    expect(rx[0].dispenseRequest?.validityPeriod?.end).toBe('2026-04-09T14:10:00.000Z')
  })

  /** Cancelada viaja marcada, e não some: foi prescrita e desfeita. */
  it('receita cancelada vira status cancelled', () => {
    const rx = mapearPrescricoes(
      pacote({
        prescricoes: [
          {
            id: 'dddddddddddddddddddddddd',
            emitidaEm: '2026-03-10T14:10:00.000Z',
            validaAte: '2026-04-09T14:10:00.000Z',
            tipo: 'simples',
            cancelada: true,
            prescritor: 'Dra. Alice',
            itens: [{ medicamento: 'Algo 500 mg' }],
          },
        ],
      }),
      paciente,
    )
    expect(rx[0].status).toBe('cancelled')
  })

  it('item sem nome de medicamento é descartado', () => {
    const rx = mapearPrescricoes(
      pacote({
        prescricoes: [
          {
            id: 'eeeeeeeeeeeeeeeeeeeeeeee',
            emitidaEm: '2026-03-10T14:10:00.000Z',
            validaAte: '2026-04-09T14:10:00.000Z',
            tipo: 'simples',
            cancelada: false,
            prescritor: '',
            itens: [{ medicamento: '' }, { medicamento: 'Válido 10 mg' }],
          },
        ],
      }),
      paciente,
    )
    expect(rx).toHaveLength(1)
  })
})

describe('Composition', () => {
  /**
   * O `div` é XHTML. Um `<` num campo livre de prontuário — "PA < 120/80" —
   * quebraria o documento inteiro do lado do receptor, e é o tipo de defeito que
   * só aparece com dado real.
   */
  it('escapa XHTML na narrativa', () => {
    const b = pacoteParaFhir(
      pacote({
        narrativa: [
          {
            ordem: 1,
            tipo: 'consulta',
            em: '2026-03-10T14:00:00.000Z',
            autorNome: 'Dra. Alice',
            texto: 'PA < 120/80 & sem queixas <script>alert(1)</script>',
          },
        ],
      }),
    )
    const c = b.entry[0].resource as Composition
    const div = c.section?.[0].text?.div ?? ''
    expect(div).not.toContain('<script>')
    expect(div).toContain('&lt;script&gt;')
    expect(div).toContain('&amp;')
  })

  it('quebra de linha vira <br/>, e não some', () => {
    const b = pacoteParaFhir(pacote())
    const div = (b.entry[0].resource as Composition).section?.[0].text?.div ?? ''
    expect(div).toContain('<br/>')
  })

  it('narrativa vazia ainda produz um div válido', () => {
    const b = pacoteParaFhir(pacote({ narrativa: [] }))
    const div = (b.entry[0].resource as Composition).section?.[0].text?.div ?? ''
    expect(div).toContain('xmlns="http://www.w3.org/1999/xhtml"')
    expect(div).toContain('Sem registros')
  })

  it('a seção lista os recursos, sem repetir o Patient', () => {
    const b = pacoteParaFhir(pacote())
    const entradas = (b.entry[0].resource as Composition).section?.[0].entry ?? []
    expect(entradas.some((e) => e.reference.startsWith('Patient/'))).toBe(false)
    expect(entradas.length).toBeGreaterThan(0)
  })
})

describe('DocumentReference', () => {
  /**
   * O binário fica no GridFS. Embutir o PDF em base64 transformaria a
   * transferência num anexo de e-mail com dado de saúde dentro — exatamente o
   * que este produto existe para evitar.
   */
  it('leva a referência, nunca o arquivo', () => {
    const b = pacoteParaFhir(pacote())
    const doc = recursosDo(b, 'DocumentReference')[0] as { content: { attachment: Record<string, unknown> }[] }
    expect(doc.content[0].attachment.data).toBeUndefined()
    expect(doc.content[0].attachment.title).toBe('usg.pdf')
    expect(doc.content[0].attachment.size).toBe(240_000)
  })
})
