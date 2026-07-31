import { useState } from 'react'
import { Table2 } from 'lucide-react'
import { Sheet } from '@/components/Sheet'
import { cn } from '@/lib/cn'
import type { MedidaFetal } from '@/features/bebe/tipos'
import type { PontoInfantil } from '@/features/bebe/CrescimentoInfantil'

/**
 * Todos os números, atrás de uma porta.
 *
 * Antes eram duas tabelas largas no fim da página, com rolagem horizontal
 * própria — a última coisa que a gestante via depois de rolar a tela inteira.
 * A tabela continua exatamente igual: ela é a leitura certa **quando se quer
 * conferir um número**, e é a leitura errada como visão padrão de uma tela que
 * existe para emocionar. Agora ela abre numa folha, sem navegar para lugar
 * nenhum, e a página cabe no que a pessoa veio ver.
 */
export function TodosOsNumeros({
  rotulo = 'Ver todos os números',
  children,
}: {
  rotulo?: string
  children: React.ReactNode
}) {
  const [aberto, setAberto] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="inline-flex min-h-11 items-center gap-2 self-start rounded-pill border border-line bg-paper px-5 font-display text-sm font-semibold text-indigo shadow-soft transition-colors hover:bg-paper-2 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus)]"
      >
        <Table2 className="size-4" aria-hidden />
        {rotulo}
      </button>

      <Sheet aberto={aberto} onFechar={() => setAberto(false)} titulo={rotulo} alturas={[0.6, 0.92]}>
        {children}
      </Sheet>
    </>
  )
}

export function HistoricoFetal({ medidas, ehMedico }: { medidas: MedidaFetal[]; ehMedico: boolean }) {
  if (medidas.length === 0) return null

  return (
    <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead>
            <tr className="text-xs text-ink-mute">
              <th scope="col" className="pb-2 pr-3 font-semibold">Semana</th>
              <th scope="col" className="pb-2 pr-3 font-semibold">Peso estimado</th>
              {ehMedico && (
                <>
                  <th scope="col" className="pb-2 pr-3 font-semibold">CC</th>
                  <th scope="col" className="pb-2 pr-3 font-semibold">CA</th>
                  <th scope="col" className="pb-2 pr-3 font-semibold">CF</th>
                  <th scope="col" className="pb-2 pr-3 font-semibold">Percentil</th>
                </>
              )}
              <th scope="col" className="pb-2 font-semibold">Registrado por</th>
            </tr>
          </thead>
          <tbody>
            {[...medidas]
              .sort((a, b) => b.semana - a.semana)
              .map((m) => (
                <tr key={m.id} className="border-t border-line">
                  <td className="py-2 pr-3 font-semibold text-ink">{m.semana}s</td>
                  <td className="py-2 pr-3 text-ink-soft">{m.pfeG ? `${m.pfeG} g` : '—'}</td>
                  {ehMedico && (
                    <>
                      <td className="py-2 pr-3 text-ink-soft">{m.ccMm ? `${m.ccMm} mm` : '—'}</td>
                      <td className="py-2 pr-3 text-ink-soft">{m.caMm ? `${m.caMm} mm` : '—'}</td>
                      <td className="py-2 pr-3 text-ink-soft">{m.cfMm ? `${m.cfMm} mm` : '—'}</td>
                      <td className="py-2 pr-3">
                        <ChipPercentil valor={m.percentis?.pfeG ?? null} />
                      </td>
                    </>
                  )}
                  <td className="py-2 text-ink-mute">{m.autorNome || '—'}</td>
                </tr>
              ))}
          </tbody>
        </table>
    </div>
  )
}
export function HistoricoInfantil({ medidas, ehMedico }: { medidas: PontoInfantil[]; ehMedico: boolean }) {
  if (medidas.length === 0) return null

  return (
    <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead>
            <tr className="text-xs text-ink-mute">
              <th scope="col" className="pb-2 pr-3 font-semibold">Idade</th>
              <th scope="col" className="pb-2 pr-3 font-semibold">Peso</th>
              <th scope="col" className="pb-2 pr-3 font-semibold">Comprimento</th>
              <th scope="col" className="pb-2 pr-3 font-semibold">PC</th>
              {ehMedico && <th scope="col" className="pb-2 pr-3 font-semibold">Percentil peso</th>}
              <th scope="col" className="pb-2 font-semibold">Origem</th>
            </tr>
          </thead>
          <tbody>
            {[...medidas]
              .sort((a, b) => b.meses - a.meses)
              .map((m) => (
                <tr key={`${m.meses}-${m.data}`} className="border-t border-line">
                  <td className="py-2 pr-3 font-semibold text-ink">
                    {m.meses === 0 ? 'Nascimento' : `${m.meses} ${m.meses === 1 ? 'mês' : 'meses'}`}
                  </td>
                  <td className="py-2 pr-3 text-ink-soft">
                    {m.pesoKg ? `${m.pesoKg.toFixed(2).replace('.', ',')} kg` : '—'}
                  </td>
                  <td className="py-2 pr-3 text-ink-soft">{m.comprimentoCm ? `${m.comprimentoCm} cm` : '—'}</td>
                  <td className="py-2 pr-3 text-ink-soft">
                    {m.perimetroCefalicoCm ? `${m.perimetroCefalicoCm} cm` : '—'}
                  </td>
                  {ehMedico && (
                    <td className="py-2 pr-3">
                      <ChipPercentil valor={m.percentis?.pesoKg ?? null} />
                    </td>
                  )}
                  <td className="py-2 text-ink-mute">
                    {m.origem === 'nascimento' ? 'Resumo do nascimento' : m.autorNome || 'Consulta'}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
    </div>
  )
}

function ChipPercentil({ valor }: { valor: number | null }) {
  if (valor == null) return <span className="text-ink-mute">—</span>
  return (
    <span
      className={cn(
        'rounded-pill px-2 py-0.5 text-xs font-semibold',
        valor < 10 || valor > 90 ? 'u-chip-warn' : 'u-chip-success',
      )}
    >
      P{valor}
    </span>
  )
}