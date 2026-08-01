import { View, Text } from '@react-pdf/renderer'
import { DocumentoPrumo } from '../sistema/Documento'
import { Secao, Tabela, Campo, Vazio } from '../sistema/primitivas'
import type { Coluna } from '../sistema/primitivas'
import { TOKENS, TIPO, ESPACO } from '../sistema/tokens'

export interface ConsultaHistorico {
  data: string
  tipo: string
  autorNome: string
  igSemanas?: number | null
  igDias?: number | null
  subjetivo?: string
  objetivo?: string
  avaliacao?: string
  plano?: string
  medidas?: Record<string, number | null | undefined>
}

export interface HistoricoConsultasPDF {
  pacienteNome: string
  geradoEm: string
  consultas: ConsultaHistorico[]
  medico?: { nome: string; crm?: string; especialidade?: string }
}

const MEDIDAS_TABELA: { chave: string; rotulo: string; unidade: string }[] = [
  { chave: 'pesoKg', rotulo: 'Peso', unidade: 'kg' },
  { chave: 'paSistolica', rotulo: 'PA sist.', unidade: '' },
  { chave: 'paDiastolica', rotulo: 'PA diast.', unidade: '' },
  { chave: 'alturaUterinaCm', rotulo: 'AU', unidade: 'cm' },
  { chave: 'bcfBpm', rotulo: 'BCF', unidade: '' },
]

interface LinhaEvolucao {
  data: string
  ig: string
  peso: string
  pa: string
  au: string
  bcf: string
}

const COLUNAS: Coluna<LinhaEvolucao>[] = [
  { chave: 'data', rotulo: 'Data', largura: 1.2 },
  { chave: 'ig', rotulo: 'IG', largura: 1 },
  { chave: 'peso', rotulo: 'Peso', largura: 1, alinhamento: 'right' },
  { chave: 'pa', rotulo: 'PA', largura: 1, alinhamento: 'right' },
  { chave: 'au', rotulo: 'AU', largura: 0.8, alinhamento: 'right' },
  { chave: 'bcf', rotulo: 'BCF', largura: 0.8, alinhamento: 'right' },
]

function dataCurta(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR')
}

function num(v: number | null | undefined): string {
  return typeof v === 'number' ? String(v) : '—'
}

/**
 * Todas as consultas, numa peça só.
 *
 * O produto já emitia o resumo de **uma** consulta. Faltava o documento que o
 * consultório de fato usa: o histórico inteiro, para levar a um colega, anexar a
 * um pedido de convênio ou guardar quando se muda de médico.
 *
 * A tabela de evolução vem **antes** dos registros por extenso, e essa ordem é a
 * decisão de projeto do documento. Quem abre um histórico quer primeiro ver a
 * curva — peso, pressão, altura uterina, batimentos, lado a lado — e só depois
 * ler o que foi escrito em cada dia. Invertido, a tendência fica enterrada em
 * dez páginas de texto e ninguém a encontra.
 */
export function HistoricoConsultasDocument({ dados }: { dados: HistoricoConsultasPDF }) {
  // Da mais antiga para a mais nova: um histórico se lê no sentido do tempo.
  const consultas = [...dados.consultas].sort(
    (a, b) => new Date(a.data).getTime() - new Date(b.data).getTime(),
  )

  const linhas: LinhaEvolucao[] = consultas.map((c) => ({
    data: dataCurta(c.data),
    ig: c.igSemanas != null ? `${c.igSemanas}s${c.igDias ?? 0}d` : '—',
    peso: num(c.medidas?.pesoKg),
    pa:
      c.medidas?.paSistolica && c.medidas?.paDiastolica
        ? `${c.medidas.paSistolica}/${c.medidas.paDiastolica}`
        : '—',
    au: num(c.medidas?.alturaUterinaCm),
    bcf: num(c.medidas?.bcfBpm),
  }))

  // Colunas todas vazias só ocupam espaço — some com o que este caso não usa.
  const usadas = new Set(
    MEDIDAS_TABELA.filter((m) => consultas.some((c) => typeof c.medidas?.[m.chave] === 'number')).map(
      (m) => m.chave,
    ),
  )
  const colunas = COLUNAS.filter((col) => {
    if (col.chave === 'data' || col.chave === 'ig') return true
    if (col.chave === 'peso') return usadas.has('pesoKg')
    if (col.chave === 'pa') return usadas.has('paSistolica') || usadas.has('paDiastolica')
    if (col.chave === 'au') return usadas.has('alturaUterinaCm')
    if (col.chave === 'bcf') return usadas.has('bcfBpm')
    return true
  })

  return (
    <DocumentoPrumo
      titulo="Histórico de consultas"
      subtitulo={dados.pacienteNome}
      paciente={dados.pacienteNome ? { nome: dados.pacienteNome } : undefined}
      documentoId={`hist-${consultas.length}`}
      assinatura={dados.medico}
    >
      <View>
        <Secao titulo="Evolução" nota="Os números lado a lado, no sentido do tempo." />
        {linhas.length === 0 ? (
          <Vazio>Nenhuma consulta registrada ainda.</Vazio>
        ) : (
          <Tabela colunas={colunas} linhas={linhas} zebra />
        )}
      </View>

      <View>
        <Secao titulo={`Registros (${consultas.length})`} />
        {consultas.length === 0 ? (
          <Vazio>Nenhuma consulta registrada ainda.</Vazio>
        ) : (
          consultas.map((c, i) => (
            // `wrap={false}` mantém cada consulta inteira numa página quando cabe:
            // um registro clínico partido ao meio se lê como dois registros.
            <View key={i} wrap={false} style={{ marginBottom: ESPACO.md }}>
              <Text
                style={{
                  fontFamily: 'Outfit',
                  fontWeight: 600,
                  fontSize: TIPO.corpo,
                  color: TOKENS.indigo,
                }}
              >
                {dataCurta(c.data)}
                {c.igSemanas != null ? ` · ${c.igSemanas}s${c.igDias ?? 0}d` : ''}
                {c.autorNome ? ` · ${c.autorNome}` : ''}
              </Text>
              {c.subjetivo ? <Campo rotulo="Subjetivo" valor={c.subjetivo} /> : null}
              {c.objetivo ? <Campo rotulo="Objetivo" valor={c.objetivo} /> : null}
              {c.avaliacao ? <Campo rotulo="Avaliação" valor={c.avaliacao} /> : null}
              {c.plano ? <Campo rotulo="Conduta" valor={c.plano} /> : null}
            </View>
          ))
        )}
      </View>
    </DocumentoPrumo>
  )
}
