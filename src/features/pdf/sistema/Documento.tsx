import type { ReactNode } from 'react'
import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import { Marca, Simbolo, BarraGradiente } from './Marca'
import { TOKENS, TIPO, TRACKING, ESPACO, PAGINA } from './tokens'
import { registrarFontes } from './fontes'

registrarFontes()

export interface DadosPaciente {
  nome?: string
  idade?: string
  nascimento?: string
}

interface DocumentoProps {
  titulo: string
  subtitulo?: string
  paciente?: DadosPaciente
  /** Uma capa própria. Vale para documentos longos e para os que circulam. */
  capa?: boolean
  /** Identificador curto, impresso no rodapé. Rastreabilidade sem custo visual. */
  documentoId?: string
  /** Bloco de assinatura no fim — todo documento clínico deveria ter. */
  assinatura?: { nome: string; crm?: string; especialidade?: string }
  /**
   * Partes que começam **cada uma numa página nova**, com o cabeçalho e o rodapé
   * fixos repetindo. Usado pelas vias da receita.
   *
   * ⚠️ Existe por causa de uma armadilha do react-pdf, e não por gosto: o
   * `break` só é obedecido quando o elemento é **filho direto da `Page`**.
   * Aninhado — inclusive dentro do wrapper do corpo — ele é ignorado **em
   * silêncio**, sem erro e sem aviso, e o documento sai com uma página só. Foi
   * exatamente assim que a segunda via do antimicrobiano sumiu na primeira
   * tentativa. Por isso os blocos são renderizados no nível da página, e não
   * dentro de `s.corpo`.
   */
  blocos?: ReactNode[]
  children?: ReactNode
}

const s = StyleSheet.create({
  page: {
    paddingTop: PAGINA.margemTopo,
    paddingBottom: PAGINA.margemBase,
    paddingHorizontal: PAGINA.margemH,
    fontSize: TIPO.corpo,
    fontFamily: 'Nunito',
    color: TOKENS.ink,
    /**
     * ⚠️ NÃO ponha `lineHeight` aqui, nem em nada dentro de um elemento `fixed`.
     *
     * No react-pdf, um `lineHeight` explícito dentro de uma View `fixed` faz o
     * elemento simplesmente **não ser desenhado** — sem erro, sem aviso. Um
     * leading na Page é herdado pelo cabeçalho e pelo rodapé fixos e produz o
     * mesmo efeito.
     *
     * Foi assim que a primeira versão saiu sem paginação nenhuma: o rodapé
     * existia na árvore, o componente era chamado, e nada aparecia no papel.
     * Descoberto por bisseção; guardado pelo teste em
     * `documentos/documentos.test.tsx`, que verifica a presença do rodapé.
     *
     * O leading do corpo mora em `s.corpo`, que envolve o conteúdo e não é fixo.
     */
  },

  /** Leading de leitura — aplicado ao conteúdo, nunca ao chrome fixo. */
  corpo: { lineHeight: 1.45 },

  /* Cabeçalho fixo — repete em toda página que não é a capa. */
  cabecalho: {
    position: 'absolute',
    top: 18,
    left: PAGINA.margemH,
    right: PAGINA.margemH,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 5,
    borderBottomWidth: 0.5,
    borderBottomColor: TOKENS.line,
  },
  cabecalhoEsq: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  cabecalhoMarca: {
    fontSize: TIPO.pequeno,
    fontFamily: 'Outfit',
    fontWeight: 700,
    color: TOKENS.indigo,
  },
  cabecalhoDir: { fontSize: TIPO.micro, color: TOKENS.inkMute },

  /* Rodapé fixo, com paginação de verdade. */
  rodape: {
    position: 'absolute',
    bottom: 22,
    left: PAGINA.margemH,
    right: PAGINA.margemH,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 5,
    borderTopWidth: 0.5,
    borderTopColor: TOKENS.line,
  },
  rodapeTexto: { fontSize: TIPO.micro, color: TOKENS.inkMute },
  rodapeCentro: { fontSize: TIPO.micro, color: TOKENS.inkMute, textAlign: 'center', flex: 1 },

  /* Capa */
  capa: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingBottom: 60 },
  capaTitulo: {
    fontSize: TIPO.capaTitulo,
    fontFamily: 'Outfit',
    fontWeight: 700,
    color: TOKENS.indigo,
    letterSpacing: TRACKING.capaTitulo,
    textAlign: 'center',
    marginTop: ESPACO.lg,
  },
  capaSub: {
    fontSize: TIPO.corpo,
    color: TOKENS.inkMute,
    textAlign: 'center',
    marginTop: ESPACO.xs,
  },
  capaBarra: { width: 120, marginTop: ESPACO.lg },
  capaPaciente: {
    marginTop: ESPACO.xl,
    borderWidth: 0.5,
    borderColor: TOKENS.line,
    borderRadius: 8,
    backgroundColor: TOKENS.paper2,
    paddingVertical: ESPACO.md,
    paddingHorizontal: ESPACO.lg,
    minWidth: 260,
  },

  /* Abertura de página normal */
  abertura: { marginBottom: ESPACO.lg },
  titulo: {
    fontSize: TIPO.titulo,
    fontFamily: 'Outfit',
    fontWeight: 700,
    color: TOKENS.ink,
    letterSpacing: TRACKING.titulo,
  },
  subtitulo: { fontSize: TIPO.pequeno, color: TOKENS.inkMute, marginTop: 1 },

  assinatura: {
    marginTop: ESPACO.xl,
    paddingTop: ESPACO.sm,
    borderTopWidth: 0.5,
    borderTopColor: TOKENS.line,
    width: 240,
  },
  assinaturaNome: { fontSize: TIPO.corpo, fontFamily: 'Outfit', fontWeight: 600, color: TOKENS.ink },
  assinaturaMeta: { fontSize: TIPO.micro, color: TOKENS.inkMute },
})

const CONFIDENCIAL =
  'Documento com dados de saúde. Uso restrito ao paciente e à equipe autorizada.'

function agoraBR(): string {
  return new Date().toLocaleString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * O invólucro de todo PDF do Prumo.
 *
 * O que ele resolve, e que a versão anterior não tinha: **paginação real** (o
 * react-pdf sabe o total de páginas via `render`, e sem isso um prontuário de
 * seis páginas soltas não é um documento), cabeçalho que se repete, rodapé com
 * identificação e confidencialidade, capa opcional para o que circula, e bloco
 * de assinatura.
 *
 * Fonte da marca em vez da Helvetica embutida — a diferença entre um documento
 * que parece do Prumo e um que parece de qualquer gerador.
 */
export function DocumentoPrumo({
  titulo,
  subtitulo,
  paciente,
  capa = false,
  documentoId,
  assinatura,
  blocos,
  children,
}: DocumentoProps) {
  const geradoEm = agoraBR()

  return (
    <Document title={`${titulo} — Prumo`} author="Prumo" language="pt-BR">
      {capa && (
        <Page size="A4" style={s.page}>
          <View style={s.capa}>
            <Marca tamanho={34} />
            <View style={s.capaBarra}>
              <BarraGradiente altura={3} />
            </View>
            <Text style={s.capaTitulo}>{titulo}</Text>
            {subtitulo ? <Text style={s.capaSub}>{subtitulo}</Text> : null}

            {paciente?.nome ? (
              <View style={s.capaPaciente}>
                <Campo rotulo="Paciente" valor={paciente.nome} />
                {paciente.idade ? <Campo rotulo="Idade" valor={paciente.idade} /> : null}
                {paciente.nascimento ? (
                  <Campo rotulo="Nascimento" valor={paciente.nascimento} />
                ) : null}
                <Campo rotulo="Gerado em" valor={geradoEm} />
              </View>
            ) : (
              <Text style={[s.capaSub, { marginTop: ESPACO.lg }]}>Gerado em {geradoEm}</Text>
            )}
          </View>

          <Rodape documentoId={documentoId} />
        </Page>
      )}

      <Page size="A4" style={s.page}>
        <View style={s.cabecalho} fixed>
          <View style={s.cabecalhoEsq}>
            <Simbolo tamanho={11} />
            <Text style={s.cabecalhoMarca}>Prumo</Text>
          </View>
          <Text style={s.cabecalhoDir}>
            {[paciente?.nome, titulo].filter(Boolean).join(' · ')}
          </Text>
        </View>

        {!capa && (
          <View style={s.abertura}>
            <Text style={s.titulo}>{titulo}</Text>
            {subtitulo ? <Text style={s.subtitulo}>{subtitulo}</Text> : null}
            <View style={{ marginTop: ESPACO.sm, width: 64 }}>
              <BarraGradiente altura={3} />
            </View>
          </View>
        )}

        {blocos
          ? blocos.map((bloco, i) => (
              // `break` no nível da página — ver o comentário em `blocos`.
              <View key={i} style={s.corpo} break={i > 0}>
                {bloco}
              </View>
            ))
          : <View style={s.corpo}>{children}</View>}

        {assinatura ? (
          <View style={s.assinatura} wrap={false}>
            <Text style={s.assinaturaNome}>{assinatura.nome}</Text>
            <Text style={s.assinaturaMeta}>
              {[
                assinatura.crm && `CRM ${assinatura.crm}`,
                assinatura.especialidade,
                geradoEm,
              ]
                .filter(Boolean)
                .join(' · ')}
            </Text>
            {/*
              Enquanto a assinatura ICP-Brasil não existe, o documento diz o que
              ele é. Omitir isso seria deixar alguém supor validade jurídica que
              o arquivo ainda não tem.
            */}
            <Text style={[s.assinaturaMeta, { marginTop: 2 }]}>
              Cópia digital sem assinatura ICP-Brasil.
            </Text>
          </View>
        ) : null}

        <Rodape documentoId={documentoId} />
      </Page>
    </Document>
  )
}

function Rodape({ documentoId }: { documentoId?: string }) {
  return (
    <View style={s.rodape} fixed>
      <Text style={s.rodapeTexto}>{documentoId ?? 'prumo'}</Text>
      <Text style={s.rodapeCentro}>{CONFIDENCIAL}</Text>
      <Text
        style={s.rodapeTexto}
        render={({ pageNumber, totalPages }) => `pág. ${pageNumber} de ${totalPages}`}
      />
    </View>
  )
}

const sc = StyleSheet.create({
  campo: { flexDirection: 'row', justifyContent: 'space-between', gap: ESPACO.md, marginBottom: 2 },
  rotulo: { fontSize: TIPO.micro, color: TOKENS.inkMute },
  valor: { fontSize: TIPO.pequeno, fontFamily: 'Outfit', fontWeight: 600, color: TOKENS.ink },
})

function Campo({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <View style={sc.campo}>
      <Text style={sc.rotulo}>{rotulo}</Text>
      <Text style={sc.valor}>{valor}</Text>
    </View>
  )
}
