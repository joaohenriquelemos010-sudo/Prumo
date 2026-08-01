import { useState } from 'react'
import { api } from '@/lib/api/client'
import { Sheet } from '@/components/Sheet'
import { Button } from '@/components/Button'
import { AlertaErro } from '@/components/AlertaErro'

export interface PacienteCriado {
  id: string
  nome: string
}

const MOMENTOS = [
  { id: 'gestante', rotulo: 'Grávida' },
  { id: 'ja-nasceu', rotulo: 'Bebê já nasceu' },
  { id: 'planejando', rotulo: 'Planejando engravidar' },
] as const

/**
 * Cadastrar uma paciente que não está na plataforma.
 *
 * Só o nome é obrigatório, e isso é a decisão de produto inteira: um cadastro
 * que exige data de nascimento, telefone e e-mail antes de deixar registrar a
 * consulta é o atrito que faz o médico anotar no papel. O resto entra depois, se
 * entrar — o campo existe, a exigência não.
 *
 * A conta da paciente não aparece aqui de propósito. Ela vem depois, se a
 * paciente quiser, pelo código de vinculação — e até lá o atendimento acontece
 * igual.
 */
export function NovoPaciente({
  aberto,
  onFechar,
  onCriado,
}: {
  aberto: boolean
  onFechar: () => void
  onCriado: (p: PacienteCriado) => void
}) {
  const [nome, setNome] = useState('')
  const [momento, setMomento] = useState<(typeof MOMENTOS)[number]['id']>('gestante')
  const [dpp, setDpp] = useState('')
  const [dataNascimentoBebe, setDataNascimentoBebe] = useState('')
  const [dataNascimento, setDataNascimento] = useState('')
  const [telefone, setTelefone] = useState('')
  const [email, setEmail] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

  async function salvar() {
    setErro(null)
    setSalvando(true)
    try {
      const d = await api.post<{ paciente: PacienteCriado }>('/pacientes', {
        nome,
        momento,
        dpp: momento === 'gestante' ? dpp : '',
        dataNascimentoBebe: momento === 'ja-nasceu' ? dataNascimentoBebe : '',
        dataNascimento,
        telefone,
        email,
        observacoes,
      })
      onCriado(d.paciente)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui cadastrar agora.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Sheet aberto={aberto} onFechar={onFechar} titulo="Cadastrar paciente">
      <p className="text-sm text-ink-soft">
        Para atender agora quem ainda não tem conta. Depois, se ela quiser, você gera um código e o
        histórico passa a aparecer no app dela — sem digitar nada de novo.
      </p>

      {erro && <AlertaErro className="mt-3">{erro}</AlertaErro>}

      <div className="mt-md flex flex-col gap-3">
        <label className="text-sm">
          Nome da paciente
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className="input mt-1"
            maxLength={80}
            placeholder="Como ela se apresenta"
            autoFocus
          />
        </label>

        <fieldset>
          <legend className="text-sm font-semibold text-ink">Momento</legend>
          <div className="mt-1 flex flex-wrap gap-2">
            {MOMENTOS.map((m) => (
              <label
                key={m.id}
                className="inline-flex cursor-pointer items-center gap-2 rounded-pill border border-line bg-paper px-3 py-2 text-sm"
              >
                <input
                  type="radio"
                  name="momento"
                  checked={momento === m.id}
                  onChange={() => setMomento(m.id)}
                />
                {m.rotulo}
              </label>
            ))}
          </div>
        </fieldset>

        {/* Só a data que importa para o momento escolhido — as outras seriam ruído. */}
        {momento === 'gestante' && (
          <label className="text-sm">
            Data provável do parto (opcional)
            <input
              type="date"
              value={dpp}
              onChange={(e) => setDpp(e.target.value)}
              className="input mt-1"
            />
          </label>
        )}
        {momento === 'ja-nasceu' && (
          <label className="text-sm">
            Nascimento do bebê (opcional)
            <input
              type="date"
              value={dataNascimentoBebe}
              onChange={(e) => setDataNascimentoBebe(e.target.value)}
              className="input mt-1"
            />
          </label>
        )}

        <label className="text-sm">
          Nascimento da paciente (opcional)
          <input
            type="date"
            value={dataNascimento}
            onChange={(e) => setDataNascimento(e.target.value)}
            className="input mt-1"
          />
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            Telefone (opcional)
            <input
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              className="input mt-1"
              maxLength={20}
              inputMode="tel"
            />
          </label>
          <label className="text-sm">
            E-mail (opcional)
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              className="input mt-1"
              maxLength={120}
            />
          </label>
        </div>

        <label className="text-sm">
          Observações (opcional)
          <input
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            className="input mt-1"
            maxLength={500}
            placeholder="Ex.: encaminhada pela UBS do bairro."
          />
        </label>

        <div className="mt-1 flex gap-2">
          <Button onClick={() => void salvar()} disabled={salvando || nome.trim().length < 2}>
            {salvando ? 'Cadastrando…' : 'Cadastrar e abrir'}
          </Button>
          <Button variant="ghost" onClick={onFechar}>
            Cancelar
          </Button>
        </div>
      </div>
    </Sheet>
  )
}
