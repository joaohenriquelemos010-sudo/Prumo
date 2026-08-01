import { useEffect, useState } from 'react'
import { Clock, Plus, Stethoscope } from 'lucide-react'
import { api } from '@/lib/api/client'
import { Button } from '@/components/Button'
import { Sheet } from '@/components/Sheet'
import { Skeleton } from '@/components/Skeleton'
import { AlertaErro } from '@/components/AlertaErro'
import { BotaoExcluir } from '@/components/BotaoExcluir'
import { cn } from '@/lib/cn'

export interface TipoAtendimento {
  id: string
  nome: string
  duracaoMin: number
  cor: string
  template: string
  templateRotulo: string
  templateNatureza: 'primeira' | 'retorno' | 'generico'
  procedimento: boolean
  ativo: boolean
  ordem: number
  observacaoPadrao: string
}

interface TemplateOpcao {
  chave: string
  rotulo: string
  natureza: string
  quando: string
  campos: number
}

const CORES: Record<string, string> = {
  indigo: 'bg-indigo',
  lilas: 'bg-lilas',
  azul: 'bg-azul',
  success: 'bg-success-ink',
  warn: 'bg-warn-ink',
}

const vazio = {
  nome: '',
  duracaoMin: 30,
  cor: 'indigo',
  template: 'soap-generico',
  procedimento: false,
  observacaoPadrao: '',
}

/**
 * O catálogo de tipos de consulta do consultório.
 *
 * Duas coisas dependem dele, e é por isso que ele existe: a **duração** que o
 * horário ocupa na agenda, e o **formulário de prontuário** que abre no
 * atendimento. Sem catálogo, os dois eram um valor global e três tipos fixos no
 * código — o que não descreve consultório nenhum.
 *
 * O médico não começa do zero: na primeira vez que esta tela carrega, o servidor
 * semeia os tipos da especialidade dele. Configuração em branco é a forma mais
 * confiável de um recurso não ser usado.
 */
export function TiposAtendimento() {
  const [tipos, setTipos] = useState<TipoAtendimento[]>([])
  const [templates, setTemplates] = useState<TemplateOpcao[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [editando, setEditando] = useState<TipoAtendimento | typeof vazio | null>(null)
  const [salvando, setSalvando] = useState(false)

  async function carregar() {
    try {
      const d = await api.get<{ tipos: TipoAtendimento[]; templates: TemplateOpcao[] }>(
        '/tipos-atendimento',
      )
      setTipos(d.tipos)
      setTemplates(d.templates)
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
        duracaoMin: editando.duracaoMin,
        cor: editando.cor,
        template: editando.template,
        procedimento: editando.procedimento,
        observacaoPadrao: editando.observacaoPadrao,
      }
      if ('id' in editando) await api.patch(`/tipos-atendimento/${editando.id}`, corpo)
      else await api.post('/tipos-atendimento', corpo)
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
      await api.del(`/tipos-atendimento/${id}`)
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
            <Stethoscope className="size-5 text-indigo" aria-hidden />
            Tipos de consulta
          </h2>
          <p className="mt-1 text-sm text-ink-soft">
            Cada tipo tem a própria duração e o próprio formulário de prontuário — é o que faz a
            primeira consulta abrir a anamnese completa e o retorno abrir só o acompanhamento.
          </p>
        </div>
        <Button
          size="sm"
          variant="secondary"
          iconLeft={<Plus className="size-4" aria-hidden />}
          onClick={() => setEditando({ ...vazio })}
        >
          Novo tipo
        </Button>
      </div>

      {erro && <AlertaErro className="mt-3">{erro}</AlertaErro>}

      {carregando ? (
        <Skeleton className="mt-md h-24" />
      ) : (
        <ul className="mt-md flex flex-col gap-2">
          {tipos.map((t) => (
            <li
              key={t.id}
              className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-paper-2 p-3"
            >
              <span
                className={cn('size-3 shrink-0 rounded-pill', CORES[t.cor] ?? 'bg-indigo')}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <p className="truncate font-display text-sm font-semibold text-ink">{t.nome}</p>
                <p className="truncate text-xs text-ink-mute">
                  <Clock className="mr-1 inline size-3" aria-hidden />
                  {t.duracaoMin} min · {t.templateRotulo}
                  {t.procedimento && ' · procedimento'}
                </p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setEditando(t)}>
                Editar
              </Button>
              <BotaoExcluir
                onConfirm={() => void remover(t.id)}
                titulo="Tirar da lista?"
                size="sm"
              />
            </li>
          ))}
        </ul>
      )}

      <Sheet
        aberto={editando !== null}
        onFechar={() => setEditando(null)}
        titulo={editando && 'id' in editando ? 'Editar tipo' : 'Novo tipo de consulta'}
      >
        {editando && (
          <div className="flex flex-col gap-3">
            <label className="text-sm">
              Nome
              <input
                value={editando.nome}
                onChange={(e) => setEditando({ ...editando, nome: e.target.value })}
                className="input mt-1"
                maxLength={60}
                placeholder="Ex.: Pré-natal — retorno"
                autoFocus
              />
            </label>

            <label className="text-sm">
              Duração (minutos)
              <input
                type="number"
                value={editando.duracaoMin}
                onChange={(e) => setEditando({ ...editando, duracaoMin: Number(e.target.value) })}
                className="input mt-1"
                min={5}
                max={480}
                step={5}
              />
            </label>

            <label className="text-sm">
              Formulário de prontuário
              <select
                value={editando.template}
                onChange={(e) => setEditando({ ...editando, template: e.target.value })}
                className="input mt-1"
              >
                {templates.map((t) => (
                  <option key={t.chave} value={t.chave}>
                    {t.rotulo} ({t.campos} campos)
                  </option>
                ))}
              </select>
              <span className="mt-0.5 block text-xs text-ink-mute">
                {templates.find((t) => t.chave === editando.template)?.quando}
              </span>
            </label>

            <fieldset>
              <legend className="text-sm font-semibold text-ink">Cor na agenda</legend>
              <div className="mt-1 flex gap-2">
                {Object.keys(CORES).map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={c}
                    aria-pressed={editando.cor === c}
                    onClick={() => setEditando({ ...editando, cor: c })}
                    className={cn(
                      'size-8 rounded-pill border-2',
                      CORES[c],
                      editando.cor === c ? 'border-ink' : 'border-transparent',
                    )}
                  />
                ))}
              </div>
            </fieldset>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={editando.procedimento}
                onChange={(e) => setEditando({ ...editando, procedimento: e.target.checked })}
              />
              É procedimento, não consulta
            </label>

            <div className="mt-1 flex gap-2">
              <Button onClick={() => void salvar()} disabled={salvando || editando.nome.trim().length < 2}>
                {salvando ? 'Salvando…' : 'Salvar'}
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
