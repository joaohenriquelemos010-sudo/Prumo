import { View, Text } from '@react-pdf/renderer'
import { DocumentoPrumo } from '../sistema/Documento'
import { Secao, Campo, Cartao, Tabela, Vazio } from '../sistema/primitivas'
import type { Coluna } from '../sistema/primitivas'
import { TOKENS, TIPO } from '../sistema/tokens'

/** Espelha o que `GET /api/auth/exportar` devolve. */
export interface MeusDadosExport {
  exportadoEm: string
  conta: {
    nome: string
    email: string
    papel: string
    crm?: string
    crmUf?: string
    verificacaoStatus?: string
    criadaEm?: string
  }
  jornadas: {
    nome?: string
    momento: string
    programa?: string
    dpp?: string | null
    dataNascimento?: string | null
    etapasConcluidas: string[]
    vacinasAplicadas: string[]
    prontuario: {
      tipoSanguineo?: string
      alergias?: string
      resumoGestacional?: string
      condicoes?: string[]
      eventos?: { id: string; data: string; autorNome?: string; texto: string }[]
    } | null
    consultas: {
      id: string
      data: string
      tipo: string
      subjetivo?: string
      objetivo?: string
      avaliacao?: string
      plano?: string
    }[]
    exames: {
      id: string
      nome: string
      categoria: string
      dataExame: string
      observacoes?: string
      arquivoNome?: string
    }[]
    duvidas: {
      id: string
      texto: string
      criadaEm: string
      respondida: boolean
      respostaTexto?: string
      respondidaPor?: string
    }[]
  }[]
  vinculos: { medicoNome?: string; pacienteNome?: string; status?: string }[]
  convitesEnviados: { usado?: boolean; expiraEm?: string }[]
  /**
   * `agendamentos`. A versão anterior lia `solicitacoes`, campo que o servidor
   * deixou de mandar quando a migração para `Agendamento` rodou — e `.length`
   * sobre `undefined` derrubava o render inteiro. "Baixar meus dados" ficou
   * quebrado por isso.
   */
  agendamentos: {
    profissionalNome?: string
    objetivo: string
    modalidade: string
    status: string
    inicio: string
  }[]
}

const PAPEL: Record<string, string> = {
  gestante: 'Gestante',
  mae: 'Mãe',
  pai: 'Pai',
  medico: 'Médico(a)',
  admin: 'Administrador',
}

const data = (v?: string | null) => (v ? new Date(v).toLocaleDateString('pt-BR') : '—')

type Agendamento = MeusDadosExport['agendamentos'][number]

const COLUNAS_AGENDA: Coluna<Agendamento>[] = [
  { chave: 'inicio', rotulo: 'Quando', largura: 1, render: (a) => data(a.inicio) },
  { chave: 'profissionalNome', rotulo: 'Profissional', largura: 1.8 },
  { chave: 'objetivo', rotulo: 'Objetivo', largura: 1.4 },
  { chave: 'status', rotulo: 'Situação', largura: 1, alinhamento: 'right' },
]

/**
 * A exportação LGPD, em papel.
 *
 * Todo acesso a array é defensivo: este documento é gerado a partir de uma
 * resposta de API que evolui, e um campo ausente não pode derrubar o download
 * de alguém exercendo um direito.
 */
export function MeusDadosDocument({ dados }: { dados: MeusDadosExport }) {
  const jornadas = dados.jornadas ?? []

  return (
    <DocumentoPrumo
      titulo="Meus dados"
      subtitulo={`Exportado em ${new Date(dados.exportadoEm).toLocaleString('pt-BR')}`}
      capa
      documentoId="meus-dados"
    >
      <Secao titulo="Conta" />
      <Campo rotulo="Nome" valor={dados.conta?.nome} />
      <Campo rotulo="E-mail" valor={dados.conta?.email} />
      <Campo rotulo="Perfil" valor={PAPEL[dados.conta?.papel] ?? dados.conta?.papel} />
      {dados.conta?.papel === 'medico' && (
        <Campo
          rotulo="CRM"
          valor={`${dados.conta.crm ?? '—'}${dados.conta.crmUf ? `/${dados.conta.crmUf}` : ''}`}
        />
      )}
      <Campo rotulo="Conta criada em" valor={data(dados.conta?.criadaEm)} />

      {jornadas.map((j, i) => (
        <View key={i}>
          <Secao titulo={j.nome || 'Minha jornada'} />
          <Campo rotulo="Momento" valor={j.momento} />
          <Campo rotulo="Data provável do parto" valor={j.dpp ? data(j.dpp) : ''} />
          <Campo rotulo="Nascimento" valor={j.dataNascimento ? data(j.dataNascimento) : ''} />
          <Campo rotulo="Etapas concluídas" valor={String(j.etapasConcluidas?.length ?? 0)} />
          <Campo rotulo="Doses aplicadas" valor={String(j.vacinasAplicadas?.length ?? 0)} />

          {j.prontuario && (
            <Cartao titulo="Prontuário">
              <Campo rotulo="Tipo sanguíneo" valor={j.prontuario.tipoSanguineo} />
              <Campo rotulo="Alergias" valor={j.prontuario.alergias} />
              <Campo rotulo="Condições" valor={j.prontuario.condicoes?.join(' · ')} />
              <Campo rotulo="Resumo gestacional" valor={j.prontuario.resumoGestacional} />
            </Cartao>
          )}

          {(j.consultas?.length ?? 0) > 0 && (
            <View>
              <Secao titulo="Consultas" />
              {j.consultas.map((c) => (
                <Cartao key={c.id}>
                  <Text style={{ fontSize: TIPO.micro, color: TOKENS.inkMute }}>
                    {data(c.data)} · {c.tipo}
                  </Text>
                  {c.subjetivo ? <Text style={{ fontSize: TIPO.pequeno }}>S: {c.subjetivo}</Text> : null}
                  {c.objetivo ? <Text style={{ fontSize: TIPO.pequeno }}>O: {c.objetivo}</Text> : null}
                  {c.avaliacao ? <Text style={{ fontSize: TIPO.pequeno }}>A: {c.avaliacao}</Text> : null}
                  {c.plano ? <Text style={{ fontSize: TIPO.pequeno }}>P: {c.plano}</Text> : null}
                </Cartao>
              ))}
            </View>
          )}

          {(j.exames?.length ?? 0) > 0 && (
            <View>
              <Secao titulo="Exames" />
              {j.exames.map((e) => (
                <Campo key={e.id} rotulo={`${e.nome} · ${e.categoria}`} valor={data(e.dataExame)} />
              ))}
            </View>
          )}

          {(j.duvidas?.length ?? 0) > 0 && (
            <View>
              <Secao titulo="Dúvidas" />
              {j.duvidas.map((d) => (
                <Cartao key={d.id}>
                  <Text style={{ fontSize: TIPO.corpo }}>{d.texto}</Text>
                  {d.respondida ? (
                    <Text style={{ fontSize: TIPO.pequeno, color: TOKENS.inkSoft }}>
                      Resposta: {d.respostaTexto}
                    </Text>
                  ) : null}
                </Cartao>
              ))}
            </View>
          )}
        </View>
      ))}

      <Secao titulo="Agendamentos" />
      <Tabela
        colunas={COLUNAS_AGENDA}
        linhas={dados.agendamentos ?? []}
        vazio="Nenhum agendamento registrado."
      />

      <Secao titulo="Conexões" />
      {(dados.vinculos?.length ?? 0) === 0 ? (
        <Vazio>Nenhuma conexão ativa.</Vazio>
      ) : (
        dados.vinculos.map((v, i) => (
          <Campo key={i} rotulo={v.medicoNome || v.pacienteNome || 'Conexão'} valor={v.status} />
        ))
      )}
    </DocumentoPrumo>
  )
}
