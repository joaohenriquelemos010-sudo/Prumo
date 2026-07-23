import { useEffect, useState } from 'react'
import { CalendarHeart, Check, Pencil } from 'lucide-react'
import { usePerfil } from '@/lib/stores/perfil'
import type { Momento } from '@/lib/stores/perfil'
import { Button } from '@/components/Button'
import { cn } from '@/lib/cn'

/** yyyy-mm-dd for <input type=date>, from an ISO string. */
function toInputDate(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toISOString().slice(0, 10)
}

const MOMENTOS: { value: Momento; label: string }[] = [
  { value: 'planejando', label: 'Planejando' },
  { value: 'gestante', label: 'Grávida' },
  { value: 'ja-nasceu', label: 'Bebê nasceu' },
]

/**
 * Sets the moment + key date (DPP or birth date) that drive the SUS schedule.
 * Shown collapsed as a summary once filled; opens into a small form to edit.
 * When nothing is set yet, it invites the person warmly instead of showing an
 * empty screen elsewhere.
 */
export function DadosCrianca({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const perfil = usePerfil((s) => s.perfil)
  const loaded = usePerfil((s) => s.loaded)
  const load = usePerfil((s) => s.load)
  const update = usePerfil((s) => s.update)

  const [editing, setEditing] = useState(defaultOpen)
  const [momento, setMomento] = useState<Momento>('gestante')
  const [data, setData] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!loaded) void load()
  }, [loaded, load])

  useEffect(() => {
    if (!perfil) return
    setMomento(perfil.momento)
    setData(toInputDate(perfil.momento === 'ja-nasceu' ? perfil.dataNascimento : perfil.dpp))
  }, [perfil])

  const temData = Boolean(perfil && (perfil.dataNascimento || perfil.dpp))
  const precisaData = momento === 'gestante' || momento === 'ja-nasceu'

  async function salvar() {
    setErro(null)
    if (precisaData && !data) {
      setErro(momento === 'ja-nasceu' ? 'Informe a data de nascimento.' : 'Informe a data provável do parto.')
      return
    }
    setSaving(true)
    const patch = {
      momento,
      dataNascimento: momento === 'ja-nasceu' && data ? new Date(data).toISOString() : null,
      dpp: momento === 'gestante' && data ? new Date(data).toISOString() : null,
    }
    const result = await update(patch)
    setSaving(false)
    if (result.ok) setEditing(false)
    else setErro(result.error ?? 'Não consegui salvar.')
  }

  // Collapsed summary
  if (!editing && temData) {
    const label = perfil?.momento === 'ja-nasceu' ? 'Nascimento' : 'Data provável do parto'
    const value = toInputDate(perfil?.momento === 'ja-nasceu' ? perfil.dataNascimento : perfil?.dpp ?? null)
    return (
      <div className="flex items-center justify-between gap-md rounded-2xl border border-line bg-paper p-md shadow-soft">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl [background-image:var(--grad-brand-soft)] text-indigo">
            <CalendarHeart className="size-5" aria-hidden />
          </span>
          <div>
            <p className="text-xs font-semibold text-ink-mute">{label}</p>
            <p className="font-display font-semibold text-ink">
              {value ? new Date(value).toLocaleDateString('pt-BR') : '—'}
            </p>
          </div>
        </div>
        <Button variant="ghost" size="md" iconLeft={<Pencil className="size-4" aria-hidden />} onClick={() => setEditing(true)}>
          Editar
        </Button>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-line bg-paper p-lg shadow-soft">
      <h2 className="text-lg">Vamos personalizar sua trilha clínica</h2>
      <p className="mt-1 text-sm text-ink-soft">
        Com a data certa, montamos sua agenda e o calendário de vacinas do jeito do SUS.
      </p>

      <div className="mt-md flex flex-col gap-3">
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Seu momento">
          {MOMENTOS.map((m) => (
            <button
              key={m.value}
              type="button"
              role="radio"
              aria-checked={momento === m.value}
              onClick={() => setMomento(m.value)}
              className={cn(
                'rounded-pill border px-4 py-2 text-sm font-semibold transition-colors duration-[var(--dur-fast)]',
                momento === m.value
                  ? 'border-transparent [background-image:var(--grad-brand)] text-white'
                  : 'border-line bg-paper text-ink-soft hover:bg-paper-2',
              )}
            >
              {m.label}
            </button>
          ))}
        </div>

        {precisaData && (
          <label htmlFor="data-crianca" className="flex flex-col gap-1.5">
            <span className="font-display text-sm font-semibold text-ink">
              {momento === 'ja-nasceu' ? 'Data de nascimento' : 'Data provável do parto'}
            </span>
            <input
              id="data-crianca"
              type="date"
              value={data}
              onChange={(e) => {
                setData(e.target.value)
                if (erro) setErro(null)
              }}
              className="input"
            />
          </label>
        )}
      </div>

      {erro && (
        <p role="alert" className="mt-3 text-sm font-semibold text-warn">
          {erro}
        </p>
      )}

      <div className="mt-md flex gap-2">
        <Button size="md" loading={saving} iconLeft={<Check className="size-4" aria-hidden />} onClick={salvar}>
          Salvar
        </Button>
        {temData && (
          <Button variant="ghost" size="md" onClick={() => setEditing(false)}>
            Cancelar
          </Button>
        )}
      </div>
    </div>
  )
}
