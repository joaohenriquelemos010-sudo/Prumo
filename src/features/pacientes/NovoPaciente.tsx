import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
import { api } from '@/lib/api/client'
import { Sheet } from '@/components/Sheet'
import { Button } from '@/components/Button'
import { Campo } from '@/components/Campo'
import { AlertaErro } from '@/components/AlertaErro'
import { formatarCPF, formatarTelefone, hojeISO } from '@/lib/br-docs'
import { MOMENTOS, PACIENTE_VAZIA, paraApi, temErro, validarPaciente } from '@/features/cadastro/paciente'
import type { DadosPaciente, ErrosPaciente } from '@/features/cadastro/paciente'
import { cn } from '@/lib/cn'

export interface PacienteCriado {
  id: string
  nome: string
}

/**
 * Cadastro rápido — a paciente que chegou agora.
 *
 * Só o nome é obrigatório, e isso é a decisão de produto inteira: um cadastro
 * que exige CPF, data de nascimento e telefone antes de deixar registrar a
 * consulta é o atrito que faz o médico anotar no papel. O que está aqui é o
 * mínimo para atender hoje — a ficha completa mora em `/app/pacientes/novo`, e o
 * atalho para ela fica no rodapé desta folha.
 *
 * A validação é a mesma do formulário grande, em modo `completo: false`: campo
 * vazio passa, campo **errado** não. Um CPF digitado torto é torto nos dois
 * lugares — o opcional é informar, não é informar errado.
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
  const [dados, setDados] = useState<DadosPaciente>(PACIENTE_VAZIA)
  const [erros, setErros] = useState<ErrosPaciente>({})
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

  function alterar(patch: Partial<DadosPaciente>) {
    const proximo = { ...dados, ...patch }
    setDados(proximo)
    if (temErro(erros)) setErros(validarPaciente(proximo, { completo: false }))
  }

  async function salvar() {
    const encontrados = validarPaciente(dados, { completo: false })
    setErros(encontrados)
    if (temErro(encontrados)) return

    setErro(null)
    setSalvando(true)
    try {
      const d = await api.post<{ paciente: PacienteCriado }>('/pacientes', paraApi(dados))
      setDados(PACIENTE_VAZIA)
      onCriado(d.paciente)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui cadastrar agora.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Sheet aberto={aberto} onFechar={onFechar} titulo="Cadastro rápido">
      <p className="text-sm text-ink-soft">
        Para atender agora quem ainda não tem conta. O resto do cadastro pode esperar — e depois,
        se ela quiser, você gera um código e o histórico passa a aparecer no app dela.
      </p>

      {erro && <AlertaErro>{erro}</AlertaErro>}

      <div className="mt-md flex flex-col gap-3">
        <Campo
          rotulo="Nome da paciente"
          obrigatorio
          value={dados.nome}
          onChange={(e) => alterar({ nome: e.target.value })}
          erro={erros.nome}
          maxLength={80}
          autoComplete="name"
          placeholder="Como ela se apresenta"
          autoFocus
        />

        <fieldset>
          <legend className="font-display text-sm font-semibold text-ink">Momento</legend>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {MOMENTOS.map((m) => (
              <button
                key={m.id}
                type="button"
                aria-pressed={dados.momento === m.id}
                onClick={() => alterar({ momento: m.id })}
                className={cn(
                  'inline-flex min-h-10 items-center rounded-pill border px-3.5 font-display text-sm font-semibold',
                  'focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus)]',
                  dados.momento === m.id
                    ? 'border-transparent [background-image:var(--grad-brand)] text-white'
                    : 'border-line bg-paper text-ink-soft hover:bg-paper-2',
                )}
              >
                {m.rotulo}
              </button>
            ))}
          </div>
        </fieldset>

        {/* Só a data que importa para o momento escolhido — as outras seriam ruído. */}
        {dados.momento === 'gestante' && (
          <Campo
            rotulo="Data provável do parto"
            type="date"
            value={dados.dpp}
            onChange={(e) => alterar({ dpp: e.target.value })}
            erro={erros.dpp}
            ajuda="Opcional — dá para preencher depois."
          />
        )}
        {dados.momento === 'ja-nasceu' && (
          <Campo
            rotulo="Nascimento do bebê"
            type="date"
            value={dados.dataNascimentoBebe}
            onChange={(e) => alterar({ dataNascimentoBebe: e.target.value })}
            erro={erros.dataNascimentoBebe}
            max={hojeISO()}
          />
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <Campo
            rotulo="Celular"
            value={dados.telefone}
            onChange={(e) => alterar({ telefone: formatarTelefone(e.target.value) })}
            erro={erros.telefone}
            inputMode="tel"
            placeholder="(00) 00000-0000"
            ajuda="É o que recebe os lembretes."
          />
          <Campo
            rotulo="CPF"
            value={dados.cpf}
            onChange={(e) => alterar({ cpf: formatarCPF(e.target.value) })}
            erro={erros.cpf}
            inputMode="numeric"
            placeholder="000.000.000-00"
          />
        </div>

        <Campo
          rotulo="Nascimento da paciente"
          type="date"
          value={dados.dataNascimento}
          onChange={(e) => alterar({ dataNascimento: e.target.value })}
          erro={erros.dataNascimento}
          max={hojeISO()}
        />

        <div className="mt-1 flex flex-wrap gap-2">
          <Button
            onClick={() => void salvar()}
            loading={salvando}
            disabled={dados.nome.trim().length < 2}
          >
            Cadastrar e abrir
          </Button>
          <Button variant="ghost" onClick={onFechar}>
            Cancelar
          </Button>
        </div>

        {/*
          A saída para a ficha completa fica no fim, e não no topo: quem abriu
          esta folha veio para ser rápido. O caminho existe para quem descobriu no
          meio que tem tempo — e leva o que já foi digitado junto, pela URL.
        */}
        <Link
          to={`/app/pacientes/novo${dados.nome.trim() ? `?nome=${encodeURIComponent(dados.nome.trim())}` : ''}`}
          onClick={onFechar}
          className="inline-flex w-fit items-center gap-1 text-sm font-semibold text-indigo hover:underline"
        >
          Preencher a ficha completa
          <ArrowUpRight className="size-4" aria-hidden />
        </Link>
      </div>
    </Sheet>
  )
}
