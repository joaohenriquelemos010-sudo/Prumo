import { View, Text } from '@react-pdf/renderer'
import { DocumentoPrumo } from '../sistema/Documento'
import { Secao, Destaque, Tabela, Paragrafo, Vazio } from '../sistema/primitivas'
import type { Coluna } from '../sistema/primitivas'
import { TOKENS, TIPO, ESPACO } from '../sistema/tokens'

export interface ResumoConsultaPDF {
  pacienteNome?: string
  data: string
  tipo: string
  igSemanas?: number | null
  igDias?: number | null
  /** O texto escrito PARA ela — não o plano clínico. */
  resumoParaFamilia?: string
  plano?: string
  medidas?: Record<string, number | null | undefined>
  medico: { nome: string; crm?: string; especialidade?: string }
}

const ROTULO_MEDIDA: Record<string, { rotulo: string; unidade: string }> = {
  pesoKg: { rotulo: 'Peso', unidade: 'kg' },
  alturaCm: { rotulo: 'Altura', unidade: 'cm' },
  paSistolica: { rotulo: 'Pressão (sistólica)', unidade: 'mmHg' },
  paDiastolica: { rotulo: 'Pressão (diastólica)', unidade: 'mmHg' },
  alturaUterinaCm: { rotulo: 'Altura uterina', unidade: 'cm' },
  bcfBpm: { rotulo: 'Batimentos do bebê', unidade: 'bpm' },
  pesoG: { rotulo: 'Peso', unidade: 'g' },
  comprimentoCm: { rotulo: 'Comprimento', unidade: 'cm' },
  perimetroCefalicoCm: { rotulo: 'Perímetro cefálico', unidade: 'cm' },
}

interface LinhaMedida {
  rotulo: string
  valor: string
}

const COLUNAS: Coluna<LinhaMedida>[] = [
  { chave: 'rotulo', rotulo: 'Medida', largura: 2 },
  { chave: 'valor', rotulo: 'Valor', largura: 1, alinhamento: 'right' },
]

/**
 * O resumo que a médica manda para a paciente.
 *
 * É o documento mais importante desta fase e o mais fácil de errar. Ele **não é**
 * o prontuário reduzido: é o texto que a médica escreveu em linguagem leiga, e o
 * mínimo de números que fazem sentido para quem não é da área.
 *
 * O que fica **de fora**, deliberadamente: subjetivo, objetivo, avaliação e notas
 * privadas. Um achado escrito para um colega — "descartar RCIU" — chega de um
 * jeito muito diferente numa mãe lendo sozinha à meia-noite. Se o texto para a
 * família estiver vazio, o documento diz isso em vez de despejar o plano clínico
 * no lugar.
 */
export function ResumoDaConsultaDocument({ dados }: { dados: ResumoConsultaPDF }) {
  const medidas: LinhaMedida[] = Object.entries(dados.medidas ?? {})
    .filter(([chave, v]) => v !== null && v !== undefined && ROTULO_MEDIDA[chave])
    .map(([chave, v]) => ({
      rotulo: ROTULO_MEDIDA[chave]!.rotulo,
      valor: `${v} ${ROTULO_MEDIDA[chave]!.unidade}`,
    }))

  const quando = new Date(dados.data).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })

  const ig =
    dados.igSemanas != null ? `${dados.igSemanas}s${dados.igDias ?? 0}d de gestação` : undefined

  return (
    <DocumentoPrumo
      titulo="Resumo da sua consulta"
      subtitulo={[quando, ig].filter(Boolean).join(' · ')}
      paciente={dados.pacienteNome ? { nome: dados.pacienteNome } : undefined}
      documentoId="resumo-consulta"
      assinatura={dados.medico}
    >
      {dados.resumoParaFamilia?.trim() ? (
        <Destaque>
          <Text
            style={{
              fontSize: TIPO.micro,
              fontFamily: 'Outfit',
              fontWeight: 700,
              color: TOKENS.indigo,
            }}
          >
            O QUE CONVERSAMOS
          </Text>
          <Text style={{ fontSize: TIPO.corpo, marginTop: 2 }}>{dados.resumoParaFamilia}</Text>
        </Destaque>
      ) : (
        <Vazio>
          Sua médica não deixou um resumo escrito desta consulta. Se ficou alguma dúvida, anote no
          caderninho para a próxima.
        </Vazio>
      )}

      {medidas.length > 0 && (
        <View>
          <Secao titulo="Medidas de hoje" />
          <Tabela colunas={COLUNAS} linhas={medidas} />
        </View>
      )}

      {dados.plano?.trim() ? (
        <View>
          <Secao titulo="Orientações" />
          <Paragrafo>{dados.plano}</Paragrafo>
        </View>
      ) : null}

      <Text
        style={{
          fontSize: TIPO.micro,
          color: TOKENS.inkMute,
          marginTop: ESPACO.lg,
        }}
      >
        Este resumo não substitui o prontuário nem uma avaliação presencial. Em caso de dúvida ou
        sinal de alerta, procure sua equipe de saúde.
      </Text>
    </DocumentoPrumo>
  )
}
