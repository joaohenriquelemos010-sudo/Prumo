import { useState } from 'react'
import { Ruler, Check, Lock } from 'lucide-react'
import { api } from '@/lib/api/client'
import { useMedicoContext, criancaQuery } from '@/lib/stores/medico-context'
import { Button } from '@/components/Button'
import { AlertaErro } from '@/components/AlertaErro'
import type { MedidaFetal } from '@/features/bebe/tipos'

const CAMPOS = [
  { chave: 'dbpMm', label: 'DBP (mm)', placeholder: '84' },
  { chave: 'ccMm', label: 'CC (mm)', placeholder: '309' },
  { chave: 'caMm', label: 'CA (mm)', placeholder: '285' },
  { chave: 'cfMm', label: 'CF (mm)', placeholder: '60' },
  { chave: 'pfeG', label: 'Peso estimado (g)', placeholder: '1559' },
  { chave: 'ilaCm', label: 'ILA (cm)', placeholder: '12' },
] as const

const APRESENTACOES = [
  { valor: 'cefalica', label: 'Cefálica' },
  { valor: 'pelvica', label: 'Pélvica' },
  { valor: 'cormica', label: 'Córmica' },
  { valor: 'indefinida', label: 'Indefinida' },
] as const

/**
 * The obstetrician's entry form for one gestational week.
 *
 * Saving recomputes the percentiles and runs the pattern check, so a measurement
 * outside the expected band raises its alert immediately — the whole point of
 * writing numbers instead of prose.
 *
 * Upserts by week: correcting a reading fixes the record rather than adding a
 * second, contradictory one.
 */
export function RegistrarMedidas({
  semanaSugerida,
  medidas,
  onSalvo,
}: {
  semanaSugerida: number
  medidas: MedidaFetal[]
  onSalvo: () => void
}) {
  const criancaAtiva = useMedicoContext((s) => s.criancaAtiva)
  const [semana, setSemana] = useState(String(semanaSugerida))
  const [valores, setValores] = useState<Record<string, string>>({})
  const [apresentacao, setApresentacao] = useState<string>('indefinida')
  const [observacao, setObservacao] = useState('')
  const [notasPrivadas, setNotasPrivadas] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [salvo, setSalvo] = useState(false)

  /** Loads an existing week so an edit corrects rather than blanks the record. */
  function carregarSemana(valor: string) {
    setSemana(valor)
    setSalvo(false)
    const existente = medidas.find((m) => m.semana === Number(valor))
    if (!existente) return
    setValores({
      dbpMm: existente.dbpMm?.toString() ?? '',
      ccMm: existente.ccMm?.toString() ?? '',
      caMm: existente.caMm?.toString() ?? '',
      cfMm: existente.cfMm?.toString() ?? '',
      pfeG: existente.pfeG?.toString() ?? '',
      ilaCm: existente.ilaCm?.toString() ?? '',
    })
    setApresentacao(existente.apresentacao || 'indefinida')
    setObservacao(existente.observacao ?? '')
    setNotasPrivadas(existente.notasPrivadas ?? '')
  }

  function num(chave: string): number | null {
    const v = valores[chave]
    if (!v) return null
    const n = Number(v.replace(',', '.'))
    return Number.isFinite(n) ? n : null
  }

  async function salvar() {
    setErro(null)
    const s = Number(semana)
    if (!Number.isFinite(s) || s < 10 || s > 42) {
      setErro('A semana precisa estar entre 10 e 42.')
      return
    }
    setSalvando(true)
    try {
      await api.put(`/bebe/medidas${criancaQuery(criancaAtiva)}`, {
        semana: s,
        dbpMm: num('dbpMm'),
        ccMm: num('ccMm'),
        caMm: num('caMm'),
        cfMm: num('cfMm'),
        pfeG: num('pfeG'),
        ilaCm: num('ilaCm'),
        apresentacao,
        observacao: observacao || undefined,
        notasPrivadas: notasPrivadas || undefined,
      })
      setSalvo(true)
      onSalvo()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui salvar as medidas.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <section className="rounded-2xl border border-line bg-paper p-lg shadow-soft">
      <h2 className="inline-flex items-center gap-2 text-lg">
        <Ruler className="size-5 text-indigo" aria-hidden />
        Registrar biometria
      </h2>
      <p className="mt-1 text-sm text-ink-soft">
        Ao salvar, os percentis são calculados e a verificação de padrões roda na hora.
      </p>

      <div className="mt-md">
        <label className="block text-sm font-semibold text-ink" htmlFor="semana-medida">
          Semana gestacional
        </label>
        <input
          id="semana-medida"
          type="number"
          min={10}
          max={42}
          value={semana}
          onChange={(e) => carregarSemana(e.target.value)}
          className="input mt-1 w-28"
        />
      </div>

      <div className="mt-md grid grid-cols-1 gap-3 sm:grid-cols-3">
        {CAMPOS.map((c) => (
          <div key={c.chave}>
            <label className="block text-xs text-ink-mute" htmlFor={`fetal-${c.chave}`}>
              {c.label}
            </label>
            <input
              id={`fetal-${c.chave}`}
              value={valores[c.chave] ?? ''}
              onChange={(e) => {
                setValores((v) => ({ ...v, [c.chave]: e.target.value }))
                setSalvo(false)
              }}
              inputMode="decimal"
              placeholder={c.placeholder}
              className="input mt-1"
            />
          </div>
        ))}
      </div>

      <div className="mt-md">
        <span className="block text-sm font-semibold text-ink">Apresentação</span>
        <div role="radiogroup" aria-label="Apresentação" className="mt-2 flex flex-wrap gap-2">
          {APRESENTACOES.map((a) => (
            <button
              key={a.valor}
              type="button"
              role="radio"
              aria-checked={apresentacao === a.valor}
              onClick={() => setApresentacao(a.valor)}
              className={
                'min-h-11 rounded-pill border px-4 text-sm font-semibold ' +
                (apresentacao === a.valor
                  ? 'border-transparent [background-image:var(--grad-brand)] text-white'
                  : 'border-line bg-paper text-ink-soft hover:text-indigo')
              }
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-md">
        <label className="block text-sm font-semibold text-ink" htmlFor="obs-medida">
          Observação para a família
        </label>
        <textarea
          id="obs-medida"
          value={observacao}
          onChange={(e) => setObservacao(e.target.value)}
          maxLength={500}
          placeholder="Bebê crescendo bem, líquido normal."
          className="input mt-1 min-h-16 resize-y"
        />
      </div>

      <div className="mt-md">
        <label className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink" htmlFor="privadas-medida">
          <Lock className="size-4" aria-hidden />
          Notas só da equipe
        </label>
        <textarea
          id="privadas-medida"
          value={notasPrivadas}
          onChange={(e) => setNotasPrivadas(e.target.value)}
          maxLength={1000}
          placeholder="Achados a acompanhar, hipóteses, condutas em aberto."
          className="input mt-1 min-h-16 resize-y"
        />
        <p className="mt-1 text-xs text-ink-mute">Nunca aparece para a família.</p>
      </div>

      {erro && <AlertaErro>{erro}</AlertaErro>}

      <div className="mt-lg flex flex-wrap items-center gap-3">
        <Button loading={salvando} iconLeft={<Check className="size-4" aria-hidden />} onClick={salvar}>
          Salvar medidas
        </Button>
        {salvo && (
          <span className="inline-flex items-center gap-1 text-sm font-semibold text-success-ink" role="status">
            <Check className="size-4" aria-hidden /> Salvo
          </span>
        )}
      </div>
    </section>
  )
}
