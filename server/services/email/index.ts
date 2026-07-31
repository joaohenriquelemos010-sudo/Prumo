import { env } from '../../env.js'

export interface Mensagem {
  para: string
  assunto: string
  html: string
  texto: string
  /** `List-Unsubscribe` e afins. Ver `enviar()`. */
  cabecalhos?: Record<string, string>
}

export interface ResultadoEnvio {
  entregue: boolean
  /** `noop` enquanto o SMTP não estiver configurado. */
  transporte: 'smtp' | 'noop'
  erro?: string
}

/**
 * A saída de e-mail do Prumo.
 *
 * **Hoje ela está encostada de propósito.** Sem `SMTP_HOST` configurado, o
 * transporte é o `noop`: a mensagem é montada, passa por toda a política, é
 * registrada como enviada e **não sai**. Isso é intencional — dá para exercitar
 * o motor inteiro, ver o que seria mandado e para quem, sem risco de escrever
 * para uma paciente antes de o remetente e o domínio estarem prontos.
 *
 * Ligar é preencher as variáveis de ambiente. Nenhuma linha de código muda.
 */
export async function enviar(mensagem: Mensagem): Promise<ResultadoEnvio> {
  if (!env.SMTP_HOST) {
    console.info(
      `[email:noop] para=${mensagem.para} assunto="${mensagem.assunto}" (SMTP não configurado)`,
    )
    return { entregue: false, transporte: 'noop' }
  }

  // Importado só quando há SMTP: o nodemailer não entra no caminho de nenhuma
  // requisição enquanto o envio estiver desligado.
  const { enviarPorSmtp } = await import('./smtp.js')
  return enviarPorSmtp(mensagem)
}

/** O envio está ligado? Usado pela UI para não prometer o que não acontece. */
export function envioAtivo(): boolean {
  return Boolean(env.SMTP_HOST)
}
