import { History, Sparkles } from 'lucide-react'
import { cn } from '@/lib/cn'

export type TipoCampo = 'texto' | 'texto-longo' | 'numero' | 'data' | 'selecao' | 'booleano'

export interface Campo {
  id: string
  rotulo: string
  tipo: TipoCampo
  unidade?: string
  opcoes?: string[]
  dica?: string
  permanente?: boolean
}

export interface Secao {
  id: string
  rotulo: string
  resumo?: string
  campos: Campo[]
}

export interface RespostaHerdada {
  campoId: string
  rotulo: string
  valor: string
  em: string
  unidade?: string
}

export interface Formulario {
  chave: string
  versao: number
  rotulo: string
  natureza: 'primeira' | 'retorno' | 'generico'
  quando: string
  primeiraVez: boolean
  secoes: Secao[]
  herdado: RespostaHerdada[]
}

export type Valores = Record<string, string | number | boolean | null>

function quando(iso: string): string {
  const d = new Date(iso)
  const meses = Math.max(
    0,
    (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24 * 30.44),
  )
  if (meses < 1) return 'este mês'
  if (meses < 2) return 'há 1 mês'
  if (meses < 12) return `há ${Math.round(meses)} meses`
  const anos = Math.round(meses / 12)
  return `há ${anos} ${anos === 1 ? 'ano' : 'anos'}`
}

/**
 * O que já foi respondido — e por isso não é perguntado de novo.
 *
 * Este bloco é o pedido central do fluxo do consultório: *"na 2ª já não pergunta
 * porque já tem as informações da 1ª"*. Repetir a anamnese a cada retorno não é
 * só perda de tempo; é o que faz o médico parar de preencher, e um prontuário
 * preenchido pela metade vale menos que um caderno.
 *
 * É leitura, nunca campo. Um valor de anamnese editável dentro do retorno
 * pareceria que a paciente respondeu aquilo hoje — e ela não respondeu.
 */
function Herdado({ itens }: { itens: RespostaHerdada[] }) {
  if (itens.length === 0) return null
  return (
    <section className="rounded-xl border border-line bg-paper-2 p-3">
      <h3 className="inline-flex items-center gap-1.5 font-display text-xs font-bold uppercase tracking-caption text-ink-mute">
        <History className="size-3.5" aria-hidden />
        Da anamnese, já respondido
      </h3>
      <dl className="mt-2 grid gap-x-4 gap-y-1.5 sm:grid-cols-2">
        {itens.map((h) => (
          <div key={h.campoId} className="min-w-0">
            <dt className="text-xs text-ink-mute">
              {h.rotulo} <span className="opacity-60">· {quando(h.em)}</span>
            </dt>
            <dd className="truncate text-sm text-ink" title={h.valor}>
              {h.valor}
              {h.unidade ? ` ${h.unidade}` : ''}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

function CampoUnico({
  campo,
  valor,
  onChange,
}: {
  campo: Campo
  valor: string | number | boolean | null | undefined
  onChange: (v: string | number | boolean | null) => void
}) {
  const comum = 'input mt-1 w-full'
  const v = valor ?? ''

  return (
    <label className="block text-sm">
      <span className="font-medium text-ink">
        {campo.rotulo}
        {campo.unidade && <span className="ml-1 text-ink-mute">({campo.unidade})</span>}
      </span>

      {campo.tipo === 'texto-longo' ? (
        <textarea
          value={String(v)}
          onChange={(e) => onChange(e.target.value)}
          rows={2}
          className={cn(comum, 'resize-y')}
        />
      ) : campo.tipo === 'selecao' ? (
        <select value={String(v)} onChange={(e) => onChange(e.target.value)} className={comum}>
          <option value="">—</option>
          {(campo.opcoes ?? []).map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      ) : campo.tipo === 'booleano' ? (
        <span className="mt-1 flex items-center gap-2">
          <input
            type="checkbox"
            checked={Boolean(valor)}
            onChange={(e) => onChange(e.target.checked)}
          />
          <span className="text-ink-soft">{valor ? 'Sim' : 'Não'}</span>
        </span>
      ) : (
        <input
          type={campo.tipo === 'numero' ? 'number' : campo.tipo === 'data' ? 'date' : 'text'}
          value={String(v)}
          onChange={(e) =>
            onChange(
              campo.tipo === 'numero'
                ? e.target.value === ''
                  ? null
                  : Number(e.target.value)
                : e.target.value,
            )
          }
          className={comum}
          inputMode={campo.tipo === 'numero' ? 'decimal' : undefined}
        />
      )}

      {campo.dica && <span className="mt-0.5 block text-xs text-ink-mute">{campo.dica}</span>}
    </label>
  )
}

/**
 * O formulário de prontuário do atendimento de hoje.
 *
 * Qual formulário abre é decisão do **servidor**, não desta tela: a regra é
 * clínica ("esta jornada já teve a primeira consulta desta linha?") e precisa
 * valer igual em qualquer cliente. Aqui só se renderiza o que veio.
 */
export function FormularioProntuario({
  formulario,
  valores,
  onCampo,
}: {
  formulario: Formulario
  valores: Valores
  onCampo: (id: string, valor: string | number | boolean | null) => void
}) {
  if (formulario.secoes.length === 0 && formulario.herdado.length === 0) return null

  return (
    <div className="flex flex-col gap-md">
      <div className="flex flex-wrap items-baseline gap-2">
        <h2 className="font-display text-sm font-bold uppercase tracking-caption text-ink-mute">
          {formulario.rotulo}
        </h2>
        {formulario.primeiraVez && (
          <span className="inline-flex items-center gap-1 rounded-pill bg-[var(--color-lilas-soft)] px-2 py-0.5 text-xs font-semibold text-indigo">
            <Sparkles className="size-3" aria-hidden />
            primeira consulta
          </span>
        )}
      </div>

      <Herdado itens={formulario.herdado} />

      {formulario.secoes.map((s) => (
        <section key={s.id}>
          <h3 className="font-display text-sm font-semibold text-ink">{s.rotulo}</h3>
          {s.resumo && <p className="text-xs text-ink-mute">{s.resumo}</p>}
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            {s.campos.map((c) => (
              <div key={c.id} className={c.tipo === 'texto-longo' ? 'sm:col-span-2' : undefined}>
                <CampoUnico campo={c} valor={valores[c.id]} onChange={(v) => onCampo(c.id, v)} />
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
