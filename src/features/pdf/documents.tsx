import { Document, Page, View, Text, StyleSheet, PDFDownloadLink } from '@react-pdf/renderer'

/**
 * All Prumo PDF documents in one module → a single lazy @react-pdf chunk shared
 * by every page. Brand-flavoured but print-legible (built-in Helvetica, so
 * generation never depends on a network font fetch). Client-side only, ideal for
 * Vercel Free. Every document carries the same header + disclaimer footer.
 */

const INDIGO = '#36408c'
const LILAS = '#b58bfd'
const AZUL = '#5b81fb'
const INK = '#2d3363'
const MUTE = '#6b6f96'
const LINE = '#e4e2f2'
const SUCCESS = '#3f9a6a'
const WARN = '#b8791f'

const s = StyleSheet.create({
  page: { paddingTop: 44, paddingBottom: 56, paddingHorizontal: 44, fontSize: 11, color: INK, fontFamily: 'Helvetica' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  brand: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: INDIGO },
  bar: { height: 4, borderRadius: 2, backgroundColor: LILAS, marginBottom: 16 },
  title: { fontSize: 15, fontFamily: 'Helvetica-Bold', color: INK, marginBottom: 2 },
  sub: { fontSize: 10, color: MUTE, marginBottom: 16 },
  section: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: INDIGO, marginTop: 14, marginBottom: 6 },
  row: { flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: LINE, paddingVertical: 4 },
  cardTitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: INK },
  small: { fontSize: 9.5, color: MUTE },
  card: { borderWidth: 1, borderColor: LINE, borderRadius: 8, padding: 10, marginBottom: 8 },
  footer: { position: 'absolute', bottom: 28, left: 44, right: 44, fontSize: 8, color: MUTE, textAlign: 'center', borderTopWidth: 1, borderTopColor: LINE, paddingTop: 8 },
})

function Shell({ titulo, sub, children }: { titulo: string; sub?: string; children: React.ReactNode }) {
  const geradoEm = new Date().toLocaleDateString('pt-BR')
  return (
    <Page size="A4" style={s.page}>
      <View style={s.header}>
        <Text style={s.brand}>Prumo</Text>
        <Text style={{ fontSize: 9, color: MUTE }}>Gerado em {geradoEm}</Text>
      </View>
      <View style={s.bar} />
      <Text style={s.title}>{titulo}</Text>
      {sub ? <Text style={s.sub}>{sub}</Text> : <View style={{ marginBottom: 16 }} />}
      {children}
      <Text style={s.footer} fixed>
        Documento gerado pela Prumo · conteúdo informativo · não substitui documento oficial nem a orientação da sua equipe de saúde.
      </Text>
    </Page>
  )
}

/* ----------------------------- Caderninho ----------------------------- */

export interface DuvidaPDF {
  id: string
  texto: string
  criadaEm: string
  respondida: boolean
  respostaTexto: string
  respondidaPor: string
}

function agruparPorDia(duvidas: DuvidaPDF[]): [string, DuvidaPDF[]][] {
  const map = new Map<string, DuvidaPDF[]>()
  for (const d of duvidas) {
    const dia = new Date(d.criadaEm).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
    const arr = map.get(dia) ?? []
    arr.push(d)
    map.set(dia, arr)
  }
  return [...map.entries()]
}

export function CaderninhoDocument({ duvidas, nome }: { duvidas: DuvidaPDF[]; nome?: string }) {
  const grupos = agruparPorDia(duvidas)
  return (
    <Document title="Caderninho de Dúvidas — Prumo" author="Prumo">
      <Shell titulo="Caderninho de Dúvidas" sub={`${nome ? `${nome} · ` : ''}Perguntas para conversar com a equipe de saúde`}>
        {grupos.length === 0 ? (
          <Text style={{ color: MUTE }}>Nenhuma dúvida anotada ainda.</Text>
        ) : (
          grupos.map(([dia, lista]) => (
            <View key={dia} wrap={false}>
              <Text style={s.section}>{dia}</Text>
              {lista.map((d) => (
                <View key={d.id} style={s.card}>
                  <Text>• {d.texto}</Text>
                  {d.respondida ? (
                    <View style={{ marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: LINE }}>
                      <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: AZUL }}>
                        Resposta{d.respondidaPor ? ` · ${d.respondidaPor}` : ''}
                      </Text>
                      <Text style={{ fontSize: 10.5 }}>{d.respostaTexto}</Text>
                    </View>
                  ) : (
                    <Text style={{ marginTop: 4, fontSize: 9, color: MUTE }}>Aguardando resposta</Text>
                  )}
                </View>
              ))}
            </View>
          ))
        )}
      </Shell>
    </Document>
  )
}

/* ----------------------------- Prontuário ----------------------------- */

export interface ProntuarioPDFData {
  nome?: string
  tipoSanguineo: string
  alergias: string
  resumoGestacional: string
  condicoes: string[]
  eventos: { id: string; data: string; autorNome: string; texto: string }[]
}

function campo(label: string, valor: string) {
  return (
    <View style={{ marginBottom: 6 }}>
      <Text style={{ fontSize: 9, color: MUTE }}>{label}</Text>
      <Text>{valor || '—'}</Text>
    </View>
  )
}

export function ProntuarioDocument({ dados }: { dados: ProntuarioPDFData }) {
  return (
    <Document title="Prontuário — Prumo" author="Prumo">
      <Shell titulo="Prontuário contínuo" sub={dados.nome ? `Paciente: ${dados.nome}` : 'Histórico da gestação à pediatria'}>
        <Text style={s.section}>Resumo clínico</Text>
        <View style={{ flexDirection: 'row', gap: 24 }}>
          <View style={{ flex: 1 }}>{campo('Tipo sanguíneo', dados.tipoSanguineo)}</View>
          <View style={{ flex: 1 }}>{campo('Alergias', dados.alergias)}</View>
        </View>
        {campo('Resumo gestacional', dados.resumoGestacional)}
        {dados.condicoes.length > 0 && campo('Condições em acompanhamento', dados.condicoes.join(' · '))}

        <Text style={s.section}>Linha do tempo</Text>
        {dados.eventos.length === 0 ? (
          <Text style={{ color: MUTE }}>Sem anotações registradas.</Text>
        ) : (
          dados.eventos.map((e) => (
            <View key={e.id} style={s.card} wrap={false}>
              <Text>{e.texto}</Text>
              <Text style={s.small}>
                {new Date(e.data).toLocaleDateString('pt-BR')}
                {e.autorNome ? ` · ${e.autorNome}` : ''}
              </Text>
            </View>
          ))
        )}
      </Shell>
    </Document>
  )
}

/* ----------------------------- Vacinação ----------------------------- */

export interface DosePDF {
  id: string
  nome: string
  dose: string
  idadeLabel: string
  data: string
  status: 'aplicada' | 'atrasada' | 'proxima' | 'futura'
}

const STATUS_LABEL: Record<DosePDF['status'], { label: string; color: string }> = {
  aplicada: { label: 'Aplicada', color: SUCCESS },
  atrasada: { label: 'Em atraso', color: WARN },
  proxima: { label: 'Em breve', color: INDIGO },
  futura: { label: 'Futura', color: MUTE },
}

export function VacinacaoDocument({ doses, nome }: { doses: DosePDF[]; nome?: string }) {
  const grupos = new Map<string, DosePDF[]>()
  for (const d of doses) {
    const arr = grupos.get(d.idadeLabel) ?? []
    arr.push(d)
    grupos.set(d.idadeLabel, arr)
  }
  return (
    <Document title="Carteira de Vacinação — Prumo" author="Prumo">
      <Shell titulo="Carteira de Vacinação" sub={`${nome ? `${nome} · ` : ''}Calendário Nacional de Vacinação (PNI)`}>
        {[...grupos.entries()].map(([idade, lista]) => (
          <View key={idade} wrap={false}>
            <Text style={s.section}>{idade}</Text>
            {lista.map((d) => {
              const meta = STATUS_LABEL[d.status]
              return (
                <View key={d.id} style={s.row}>
                  <Text style={{ flex: 1 }}>
                    {d.nome} · {d.dose}
                  </Text>
                  <Text style={{ color: meta.color, fontFamily: 'Helvetica-Bold', fontSize: 10 }}>
                    {meta.label}
                  </Text>
                </View>
              )
            })}
          </View>
        ))}
        <Text style={{ ...s.small, marginTop: 14 }}>
          Fonte: Ministério da Saúde — Programa Nacional de Imunizações (PNI). Vacinas de campanha podem variar por período.
        </Text>
      </Shell>
    </Document>
  )
}

/* ----------------------------- Trilha ----------------------------- */

export interface TrilhaNodePDF {
  id: string
  titulo: string
  fase: string
  status: 'concluido' | 'atual' | 'bloqueado'
}

const NODE_LABEL: Record<TrilhaNodePDF['status'], { label: string; color: string }> = {
  concluido: { label: 'Concluído', color: SUCCESS },
  atual: { label: 'Etapa atual', color: INDIGO },
  bloqueado: { label: 'A seguir', color: MUTE },
}

export function TrilhaDocument({ nodes, progresso, nome }: { nodes: TrilhaNodePDF[]; progresso: number; nome?: string }) {
  const fases = new Map<string, TrilhaNodePDF[]>()
  for (const n of nodes) {
    const arr = fases.get(n.fase) ?? []
    arr.push(n)
    fases.set(n.fase, arr)
  }
  return (
    <Document title="Resumo da Trilha — Prumo" author="Prumo">
      <Shell titulo="Resumo da Trilha" sub={`${nome ? `${nome} · ` : ''}Progresso: ${progresso}%`}>
        {[...fases.entries()].map(([fase, lista]) => (
          <View key={fase} wrap={false}>
            <Text style={s.section}>{fase}</Text>
            {lista.map((n) => {
              const meta = NODE_LABEL[n.status]
              return (
                <View key={n.id} style={s.row}>
                  <Text style={{ flex: 1 }}>{n.titulo}</Text>
                  <Text style={{ color: meta.color, fontFamily: 'Helvetica-Bold', fontSize: 10 }}>{meta.label}</Text>
                </View>
              )
            })}
          </View>
        ))}
      </Shell>
    </Document>
  )
}

/* ----------------------------- Download button ----------------------------- */

/** Shared styled download link. Renders as a soft outline button. */
export function DownloadLink({
  documento,
  fileName,
  label,
}: {
  documento: React.ReactElement
  fileName: string
  label: string
}) {
  return (
    <PDFDownloadLink document={documento} fileName={fileName} style={{ textDecoration: 'none' }}>
      {({ loading }) => (
        <span className="inline-flex h-11 items-center gap-2 self-start rounded-pill border border-line bg-paper px-5 font-display text-sm font-semibold text-indigo shadow-soft hover:bg-paper-2">
          {loading ? 'Preparando…' : label}
        </span>
      )}
    </PDFDownloadLink>
  )
}

/* Per-document button wrappers — pages lazy-load these and pass live data. */

export function BaixarCaderninho({ duvidas, nome }: { duvidas: DuvidaPDF[]; nome?: string }) {
  return <DownloadLink documento={<CaderninhoDocument duvidas={duvidas} nome={nome} />} fileName="caderninho-de-duvidas.pdf" label="Imprimir / baixar PDF" />
}

export function BaixarProntuario({ dados }: { dados: ProntuarioPDFData }) {
  return <DownloadLink documento={<ProntuarioDocument dados={dados} />} fileName="prontuario.pdf" label="Baixar prontuário (PDF)" />
}

export function BaixarVacinacao({ doses, nome }: { doses: DosePDF[]; nome?: string }) {
  return <DownloadLink documento={<VacinacaoDocument doses={doses} nome={nome} />} fileName="carteira-de-vacinacao.pdf" label="Baixar carteira (PDF)" />
}

export function BaixarTrilha({ nodes, progresso, nome }: { nodes: TrilhaNodePDF[]; progresso: number; nome?: string }) {
  return <DownloadLink documento={<TrilhaDocument nodes={nodes} progresso={progresso} nome={nome} />} fileName="resumo-da-trilha.pdf" label="Baixar resumo (PDF)" />
}
