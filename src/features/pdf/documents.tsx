/**
 * Ponto de entrada dos PDFs do Prumo.
 *
 * O arquivo continua com este nome e continua exportando tudo por um lugar só —
 * essa era a propriedade que a versão monolítica anterior protegia, e ela vale:
 * o Vite emite **um** chunk `@react-pdf` compartilhado por todas as páginas, em
 * vez de um por documento. As páginas seguem fazendo
 * `lazy(() => import('@/features/pdf/documents'))` sem saber que por baixo agora
 * existe um sistema de documentos.
 *
 * Onde está o quê:
 *  - `sistema/`     → fontes da marca, paleta, capa/cabeçalho/rodapé, primitivas
 *  - `documentos/`  → um arquivo por documento
 */

import { DownloadLink } from './sistema/DownloadLink'
import { CaderninhoDocument } from './documentos/Caderninho'
import type { DuvidaPDF } from './documentos/Caderninho'
import { ProntuarioDocument } from './documentos/Prontuario'
import type { ProntuarioPDFData, EvolucaoPDF } from './documentos/Prontuario'
import { VacinacaoDocument } from './documentos/Vacinacao'
import type { DosePDF } from './documentos/Vacinacao'
import { TrilhaDocument } from './documentos/Trilha'
import type { TrilhaNodePDF } from './documentos/Trilha'
import { MeusDadosDocument } from './documentos/MeusDados'
import type { MeusDadosExport } from './documentos/MeusDados'
import { ResumoDaConsultaDocument } from './documentos/ResumoDaConsulta'
import type { ResumoConsultaPDF } from './documentos/ResumoDaConsulta'
import { HistoricoConsultasDocument } from './documentos/HistoricoConsultas'
import type { HistoricoConsultasPDF } from './documentos/HistoricoConsultas'
import { TransferenciaDocument } from './documentos/Transferencia'
import type { PacotePDF } from './documentos/Transferencia'
import { ReceitaDocument } from './documentos/Receita'
import type { ReceitaPDF } from './documentos/Receita'

export { DownloadLink }
export {
  CaderninhoDocument,
  ProntuarioDocument,
  VacinacaoDocument,
  TrilhaDocument,
  MeusDadosDocument,
  ResumoDaConsultaDocument,
  HistoricoConsultasDocument,
  TransferenciaDocument,
  ReceitaDocument,
}
export type {
  DuvidaPDF,
  ProntuarioPDFData,
  EvolucaoPDF,
  DosePDF,
  TrilhaNodePDF,
  MeusDadosExport,
  ResumoConsultaPDF,
  PacotePDF,
  ReceitaPDF,
}

/* ---- Botões por documento: as páginas carregam estes e passam os dados ---- */

export function BaixarCaderninho({ duvidas, nome }: { duvidas: DuvidaPDF[]; nome?: string }) {
  return (
    <DownloadLink
      documento={<CaderninhoDocument duvidas={duvidas} nome={nome} />}
      fileName="caderninho-de-duvidas.pdf"
      label="Imprimir / baixar PDF"
    />
  )
}

export function BaixarProntuario({ dados }: { dados: ProntuarioPDFData }) {
  return (
    <DownloadLink
      documento={<ProntuarioDocument dados={dados} />}
      fileName="prontuario.pdf"
      label="Baixar prontuário (PDF)"
    />
  )
}

export function BaixarVacinacao({ doses, nome }: { doses: DosePDF[]; nome?: string }) {
  return (
    <DownloadLink
      documento={<VacinacaoDocument doses={doses} nome={nome} />}
      fileName="carteira-de-vacinacao.pdf"
      label="Baixar carteira (PDF)"
    />
  )
}

export function BaixarTrilha({
  nodes,
  progresso,
  nome,
}: {
  nodes: TrilhaNodePDF[]
  progresso: number
  nome?: string
}) {
  return (
    <DownloadLink
      documento={<TrilhaDocument nodes={nodes} progresso={progresso} nome={nome} />}
      fileName="resumo-da-trilha.pdf"
      label="Baixar resumo (PDF)"
    />
  )
}

export function BaixarResumoDaConsulta({ dados }: { dados: ResumoConsultaPDF }) {
  return (
    <DownloadLink
      documento={<ResumoDaConsultaDocument dados={dados} />}
      fileName="resumo-da-consulta.pdf"
      label="Baixar resumo (PDF)"
    />
  )
}

export function BaixarHistoricoConsultas({ dados }: { dados: HistoricoConsultasPDF }) {
  return (
    <DownloadLink
      documento={<HistoricoConsultasDocument dados={dados} />}
      fileName="historico-de-consultas.pdf"
      label="Baixar todas as consultas (PDF)"
    />
  )
}

export function BaixarTransferencia({ pacote }: { pacote: PacotePDF }) {
  return (
    <DownloadLink
      documento={<TransferenciaDocument pacote={pacote} />}
      fileName="prontuario-transferencia.pdf"
      label="Baixar prontuário (PDF)"
    />
  )
}

/**
 * A receita.
 *
 * Nome de arquivo com a data: a paciente baixa várias ao longo da gestação, e
 * `receita.pdf (3)` na pasta de downloads não diz qual é qual.
 */
export function BaixarReceita({ dados }: { dados: ReceitaPDF }) {
  const dia = dados.emitidaEm.slice(0, 10)
  return (
    <DownloadLink
      documento={<ReceitaDocument dados={dados} />}
      fileName={`receita-${dia}.pdf`}
      label="Baixar receita (PDF)"
    />
  )
}
