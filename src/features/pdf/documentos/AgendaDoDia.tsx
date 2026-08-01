import { View, Text } from '@react-pdf/renderer'
import { DocumentoPrumo } from '../sistema/Documento'
import { Secao, Tabela, Vazio } from '../sistema/primitivas'
import type { Coluna } from '../sistema/primitivas'
import { TOKENS, TIPO, ESPACO } from '../sistema/tokens'

export interface ItemAgendaPDF {
  inicio: string
  duracaoMin: number
  pacienteNome: string
  tipoNome: string
  modalidade: string
  status: string
  telefone?: string
}

export interface AgendaPDF {
  medicoNome: string
  periodo: string
  geradoEm: string
  itens: ItemAgendaPDF[]
}

interface Linha {
  hora: string
  paciente: string
  tipo: string
  modalidade: string
  situacao: string
}

const COLUNAS: Coluna<Linha>[] = [
  { chave: 'hora', rotulo: 'Horário', largura: 1 },
  { chave: 'paciente', rotulo: 'Paciente', largura: 2.4 },
  { chave: 'tipo', rotulo: 'Tipo', largura: 1.8 },
  { chave: 'modalidade', rotulo: 'Onde', largura: 1 },
  { chave: 'situacao', rotulo: 'Situação', largura: 1 },
]

const MODALIDADE: Record<string, string> = {
  presencial: 'Consultório',
  teleconsulta: 'Vídeo',
  domiciliar: 'Domicílio',
}

function diaPorExtenso(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  })
}

function hora(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

/**
 * A agenda impressa.
 *
 * Papel na mesa continua sendo como muito consultório funciona — a secretária
 * confere a lista, risca quem chegou, anota o telefone de quem faltou. Um
 * sistema que não imprime não substitui o caderno; ele passa a conviver com o
 * caderno, e aí os dois ficam errados.
 *
 * Um dia por seção, com o total no título: quem imprime quer saber de quantos
 * pacientes é o dia antes de virar a página.
 */
export function AgendaDoDiaDocument({ dados }: { dados: AgendaPDF }) {
  const porDia = new Map<string, ItemAgendaPDF[]>()
  for (const i of [...dados.itens].sort((a, b) => a.inicio.localeCompare(b.inicio))) {
    const chave = i.inicio.slice(0, 10)
    porDia.set(chave, [...(porDia.get(chave) ?? []), i])
  }

  return (
    <DocumentoPrumo
      titulo="Agenda"
      subtitulo={dados.periodo}
      documentoId={`agenda-${dados.itens.length}`}
    >
      {porDia.size === 0 ? (
        <Vazio>Nenhum atendimento marcado neste período.</Vazio>
      ) : (
        [...porDia.entries()].map(([chave, itens]) => (
          <View key={chave}>
            <Secao
              titulo={diaPorExtenso(itens[0].inicio)}
              nota={`${itens.length} ${itens.length === 1 ? 'atendimento' : 'atendimentos'}`}
            />
            <Tabela
              colunas={COLUNAS}
              linhas={itens.map((i) => ({
                hora: hora(i.inicio),
                paciente: i.telefone ? `${i.pacienteNome} · ${i.telefone}` : i.pacienteNome,
                tipo: i.tipoNome || '—',
                modalidade: MODALIDADE[i.modalidade] ?? i.modalidade,
                situacao: i.status,
              }))}
              zebra
            />
          </View>
        ))
      )}

      {/* O espaço para escrever à mão é o motivo de imprimir. */}
      <View style={{ marginTop: ESPACO.lg }}>
        <Text style={{ fontSize: TIPO.micro, color: TOKENS.inkMute }}>
          Impresso em {new Date(dados.geradoEm).toLocaleString('pt-BR')} · {dados.medicoNome}
        </Text>
      </View>
    </DocumentoPrumo>
  )
}
