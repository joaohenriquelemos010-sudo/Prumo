import { somenteDigitos } from '@/lib/br-docs'
import type { Endereco } from './paciente'

/**
 * Busca de endereço por CEP.
 *
 * Digitar oito dígitos e receber rua, bairro, cidade e estado preenchidos é a
 * diferença entre um endereço completo e um endereço abreviado às pressas — e
 * endereço abreviado é o que faz a correspondência do convênio voltar.
 *
 * A consulta vai para o **próprio servidor** (`GET /api/cep/:cep`), que fala com
 * o ViaCEP e devolve já normalizado. Falar direto do navegador exigiria abrir a
 * `connect-src` da CSP para um domínio externo — a regra que impede uma
 * dependência comprometida de mandar dado de saúde para fora — e entregaria o IP
 * da paciente a um terceiro. Ver `server/routes/cep.ts`.
 *
 * Falhar é silencioso: se o serviço estiver fora, os campos continuam
 * editáveis e a pessoa digita a rua. Uma busca de conveniência que vira bloqueio
 * é pior do que não existir.
 */

export interface ResultadoCep {
  achou: boolean
  /** Só os campos que o serviço conhece — número segue em branco. */
  endereco?: Pick<Endereco, 'logradouro' | 'bairro' | 'cidade' | 'uf' | 'complemento'>
  erro?: string
}

const TIMEOUT_MS = 7000

export function cepCompleto(valor: string): boolean {
  return somenteDigitos(valor).length === 8
}

export async function buscarCep(valor: string): Promise<ResultadoCep> {
  const cep = somenteDigitos(valor)
  if (cep.length !== 8) return { achou: false }

  const controlador = new AbortController()
  const timer = setTimeout(() => controlador.abort(), TIMEOUT_MS)

  try {
    /*
     * `fetch` direto, e não o cliente de API: a página pública de pré-cadastro
     * usa a mesma busca e não tem sessão nenhuma para oferecer. E um 404 aqui é
     * resposta legítima ("esse CEP não existe"), não erro de aplicação.
     */
    const resposta = await fetch(`/api/cep/${cep}`, { signal: controlador.signal })
    if (resposta.status === 404) {
      return { achou: false, erro: 'CEP não encontrado. Confere os números?' }
    }
    if (!resposta.ok) return { achou: false }

    const dados = (await resposta.json()) as { endereco?: ResultadoCep['endereco'] }
    if (!dados.endereco) return { achou: false }
    return { achou: true, endereco: dados.endereco }
  } catch {
    // Offline, tempo esgotado, bloqueado por extensão — todos com a mesma
    // consequência: preenche na mão.
    return { achou: false }
  } finally {
    clearTimeout(timer)
  }
}
