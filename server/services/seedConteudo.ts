import { ChecklistTemplate } from '../models/ChecklistTemplate.js'
import { gestanteCompleto } from '../conteudo/checklists/gestante-completo.js'
import { puericulturaCompleto } from '../conteudo/checklists/puericultura-completo.js'
import type { TemplateSemente } from '../conteudo/checklists/tipos.js'

export const TEMPLATES: TemplateSemente[] = [gestanteCompleto, puericulturaCompleto]

/**
 * Publica o conteúdo de checklist no banco.
 *
 * Idempotente por `{chave, versao}`: rodar de novo atualiza a mesma linha em vez
 * de duplicar. **Corrigir um texto é editar o arquivo e deixar a versão** — o
 * conteúdo é substituído para todo mundo, e ninguém perde progresso, porque a
 * instância guarda só estado.
 *
 * Subir a `versao` é para quando os **ids** mudam (grupo ou passo renomeado,
 * removido, dividido). Aí o estado antigo deixa de casar, e uma versão nova é o
 * que impede uma paciente de ver seus itens marcados desaparecerem sem
 * explicação.
 */
export async function seedConteudo(): Promise<void> {
  for (const t of TEMPLATES) {
    await ChecklistTemplate.updateOne(
      { chave: t.chave, versao: t.versao },
      {
        $set: {
          programa: t.programa,
          publico: t.publico,
          fase: t.fase ?? '',
          origem: 'prumo',
          titulo: t.titulo,
          descricao: t.descricao ?? '',
          icone: t.icone ?? 'lista',
          grupos: t.grupos.map((g) => ({
            id: g.id,
            titulo: g.titulo,
            resumo: g.resumo ?? '',
            explicacaoLeiga: g.explicacaoLeiga,
            porqueImporta: g.porqueImporta ?? '',
            fonte: g.fonte ?? '',
            icone: g.icone ?? 'circulo',
            janela: g.janela ?? {},
            lembrete: g.lembrete ?? {},
            passos: g.passos.map((p) => ({
              id: p.id,
              titulo: p.titulo,
              explicacaoLeiga: p.explicacaoLeiga ?? '',
              dica: p.dica ?? '',
              opcional: p.opcional ?? false,
            })),
          })),
        },
      },
      { upsert: true },
    )
  }
}
