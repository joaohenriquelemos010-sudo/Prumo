import { Link } from 'react-router-dom'
import { Compass } from 'lucide-react'
import { Blob } from '@/components/Blob'
import { Logo } from '@/components/Logo'

/** A caring 404 — never a dead end. */
export default function NotFoundPage() {
  return (
    <div className="relative grid min-h-[75vh] place-items-center overflow-hidden px-md text-center">
      <Blob variant="a" intensity={0.45} className="left-1/2 top-10 size-[28rem] -translate-x-1/2" />
      <div className="flex max-w-md flex-col items-center gap-md">
        <Logo variant="symbol" className="h-16" label="Prumo" />
        <span className="grid size-14 place-items-center rounded-full [background-image:var(--grad-brand-soft)] text-indigo">
          <Compass className="size-7" aria-hidden />
        </span>
        <h1 className="text-4xl">Essa página saiu do prumo</h1>
        <p className="text-ink-soft">
          O caminho que você procurava não está aqui. Sem problema — a gente te leva de
          volta para o rumo certo.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link
            to="/"
            className="inline-flex h-12 items-center rounded-pill px-6 font-display font-semibold text-white shadow-soft [background-image:var(--grad-brand)] transition-[filter] duration-[var(--dur-fast)] hover:brightness-[1.05]"
          >
            Voltar para o início
          </Link>
          <Link
            to="/trilha"
            className="inline-flex h-12 items-center rounded-pill border border-line bg-paper px-6 font-display font-semibold text-indigo hover:bg-paper-2"
          >
            Ir para a trilha
          </Link>
        </div>
      </div>
    </div>
  )
}
