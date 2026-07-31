import nodemailer from 'nodemailer'
import type { Transporter } from 'nodemailer'
import { env } from '../../env.js'
import type { Mensagem, ResultadoEnvio } from './index.js'

/**
 * O transporte SMTP.
 *
 * Só é carregado quando `SMTP_HOST` existe (ver `email/index.ts`), então
 * enquanto o envio estiver encostado este módulo nunca entra em memória.
 *
 * O transporter é guardado em `globalThis` pelo mesmo motivo da conexão do
 * Mongo: em serverless o módulo é reavaliado entre invocações enquanto o
 * processo continua vivo, e abrir um pool SMTP por requisição esgota o limite
 * de conexões do provedor rapidinho.
 */
const cacheGlobal = globalThis as unknown as { __prumoSmtp?: Transporter }

function transporter(): Transporter {
  if (cacheGlobal.__prumoSmtp) return cacheGlobal.__prumoSmtp

  cacheGlobal.__prumoSmtp = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    // 465 é TLS implícito; 587 sobe por STARTTLS.
    secure: env.SMTP_PORT === 465,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
    pool: true,
    maxConnections: 3,
  })

  return cacheGlobal.__prumoSmtp
}

export async function enviarPorSmtp(mensagem: Mensagem): Promise<ResultadoEnvio> {
  try {
    await transporter().sendMail({
      from: env.SMTP_FROM,
      to: mensagem.para,
      subject: mensagem.assunto,
      text: mensagem.texto,
      html: mensagem.html,
      headers: mensagem.cabecalhos,
    })
    return { entregue: true, transporte: 'smtp' }
  } catch (err) {
    return {
      entregue: false,
      transporte: 'smtp',
      erro: err instanceof Error ? err.message : String(err),
    }
  }
}
