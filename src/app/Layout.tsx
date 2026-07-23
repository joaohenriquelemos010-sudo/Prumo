import { Suspense } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Header } from './Header'
import { Footer } from './Footer'
import { ConsentBanner } from './ConsentBanner'
import { ErrorBoundary } from './ErrorBoundary'
import { ScrollToTop } from './ScrollToTop'
import { PageFallback } from './PageFallback'

/** Shared shell: skip link, header, animated route outlet, footer, consent. */
export function Layout() {
  const location = useLocation()

  return (
    <>
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-pill focus:bg-paper focus:px-4 focus:py-2 focus:font-semibold focus:text-indigo focus:shadow-lift"
      >
        Pular para o conteúdo
      </a>

      <ScrollToTop />
      <Header />

      <main id="conteudo" className="min-h-[60vh]">
        <ErrorBoundary>
          <Suspense fallback={<PageFallback />}>
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              >
                <Outlet />
              </motion.div>
            </AnimatePresence>
          </Suspense>
        </ErrorBoundary>
      </main>

      <Footer />
      <ConsentBanner />
    </>
  )
}
