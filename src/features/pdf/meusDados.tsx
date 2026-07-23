import { pdf } from '@react-pdf/renderer'
import { MeusDadosDocument } from './documents'
import type { MeusDadosExport } from './documents'

/** Renders the "meus dados" PDF off-screen and resolves with the file blob. */
export function gerarMeusDadosPdfBlob(dados: MeusDadosExport): Promise<Blob> {
  return pdf(<MeusDadosDocument dados={dados} />).toBlob()
}
