import { useId, useState } from 'react'
import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react'
import { ChevronDown, Eye, EyeOff } from 'lucide-react'
import { forcaSenha } from '@/lib/senha'
import { cn } from '@/lib/cn'

/**
 * Os campos do cadastro.
 *
 * Três decisões que valem para todos eles:
 *
 * - **O rótulo mora dentro da caixa, acima do valor.** É o padrão do iOS, e ele
 *   resolve o problema do placeholder-como-rótulo: o nome do campo não some
 *   quando a pessoa começa a digitar, então ninguém precisa apagar o que
 *   escreveu para lembrar o que o campo pedia.
 * - **O erro é do campo, não do formulário.** Validar tudo só no submit devolve
 *   uma lista de reclamações longe de onde elas acontecem. Aqui cada campo
 *   carrega o próprio erro, ligado por `aria-describedby` e marcado com
 *   `aria-invalid`.
 * - **O anel de foco é do invólucro.** O `input` é transparente e sem borda, e o
 *   `outline` global cairia dentro da caixa, desalinhado. O invólucro assume o
 *   foco e o campo inteiro acende junto.
 */

/**
 * Sem direção de flex aqui de propósito: quem usa escolhe (`flex-col` para os
 * campos simples, `items-center` para a linha com o olho). `cn` só concatena
 * classes — quem ganha entre `flex-col` e `flex-row` é a ordem no CSS gerado,
 * não a ordem no atributo, então "sobrescrever depois" não funcionaria.
 */
const CAIXA =
  'flex w-full rounded-lg border bg-[color-mix(in_oklab,var(--color-paper)_78%,transparent)] px-3.5 py-2 ' +
  'transition-[border-color,box-shadow] duration-[var(--dur-fast)] ease-out ' +
  'focus-within:border-[var(--color-lilas)] focus-within:shadow-glow'

const CONTROLE =
  'w-full border-0 bg-transparent p-0 text-base text-ink outline-none placeholder:text-ink-mute ' +
  'focus-visible:outline-none [color-scheme:light] dark:[color-scheme:dark]'

const ROTULO = 'font-display text-[0.78rem] font-semibold tracking-caption text-ink-mute'

interface BaseProps {
  rotulo: string
  /** Texto de apoio permanente — o "por que pedimos isso". */
  ajuda?: ReactNode
  erro?: string
  className?: string
  /** Marca o campo como exigido — asterisco visível e `required` para o leitor. */
  obrigatorio?: boolean
}

type CampoProps = BaseProps &
  Omit<InputHTMLAttributes<HTMLInputElement>, 'className'> & {
    /**
     * O que vive na borda direita do campo: o ícone do WhatsApp, o botão de
     * buscar CEP, o "kg" de uma medida. Fica **dentro** da caixa porque
     * pertence ao campo — um botão solto ao lado parece agir sobre o
     * formulário, e não sobre aquele valor.
     */
    sufixo?: ReactNode
  }

export function Campo({
  rotulo,
  ajuda,
  erro,
  className,
  id,
  obrigatorio,
  sufixo,
  ...resto
}: CampoProps) {
  const gerado = useId()
  const campoId = id ?? gerado
  const { descricao, descritoPor } = usarDescricao(campoId, ajuda, erro)

  const controle = (
    <input
      id={campoId}
      className={CONTROLE}
      aria-invalid={erro ? true : undefined}
      aria-describedby={descritoPor}
      required={obrigatorio}
      {...resto}
    />
  )

  return (
    <div className={cn('flex min-w-0 flex-col gap-1', className)}>
      {/*
        Sem sufixo, a caixa inteira é o `label` — clicar em qualquer lugar dela
        foca o campo. Com sufixo isso não pode ser: um clique no botão de buscar
        CEP não deve virar um clique no campo, então o `label` encolhe para a
        coluna do valor e o botão fica fora dele.
      */}
      {sufixo ? (
        <div className={cn(CAIXA, 'items-center gap-2', erro ? 'border-warn' : 'border-line')}>
          <label htmlFor={campoId} className="flex min-w-0 flex-1 flex-col">
            <Rotulo obrigatorio={obrigatorio}>{rotulo}</Rotulo>
            {controle}
          </label>
          {sufixo}
        </div>
      ) : (
        <label htmlFor={campoId} className={cn(CAIXA, 'flex-col', erro ? 'border-warn' : 'border-line')}>
          <Rotulo obrigatorio={obrigatorio}>{rotulo}</Rotulo>
          {controle}
        </label>
      )}
      {descricao}
    </div>
  )
}

/**
 * O asterisco é `aria-hidden` e acompanhado de `required` no controle: quem
 * enxerga vê o sinal, quem usa leitor de tela ouve "obrigatório" — e ninguém
 * ouve "asterisco" no meio do nome do campo.
 */
function Rotulo({ children, obrigatorio }: { children: ReactNode; obrigatorio?: boolean }) {
  return (
    <span className={ROTULO}>
      {children}
      {obrigatorio && (
        <span aria-hidden className="ml-0.5 text-warn-ink">
          *
        </span>
      )}
    </span>
  )
}

type CampoAreaProps = BaseProps & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'className'>

/** O mesmo campo, para o texto que não cabe numa linha. */
export function CampoArea({
  rotulo,
  ajuda,
  erro,
  className,
  id,
  obrigatorio,
  rows = 3,
  ...resto
}: CampoAreaProps) {
  const gerado = useId()
  const campoId = id ?? gerado
  const { descricao, descritoPor } = usarDescricao(campoId, ajuda, erro)

  return (
    <div className={cn('flex min-w-0 flex-col gap-1', className)}>
      <label htmlFor={campoId} className={cn(CAIXA, 'flex-col', erro ? 'border-warn' : 'border-line')}>
        <Rotulo obrigatorio={obrigatorio}>{rotulo}</Rotulo>
        <textarea
          id={campoId}
          rows={rows}
          className={cn(CONTROLE, 'resize-y leading-relaxed')}
          aria-invalid={erro ? true : undefined}
          aria-describedby={descritoPor}
          required={obrigatorio}
          {...resto}
        />
      </label>
      {descricao}
    </div>
  )
}

type CampoSelectProps = BaseProps &
  Omit<SelectHTMLAttributes<HTMLSelectElement>, 'className'> & { children: ReactNode }

export function CampoSelect({
  rotulo,
  ajuda,
  erro,
  className,
  id,
  obrigatorio,
  children,
  ...resto
}: CampoSelectProps) {
  const gerado = useId()
  const campoId = id ?? gerado
  const { descricao, descritoPor } = usarDescricao(campoId, ajuda, erro)

  return (
    <div className={cn('flex min-w-0 flex-col gap-1', className)}>
      <label
        htmlFor={campoId}
        className={cn(CAIXA, 'items-center gap-2', erro ? 'border-warn' : 'border-line')}
      >
        <span className="flex min-w-0 flex-1 flex-col">
          <Rotulo obrigatorio={obrigatorio}>{rotulo}</Rotulo>
          <select
            id={campoId}
            className={cn(CONTROLE, 'cursor-pointer appearance-none')}
            aria-invalid={erro ? true : undefined}
            aria-describedby={descritoPor}
            required={obrigatorio}
            {...resto}
          >
            {children}
          </select>
        </span>
        {/*
          `appearance-none` tira a setinha nativa junto com o resto do estilo do
          sistema. Sem ela, um select fica visualmente igual a um campo de texto
          — e a pessoa clica esperando digitar.
        */}
        <ChevronDown className="size-4 shrink-0 text-ink-mute" aria-hidden />
      </label>
      {descricao}
    </div>
  )
}

type CampoSenhaProps = BaseProps &
  Omit<InputHTMLAttributes<HTMLInputElement>, 'className' | 'type'> & {
    /** Mostra o medidor de força. Só faz sentido ao **criar** uma senha. */
    medidor?: boolean
    value: string
  }

/**
 * Senha com olho e medidor.
 *
 * O olho existe porque a alternativa real não é "senha secreta" — é a pessoa
 * digitando errado três vezes num teclado de celular e desistindo. Ele começa
 * fechado, e o `aria-pressed` conta o estado para quem usa leitor de tela.
 *
 * O medidor **aconselha, não reprova**: ele nunca desabilita o botão. Quem
 * decide o que entra é a regra do servidor (ver `lib/senha.ts`).
 */
export function CampoSenha({
  rotulo,
  ajuda,
  erro,
  className,
  id,
  medidor,
  value,
  ...resto
}: CampoSenhaProps) {
  const gerado = useId()
  const campoId = id ?? gerado
  const [visivel, setVisivel] = useState(false)
  const forca = medidor ? forcaSenha(value) : null
  const dicaId = `${campoId}-forca`

  const { descricao, descritoPor } = usarDescricao(campoId, ajuda, erro, forca ? dicaId : undefined)

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <div className={cn(CAIXA, 'items-center gap-2', erro ? 'border-warn' : 'border-line')}>
        <label htmlFor={campoId} className="flex min-w-0 flex-1 flex-col">
          <span className={ROTULO}>{rotulo}</span>
          <input
            id={campoId}
            type={visivel ? 'text' : 'password'}
            value={value}
            className={CONTROLE}
            aria-invalid={erro ? true : undefined}
            aria-describedby={descritoPor}
            {...resto}
          />
        </label>
        <button
          type="button"
          onClick={() => setVisivel((v) => !v)}
          aria-pressed={visivel}
          aria-label={visivel ? 'Ocultar senha' : 'Mostrar senha'}
          className="grid size-9 shrink-0 place-items-center rounded-pill text-ink-mute transition-colors duration-[var(--dur-fast)] hover:bg-paper-2 hover:text-indigo"
        >
          {visivel ? <EyeOff className="size-5" aria-hidden /> : <Eye className="size-5" aria-hidden />}
        </button>
      </div>

      {forca && (
        <div id={dicaId} className="flex items-center gap-2 px-1">
          <span className="flex flex-1 gap-1" aria-hidden>
            {[1, 2, 3, 4].map((barra) => (
              <span
                key={barra}
                className={cn(
                  'h-1 flex-1 rounded-pill transition-colors duration-[var(--dur-base)]',
                  barra <= forca.nivel ? CORES_FORCA[forca.nivel] : 'bg-paper-3',
                )}
              />
            ))}
          </span>
          <span className="shrink-0 text-xs text-ink-mute">{value ? forca.rotulo : ''}</span>
        </div>
      )}
      {forca && value.length > 0 && !erro && <p className="px-1 text-xs text-ink-mute">{forca.dica}</p>}
      {descricao}
    </div>
  )
}

const CORES_FORCA: Record<number, string> = {
  0: 'bg-paper-3',
  1: 'bg-warn',
  2: 'bg-warn',
  3: 'bg-[var(--color-lilas)]',
  4: 'bg-success',
}

interface CaixaAceiteProps {
  checked: boolean
  onChange: (valor: boolean) => void
  children: ReactNode
  erro?: string
  id?: string
}

/**
 * O aceite dos termos.
 *
 * Nunca vem pré-marcado, e isso não é detalhe de estilo: um consentimento que
 * já veio marcado não é consentimento — é uma caixa que a pessoa não viu.
 */
export function CaixaAceite({ checked, onChange, children, erro, id }: CaixaAceiteProps) {
  const gerado = useId()
  const campoId = id ?? gerado
  const erroId = `${campoId}-erro`

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={campoId} className="flex cursor-pointer items-start gap-3 rounded-lg p-1">
        <input
          id={campoId}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          aria-invalid={erro ? true : undefined}
          aria-describedby={erro ? erroId : undefined}
          className={cn(
            'mt-0.5 size-5 shrink-0 cursor-pointer rounded-sm border accent-[var(--color-lilas)]',
            erro ? 'border-warn' : 'border-line',
          )}
        />
        <span className="text-sm leading-snug text-ink-soft">{children}</span>
      </label>
      {erro && (
        <p id={erroId} role="alert" className="px-1 text-xs font-semibold text-warn-ink">
          {erro}
        </p>
      )}
    </div>
  )
}

/**
 * Ajuda e erro dividem o mesmo `aria-describedby`. O erro vem primeiro na lista
 * porque é o que precisa ser lido primeiro.
 */
function usarDescricao(campoId: string, ajuda: ReactNode, erro?: string, extraId?: string) {
  const ajudaId = `${campoId}-ajuda`
  const erroId = `${campoId}-erro`
  const ids = [erro && erroId, ajuda && ajudaId, extraId].filter(Boolean).join(' ')

  return {
    descritoPor: ids || undefined,
    descricao: (
      <>
        {erro && (
          <p id={erroId} role="alert" className="px-1 text-xs font-semibold text-warn-ink">
            {erro}
          </p>
        )}
        {ajuda && !erro && (
          <p id={ajudaId} className="px-1 text-xs text-ink-mute">
            {ajuda}
          </p>
        )}
      </>
    ),
  }
}
