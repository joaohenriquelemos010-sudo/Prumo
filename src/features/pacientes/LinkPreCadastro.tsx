import { useEffect, useState } from 'react'
import {
  Check,
  Copy,
  Link2,
  Lock,
  MessageCircle,
  Pencil,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Timer,
} from 'lucide-react'
import { api } from '@/lib/api/client'
import { Button } from '@/components/Button'
import { Campo } from '@/components/Campo'
import { AlertaErro } from '@/components/AlertaErro'
import { Skeleton } from '@/components/Skeleton'

interface Link {
  token: string
  caminho: string
  nomeClinica: string
  ativo: boolean
  recebidos: number
}

/**
 * O link de pré-cadastro — a ficha que a paciente preenche sozinha.
 *
 * A recepção digitando os dados de dezoito pacientes por dia é o gargalo mais
 * caro do consultório e o mais fácil de errar: nome ditado por telefone, CPF
 * lido de uma foto tremida, endereço abreviado para caber. Quem sabe esses
 * dados é a paciente, e ela tem o celular na mão enquanto espera.
 *
 * O link é **um só**, reutilizável, e isso é decisão de produto: um link por
 * paciente obrigaria alguém a gerar e enviar um a um — trocar digitação por
 * gerenciamento de links não é economia nenhuma. Este vai na mensagem de
 * confirmação, no perfil da clínica, no cartãozinho da recepção.
 *
 * O que chega por ele entra marcado como **declarado, não conferido** — a
 * distinção aparece na ficha até alguém do consultório revisar.
 */
export function LinkPreCadastro() {
  const [link, setLink] = useState<Link | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [copiado, setCopiado] = useState(false)
  const [editandoNome, setEditandoNome] = useState(false)
  const [nome, setNome] = useState('')
  const [ocupado, setOcupado] = useState(false)

  useEffect(() => {
    api
      .get<{ link: Link }>('/pre-cadastro/link')
      .then((d) => {
        setLink(d.link)
        setNome(d.link.nomeClinica)
      })
      .catch((e) => setErro(e instanceof Error ? e.message : 'Não consegui carregar o link.'))
      .finally(() => setCarregando(false))
  }, [])

  const url = link ? `${window.location.origin}${link.caminho}` : ''

  async function salvar(corpo: Record<string, unknown>) {
    setOcupado(true)
    setErro(null)
    try {
      const d = await api.put<{ link: Link }>('/pre-cadastro/link', corpo)
      setLink(d.link)
      setNome(d.link.nomeClinica)
      setEditandoNome(false)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui salvar agora.')
    } finally {
      setOcupado(false)
    }
  }

  function copiar() {
    void navigator.clipboard?.writeText(url).then(() => {
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    })
  }

  /**
   * `wa.me` sem número: abre o WhatsApp com a mensagem pronta e deixa a escolha
   * do contato para quem está enviando. Escolher a paciente na agenda do próprio
   * celular é mais rápido do que digitar o telefone dela aqui — e não exige que
   * o número já esteja cadastrado, que é exatamente o que ainda não está.
   */
  const mensagem = encodeURIComponent(
    `Olá! Para agilizar seu atendimento${link?.nomeClinica ? ` na ${link.nomeClinica}` : ''}, ` +
      `preencha seu cadastro por aqui antes da consulta: ${url}`,
  )

  if (carregando) return <Skeleton className="h-72 w-full rounded-2xl" />

  return (
    <section className="rounded-2xl border border-line bg-paper p-md shadow-soft">
      <header className="flex flex-wrap items-center gap-2">
        <MessageCircle className="size-5 text-success-ink" aria-hidden />
        <h2 className="font-display text-base font-semibold text-ink">
          Envie o pré-cadastro para a paciente
        </h2>
      </header>

      <p className="mt-2 text-sm text-ink-soft">
        Um link seguro para a paciente preencher os dados pelo celular, antes ou enquanto aguarda a
        consulta.
      </p>

      <ul className="mt-md flex flex-col gap-2.5">
        <Beneficio icone={<Smartphone className="size-4" aria-hidden />}>
          Ela preenche no celular, de forma simples e segura.
        </Beneficio>
        <Beneficio icone={<Link2 className="size-4" aria-hidden />}>
          Os dados chegam direto na sua lista de pacientes.
        </Beneficio>
        <Beneficio icone={<Timer className="size-4" aria-hidden />}>
          Menos tempo de espera, mais organização no consultório.
        </Beneficio>
      </ul>

      {erro && <AlertaErro>{erro}</AlertaErro>}

      <div className="mt-md rounded-xl border border-line bg-paper-2 p-3">
        <p className="font-display text-sm font-semibold text-ink">Link de pré-cadastro</p>

        <div className="mt-2 flex items-center gap-2 rounded-lg border border-line bg-paper px-3 py-2">
          <span className="min-w-0 flex-1 truncate text-sm text-ink-soft" title={url}>
            {url}
          </span>
          <button
            type="button"
            onClick={copiar}
            aria-label="Copiar link"
            className="grid size-8 shrink-0 place-items-center rounded-pill text-ink-soft hover:bg-paper-2 hover:text-indigo"
          >
            {copiado ? (
              <Check className="size-4 text-success-ink" aria-hidden />
            ) : (
              <Copy className="size-4" aria-hidden />
            )}
          </button>
        </div>

        {editandoNome ? (
          <div className="mt-2 flex flex-wrap items-end gap-2">
            <Campo
              rotulo="Nome da clínica"
              className="min-w-40 flex-1"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              maxLength={60}
              placeholder="Como a paciente reconhece você"
            />
            <Button size="sm" loading={ocupado} onClick={() => void salvar({ nomeClinica: nome })}>
              Salvar
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditandoNome(false)}>
              Cancelar
            </Button>
          </div>
        ) : (
          <p className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-ink-mute">
            {link?.nomeClinica
              ? `A paciente vê "${link.nomeClinica}" no topo do formulário.`
              : 'O link é único e pode ser personalizado com o nome da sua clínica.'}
            <button
              type="button"
              onClick={() => setEditandoNome(true)}
              className="inline-flex items-center gap-1 font-semibold text-indigo hover:underline"
            >
              <Pencil className="size-3" aria-hidden />
              {link?.nomeClinica ? 'Editar' : 'Personalizar'}
            </button>
          </p>
        )}

        <a
          href={`https://wa.me/?text=${mensagem}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 block"
        >
          <Button
            variant="secondary"
            fullWidth
            iconLeft={<MessageCircle className="size-4" aria-hidden />}
          >
            Enviar link pelo WhatsApp
          </Button>
        </a>

        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <Button
            size="sm"
            variant="ghost"
            iconLeft={<Copy className="size-4" aria-hidden />}
            onClick={copiar}
          >
            {copiado ? 'Link copiado' : 'Copiar link'}
          </Button>
          {/*
            Gerar outro link mata o anterior na hora. É o que resolve o link que
            foi parar num grupo errado — e por isso pergunta antes.
          */}
          <Button
            size="sm"
            variant="ghost"
            disabled={ocupado}
            iconLeft={<RefreshCw className="size-4" aria-hidden />}
            onClick={() => {
              if (
                !window.confirm(
                  'Gerar um link novo faz o atual parar de funcionar na hora. Quem já recebeu o antigo não vai conseguir preencher. Continuar?',
                )
              )
                return
              void salvar({ rotacionar: true })
            }}
          >
            Gerar outro
          </Button>
        </div>
      </div>

      {link && link.recebidos > 0 && (
        <p className="mt-2 text-xs text-ink-mute">
          {link.recebidos} {link.recebidos === 1 ? 'ficha recebida' : 'fichas recebidas'} por este
          link.
        </p>
      )}

      <p className="mt-md flex items-start gap-2 text-xs text-ink-mute">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-indigo" aria-hidden />
        Os dados informados pela paciente trafegam criptografados. CPF e carteirinha ficam cifrados
        no banco.
      </p>
      <p className="mt-1.5 flex items-start gap-2 text-xs text-ink-mute">
        <Lock className="mt-0.5 size-4 shrink-0 text-indigo" aria-hidden />
        O link só recebe cadastro — não mostra prontuário, agenda nem dado de nenhuma paciente.
      </p>
    </section>
  )
}

function Beneficio({ icone, children }: { icone: React.ReactNode; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5 text-sm text-ink-soft">
      <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-[color-mix(in_oklch,var(--color-lilas)_14%,transparent)] text-indigo">
        {icone}
      </span>
      <span>{children}</span>
    </li>
  )
}
