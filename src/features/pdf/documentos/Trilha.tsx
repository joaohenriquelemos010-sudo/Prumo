import { View, Text } from '@react-pdf/renderer'
import { DocumentoPrumo } from '../sistema/Documento'
import { Secao, Tabela } from '../sistema/primitivas'
import type { Coluna } from '../sistema/primitivas'
import { TOKENS, TIPO, ESPACO } from '../sistema/tokens'
import { BarraGradiente } from '../sistema/Marca'

export interface TrilhaNodePDF {
  id: string
  titulo: string
  fase: string
  status: 'concluido' | 'atual' | 'bloqueado'
}

const ROTULO: Record<TrilhaNodePDF['status'], string> = {
  concluido: 'Concluído',
  atual: 'Etapa atual',
  bloqueado: 'A seguir',
}

const COLUNAS: Coluna<TrilhaNodePDF>[] = [
  { chave: 'titulo', rotulo: 'Etapa', largura: 3 },
  {
    chave: 'status',
    rotulo: 'Situação',
    largura: 1,
    alinhamento: 'right',
    render: (n) => ROTULO[n.status],
  },
]

/** Barra de progresso — dois retângulos, que é tudo que o react-pdf precisa. */
function Progresso({ percentual }: { percentual: number }) {
  const seguro = Math.max(0, Math.min(100, percentual))
  return (
    <View style={{ marginTop: ESPACO.xs }}>
      <View
        style={{
          height: 6,
          borderRadius: 3,
          backgroundColor: TOKENS.paper3,
          overflow: 'hidden',
        }}
      >
        <View style={{ width: `${seguro}%` }}>
          <BarraGradiente altura={6} passos={10} />
        </View>
      </View>
      <Text style={{ fontSize: TIPO.micro, color: TOKENS.inkMute, marginTop: 2 }}>
        {seguro}% da trilha concluída
      </Text>
    </View>
  )
}

export function TrilhaDocument({
  nodes,
  progresso,
  nome,
}: {
  nodes: TrilhaNodePDF[]
  progresso: number
  nome?: string
}) {
  const fases = new Map<string, TrilhaNodePDF[]>()
  for (const n of nodes) {
    const lista = fases.get(n.fase) ?? []
    lista.push(n)
    fases.set(n.fase, lista)
  }

  return (
    <DocumentoPrumo
      titulo="Resumo da trilha"
      subtitulo="O caminho até aqui, e o que vem a seguir"
      paciente={nome ? { nome } : undefined}
      documentoId="trilha"
    >
      <Progresso percentual={progresso} />

      {[...fases.entries()].map(([fase, lista]) => (
        <View key={fase}>
          <Secao titulo={fase} />
          <Tabela colunas={COLUNAS} linhas={lista} />
        </View>
      ))}
    </DocumentoPrumo>
  )
}
