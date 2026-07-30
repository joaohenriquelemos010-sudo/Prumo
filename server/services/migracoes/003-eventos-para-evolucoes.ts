import { Prontuario } from '../../models/Prontuario.js'
import { Evolucao } from '../../models/Evolucao.js'
import { registrar } from '../evolucao.js'

/**
 * Leva os `Prontuario.eventos[]` embutidos para a coleção `Evolucao`.
 *
 * O campo antigo era um array de subdocumentos editáveis — que é exatamente o
 * que um prontuário não pode ser. A história existente não se perde: ela é
 * reencadeada, em ordem cronológica, preservando data, autor e texto originais.
 *
 * `metadados.eventoLegadoId` guarda o `_id` do subdocumento antigo. É o que
 * torna a migração idempotente (um evento já migrado não migra de novo) e o que
 * permite auditar depois de onde cada entrada veio.
 *
 * O campo `eventos[]` NÃO é apagado. Ele congela: nada mais escreve nele, e o
 * serializer continua lendo por um release para que nenhuma tela fique vazia no
 * meio de um deploy.
 */
export async function up(): Promise<void> {
  const prontuarios = await Prontuario.find({ 'eventos.0': { $exists: true } })

  for (const prontuario of prontuarios) {
    // Ordem cronológica: a cadeia tem que refletir a sequência real dos fatos,
    // não a ordem em que os subdocumentos foram parar no array.
    const eventos = [...prontuario.eventos].sort(
      (a, b) => new Date(a.data ?? 0).getTime() - new Date(b.data ?? 0).getTime(),
    )

    for (const evento of eventos) {
      const legadoId = String(evento._id)

      const jaMigrado = await Evolucao.exists({
        jornada: prontuario.crianca,
        'metadados.eventoLegadoId': legadoId,
      })
      if (jaMigrado) continue

      await registrar(prontuario.crianca, {
        tipo: 'evolucao',
        autorId: evento.autorId ?? '',
        autorNome: evento.autorNome ?? '',
        autorPapel: evento.autorPapel ?? '',
        texto: evento.texto ?? '',
        em: evento.data ? new Date(evento.data) : new Date(),
        metadados: { eventoLegadoId: legadoId, origemMigracao: '003' },
      })
    }
  }
}
