import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Users, Link2 } from 'lucide-react'
import { api } from '@/lib/api/client'
import { useAuth } from '@/lib/stores/auth'
import { useMedicoContext } from '@/lib/stores/medico-context'

interface Opcao {
  crianca: string
  nome: string
}

/**
 * Child selector shown at the top of the clinical/journey pages.
 *
 * - Doctor: switch between connected patients (default = the example patient).
 * - Family: switch between their own journey and any child they co-parent
 *   (the other parent). Hidden when there is nothing to switch to.
 *
 * The chosen child is written to `useMedicoContext`; the pages read it and scope
 * their API calls with `criancaQuery`. `null` = the user's own default journey.
 */
export function SeletorPaciente() {
  const papel = useAuth((s) => s.user?.papel)
  const criancaAtiva = useMedicoContext((s) => s.criancaAtiva)
  const setPaciente = useMedicoContext((s) => s.setPaciente)
  const [opcoes, setOpcoes] = useState<Opcao[]>([])

  const isMedico = papel === 'medico'
  const isFamilia = papel === 'mae' || papel === 'pai' || papel === 'gestante'

  useEffect(() => {
    if (isMedico) {
      api
        .get<{ vinculos: Opcao[] }>('/vinculos')
        .then((d) => setOpcoes(d.vinculos))
        .catch(() => {})
    } else if (isFamilia) {
      api
        .get<{ coParentadas: Opcao[] }>('/familia')
        .then((d) => setOpcoes(d.coParentadas))
        .catch(() => {})
    }
  }, [isMedico, isFamilia])

  // Family with no co-parented child has nothing to switch — keep the UI clean.
  if (!isMedico && !isFamilia) return null
  if (isFamilia && opcoes.length === 0) return null

  const labelPadrao = isMedico ? 'Paciente de exemplo' : 'Minha jornada'
  const rotulo = isMedico ? 'Paciente:' : 'Jornada:'

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-paper p-3 shadow-soft">
      <span className="inline-flex items-center gap-2 text-sm font-semibold text-ink">
        <Users className="size-4 text-indigo" aria-hidden />
        {rotulo}
      </span>
      <select
        value={criancaAtiva ?? ''}
        onChange={(e) => {
          const id = e.target.value || null
          const nome = opcoes.find((p) => p.crianca === id)?.nome ?? null
          setPaciente(id, nome)
        }}
        className="input h-9 max-w-56 py-0"
      >
        <option value="">{labelPadrao}</option>
        {opcoes.map((p) => (
          <option key={p.crianca} value={p.crianca}>
            {p.nome || (isMedico ? 'Paciente' : 'Bebê')}
          </option>
        ))}
      </select>
      {isMedico && opcoes.length === 0 && (
        <Link to="/app/compartilhar" className="inline-flex items-center gap-1 text-sm font-semibold text-indigo hover:text-azul">
          <Link2 className="size-3.5" aria-hidden /> Conectar um paciente
        </Link>
      )}
    </div>
  )
}
