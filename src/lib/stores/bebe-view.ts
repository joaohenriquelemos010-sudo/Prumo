import { create } from 'zustand'
import type { Granularidade } from '@/features/bebe/agregacao'

/**
 * Como a pessoa escolheu ler a evolução do bebê.
 *
 * Fica em `localStorage`, e isso é permitido justamente porque **não é dado de
 * saúde** — é preferência de interface, do mesmo tipo que tema claro/escuro.
 * A regra do produto continua valendo inteira: nenhuma medida, nenhuma data,
 * nenhum nome sai do servidor para o disco do navegador.
 *
 * Persistir importa mais do que parece. Quem escolhe "trimestre" escolhe porque
 * semana a semana é demais para o momento de vida dela; devolver a tela em
 * "semana" no próximo acesso desfaz a escolha e faz o produto parecer que não
 * escuta.
 */
const CHAVE = 'prumo.bebe.granularidade'

const VALIDAS: Granularidade[] = ['semana', 'mes', 'trimestre']

function ler(): Granularidade {
  try {
    const guardada = localStorage.getItem(CHAVE)
    // Valor desconhecido (versão antiga, alguém editando à mão) volta ao padrão
    // em vez de quebrar a tela com um bucket que não existe.
    if (guardada && VALIDAS.includes(guardada as Granularidade)) return guardada as Granularidade
  } catch {
    // localStorage indisponível (modo privado, storage cheio). Não é motivo
    // para a página não abrir.
  }
  return 'semana'
}

interface BebeViewState {
  granularidade: Granularidade
  setGranularidade: (g: Granularidade) => void
}

export const useBebeView = create<BebeViewState>((set) => ({
  granularidade: ler(),
  setGranularidade: (granularidade) => {
    set({ granularidade })
    try {
      localStorage.setItem(CHAVE, granularidade)
    } catch {
      // A escolha continua valendo nesta sessão mesmo sem conseguir gravar.
    }
  },
}))
