/**
 * Os recursos FHIR R4 que o Prumo emite — só o que ele de fato usa.
 *
 * Escrever os tipos à mão em vez de trazer `@types/fhir` é deliberado: aquele
 * pacote tem centenas de milhares de linhas para cobrir a especificação inteira,
 * e o servidor usa oito recursos. Um `Bundle` mal formado aqui não seria pego
 * pelo tipo gigante nem pelo pequeno — o que pega é o teste.
 *
 * ## Versão
 *
 * R4 (4.0.1), que é a que a RNDS usa. FHIR não é retrocompatível entre versões
 * maiores; migrar para R5 um dia será reescrever este arquivo, e é por isso que
 * ele está isolado.
 */

export type FhirData = string

export interface Referencia {
  reference: string
  display?: string
}

export interface Codificacao {
  system?: string
  code?: string
  display?: string
}

export interface ConceitoCodificavel {
  coding?: Codificacao[]
  text?: string
}

export interface Periodo {
  start?: FhirData
  end?: FhirData
}

export interface Quantidade {
  value?: number
  unit?: string
  system?: string
  code?: string
}

interface Base {
  resourceType: string
  id: string
  meta?: { profile?: string[]; lastUpdated?: FhirData }
}

export interface Patient extends Base {
  resourceType: 'Patient'
  active?: boolean
  name?: { use?: string; text?: string }[]
  birthDate?: string
  extension?: { url: string; valueDate?: string; valueString?: string }[]
}

export interface Condition extends Base {
  resourceType: 'Condition'
  clinicalStatus?: ConceitoCodificavel
  code: ConceitoCodificavel
  subject: Referencia
  recordedDate?: FhirData
}

export interface Encounter extends Base {
  resourceType: 'Encounter'
  status: 'finished' | 'in-progress' | 'planned' | 'cancelled'
  class: Codificacao
  type?: ConceitoCodificavel[]
  subject: Referencia
  period?: Periodo
  participant?: { individual?: Referencia }[]
}

export interface Observation extends Base {
  resourceType: 'Observation'
  status: 'final' | 'preliminary' | 'amended'
  category?: ConceitoCodificavel[]
  code: ConceitoCodificavel
  subject: Referencia
  encounter?: Referencia
  effectiveDateTime?: FhirData
  valueQuantity?: Quantidade
  valueString?: string
  component?: { code: ConceitoCodificavel; valueQuantity?: Quantidade; valueString?: string }[]
}

export interface Immunization extends Base {
  resourceType: 'Immunization'
  status: 'completed' | 'entered-in-error' | 'not-done'
  vaccineCode: ConceitoCodificavel
  patient: Referencia
  occurrenceDateTime?: FhirData
  occurrenceString?: string
}

export interface DocumentReference extends Base {
  resourceType: 'DocumentReference'
  status: 'current' | 'superseded' | 'entered-in-error'
  type?: ConceitoCodificavel
  category?: ConceitoCodificavel[]
  subject: Referencia
  date?: FhirData
  description?: string
  content: { attachment: { contentType?: string; title?: string; size?: number; url?: string } }[]
}

export interface MedicationRequest extends Base {
  resourceType: 'MedicationRequest'
  status: 'active' | 'completed' | 'cancelled' | 'stopped'
  intent: 'order'
  medicationCodeableConcept: ConceitoCodificavel
  subject: Referencia
  authoredOn?: FhirData
  requester?: Referencia
  dosageInstruction?: { text?: string }[]
  dispenseRequest?: { validityPeriod?: Periodo }
}

export interface Composition extends Base {
  resourceType: 'Composition'
  status: 'final' | 'preliminary' | 'amended'
  type: ConceitoCodificavel
  subject: Referencia
  date: FhirData
  author: Referencia[]
  title: string
  section?: { title?: string; text?: { status: 'generated'; div: string }; entry?: Referencia[] }[]
}

export interface Practitioner extends Base {
  resourceType: 'Practitioner'
  name?: { text?: string }[]
  identifier?: { system?: string; value?: string }[]
}

export type Recurso =
  | Patient
  | Condition
  | Encounter
  | Observation
  | Immunization
  | DocumentReference
  | MedicationRequest
  | Composition
  | Practitioner

export interface Bundle {
  resourceType: 'Bundle'
  id: string
  type: 'document' | 'collection'
  timestamp: FhirData
  entry: { fullUrl: string; resource: Recurso }[]
}
