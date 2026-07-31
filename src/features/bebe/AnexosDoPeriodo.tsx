import { FileText, Image as ImagemIcone, Paperclip } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { ExameResumo } from '@/features/bebe/tipos'

const ICONE_POR_TIPO = (mime: string) => (mime.startsWith('image/') ? ImagemIcone : FileText)

function dataCurta(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

/**
 * Os exames que caem dentro do período, como uma tira horizontal.
 *
 * Fica dentro do cartão do período por um motivo: o ultrassom da semana 20 e o
 * peso da semana 20 são a mesma lembrança, e hoje moram em duas telas
 * diferentes. Reuni-los é o que transforma "o Prumo guarda meus exames" em "o
 * Prumo guarda a minha gravidez".
 *
 * A tira rola no eixo próprio (`overflow-x`), nunca a página. Rolagem de página
 * dentro de um cartão é como se perde o lugar em que se estava lendo.
 */
export function AnexosDoPeriodo({ exames }: { exames: ExameResumo[] }) {
  if (exames.length === 0) return null

  return (
    <div className="mt-md">
      <p className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold text-ink-mute">
        <Paperclip className="size-3.5" aria-hidden />
        {exames.length === 1 ? '1 exame deste período' : `${exames.length} exames deste período`}
      </p>

      <ul className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {exames.map((e) => {
          const Icone = ICONE_POR_TIPO(e.mimeType)
          return (
            <li key={e.id} className="shrink-0">
              <Link
                to="/app/exames"
                className="flex w-40 flex-col gap-1.5 rounded-xl border border-line bg-paper-2 p-3 transition-colors hover:bg-paper focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus)]"
              >
                <span className="grid size-8 place-items-center rounded-lg [background-image:var(--grad-brand-soft)] text-indigo">
                  <Icone className="size-4" aria-hidden />
                </span>
                <span className="line-clamp-2 font-display text-sm font-semibold leading-tight text-ink">
                  {e.nome}
                </span>
                <span className="text-xs text-ink-mute">
                  {dataCurta(e.dataExame)}
                  {e.temArquivo ? ' · com anexo' : ''}
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
