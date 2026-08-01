import { useState } from 'react'
import { KeyRound } from 'lucide-react'
import { api } from '@/lib/api/client'
import { Button } from '@/components/Button'
import { AlertaErro } from '@/components/AlertaErro'

/**
 * "Já fui atendida antes de ter conta."
 *
 * A recíproca do cadastro de balcão: o médico atendeu e registrou tudo antes de
 * a paciente existir na plataforma; aqui ela reivindica esse registro e ele
 * passa a ser dela. Não é importação nem cópia — é a **mesma** jornada mudando
 * de dono, com a história inteira no lugar.
 */
export function UsarCodigo({ onVinculada }: { onVinculada: () => void }) {
  const [codigo, setCodigo] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [ok, setOk] = useState(false)
  const [ocupado, setOcupado] = useState(false)

  async function enviar() {
    setErro(null)
    setOcupado(true)
    try {
      await api.post('/pacientes/vincular', { codigo })
      setOk(true)
      onVinculada()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui vincular agora.')
    } finally {
      setOcupado(false)
    }
  }

  if (ok) {
    return (
      <section className="rounded-2xl border border-line bg-paper p-lg shadow-soft">
        <h2 className="font-display text-lg text-ink">Pronto — seu histórico está aqui</h2>
        <p className="mt-1 text-ink-soft">
          O que seu médico registrou nas consultas já aparece nas suas telas.
        </p>
      </section>
    )
  }

  return (
    <section className="rounded-2xl border border-line bg-paper p-lg shadow-soft">
      <h2 className="inline-flex items-center gap-2 text-lg">
        <KeyRound className="size-5 text-indigo" aria-hidden />
        Recebi um código do meu médico
      </h2>
      <p className="mt-1 text-ink-soft">
        Se você já foi atendida antes de criar esta conta, o código traz esse histórico para cá.
      </p>

      {erro && <AlertaErro className="mt-2">{erro}</AlertaErro>}

      <div className="mt-md flex flex-wrap items-end gap-2">
        <label className="text-sm">
          Código
          {/*
            `maxLength` folgado e normalização no servidor: quem digita não deve
            ter que saber se o hífen conta. Vem `abcd 2468` ou `ABCD-2468`, o
            servidor entende os dois.
          */}
          <input
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.toUpperCase())}
            className="input mt-1 font-display text-lg tracking-[0.18em]"
            placeholder="ABCD-2468"
            maxLength={20}
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        <Button
          onClick={() => void enviar()}
          disabled={ocupado || codigo.replace(/[^A-Za-z0-9]/g, '').length < 6}
        >
          {ocupado ? 'Vinculando…' : 'Vincular'}
        </Button>
      </div>
    </section>
  )
}
