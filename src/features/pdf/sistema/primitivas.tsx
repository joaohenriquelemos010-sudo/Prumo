import type { ReactNode } from 'react'
import { View, Text, StyleSheet } from '@react-pdf/renderer'
import { TOKENS, TIPO, TRACKING, ESPACO } from './tokens'

const s = StyleSheet.create({
  secao: { marginTop: ESPACO.lg, marginBottom: ESPACO.sm },
  secaoTitulo: {
    fontSize: TIPO.secao,
    fontFamily: 'Outfit',
    fontWeight: 700,
    color: TOKENS.indigo,
    letterSpacing: TRACKING.titulo,
  },
  secaoNota: { fontSize: TIPO.micro, color: TOKENS.inkMute, marginTop: 1 },

  cartao: {
    borderWidth: 0.5,
    borderColor: TOKENS.line,
    borderRadius: 6,
    padding: ESPACO.md,
    marginBottom: ESPACO.sm,
  },
  cartaoTitulo: {
    fontSize: TIPO.corpo,
    fontFamily: 'Outfit',
    fontWeight: 600,
    color: TOKENS.ink,
    marginBottom: 2,
  },

  destaque: {
    borderLeftWidth: 2.5,
    borderLeftColor: TOKENS.lilas,
    backgroundColor: TOKENS.paper2,
    paddingVertical: ESPACO.sm,
    paddingHorizontal: ESPACO.md,
    borderRadius: 4,
    marginBottom: ESPACO.sm,
  },

  campo: { flexDirection: 'row', gap: ESPACO.sm, marginBottom: 3 },
  campoRotulo: { fontSize: TIPO.pequeno, color: TOKENS.inkMute, width: 130 },
  campoValor: { fontSize: TIPO.corpo, color: TOKENS.ink, flex: 1 },

  /**
   * O chip é View + Text, e não um Text estilizado.
   *
   * Um `Text` solto dentro de uma flex row estica no eixo cruzado, e o chip
   * saía como um retângulo alto com a palavra grudada no topo. Envolver num
   * `View` com `alignSelf: 'flex-start'` faz a caixa medir o conteúdo.
   */
  chip: {
    alignSelf: 'flex-start',
    borderRadius: 8,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  chipTexto: {
    fontSize: TIPO.micro,
    fontFamily: 'Outfit',
    fontWeight: 600,
  },

  linha: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: TOKENS.line,
    paddingVertical: 4.5,
  },
  linhaZebra: { backgroundColor: TOKENS.paper2 },
  cabecalhoTabela: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: TOKENS.indigo,
    paddingBottom: 3,
    marginTop: ESPACO.xs,
  },
  celula: { fontSize: TIPO.pequeno, color: TOKENS.ink, paddingRight: ESPACO.sm },
  celulaCabecalho: {
    fontSize: TIPO.micro,
    fontFamily: 'Outfit',
    fontWeight: 700,
    color: TOKENS.indigo,
    paddingRight: ESPACO.sm,
    textTransform: 'uppercase',
    letterSpacing: TRACKING.micro,
  },

  /**
   * Sem itálico: só registramos os pesos normais das fontes da marca, e ênfase
   * por peso lê melhor que por inclinação num documento clínico impresso. Pedir
   * itálico ao react-pdf sem a variante registrada é erro de render, não
   * degradação silenciosa.
   */
  vazio: { fontSize: TIPO.pequeno, color: TOKENS.inkMute, fontFamily: 'Outfit' },
})

const TOM_CHIP = {
  neutro: { backgroundColor: TOKENS.paper3, color: TOKENS.inkSoft },
  marca: { backgroundColor: TOKENS.lilasSoft, color: TOKENS.indigo },
  ok: { backgroundColor: '#dff0e6', color: TOKENS.successInk },
  atencao: { backgroundColor: '#fbeed6', color: TOKENS.warnInk },
} as const

export function Secao({ titulo, nota }: { titulo: string; nota?: string }) {
  return (
    <View style={s.secao} wrap={false}>
      <Text style={s.secaoTitulo}>{titulo}</Text>
      {nota ? <Text style={s.secaoNota}>{nota}</Text> : null}
    </View>
  )
}

export function Cartao({ titulo, children }: { titulo?: string; children: ReactNode }) {
  return (
    <View style={s.cartao} wrap={false}>
      {titulo ? <Text style={s.cartaoTitulo}>{titulo}</Text> : null}
      {children}
    </View>
  )
}

/** Bloco de atenção — alergia, alerta, aviso. */
export function Destaque({ children }: { children: ReactNode }) {
  return (
    <View style={s.destaque} wrap={false}>
      {children}
    </View>
  )
}

export function Campo({ rotulo, valor }: { rotulo: string; valor?: string | number | null }) {
  const texto = valor === null || valor === undefined || valor === '' ? '—' : String(valor)
  return (
    <View style={s.campo}>
      <Text style={s.campoRotulo}>{rotulo}</Text>
      <Text style={s.campoValor}>{texto}</Text>
    </View>
  )
}

export function Chip({
  children,
  tom = 'neutro',
}: {
  children: string
  tom?: keyof typeof TOM_CHIP
}) {
  const { backgroundColor, color } = TOM_CHIP[tom]
  return (
    <View style={[s.chip, { backgroundColor }]}>
      <Text style={[s.chipTexto, { color }]}>{children}</Text>
    </View>
  )
}

export function Vazio({ children }: { children: string }) {
  return <Text style={s.vazio}>{children}</Text>
}

export interface Coluna<T> {
  chave: keyof T & string
  rotulo: string
  /** Peso relativo na largura. Padrão 1. */
  largura?: number
  alinhamento?: 'left' | 'right' | 'center'
  /** Formatação da célula; recebe a linha inteira. */
  render?: (linha: T) => string
}

/**
 * Tabela com cabeçalho que **repete a cada página**.
 *
 * É a razão de esta primitiva existir: a versão anterior montava tabelas com
 * `flexDirection: row` solto, então um calendário vacinal que passava de uma
 * página virava uma lista de números sem rótulo na segunda. `fixed` no cabeçalho
 * resolve, e `wrap={false}` por linha impede que uma célula seja cortada ao meio.
 */
export function Tabela<T>({
  colunas,
  linhas,
  zebra = true,
  vazio = 'Nada registrado.',
}: {
  colunas: Coluna<T>[]
  linhas: T[]
  zebra?: boolean
  vazio?: string
}) {
  if (linhas.length === 0) return <Vazio>{vazio}</Vazio>

  return (
    <View>
      <View style={s.cabecalhoTabela} fixed>
        {colunas.map((c) => (
          <Text
            key={c.chave}
            style={[
              s.celulaCabecalho,
              { flex: c.largura ?? 1, textAlign: c.alinhamento ?? 'left' },
            ]}
          >
            {c.rotulo}
          </Text>
        ))}
      </View>

      {linhas.map((linha, i) => (
        <View
          key={i}
          style={[s.linha, zebra && i % 2 === 1 ? s.linhaZebra : {}]}
          wrap={false}
        >
          {colunas.map((c) => {
            const bruto = c.render ? c.render(linha) : linha[c.chave]
            const texto =
              bruto === null || bruto === undefined || bruto === '' ? '—' : String(bruto)
            return (
              <Text
                key={c.chave}
                style={[s.celula, { flex: c.largura ?? 1, textAlign: c.alinhamento ?? 'left' }]}
              >
                {texto}
              </Text>
            )
          })}
        </View>
      ))}
    </View>
  )
}

/** Texto de corpo que preserva as quebras de linha do original. */
export function Paragrafo({ children }: { children?: string | null }) {
  if (!children) return null
  return (
    <Text style={{ fontSize: TIPO.corpo, color: TOKENS.ink, marginBottom: ESPACO.xs }}>
      {children}
    </Text>
  )
}
