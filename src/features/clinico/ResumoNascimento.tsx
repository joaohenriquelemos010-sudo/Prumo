import { useState } from 'react'
import { Baby, ArrowRightLeft, Check } from 'lucide-react'
import { api } from '@/lib/api/client'
import { useMedicoContext, criancaQuery } from '@/lib/stores/medico-context'
import { Button } from '@/components/Button'
import { AlertaErro } from '@/components/AlertaErro'
import { TRIAGENS_NEONATAIS } from './diretrizes-pediatria'
import { cn } from '@/lib/cn'

export interface ResumoNascimento {
  preenchido: boolean
  igAoNascerSemanas: number | null
  igAoNascerDias: number | null
  tipoParto: string
  apgar1: number | null
  apgar5: number | null
  pesoNascimentoG: number | null
  comprimentoNascimentoCm: number | null
  pcNascimentoCm: number | null
  intercorrencias: string
  sorologiasMaternas: string
  gbs: string
  aleitamento: string
  triagens: { id: string; feito: boolean; resultado: string }[]
  registradoEm: string | null
}

const PARTOS = [
  { valor: 'vaginal', label: 'Vaginal' },
  { valor: 'cesarea', label: 'Cesárea' },
  { valor: 'forceps', label: 'Fórceps' },
]

const GBS = [
  { valor: 'negativo', label: 'Negativo' },
  { valor: 'positivo', label: 'Positivo' },
  { valor: 'nao-realizado', label: 'Não realizado' },
]

/**
 * The handoff from obstetrics to paediatrics.
 *
 * This is the information the pediatrician asks for at the first visit and that
 * used to live only in the obstetrician's head: how the pregnancy ended, how the
 * birth went, what the newborn screening already answered. Filled once, at the
 * turn; read from then on.
 *
 * Saving also flips the journey to `ja-nasceu`, which is what starts the vaccine
 * calendar and the puericultura schedule — so the record and the agenda agree.
 */
export function ResumoNascimento({
  resumo,
  onSalvo,
}: {
  resumo: ResumoNascimento | null
  onSalvo: () => void
}) {
  const criancaAtiva = useMedicoContext((s) => s.criancaAtiva)
  const [editando, setEditando] = useState(false)
  const [campos, setCampos] = useState<Record<string, string>>({})
  const [tipoParto, setTipoParto] = useState('')
  const [gbs, setGbs] = useState('')
  const [triagens, setTriagens] = useState<Record<string, boolean>>({})
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  function abrir() {
    setCampos({
      dataNascimento: new Date().toISOString().slice(0, 10),
      igAoNascerSemanas: resumo?.igAoNascerSemanas?.toString() ?? '',
      igAoNascerDias: resumo?.igAoNascerDias?.toString() ?? '',
      apgar1: resumo?.apgar1?.toString() ?? '',
      apgar5: resumo?.apgar5?.toString() ?? '',
      pesoNascimentoG: resumo?.pesoNascimentoG?.toString() ?? '',
      comprimentoNascimentoCm: resumo?.comprimentoNascimentoCm?.toString() ?? '',
      pcNascimentoCm: resumo?.pcNascimentoCm?.toString() ?? '',
      intercorrencias: resumo?.intercorrencias ?? '',
      sorologiasMaternas: resumo?.sorologiasMaternas ?? '',
      aleitamento: resumo?.aleitamento ?? '',
    })
    setTipoParto(resumo?.tipoParto ?? '')
    setGbs(resumo?.gbs ?? '')
    setTriagens(Object.fromEntries((resumo?.triagens ?? []).map((t) => [t.id, t.feito])))
    setErro(null)
    setEditando(true)
  }

  function num(chave: string): number | null {
    const v = campos[chave]
    if (!v) return null
    const n = Number(v.replace(',', '.'))
    return Number.isFinite(n) ? n : null
  }

  async function salvar() {
    setErro(null)
    setSalvando(true)
    try {
      await api.put(`/prontuario/nascimento${criancaQuery(criancaAtiva)}`, {
        dataNascimento: campos.dataNascimento || undefined,
        igAoNascerSemanas: num('igAoNascerSemanas'),
        igAoNascerDias: num('igAoNascerDias'),
        tipoParto: tipoParto || undefined,
        apgar1: num('apgar1'),
        apgar5: num('apgar5'),
        pesoNascimentoG: num('pesoNascimentoG'),
        comprimentoNascimentoCm: num('comprimentoNascimentoCm'),
        pcNascimentoCm: num('pcNascimentoCm'),
        intercorrencias: campos.intercorrencias || undefined,
        sorologiasMaternas: campos.sorologiasMaternas || undefined,
        gbs: gbs || undefined,
        aleitamento: campos.aleitamento || undefined,
        triagens: TRIAGENS_NEONATAIS.map((t) => ({ id: t.id, feito: Boolean(triagens[t.id]) })),
      })
      setEditando(false)
      onSalvo()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui salvar agora.')
    } finally {
      setSalvando(false)
    }
  }

  if (!editando) {
    return (
      <section className="rounded-2xl border border-line bg-paper p-lg shadow-soft">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <Baby className="size-5 text-indigo" aria-hidden />
            <h2 className="text-lg">Nascimento e passagem para a pediatria</h2>
          </div>
          <Button
            size="md"
            variant={resumo?.preenchido ? 'secondary' : 'primary'}
            iconLeft={<ArrowRightLeft className="size-4" aria-hidden />}
            onClick={abrir}
          >
            {resumo?.preenchido ? 'Editar' : 'Registrar nascimento'}
          </Button>
        </div>

        {resumo?.preenchido ? (
          <>
            <dl className="mt-md grid gap-3 sm:grid-cols-3">
              <Item termo="Idade gestacional" valor={
                resumo.igAoNascerSemanas != null
                  ? `${resumo.igAoNascerSemanas}s${resumo.igAoNascerDias ?? 0}d`
                  : '—'
              } />
              <Item termo="Parto" valor={PARTOS.find((p) => p.valor === resumo.tipoParto)?.label ?? '—'} />
              <Item
                termo="Apgar"
                valor={resumo.apgar1 != null ? `${resumo.apgar1} / ${resumo.apgar5 ?? '—'}` : '—'}
              />
              <Item termo="Peso" valor={resumo.pesoNascimentoG ? `${resumo.pesoNascimentoG} g` : '—'} />
              <Item
                termo="Comprimento"
                valor={resumo.comprimentoNascimentoCm ? `${resumo.comprimentoNascimentoCm} cm` : '—'}
              />
              <Item termo="PC" valor={resumo.pcNascimentoCm ? `${resumo.pcNascimentoCm} cm` : '—'} />
              <Item termo="Estreptococo B" valor={GBS.find((g) => g.valor === resumo.gbs)?.label ?? '—'} />
              <Item termo="Aleitamento" valor={resumo.aleitamento || '—'} />
              <Item termo="Sorologias maternas" valor={resumo.sorologiasMaternas || '—'} />
            </dl>

            {resumo.intercorrencias && (
              <p className="mt-md text-sm text-ink-soft">
                <strong className="text-ink">Intercorrências:</strong> {resumo.intercorrencias}
              </p>
            )}

            <div className="mt-md">
              <p className="font-display text-sm font-semibold text-indigo">Triagens neonatais</p>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {TRIAGENS_NEONATAIS.map((t) => {
                  const feito = resumo.triagens?.find((x) => x.id === t.id)?.feito
                  return (
                    <li
                      key={t.id}
                      title={`${t.nome} · ${t.janela}`}
                      className={cn(
                        'rounded-pill px-3 py-1 text-xs font-semibold',
                        feito ? 'u-chip-success' : 'bg-paper-2 text-ink-mute',
                      )}
                    >
                      {feito ? '✓ ' : ''}
                      {t.popular}
                    </li>
                  )
                })}
              </ul>
            </div>
          </>
        ) : (
          <p className="mt-2 text-sm text-ink-soft">
            Quando o bebê nascer, registre aqui como foi a gestação e o parto. A pediatra abre um
            prontuário que já conhece a história — e o calendário de vacinas e a puericultura começam
            automaticamente.
          </p>
        )}
      </section>
    )
  }

  return (
    <section className="rounded-2xl border-2 border-[var(--color-lilas-soft)] bg-paper p-lg shadow-soft">
      <h2 className="inline-flex items-center gap-2 text-lg">
        <Baby className="size-5 text-indigo" aria-hidden />
        Registrar nascimento
      </h2>
      <p className="mt-1 text-sm text-ink-soft">
        Ao salvar, a jornada passa para “já nasceu” e o acompanhamento pediátrico começa.
      </p>

      <div className="mt-md grid gap-3 sm:grid-cols-3">
        <Campo id="dataNascimento" label="Data de nascimento" tipo="date" campos={campos} onChange={setCampos} />
        <Campo id="igAoNascerSemanas" label="IG (semanas)" campos={campos} onChange={setCampos} placeholder="39" />
        <Campo id="igAoNascerDias" label="IG (dias)" campos={campos} onChange={setCampos} placeholder="2" />
        <Campo id="pesoNascimentoG" label="Peso (g)" campos={campos} onChange={setCampos} placeholder="3240" />
        <Campo id="comprimentoNascimentoCm" label="Comprimento (cm)" campos={campos} onChange={setCampos} placeholder="49" />
        <Campo id="pcNascimentoCm" label="PC (cm)" campos={campos} onChange={setCampos} placeholder="34" />
        <Campo id="apgar1" label="Apgar 1º min" campos={campos} onChange={setCampos} placeholder="9" />
        <Campo id="apgar5" label="Apgar 5º min" campos={campos} onChange={setCampos} placeholder="10" />
        <Campo id="aleitamento" label="Aleitamento" campos={campos} onChange={setCampos} placeholder="Exclusivo" />
      </div>

      <Escolha titulo="Tipo de parto" opcoes={PARTOS} valor={tipoParto} onChange={setTipoParto} />
      <Escolha titulo="Estreptococo do grupo B" opcoes={GBS} valor={gbs} onChange={setGbs} />

      <div className="mt-md">
        <span className="block text-sm font-semibold text-ink">Triagens neonatais realizadas</span>
        <ul className="mt-2 flex flex-col gap-1">
          {TRIAGENS_NEONATAIS.map((t) => (
            <li key={t.id}>
              <label className="flex cursor-pointer items-start gap-3 rounded-xl p-2 hover:bg-paper-2">
                <input
                  type="checkbox"
                  checked={Boolean(triagens[t.id])}
                  onChange={(e) => setTriagens((s) => ({ ...s, [t.id]: e.target.checked }))}
                  className="mt-1 size-5 shrink-0 accent-[var(--color-lilas)]"
                />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-ink">{t.popular}</span>
                  <span className="block text-xs text-ink-mute">
                    {t.nome} · {t.janela}
                  </span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-md">
        <label className="block text-sm font-semibold text-ink" htmlFor="sorologiasMaternas">
          Sorologias maternas
        </label>
        <input
          id="sorologiasMaternas"
          value={campos.sorologiasMaternas ?? ''}
          onChange={(e) => setCampos((c) => ({ ...c, sorologiasMaternas: e.target.value }))}
          placeholder="HIV, sífilis, hepatite B e toxoplasmose não reagentes."
          maxLength={500}
          className="input mt-1"
        />
      </div>

      <div className="mt-md">
        <label className="block text-sm font-semibold text-ink" htmlFor="intercorrencias">
          Intercorrências da gestação e do parto
        </label>
        <textarea
          id="intercorrencias"
          value={campos.intercorrencias ?? ''}
          onChange={(e) => setCampos((c) => ({ ...c, intercorrencias: e.target.value }))}
          maxLength={1000}
          className="input mt-1 min-h-20 resize-y"
        />
      </div>

      {erro && <AlertaErro>{erro}</AlertaErro>}

      <div className="mt-lg flex flex-wrap gap-2">
        <Button loading={salvando} iconLeft={<Check className="size-4" aria-hidden />} onClick={salvar}>
          Salvar e passar para a pediatria
        </Button>
        <Button variant="ghost" onClick={() => setEditando(false)}>
          Cancelar
        </Button>
      </div>
    </section>
  )
}

function Item({ termo, valor }: { termo: string; valor: string }) {
  return (
    <div>
      <dt className="text-xs text-ink-mute">{termo}</dt>
      <dd className="font-semibold text-ink">{valor}</dd>
    </div>
  )
}

function Campo({
  id,
  label,
  tipo = 'text',
  placeholder,
  campos,
  onChange,
}: {
  id: string
  label: string
  tipo?: string
  placeholder?: string
  campos: Record<string, string>
  onChange: (fn: (c: Record<string, string>) => Record<string, string>) => void
}) {
  return (
    <div>
      <label className="block text-xs text-ink-mute" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        type={tipo}
        inputMode={tipo === 'text' ? 'decimal' : undefined}
        placeholder={placeholder}
        value={campos[id] ?? ''}
        onChange={(e) => onChange((c) => ({ ...c, [id]: e.target.value }))}
        className="input mt-1"
      />
    </div>
  )
}

function Escolha({
  titulo,
  opcoes,
  valor,
  onChange,
}: {
  titulo: string
  opcoes: { valor: string; label: string }[]
  valor: string
  onChange: (v: string) => void
}) {
  return (
    <div className="mt-md">
      <span className="block text-sm font-semibold text-ink">{titulo}</span>
      <div role="radiogroup" aria-label={titulo} className="mt-2 flex flex-wrap gap-2">
        {opcoes.map((o) => (
          <button
            key={o.valor}
            type="button"
            role="radio"
            aria-checked={valor === o.valor}
            onClick={() => onChange(o.valor)}
            className={cn(
              'min-h-11 rounded-pill border px-4 text-sm font-semibold',
              valor === o.valor
                ? 'border-transparent [background-image:var(--grad-brand)] text-white'
                : 'border-line bg-paper text-ink-soft hover:text-indigo',
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}
