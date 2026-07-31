import { View, Text, StyleSheet } from '@react-pdf/renderer'
import { DocumentoPrumo } from '../sistema/Documento'
import { Secao, Paragrafo } from '../sistema/primitivas'
import { TOKENS, TIPO, ESPACO } from '../sistema/tokens'

export interface ItemReceitaPDF {
  medicamento: string
  dose?: string
  posologia?: string
  duracao?: string
  quantidade?: string
  observacao?: string
}

export interface ReceitaPDF {
  id: string
  pacienteNome?: string
  tipo: 'simples' | 'antimicrobiano' | 'especial'
  vias: number
  itens: ItemReceitaPDF[]
  orientacoes?: string
  emitidaEm: string
  validaAte: string
  canceladaEm?: string | null
  motivoCancelamento?: string
  medico: { nome: string; crm?: string; crmUf?: string; especialidade?: string }
}

const ROTULO_TIPO: Record<ReceitaPDF['tipo'], string> = {
  simples: 'Receituário simples',
  antimicrobiano: 'Receituário de antimicrobiano',
  especial: 'Receituário de controle especial',
}

/** A base legal de cada tipo, impressa. A farmácia lê, e a paciente pode ler. */
const BASE_LEGAL: Record<ReceitaPDF['tipo'], string> = {
  simples: '',
  antimicrobiano: 'Emitida em 2 vias, conforme RDC ANVISA nº 20/2011. Validade de 10 dias.',
  especial: 'Emitida em 2 vias, conforme Portaria SVS/MS nº 344/1998.',
}

function data(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

const s = StyleSheet.create({
  viaEtiqueta: {
    alignSelf: 'flex-start',
    backgroundColor: TOKENS.paper3,
    color: TOKENS.indigo,
    fontFamily: 'Outfit',
    fontSize: TIPO.micro,
    fontWeight: 600,
    paddingVertical: 2.5,
    paddingHorizontal: 7,
    borderRadius: 8,
    marginBottom: ESPACO.sm,
  },
  item: {
    borderBottomWidth: 0.6,
    borderBottomColor: TOKENS.line,
    paddingBottom: ESPACO.sm,
    marginBottom: ESPACO.sm,
  },
  itemCabeca: { flexDirection: 'row', alignItems: 'flex-start' },
  numero: {
    fontFamily: 'Outfit',
    fontSize: TIPO.corpo,
    fontWeight: 700,
    color: TOKENS.lilas,
    width: 16,
  },
  medicamento: {
    flex: 1,
    fontFamily: 'Outfit',
    fontSize: TIPO.corpo + 1,
    fontWeight: 700,
    color: TOKENS.ink,
  },
  detalhe: {
    marginLeft: 16,
    marginTop: 2,
    fontFamily: 'Nunito',
    fontSize: TIPO.corpo,
    color: TOKENS.inkSoft,
    lineHeight: 1.45,
  },
  observacao: {
    marginLeft: 16,
    marginTop: 2,
    fontFamily: 'Nunito',
    fontSize: TIPO.pequeno,
    color: TOKENS.inkMute,
  },
  aviso: {
    marginTop: ESPACO.md,
    borderWidth: 0.8,
    borderColor: TOKENS.warn,
    borderRadius: 6,
    padding: ESPACO.sm,
  },
  avisoTexto: {
    fontFamily: 'Nunito',
    fontSize: TIPO.pequeno,
    color: TOKENS.warnInk,
    lineHeight: 1.45,
  },
  carimbo: {
    marginBottom: ESPACO.md,
    borderWidth: 1.2,
    borderColor: TOKENS.warn,
    borderRadius: 6,
    padding: ESPACO.sm,
  },
  carimboTitulo: {
    fontFamily: 'Outfit',
    fontSize: TIPO.secao,
    fontWeight: 700,
    color: TOKENS.warnInk,
  },
  meta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: ESPACO.md,
  },
  metaTexto: { fontFamily: 'Nunito', fontSize: TIPO.pequeno, color: TOKENS.inkMute },

  assinatura: {
    marginTop: ESPACO.lg,
    paddingTop: ESPACO.sm,
    borderTopWidth: 0.8,
    borderTopColor: TOKENS.ink,
    width: 240,
  },
  assinaturaNome: {
    fontFamily: 'Outfit',
    fontSize: TIPO.corpo,
    fontWeight: 700,
    color: TOKENS.ink,
  },
  assinaturaMeta: {
    fontFamily: 'Nunito',
    fontSize: TIPO.micro,
    color: TOKENS.inkMute,
    marginTop: 1,
  },
})

/**
 * A receita.
 *
 * É o documento que mais sai do Prumo e vai parar na mão de um terceiro — o
 * balconista da farmácia —, e por isso é o que menos pode ser bonito e vago. Ele
 * precisa ser **lido em pé, rápido, por quem não conhece o produto**: um item
 * por linha, o medicamento em destaque, a posologia logo abaixo, e a validade
 * onde os olhos batem primeiro.
 *
 * ## As duas vias
 *
 * Antimicrobiano exige duas vias (RDC 20/2011) e controle especial exige duas
 * (Portaria 344/1998) — uma fica retida na farmácia. Não é decisão de layout:
 * emitir uma via só faz a farmácia recusar, e quem descobre isso é a paciente,
 * no balcão. Cada via sai numa página, etiquetada.
 *
 * ## O aviso sobre assinatura
 *
 * Está lá porque o contrário seria mentir. A Lei 14.063/2020 e a Res. CFM
 * 2.299/2021 exigem assinatura digital qualificada (ICP-Brasil) para dispensação
 * sem presença física. Este PDF não assina nada — ele deixa o bloco pronto e
 * diz, em letra visível, que a via vale depois de assinada. É melhor a paciente
 * descobrir isso aqui do que na farmácia.
 */
export function ReceitaDocument({ dados }: { dados: ReceitaPDF }) {
  const cancelada = Boolean(dados.canceladaEm)
  const vias = Array.from({ length: Math.max(1, dados.vias) }, (_, i) => i)

  return (
    <DocumentoPrumo
      titulo={ROTULO_TIPO[dados.tipo]}
      subtitulo={`Emitida em ${data(dados.emitidaEm)}`}
      paciente={{ nome: dados.pacienteNome }}
      documentoId={dados.id.slice(-8)}
      /**
       * A assinatura NAO vai no `assinatura` do shell, e essa e a diferenca
       * entre uma receita que funciona e uma que a farmacia devolve: o bloco do
       * shell e impresso uma vez, no fim do documento — ou seja, so na ultima
       * via. A via retida no balcao sairia sem linha de assinatura.
       *
       * Cada via carrega a sua, abaixo.
       */
      blocos={vias.map((i) => (
        <View key={i}>
          {dados.vias > 1 && (
            <View>
              <Text style={s.viaEtiqueta}>
                {i === 0 ? '1ª via — farmácia' : '2ª via — paciente'}
              </Text>
            </View>
          )}

          {cancelada && (
            <View style={s.carimbo}>
              <Text style={s.carimboTitulo}>RECEITA CANCELADA</Text>
              <Text style={s.avisoTexto}>
                Cancelada em {data(dados.canceladaEm!)}
                {dados.motivoCancelamento ? ` — ${dados.motivoCancelamento}` : ''}. Esta via não deve
                ser dispensada.
              </Text>
            </View>
          )}

          <View style={s.meta}>
            <Text style={s.metaTexto}>Paciente: {dados.pacienteNome || '—'}</Text>
            <Text style={s.metaTexto}>Válida até {data(dados.validaAte)}</Text>
          </View>

          <Secao titulo="Prescrição" />

          {dados.itens.map((item, n) => {
            const linha = [item.dose, item.posologia, item.duracao].filter(Boolean).join(' · ')
            return (
              <View key={n} style={s.item} wrap={false}>
                <View style={s.itemCabeca}>
                  <Text style={s.numero}>{n + 1}.</Text>
                  <Text style={s.medicamento}>{item.medicamento}</Text>
                </View>
                {linha ? <Text style={s.detalhe}>{linha}</Text> : null}
                {item.quantidade ? (
                  <Text style={s.detalhe}>Quantidade: {item.quantidade}</Text>
                ) : null}
                {item.observacao ? <Text style={s.observacao}>{item.observacao}</Text> : null}
              </View>
            )
          })}

          {dados.orientacoes ? (
            <>
              <Secao titulo="Orientações" />
              <Paragrafo>{dados.orientacoes}</Paragrafo>
            </>
          ) : null}

          {BASE_LEGAL[dados.tipo] ? (
            <Text style={s.metaTexto}>{BASE_LEGAL[dados.tipo]}</Text>
          ) : null}

          <View style={s.aviso}>
            <Text style={s.avisoTexto}>
              Esta via ainda não está assinada digitalmente. Para valer sem a presença do
              prescritor, ela precisa da assinatura digital qualificada (ICP-Brasil) do profissional
              — ou da assinatura de próprio punho na via impressa.
            </Text>
          </View>

          {/* A linha de assinatura fica em CADA via, e por isso nao usa o bloco
              do shell. `wrap={false}` impede que ela caia sozinha na pagina
              seguinte, separada da receita que ela assina. */}
          <View style={s.assinatura} wrap={false}>
            <Text style={s.assinaturaNome}>{dados.medico.nome}</Text>
            <Text style={s.assinaturaMeta}>
              {[
                dados.medico.crm &&
                  `CRM ${dados.medico.crm}${dados.medico.crmUf ? `/${dados.medico.crmUf}` : ''}`,
                dados.medico.especialidade,
              ]
                .filter(Boolean)
                .join(' · ')}
            </Text>
          </View>
        </View>
      ))}
    />
  )
}
