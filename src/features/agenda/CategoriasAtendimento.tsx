import { useEffect, useState } from 'react'
import { Activity, Baby, Droplet, HeartPulse, Layers, Monitor, Plus, Stethoscope } from 'lucide-react'
import { api } from '@/lib/api/client'
import { Button } from '@/components/Button'
import { Sheet } from '@/components/Sheet'
import { Skeleton } from '@/components/Skeleton'
import { AlertaErro } from '@/components/AlertaErro'
import { BotaoExcluir } from '@/components/BotaoExcluir'
import { cn } from '@/lib/cn'

export interface CategoriaAtendimento {
  id: string
  nome: string
  descricao: string
  ativo: boolean
  ordem: number
}

/**
 * O ícone não é um campo — é uma consequência da posição na lista.
 *
 * O formulário do desenho pergunta três coisas (nome, descrição, status) e mais
 * nada, e está certo: escolher um pictograma é trabalho de designer, não de
 * médica com a agenda aberta. A lista mesmo assim precisa de âncoras visuais
 * para se ler num relance, então cada área recebe um par ícone+tom do ciclo
 * abaixo. Determinístico pela ordem: a mesma área tem sempre a mesma cara.
 */
const TILES: { Icone: typeof Baby; classe: string }[] = [
  { Icone: Baby, classe: 'bg-[color-mix(in_oklch,var(--color-lilas)_16%,transparent)] text-indigo' },
  { Icone: HeartPulse, classe: 'bg-[color-mix(in_oklch,var(--color-warn)_14%,transparent)] text-warn-ink' },
  { Icone: Droplet, classe: 'bg-[color-mix(in_oklch,var(--color-azul)_18%,transparent)] text-indigo' },
  { Icone: Monitor, classe: 'bg-[color-mix(in_oklch,var(--color-indigo)_14%,transparent)] text-indigo' },
  { Icone: Stethoscope, classe: 'bg-[color-mix(in_oklch,var(--color-success)_14%,transparent)] text-success-ink' },
  { Icone: Activity, classe: 'bg-[color-mix(in_oklch,var(--color-lilas)_24%,transparent)] text-indigo' },
]

const LIMITE_DESCRICAO = 200

const vazio = {
  nome: '',
  descricao: '',
  ativo: true,
}

/**
 * As áreas de atendimento do consultório — o segundo passo da configuração.
 *
 * Entre "quando você atende" e "quanto tempo cada consulta dura" falta uma
 * pergunta que o produto não fazia: **o que** você atende. Gestação, Ginecologia,
 * Mastologia e Telemedicina não são durações nem formulários; são as áreas sob as
 * quais o resto se organiza — na agenda, no prontuário e nos relatórios.
 *
 * Deliberadamente magro: nome, uma frase e um interruptor. Cor, duração e
 * template continuam morando nos tipos de consulta, que é onde eles significam
 * alguma coisa — perguntar "quantos minutos dura Gestação?" não teria resposta.
 *
 * A lista começa vazia, sem semear padrões por especialidade: o que uma médica
 * chama de área de atuação é dela, e um chute aqui vira trabalho de apagar antes
 * de trabalho de cadastrar.
 */
export function CategoriasAtendimento() {
  const [categorias, setCategorias] = useState<CategoriaAtendimento[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [editando, setEditando] = useState<CategoriaAtendimento | typeof vazio | null>(null)
  const [salvando, setSalvando] = useState(false)

  async function carregar() {
    try {
      // `todos=true`: quem configura precisa ver o que desativou — senão a área
      // inativa some da tela e não há como reativá-la.
      const d = await api.get<{ categorias: CategoriaAtendimento[] }>(
        '/categorias-atendimento?todos=true',
      )
      setCategorias(d.categorias)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível carregar.')
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    void carregar()
  }, [])

  async function salvar() {
    if (!editando) return
    setSalvando(true)
    setErro(null)
    try {
      const corpo = {
        nome: editando.nome,
        descricao: editando.descricao,
        ativo: editando.ativo,
      }
      if ('id' in editando) await api.patch(`/categorias-atendimento/${editando.id}`, corpo)
      else await api.post('/categorias-atendimento', corpo)
      setEditando(null)
      await carregar()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui salvar.')
    } finally {
      setSalvando(false)
    }
  }

  async function remover(id: string) {
    try {
      await api.del(`/categorias-atendimento/${id}`)
      await carregar()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui remover.')
    }
  }

  return (
    <section className="rounded-2xl border border-line bg-paper p-lg shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-md">
        <div>
          <h2 className="inline-flex items-center gap-2 text-lg">
            <Layers className="size-5 text-indigo" aria-hidden />
            Tipos de atendimento cadastrados
          </h2>
          <p className="mt-1 text-sm text-ink-soft">
            Defina as áreas de atendimento disponíveis para agendamento e prontuário.
          </p>
        </div>
        <Button
          size="sm"
          variant="secondary"
          iconLeft={<Plus className="size-4" aria-hidden />}
          onClick={() => setEditando({ ...vazio })}
        >
          Novo tipo de atendimento
        </Button>
      </div>

      {erro && <AlertaErro className="mt-3">{erro}</AlertaErro>}

      {carregando ? (
        <Skeleton className="mt-md h-24" />
      ) : categorias.length === 0 ? (
        <p className="mt-md rounded-xl border border-dashed border-line bg-paper-2 p-lg text-center text-sm text-ink-soft">
          Nenhuma área cadastrada ainda. Comece pelas que você atende no dia a dia — Gestação,
          Ginecologia, Mastologia.
        </p>
      ) : (
        <ul className="mt-md flex flex-col gap-2">
          {categorias.map((c, i) => {
            const { Icone, classe } = TILES[i % TILES.length]
            return (
              <li
                key={c.id}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-paper-2 p-3"
              >
                <span
                  className={cn('grid size-10 shrink-0 place-items-center rounded-xl', classe)}
                  aria-hidden
                >
                  <Icone className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-sm font-semibold text-ink">{c.nome}</p>
                  {c.descricao && (
                    <p className="truncate text-xs text-ink-mute">{c.descricao}</p>
                  )}
                </div>
                <span
                  className={cn(
                    'shrink-0 rounded-pill px-2.5 py-0.5 text-xs font-semibold',
                    c.ativo ? 'u-chip-success' : 'bg-paper-3 text-ink-soft',
                  )}
                >
                  {c.ativo ? 'Ativo' : 'Inativo'}
                </span>
                <Button size="sm" variant="ghost" onClick={() => setEditando(c)}>
                  Editar
                </Button>
                <BotaoExcluir
                  onConfirm={() => void remover(c.id)}
                  titulo="Tirar da lista?"
                  size="sm"
                />
              </li>
            )
          })}
        </ul>
      )}

      {!carregando && categorias.length > 0 && (
        <p className="mt-3 text-xs text-ink-mute">
          Mostrando {categorias.length}{' '}
          {categorias.length === 1 ? 'tipo de atendimento' : 'tipos de atendimento'}.
        </p>
      )}

      <Sheet
        aberto={editando !== null}
        onFechar={() => setEditando(null)}
        titulo={
          editando && 'id' in editando ? 'Editar tipo de atendimento' : 'Novo tipo de atendimento'
        }
      >
        {editando && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-ink-soft">
              {'id' in editando
                ? 'Ajuste esta área de atendimento.'
                : 'Crie uma nova área de atendimento.'}
            </p>

            <label className="text-sm">
              Nome do tipo de atendimento *
              <input
                value={editando.nome}
                onChange={(e) => setEditando({ ...editando, nome: e.target.value })}
                className="input mt-1"
                maxLength={60}
                placeholder="Ex.: Gestação, Ginecologia, Mastologia"
                autoFocus
              />
            </label>

            <label className="text-sm">
              Descrição <span className="text-ink-mute">(opcional)</span>
              <textarea
                value={editando.descricao}
                onChange={(e) => setEditando({ ...editando, descricao: e.target.value })}
                className="input mt-1 min-h-24 resize-y"
                maxLength={LIMITE_DESCRICAO}
                placeholder="Descreva brevemente o que está incluído nesta área de atendimento."
              />
              <span className="mt-0.5 block text-right text-xs text-ink-mute">
                {editando.descricao.length}/{LIMITE_DESCRICAO}
              </span>
            </label>

            <fieldset>
              <legend className="text-sm font-semibold text-ink">Status *</legend>
              <div className="mt-1 flex flex-col gap-2">
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="radio"
                    name="status-categoria"
                    className="mt-1"
                    checked={editando.ativo}
                    onChange={() => setEditando({ ...editando, ativo: true })}
                  />
                  <span>
                    <span className="font-semibold text-ink">Ativo</span>
                    <span className="block text-xs text-ink-mute">
                      Disponível para agendamento e uso nos prontuários.
                    </span>
                  </span>
                </label>
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="radio"
                    name="status-categoria"
                    className="mt-1"
                    checked={!editando.ativo}
                    onChange={() => setEditando({ ...editando, ativo: false })}
                  />
                  <span>
                    <span className="font-semibold text-ink">Inativo</span>
                    <span className="block text-xs text-ink-mute">
                      Não disponível para agendamento.
                    </span>
                  </span>
                </label>
              </div>
            </fieldset>

            <div className="mt-1 flex gap-2">
              <Button
                onClick={() => void salvar()}
                disabled={salvando || editando.nome.trim().length < 2}
              >
                {salvando ? 'Salvando…' : 'Salvar tipo de atendimento'}
              </Button>
              <Button variant="ghost" onClick={() => setEditando(null)}>
                Cancelar
              </Button>
            </div>
          </div>
        )}
      </Sheet>
    </section>
  )
}
