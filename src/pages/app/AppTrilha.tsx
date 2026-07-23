import { lazy, Suspense, useEffect, useState } from 'react'
import { useTrilha } from '@/lib/stores/trilha'
import { useAuth } from '@/lib/stores/auth'
import { api } from '@/lib/api/client'
import { TrilhaPath } from '@/features/trilha/TrilhaPath'
import { ProgressHeader } from '@/features/trilha/ProgressHeader'
import { Confetti } from '@/features/trilha/Confetti'
import { FASES } from '@/features/trilha/data'
import { TrilhaSkeleton } from '@/components/Skeleton'
import { Blob } from '@/components/Blob'
import { SectionHead } from '@/components/Section'

const BaixarTrilha = lazy(() =>
  import('@/features/pdf/documents').then((m) => ({ default: m.BaixarTrilha })),
)

const FASE_NOME = Object.fromEntries(FASES.map((f) => [f.fase, f.nome]))

/** The real, persisted trilha for a logged-in user. */
export default function AppTrilha() {
  const hydrate = useTrilha((s) => s.hydrate)
  const nodes = useTrilha((s) => s.nodes)
  const progresso = useTrilha((s) => s.progress())
  const nome = useAuth((s) => s.user?.nome)
  const celebratingId = useTrilha((s) => s.celebratingId)
  const clearCelebration = useTrilha((s) => s.clearCelebration)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let active = true
    api
      .get<{ etapasConcluidas: string[] }>('/trilha')
      .then((data) => active && hydrate(data.etapasConcluidas))
      .catch(() => {
        /* keep whatever state we have; the UI still works */
      })
      .finally(() => active && setReady(true))
    return () => {
      active = false
    }
  }, [hydrate])

  useEffect(() => {
    if (!celebratingId) return
    const t = setTimeout(clearCelebration, 2000)
    return () => clearTimeout(t)
  }, [celebratingId, clearCelebration])

  return (
    <div className="relative flex flex-col gap-xl">
      <Blob variant="c" intensity={0.3} className="-left-20 top-24 size-96" />
      <Confetti trigger={Boolean(celebratingId)} />

      <SectionHead
        eyebrow="Sua trilha"
        titulo="Seu caminho, do pré-natal ao primeiro ano"
        descricao="Toque num nó para ver a etapa. Ao concluir a etapa atual, seu progresso é salvo automaticamente."
      />

      {ready ? (
        <>
          <ProgressHeader />
          <TrilhaPath />
          <Suspense fallback={null}>
            <BaixarTrilha
              nome={nome}
              progresso={progresso}
              nodes={nodes.map((n) => ({
                id: n.id,
                titulo: n.titulo,
                fase: FASE_NOME[n.fase] ?? n.fase,
                status: n.status,
              }))}
            />
          </Suspense>
        </>
      ) : (
        <TrilhaSkeleton />
      )}
    </div>
  )
}
