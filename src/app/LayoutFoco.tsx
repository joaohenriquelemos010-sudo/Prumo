import { Suspense } from 'react'
import { Outlet } from 'react-router-dom'
import { ErrorBoundary } from './ErrorBoundary'
import { ScrollToTop } from './ScrollToTop'
import { PageFallback } from './PageFallback'

/**
 * O shell de foco — uma tarefa por página, sem nada em volta.
 *
 * O `Layout` público traz cabeçalho de navegação, rodapé institucional e o aviso
 * de privacidade flutuante. Isso está certo para uma página que **convence** e
 * errado para uma que **recebe**: no meio de um formulário de trinta campos, um
 * menu é uma saída acidental, e um aviso colado no rodapé cobre justamente o
 * botão de enviar no celular.
 *
 * Fica com o que é indispensável — pular para o conteúdo, subir a página ao
 * trocar de rota, limite de erro e o fallback de carregamento. Quem entra por
 * aqui veio fazer uma coisa só; a marca aparece dentro da própria página.
 */
export function LayoutFoco() {
  return (
    <>
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-pill focus:bg-paper focus:px-4 focus:py-2 focus:font-semibold focus:text-indigo focus:shadow-lift"
      >
        Pular para o conteúdo
      </a>

      <ScrollToTop />

      <main id="conteudo" className="min-h-dvh">
        <ErrorBoundary>
          <Suspense fallback={<PageFallback />}>
            <Outlet />
          </Suspense>
        </ErrorBoundary>
      </main>
    </>
  )
}
