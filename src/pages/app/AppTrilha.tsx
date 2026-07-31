import { lazy, Suspense, useEffect } from 'react'
import { useAuth } from '@/lib/stores/auth'
import { useMedicoContext } from '@/lib/stores/medico-context'
import { useChecklist } from '@/lib/stores/checklist'
import { SeletorPaciente } from '@/features/painel/SeletorPaciente'
import { TrilhaChecklist } from '@/features/checklist/TrilhaChecklist'
import { TrilhaSkeleton } from '@/components/Skeleton'
import { AlertaErro } from '@/components/AlertaErro'
import { EmptyState } from '@/components/EmptyState'
import { Blob } from '@/components/Blob'
import { Route } from 'lucide-react'

const BaixarTrilha = lazy(() =>
  import('@/features/pdf/documents').then((m) => ({ default: m.BaixarTrilha })),
)

/**
 * A trilha da família — agora uma projeção do checklist.
 *
 * Antes daqui existiam duas coisas paralelas: uma trilha com nós mockados em
 * `features/trilha/data.ts` e um conteúdo clínico que ninguém marcava. Eram duas
 * metáforas para a mesma jornada, e a que tinha o conteúdo de verdade era a que
 * não dava para tocar.
 *
 * Agora é uma só. Os nós **são** os grupos do checklist, o progresso é o que ela
 * de fato marcou, e o conteúdo vem do servidor — o mesmo que a médica pode
 * atribuir e que alimenta os lembretes.
 */
export default function AppTrilha() {
  const nome = useAuth((s) => s.user?.nome)
  const criancaAtiva = useMedicoContext((s) => s.criancaAtiva)

  const checklists = useChecklist((s) => s.checklists)
  const carregando = useChecklist((s) => s.carregando)
  const erro = useChecklist((s) => s.erro)
  const carregar = useChecklist((s) => s.carregar)

  useEffect(() => {
    void carregar(criancaAtiva)
  }, [carregar, criancaAtiva])

  // A jornada define qual checklist está em cena; os outros ficam abaixo.
  const [principal, ...demais] = checklists

  return (
    <div className="relative flex flex-col gap-xl">
      <Blob variant="c" intensity={0.3} className="-left-20 top-24 size-96" />

      <SeletorPaciente />

      {erro && <AlertaErro>{erro}</AlertaErro>}

      {carregando && checklists.length === 0 ? (
        <TrilhaSkeleton />
      ) : !principal ? (
        <EmptyState
          icon={<Route className="size-8" aria-hidden />}
          titulo="Sua trilha está sendo preparada"
          descricao="Assim que sua jornada estiver configurada, o caminho aparece aqui — com o que fazer em cada fase e por que importa."
        />
      ) : (
        <>
          <TrilhaChecklist checklist={principal} crianca={criancaAtiva} />

          {demais.map((c) => (
            <TrilhaChecklist key={c.chave} checklist={c} crianca={criancaAtiva} />
          ))}

          <Suspense fallback={null}>
            <BaixarTrilha
              nome={nome}
              progresso={principal.progresso}
              nodes={checklists.flatMap((c) =>
                c.grupos.map((g) => ({
                  id: `${c.chave}:${g.id}`,
                  titulo: g.titulo,
                  fase: c.titulo,
                  status:
                    g.estado === 'feito' || g.estado === 'nao-se-aplica'
                      ? ('concluido' as const)
                      : g.foraDaJanela
                        ? ('bloqueado' as const)
                        : ('atual' as const),
                })),
              )}
            />
          </Suspense>
        </>
      )}
    </div>
  )
}
