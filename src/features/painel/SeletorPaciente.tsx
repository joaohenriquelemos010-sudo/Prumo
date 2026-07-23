import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Users, Link2 } from 'lucide-react'
import { api } from '@/lib/api/client'
import { useAuth } from '@/lib/stores/auth'
import { useMedicoContext } from '@/lib/stores/medico-context'

interface VinculoPaciente {
  id: string
  crianca: string
  nome: string
}

/**
 * Doctor-only patient switcher, shown at the top of the clinical pages. Lets the
 * doctor choose which connected patient they're viewing (default = the example
 * patient). The clinical pages read `useMedicoContext` and scope their API calls.
 */
export function SeletorPaciente() {
  const papel = useAuth((s) => s.user?.papel)
  const criancaAtiva = useMedicoContext((s) => s.criancaAtiva)
  const setPaciente = useMedicoContext((s) => s.setPaciente)
  const [pacientes, setPacientes] = useState<VinculoPaciente[]>([])

  useEffect(() => {
    if (papel !== 'medico') return
    api
      .get<{ vinculos: VinculoPaciente[] }>('/vinculos')
      .then((d) => setPacientes(d.vinculos))
      .catch(() => {})
  }, [papel])

  if (papel !== 'medico') return null

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-paper p-3 shadow-soft">
      <span className="inline-flex items-center gap-2 text-sm font-semibold text-ink">
        <Users className="size-4 text-indigo" aria-hidden />
        Paciente:
      </span>
      <select
        value={criancaAtiva ?? ''}
        onChange={(e) => {
          const id = e.target.value || null
          const nome = pacientes.find((p) => p.crianca === id)?.nome ?? null
          setPaciente(id, nome)
        }}
        className="input h-9 max-w-56 py-0"
      >
        <option value="">Paciente de exemplo</option>
        {pacientes.map((p) => (
          <option key={p.id} value={p.crianca}>
            {p.nome || 'Paciente'}
          </option>
        ))}
      </select>
      {pacientes.length === 0 && (
        <Link to="/app/compartilhar" className="inline-flex items-center gap-1 text-sm font-semibold text-indigo hover:text-azul">
          <Link2 className="size-3.5" aria-hidden /> Conectar um paciente
        </Link>
      )}
    </div>
  )
}
