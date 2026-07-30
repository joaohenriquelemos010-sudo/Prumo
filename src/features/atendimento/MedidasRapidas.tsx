import { useMemo } from 'react'
import type { Medidas, TipoConsulta } from './tipos'
import { cn } from '@/lib/cn'

interface CampoMedida {
  chave: keyof Medidas
  rotulo: string
  placeholder: string
  /** Faixa de normalidade, só para o chip de contexto. Nunca bloqueia digitação. */
  esperado?: [number, number]
}

const CAMPOS_GESTANTE: CampoMedida[] = [
  { chave: 'pesoKg', rotulo: 'Peso (kg)', placeholder: '68,4' },
  { chave: 'paSistolica', rotulo: 'PA sist.', placeholder: '120', esperado: [90, 139] },
  { chave: 'paDiastolica', rotulo: 'PA diast.', placeholder: '80', esperado: [60, 89] },
  { chave: 'alturaUterinaCm', rotulo: 'Altura uterina (cm)', placeholder: '28' },
  { chave: 'bcfBpm', rotulo: 'BCF (bpm)', placeholder: '140', esperado: [110, 160] },
]

const CAMPOS_CRIANCA: CampoMedida[] = [
  { chave: 'pesoKg', rotulo: 'Peso (kg)', placeholder: '6,8' },
  { chave: 'comprimentoCm', rotulo: 'Comprimento (cm)', placeholder: '63' },
  { chave: 'perimetroCefalicoCm', rotulo: 'Perímetro cefálico (cm)', placeholder: '42' },
]

/** Aceita vírgula, que é como se digita número em português. */
function paraNumero(v: string): number | null {
  const limpo = v.replace(',', '.').trim()
  if (limpo === '') return null
  const n = Number(limpo)
  return Number.isFinite(n) ? n : null
}

/**
 * As medidas, em grade compacta.
 *
 * Números e não texto livre: "6,8 kg" lê bem e nunca vira curva. É daqui que
 * saem o gráfico de crescimento e a checagem automática de padrão.
 *
 * O chip ao lado do campo aparece **enquanto se digita** — a médica vê que 170
 * de sistólica está fora da faixa antes de sair do campo, não depois de salvar.
 */
export function MedidasRapidas({
  tipo,
  valores,
  onChange,
}: {
  tipo: TipoConsulta
  valores: Record<string, string>
  onChange: (chave: string, valor: string) => void
}) {
  const campos = useMemo(() => (tipo === 'pediatrica' ? CAMPOS_CRIANCA : CAMPOS_GESTANTE), [tipo])

  return (
    <div>
      <h3 className="u-eyebrow mb-2">Medidas</h3>
      <div className="grid grid-cols-2 gap-2">
        {campos.map((c) => {
          const bruto = valores[c.chave as string] ?? ''
          const n = paraNumero(bruto)
          const fora = c.esperado && n !== null && (n < c.esperado[0] || n > c.esperado[1])

          return (
            <div key={c.chave as string}>
              <label className="block text-xs text-ink-mute" htmlFor={`medida-${c.chave}`}>
                {c.rotulo}
              </label>
              <input
                id={`medida-${c.chave}`}
                value={bruto}
                onChange={(e) => onChange(c.chave as string, e.target.value)}
                inputMode="decimal"
                placeholder={c.placeholder}
                className={cn('input mt-1', fora && 'border-warn')}
              />
              {fora && (
                <p className="mt-1 text-xs text-warn-ink">
                  Esperado {c.esperado![0]}–{c.esperado![1]}
                </p>
              )}
            </div>
          )
        })}
      </div>
      <p className="mt-2 text-xs text-ink-mute">
        Viram curva de crescimento e checagem automática de padrão.
      </p>
    </div>
  )
}
