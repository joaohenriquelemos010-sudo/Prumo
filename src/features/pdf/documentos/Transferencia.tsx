import { View, Text } from '@react-pdf/renderer'
import { DocumentoPrumo } from '../sistema/Documento'
import { Secao, Campo, Destaque, Tabela, Chip, Vazio } from '../sistema/primitivas'
import type { Coluna } from '../sistema/primitivas'
import { TOKENS, TIPO, ESPACO } from '../sistema/tokens'

/** Espelha o pacote de `server/services/pacoteClinico.ts`. */
export interface PacotePDF {
  meta: {
    geradoEm: string
    versao: number
    programa: string
    integridade: { total: number; integra: boolean; quebradaEm: number | null }
  }
  paciente: {
    nome?: string
    momento?: string
    dpp?: string | null
    dataNascimento?: string | null
    tipoSanguineo?: string
    alergias?: string
    resumoGestacional?: string
  }
  condicoes: { descricao: string }[]
  encontros: {
    data: string
    tipo: string
    autorNome: string
    igSemanas?: number | null
    subjetivo?: string
    objetivo?: string
    avaliacao?: string
    avaliacaoOmitida?: boolean
    plano?: string
  }[]
  observacoes: Record<string, unknown>[]
  imunizacoes: { dose: string }[]
  documentos: { nome: string; categoria: string; dataExame: string }[]
  narrativa: {
    ordem: number
    tipo: string
    em: string
    autorNome: string
    autorCrm?: string
    texto: string
    retificadaPor?: string
  }[]
}

const data = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString('pt-BR') : '—')

const COLUNAS_EXAMES: Coluna<PacotePDF['documentos'][number]>[] = [
  { chave: 'nome', rotulo: 'Exame', largura: 2.2 },
  { chave: 'categoria', rotulo: 'Categoria', largura: 1 },
  { chave: 'dataExame', rotulo: 'Data', largura: 1, alinhamento: 'right', render: (d) => data(d.dataExame) },
]

/**
 * O prontuário em trânsito — o que o próximo médico recebe impresso.
 *
 * Leva capa e um bloco de procedência logo na abertura: quem gerou, quando, e o
 * estado da cadeia de integridade no momento da geração. Um documento clínico
 * que muda de mãos precisa dizer de onde veio, senão vira folha solta.
 *
 * As avaliações que a médica anterior marcou como privadas aparecem como
 * **omitidas**, não como campo vazio. O colega precisa saber que existe um
 * raciocínio que não veio junto — silêncio nesse ponto seria enganoso.
 */
export function TransferenciaDocument({ pacote }: { pacote: PacotePDF }) {
  const p = pacote.paciente

  return (
    <DocumentoPrumo
      titulo="Prontuário — transferência"
      subtitulo="Registro clínico completo para continuidade do cuidado"
      paciente={{
        nome: p.nome,
        nascimento: p.dataNascimento ? data(p.dataNascimento) : undefined,
      }}
      capa
      documentoId={`transf-v${pacote.meta.versao}`}
    >
      <Destaque>
        <Text style={{ fontSize: TIPO.micro, fontFamily: 'Outfit', fontWeight: 700, color: TOKENS.indigo }}>
          PROCEDÊNCIA
        </Text>
        <Text style={{ fontSize: TIPO.pequeno, marginTop: 2 }}>
          Gerado pelo Prumo em {new Date(pacote.meta.geradoEm).toLocaleString('pt-BR')}.
          {' '}
          {pacote.meta.integridade.integra
            ? `Cadeia de integridade verificada: ${pacote.meta.integridade.total} registros, íntegra.`
            : `ATENÇÃO: a verificação de integridade apontou divergência no registro #${pacote.meta.integridade.quebradaEm}.`}
        </Text>
      </Destaque>

      <Secao titulo="Paciente" />
      <Campo rotulo="Nome" valor={p.nome} />
      <Campo rotulo="Momento" valor={p.momento} />
      <Campo rotulo="Data provável do parto" valor={p.dpp ? data(p.dpp) : ''} />
      <Campo rotulo="Nascimento" valor={p.dataNascimento ? data(p.dataNascimento) : ''} />
      <Campo rotulo="Tipo sanguíneo" valor={p.tipoSanguineo} />
      <Campo rotulo="Alergias" valor={p.alergias} />
      <Campo rotulo="Condições" valor={pacote.condicoes.map((c) => c.descricao).join(' · ')} />
      <Campo rotulo="Resumo gestacional" valor={p.resumoGestacional} />

      <Secao titulo="História clínica" nota="Registro append-only; retificações preservam a entrada original." />
      {pacote.narrativa.length === 0 ? (
        <Vazio>Sem registros na história clínica.</Vazio>
      ) : (
        pacote.narrativa.map((n) => (
          <View key={n.ordem} style={{ marginBottom: ESPACO.sm }} wrap={false}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: ESPACO.xs }}>
              <Chip tom={n.retificadaPor ? 'neutro' : 'marca'}>{n.tipo}</Chip>
              {n.retificadaPor ? <Chip tom="atencao">retificada</Chip> : null}
              <Text style={{ fontSize: TIPO.micro, color: TOKENS.inkMute }}>#{n.ordem}</Text>
            </View>
            <Text style={{ fontSize: TIPO.corpo, marginTop: 2 }}>{n.texto}</Text>
            <Text style={{ fontSize: TIPO.micro, color: TOKENS.inkMute }}>
              {new Date(n.em).toLocaleString('pt-BR')}
              {n.autorNome ? ` · ${n.autorNome}` : ''}
              {n.autorCrm ? ` · CRM ${n.autorCrm}` : ''}
            </Text>
          </View>
        ))
      )}

      <Secao titulo="Consultas" />
      {pacote.encontros.length === 0 ? (
        <Vazio>Sem consultas registradas.</Vazio>
      ) : (
        pacote.encontros.map((e, i) => (
          <View key={i} style={{ marginBottom: ESPACO.sm }} wrap={false}>
            <Text style={{ fontSize: TIPO.pequeno, fontFamily: 'Outfit', fontWeight: 600, color: TOKENS.indigo }}>
              {data(e.data)} · {e.tipo}
              {e.igSemanas != null ? ` · ${e.igSemanas}s` : ''}
              {e.autorNome ? ` · ${e.autorNome}` : ''}
            </Text>
            {e.subjetivo ? <Text style={{ fontSize: TIPO.pequeno }}>S: {e.subjetivo}</Text> : null}
            {e.objetivo ? <Text style={{ fontSize: TIPO.pequeno }}>O: {e.objetivo}</Text> : null}
            {e.avaliacaoOmitida ? (
              <Text style={{ fontSize: TIPO.pequeno, color: TOKENS.inkMute, fontFamily: 'Outfit' }}>
                A: impressão diagnóstica não compartilhada pelo profissional.
              </Text>
            ) : e.avaliacao ? (
              <Text style={{ fontSize: TIPO.pequeno }}>A: {e.avaliacao}</Text>
            ) : null}
            {e.plano ? <Text style={{ fontSize: TIPO.pequeno }}>P: {e.plano}</Text> : null}
          </View>
        ))
      )}

      <Secao titulo="Exames" />
      <Tabela colunas={COLUNAS_EXAMES} linhas={pacote.documentos} vazio="Sem exames anexados." />

      <Secao titulo="Imunizações" />
      <Text style={{ fontSize: TIPO.pequeno }}>
        {pacote.imunizacoes.length > 0
          ? `${pacote.imunizacoes.length} doses registradas (PNI).`
          : 'Nenhuma dose registrada.'}
      </Text>

      <Text style={{ fontSize: TIPO.micro, color: TOKENS.inkMute, marginTop: ESPACO.lg }}>
        Os arquivos de exame não estão embutidos neste PDF — eles seguem disponíveis no Prumo, pelo
        mesmo acesso autorizado. Notas privadas do profissional anterior não integram este pacote.
      </Text>
    </DocumentoPrumo>
  )
}
