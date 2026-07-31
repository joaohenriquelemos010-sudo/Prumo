import { View, Text } from '@react-pdf/renderer'
import { DocumentoPrumo } from '../sistema/Documento'
import { Secao, Cartao, Vazio } from '../sistema/primitivas'
import { TOKENS, TIPO, ESPACO } from '../sistema/tokens'

export interface DuvidaPDF {
  id: string
  texto: string
  criadaEm: string
  respondida: boolean
  respostaTexto: string
  respondidaPor: string
}

function agruparPorDia(duvidas: DuvidaPDF[]): [string, DuvidaPDF[]][] {
  const mapa = new Map<string, DuvidaPDF[]>()
  for (const d of duvidas) {
    const dia = new Date(d.criadaEm).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    })
    const lista = mapa.get(dia) ?? []
    lista.push(d)
    mapa.set(dia, lista)
  }
  return [...mapa.entries()]
}

/**
 * O caderninho impresso — para levar na consulta.
 *
 * É o documento mais "da paciente" do produto, e a única concessão de forma que
 * ele faz é essa: as perguntas ficam agrupadas por dia, na ordem em que ela
 * pensou nelas, e não reorganizadas por tema. A conversa segue melhor assim.
 */
export function CaderninhoDocument({ duvidas, nome }: { duvidas: DuvidaPDF[]; nome?: string }) {
  const grupos = agruparPorDia(duvidas)

  return (
    <DocumentoPrumo
      titulo="Caderninho de dúvidas"
      subtitulo="Perguntas para conversar com a equipe de saúde"
      paciente={nome ? { nome } : undefined}
      documentoId="caderninho"
    >
      {grupos.length === 0 ? (
        <Vazio>Nenhuma dúvida anotada ainda. A primeira pode ser agora.</Vazio>
      ) : (
        grupos.map(([dia, lista]) => (
          <View key={dia}>
            <Secao titulo={dia} />
            {lista.map((d) => (
              <Cartao key={d.id}>
                <Text style={{ fontSize: TIPO.corpo }}>{d.texto}</Text>
                {d.respondida ? (
                  <View
                    style={{
                      marginTop: ESPACO.sm,
                      paddingTop: ESPACO.sm,
                      borderTopWidth: 0.5,
                      borderTopColor: TOKENS.line,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: TIPO.micro,
                        fontFamily: 'Outfit',
                        fontWeight: 700,
                        color: TOKENS.azul,
                      }}
                    >
                      Resposta{d.respondidaPor ? ` · ${d.respondidaPor}` : ''}
                    </Text>
                    <Text style={{ fontSize: TIPO.pequeno }}>{d.respostaTexto}</Text>
                  </View>
                ) : (
                  <Text style={{ marginTop: 3, fontSize: TIPO.micro, color: TOKENS.inkMute }}>
                    Aguardando resposta
                  </Text>
                )}
              </Cartao>
            ))}
          </View>
        ))
      )}
    </DocumentoPrumo>
  )
}
