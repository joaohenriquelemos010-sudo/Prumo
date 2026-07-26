import { useEffect, useState } from 'react'
import { CreditCard, Pencil } from 'lucide-react'
import { usePerfil } from '@/lib/stores/perfil'
import type { Convenio } from '@/lib/stores/perfil'
import { OPERADORAS, TIPO_LABEL, TIPOS_COBERTURA, descreverConvenio } from './convenios'
import type { TipoCobertura } from './convenios'
import { Button } from '@/components/Button'
import { AlertaErro } from '@/components/AlertaErro'
import { cn } from '@/lib/cn'

/**
 * The journey's health plan. Two jobs: filter the marketplace by "atende meu
 * plano", and tell the family who pays for each scheduled item.
 *
 * The card number is optional and stays masked once saved — we never need the
 * real value back in the browser, and it is not worth the risk of holding it there.
 */
export function MeuConvenio() {
  const perfil = usePerfil((s) => s.perfil)
  const loaded = usePerfil((s) => s.loaded)
  const load = usePerfil((s) => s.load)
  const update = usePerfil((s) => s.update)

  const [editando, setEditando] = useState(false)
  const [tipo, setTipo] = useState<TipoCobertura>('particular')
  const [operadora, setOperadora] = useState('')
  const [plano, setPlano] = useState('')
  const [numero, setNumero] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    if (!loaded) void load()
  }, [loaded, load])

  const convenio = perfil?.convenio ?? null

  function abrir() {
    setTipo((convenio?.tipo as TipoCobertura) ?? 'particular')
    setOperadora(convenio?.operadora ?? '')
    setPlano(convenio?.plano ?? '')
    setNumero('')
    setErro(null)
    setEditando(true)
  }

  async function salvar() {
    setErro(null)
    if (tipo === 'convenio' && !operadora.trim()) {
      setErro('Escolha a operadora do seu plano.')
      return
    }
    setSalvando(true)
    const patch: { convenio: Convenio } = {
      convenio: {
        tipo,
        operadora: tipo === 'convenio' ? operadora.trim() : '',
        plano: tipo === 'convenio' ? plano.trim() : '',
        ...(numero.trim() ? { numeroCarteirinha: numero.trim() } : {}),
      },
    }
    const result = await update(patch)
    setSalvando(false)
    if (result.ok) setEditando(false)
    else setErro(result.error ?? 'Não consegui salvar agora.')
  }

  if (!editando) {
    return (
      <section className="rounded-2xl border border-line bg-paper p-lg shadow-soft">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <CreditCard className="size-5 text-indigo" aria-hidden />
            <h2 className="text-lg">Seu plano de saúde</h2>
          </div>
          <Button size="md" variant="secondary" iconLeft={<Pencil className="size-4" aria-hidden />} onClick={abrir}>
            {convenio ? 'Alterar' : 'Informar'}
          </Button>
        </div>

        {convenio ? (
          <>
            <p className="mt-2 font-display text-xl font-bold text-ink">{descreverConvenio(convenio)}</p>
            {convenio.numeroCarteirinha && (
              <p className="text-sm text-ink-mute">Carteirinha {convenio.numeroCarteirinha}</p>
            )}
            <p className="mt-2 text-sm text-ink-soft">
              Usamos isso para mostrar quem atende seu plano e o que costuma ser coberto — nunca para
              cobrar nada.
            </p>
          </>
        ) : (
          <p className="mt-2 text-sm text-ink-soft">
            Conte qual plano você tem e a gente filtra quem atende, além de indicar o que costuma ser
            coberto em cada exame.
          </p>
        )}
      </section>
    )
  }

  return (
    <section className="rounded-2xl border-2 border-[var(--color-lilas-soft)] bg-paper p-lg shadow-soft">
      <h2 className="text-lg">Como você é atendida?</h2>

      <div role="radiogroup" aria-label="Tipo de cobertura" className="mt-md flex flex-wrap gap-2">
        {TIPOS_COBERTURA.map((t) => (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={tipo === t}
            onClick={() => setTipo(t)}
            className={cn(
              'min-h-11 rounded-pill border px-4 text-sm font-semibold',
              tipo === t
                ? 'border-transparent [background-image:var(--grad-brand)] text-white shadow-soft'
                : 'border-line bg-paper text-ink-soft hover:text-indigo',
            )}
          >
            {TIPO_LABEL[t]}
          </button>
        ))}
      </div>

      {tipo === 'convenio' && (
        <div className="mt-md flex flex-col gap-md">
          <div>
            <label className="block text-sm font-semibold text-ink" htmlFor="operadora">
              Operadora
            </label>
            <select
              id="operadora"
              value={operadora}
              onChange={(e) => setOperadora(e.target.value)}
              className="input mt-1"
            >
              <option value="">Escolha…</option>
              {OPERADORAS.map((op) => (
                <option key={op} value={op}>
                  {op}
                </option>
              ))}
              <option value="Outra">Outra</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-ink" htmlFor="plano">
              Plano (opcional)
            </label>
            <input
              id="plano"
              value={plano}
              onChange={(e) => setPlano(e.target.value)}
              placeholder="Ex.: Nacional Plus"
              maxLength={80}
              className="input mt-1"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-ink" htmlFor="carteirinha">
              Número da carteirinha (opcional)
            </label>
            <input
              id="carteirinha"
              value={numero}
              onChange={(e) => setNumero(e.target.value)}
              placeholder={perfil?.convenio?.numeroCarteirinha || 'Só os números'}
              maxLength={40}
              inputMode="numeric"
              autoComplete="off"
              className="input mt-1"
            />
            <p className="mt-1 text-xs text-ink-mute">
              Fica guardado com o resto dos seus dados de saúde e volta sempre mascarado — nem a
              equipe conectada vê o número inteiro.
            </p>
          </div>
        </div>
      )}

      {erro && <AlertaErro>{erro}</AlertaErro>}

      <div className="mt-lg flex flex-wrap gap-2">
        <Button size="md" loading={salvando} onClick={salvar}>
          Salvar
        </Button>
        <button
          type="button"
          onClick={() => setEditando(false)}
          className="inline-flex min-h-11 items-center rounded-pill px-4 text-sm font-semibold text-ink-soft hover:bg-paper-2"
        >
          Cancelar
        </button>
      </div>
    </section>
  )
}
