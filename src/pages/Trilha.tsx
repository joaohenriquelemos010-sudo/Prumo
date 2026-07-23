import { useEffect, useState } from 'react'
import { useTrilha } from '@/lib/stores/trilha'
import { TrilhaPath } from '@/features/trilha/TrilhaPath'
import { ProgressHeader } from '@/features/trilha/ProgressHeader'
import { Confetti } from '@/features/trilha/Confetti'
import { TrilhaSkeleton } from '@/components/Skeleton'
import { Blob } from '@/components/Blob'
import { SectionHead } from '@/components/Section'

export default function TrilhaPage() {
  const celebratingId = useTrilha((s) => s.celebratingId)
  const clearCelebration = useTrilha((s) => s.clearCelebration)
  const resetDemo = useTrilha((s) => s.resetDemo)
  const [ready, setReady] = useState(false)

  // Public demo: always show the sample state (persistence off).
  useEffect(() => {
    resetDemo()
    const t = setTimeout(() => setReady(true), 450)
    return () => clearTimeout(t)
  }, [resetDemo])

  useEffect(() => {
    if (!celebratingId) return
    const t = setTimeout(clearCelebration, 2000)
    return () => clearTimeout(t)
  }, [celebratingId, clearCelebration])

  return (
    <div className="relative overflow-hidden">
      <Blob variant="a" intensity={0.4} className="-left-24 top-10 size-[26rem]" />
      <Blob variant="c" intensity={0.35} className="-right-24 top-1/2 size-[24rem]" />

      <Confetti trigger={Boolean(celebratingId)} />

      <div className="u-shell py-2xl sm:py-3xl">
        <SectionHead
          center
          eyebrow="A sua trilha"
          titulo="Um caminho, do pré-natal ao primeiro ano"
          descricao="Cada nó é uma etapa. Toque para ver o que é, o que fazer e o que esperar. O caminho se preenche conforme você avança — e nada fica para trás."
        />

        <div className="mt-xl flex flex-col gap-xl">
          <ProgressHeader />
          {ready ? <TrilhaPath /> : <TrilhaSkeleton />}
        </div>

        <p className="mx-auto mt-xl max-w-xl rounded-xl bg-paper-2 p-md text-center text-sm text-ink-mute">
          Este é um protótipo com dados de exemplo. Na Prumo de verdade, sua trilha
          nasce do seu histórico real — com a segurança que a saúde do seu bebê merece.
        </p>
      </div>
    </div>
  )
}
