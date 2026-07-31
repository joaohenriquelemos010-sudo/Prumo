import { Text } from '@react-pdf/renderer'
import { DocumentoPrumo } from '../sistema/Documento'
import { Tabela, Secao } from '../sistema/primitivas'
import type { Coluna } from '../sistema/primitivas'
import { TOKENS, TIPO, ESPACO } from '../sistema/tokens'

export interface DosePDF {
  id: string
  nome: string
  dose: string
  idadeLabel: string
  data: string
  status: 'aplicada' | 'atrasada' | 'proxima' | 'futura'
}

const ROTULO_STATUS: Record<DosePDF['status'], string> = {
  aplicada: 'Aplicada',
  atrasada: 'Em atraso',
  proxima: 'Em breve',
  futura: 'Futura',
}

const COLUNAS: Coluna<DosePDF>[] = [
  { chave: 'idadeLabel', rotulo: 'Idade', largura: 1.1 },
  { chave: 'nome', rotulo: 'Vacina', largura: 2 },
  { chave: 'dose', rotulo: 'Dose', largura: 0.9 },
  { chave: 'data', rotulo: 'Data prevista', largura: 1.1 },
  {
    chave: 'status',
    rotulo: 'Situação',
    largura: 1,
    alinhamento: 'right',
    render: (d) => ROTULO_STATUS[d.status],
  },
]

/**
 * A carteira de vacinação.
 *
 * Virou **tabela de verdade**, e não uma lista de linhas flex: o calendário do
 * PNI passa de uma página, e a versão anterior perdia os rótulos das colunas na
 * segunda — uma coluna de datas soltas sem cabeçalho. O `fixed` no cabeçalho da
 * tabela resolve isso.
 */
export function VacinacaoDocument({ doses, nome }: { doses: DosePDF[]; nome?: string }) {
  return (
    <DocumentoPrumo
      titulo="Carteira de vacinação"
      subtitulo="Calendário Nacional de Vacinação (PNI)"
      paciente={nome ? { nome } : undefined}
      documentoId="vacinacao"
    >
      <Secao titulo="Doses" nota={`${doses.length} doses no calendário.`} />
      <Tabela colunas={COLUNAS} linhas={doses} vazio="Nenhuma dose no calendário." />

      <Text
        style={{
          fontSize: TIPO.micro,
          color: TOKENS.inkMute,
          marginTop: ESPACO.md,
        }}
      >
        Fonte: Ministério da Saúde — Programa Nacional de Imunizações (PNI). Vacinas de campanha
        podem variar por período. Este documento não substitui a caderneta oficial.
      </Text>
    </DocumentoPrumo>
  )
}
