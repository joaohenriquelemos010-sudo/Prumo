import { View, Text } from '@react-pdf/renderer'
import { DocumentoPrumo } from '../sistema/Documento'
import { Secao, Campo, Destaque, Cartao, Vazio, Chip } from '../sistema/primitivas'
import { TOKENS, TIPO, ESPACO } from '../sistema/tokens'

export interface EvolucaoPDF {
  id: string
  ordem: number
  tipo: string
  em: string
  autorNome: string
  autorCrm?: string
  texto: string
  retificadaPor?: string
  retificacaoDe?: string
}

export interface ProntuarioPDFData {
  nome?: string
  tipoSanguineo: string
  alergias: string
  resumoGestacional: string
  condicoes: string[]
  /** Legado — usado só quando não há evoluções (registros antigos). */
  eventos: { id: string; data: string; autorNome: string; texto: string }[]
  evolucoes?: EvolucaoPDF[]
  assinatura?: { nome: string; crm?: string; especialidade?: string }
}

const ROTULO_TIPO: Record<string, string> = {
  admissao: 'Admissão',
  consulta: 'Consulta',
  evolucao: 'Evolução',
  resultado: 'Resultado',
  transferencia: 'Transferência',
  intercorrencia: 'Intercorrência',
}

function dataHora(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * O prontuário completo, com capa.
 *
 * Leva capa porque é o documento que circula: vai para outro médico, para uma
 * maternidade, para um convênio. Um documento que circula precisa se identificar
 * na primeira página sem que ninguém precise ler.
 *
 * Entradas retificadas continuam impressas, marcadas — porque num prontuário o
 * que se registrou na hora também é história, e omiti-las no papel desfaria a
 * garantia que a cadeia dá no banco.
 */
export function ProntuarioDocument({ dados }: { dados: ProntuarioPDFData }) {
  const evolucoes = dados.evolucoes ?? []
  const legado = evolucoes.length === 0 ? dados.eventos : []

  return (
    <DocumentoPrumo
      titulo="Prontuário"
      subtitulo="Registro clínico contínuo — da gestação à pediatria"
      paciente={dados.nome ? { nome: dados.nome } : undefined}
      capa
      documentoId="prontuario"
      assinatura={dados.assinatura}
    >
      {dados.alergias?.trim() ? (
        <Destaque>
          <Text
            style={{
              fontSize: TIPO.micro,
              fontFamily: 'Outfit',
              fontWeight: 700,
              color: TOKENS.warnInk,
            }}
          >
            ALERGIAS
          </Text>
          <Text style={{ fontSize: TIPO.corpo }}>{dados.alergias}</Text>
        </Destaque>
      ) : null}

      <Secao titulo="Resumo" />
      <Campo rotulo="Tipo sanguíneo" valor={dados.tipoSanguineo} />
      <Campo rotulo="Alergias" valor={dados.alergias} />
      <Campo rotulo="Condições" valor={dados.condicoes?.join(' · ')} />
      <Campo rotulo="Resumo gestacional" valor={dados.resumoGestacional} />

      <Secao
        titulo="História clínica"
        nota="Registro append-only: correções aparecem como retificação, e a entrada original permanece."
      />

      {evolucoes.length === 0 && legado.length === 0 ? (
        <Vazio>Nenhum registro na história clínica.</Vazio>
      ) : null}

      {evolucoes.map((ev) => (
        <View key={ev.id} style={{ marginBottom: ESPACO.sm }} wrap={false}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: ESPACO.xs }}>
            <Chip tom={ev.retificadaPor ? 'neutro' : 'marca'}>
              {ROTULO_TIPO[ev.tipo] ?? ev.tipo}
            </Chip>
            {ev.retificadaPor ? <Chip tom="atencao">retificada</Chip> : null}
            <Text style={{ fontSize: TIPO.micro, color: TOKENS.inkMute }}>#{ev.ordem}</Text>
          </View>

          <Text
            style={{
              fontSize: TIPO.corpo,
              marginTop: 2,
              color: ev.retificadaPor ? TOKENS.inkMute : TOKENS.ink,
            }}
          >
            {ev.texto}
          </Text>

          <Text style={{ fontSize: TIPO.micro, color: TOKENS.inkMute }}>
            {dataHora(ev.em)}
            {ev.autorNome ? ` · ${ev.autorNome}` : ''}
            {ev.autorCrm ? ` · CRM ${ev.autorCrm}` : ''}
          </Text>
        </View>
      ))}

      {legado.map((e) => (
        <Cartao key={e.id}>
          <Text style={{ fontSize: TIPO.corpo }}>{e.texto}</Text>
          <Text style={{ fontSize: TIPO.micro, color: TOKENS.inkMute }}>
            {new Date(e.data).toLocaleDateString('pt-BR')}
            {e.autorNome ? ` · ${e.autorNome}` : ''}
          </Text>
        </Cartao>
      ))}
    </DocumentoPrumo>
  )
}
