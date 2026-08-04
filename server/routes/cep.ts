import { Router } from 'express'
import { rateLimit } from '../rate-limit.js'

export const cepRouter = Router()

/**
 * Consulta de CEP — o Prumo na frente do ViaCEP.
 *
 * O caminho óbvio seria o navegador falar direto com o ViaCEP. Duas razões
 * concretas contra:
 *
 * 1. **A CSP.** `connect-src 'self'` é o que impede uma dependência
 *    comprometida de exfiltrar dado de saúde para um domínio qualquer. Abrir
 *    uma exceção para o ViaCEP enfraquece a regra inteira para economizar um
 *    proxy de trinta linhas — a troca é péssima.
 * 2. **O que vaza no caminho.** Um `fetch` do navegador entrega o IP da
 *    paciente e o CEP dela a um terceiro. Saindo do servidor, quem aparece
 *    para o ViaCEP é o Prumo.
 *
 * O cache é o bônus: CEP muda com obra pública, não com o dia. Guardar em
 * memória evita repetir a mesma pergunta a cada paciente do mesmo bairro — e um
 * `Map` basta, porque perder o cache num cold start custa exatamente uma
 * consulta.
 */

interface EnderecoCep {
  logradouro: string
  complemento: string
  bairro: string
  cidade: string
  uf: string
}

const cache = new Map<string, EnderecoCep>()
/** Teto para o cache não virar vazamento de memória num processo longo. */
const MAX_CACHE = 5000
const TIMEOUT_MS = 5000

cepRouter.get(
  '/:cep',
  // Público: a página de pré-cadastro não tem sessão. O limite é por IP e
  // generoso o bastante para uma recepção inteira na mesma rede.
  rateLimit({ key: 'cep', limit: 60, windowMs: 60_000 }),
  async (req, res) => {
    const cep = String(req.params.cep).replace(/\D/g, '')
    if (cep.length !== 8) {
      res.status(400).json({ error: 'O CEP tem 8 dígitos.' })
      return
    }

    const emCache = cache.get(cep)
    if (emCache) {
      res.json({ endereco: emCache })
      return
    }

    try {
      const resposta = await fetch(`https://viacep.com.br/ws/${cep}/json/`, {
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })
      if (!resposta.ok) {
        res.status(404).json({ error: 'CEP não encontrado. Confere os números?' })
        return
      }

      const dados = (await resposta.json()) as Record<string, string | boolean | undefined>
      // O ViaCEP responde 200 com `{ erro: true }` para CEP inexistente.
      if (dados.erro) {
        res.status(404).json({ error: 'CEP não encontrado. Confere os números?' })
        return
      }

      const endereco: EnderecoCep = {
        logradouro: String(dados.logradouro ?? ''),
        complemento: String(dados.complemento ?? ''),
        bairro: String(dados.bairro ?? ''),
        cidade: String(dados.localidade ?? ''),
        uf: String(dados.uf ?? '').toUpperCase(),
      }

      if (cache.size >= MAX_CACHE) cache.clear()
      cache.set(cep, endereco)
      res.json({ endereco })
    } catch {
      /*
       * Fora do ar, tempo esgotado, rede bloqueada — todos com a mesma
       * consequência para quem está preenchendo: digita o endereço na mão. O
       * 503 diz "tenta de novo", e não "esse CEP não existe", que é o que um
       * 404 aqui faria a tela mentir.
       */
      res.status(503).json({ error: 'Não consegui buscar o CEP agora. Dá para preencher à mão.' })
    }
  },
)
