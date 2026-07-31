import type { ReactElement } from 'react'
import { PDFDownloadLink } from '@react-pdf/renderer'

/**
 * O botão de baixar. Renderiza como um outline discreto — o documento é o
 * produto, não o botão.
 */
export function DownloadLink({
  documento,
  fileName,
  label,
}: {
  documento: ReactElement
  fileName: string
  label: string
}) {
  return (
    <PDFDownloadLink document={documento} fileName={fileName} style={{ textDecoration: 'none' }}>
      {({ loading }) => (
        <span className="inline-flex h-11 items-center gap-2 self-start rounded-pill border border-line bg-paper px-5 font-display text-sm font-semibold text-indigo shadow-soft hover:bg-paper-2">
          {loading ? 'Preparando…' : label}
        </span>
      )}
    </PDFDownloadLink>
  )
}
