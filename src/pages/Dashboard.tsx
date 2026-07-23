import { Link } from 'react-router-dom'
import { PainelClinico } from '@/features/painel/PainelClinico'
import { Blob } from '@/components/Blob'

/** Mocked dashboard — the doctor lands here after onboarding as a proof of concept. */
export default function DashboardPage() {
  return (
    <div className="relative overflow-hidden">
      <Blob variant="a" intensity={0.3} className="-left-20 top-0 size-96" />
      <div className="u-shell py-2xl sm:py-3xl">
        <div className="flex flex-wrap items-end justify-between gap-md">
          <div>
            <span className="u-eyebrow">Painel clínico</span>
            <h1 className="mt-1 text-3xl sm:text-4xl">O quadro completo, num relance</h1>
            <p className="mt-2 max-w-xl text-ink-soft">
              Histórico contínuo, riscos em evidência, vacinas e marcos. Tudo o que a
              gestação deixou, seguindo com a criança.
            </p>
          </div>
          <Link
            to="/trilha"
            className="inline-flex h-11 items-center rounded-pill border border-line bg-paper px-5 font-display text-sm font-semibold text-indigo hover:bg-paper-2"
          >
            Ver como a família enxerga
          </Link>
        </div>

        <div className="mt-xl">
          <PainelClinico />
        </div>
      </div>
    </div>
  )
}
