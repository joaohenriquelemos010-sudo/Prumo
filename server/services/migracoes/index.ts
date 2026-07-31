import { Migracao } from '../../models/Migracao.js'
import { up as up001 } from './001-solicitacoes-para-agendamentos.js'
import { up as up002 } from './002-programa-em-jornadas.js'
import { up as up003 } from './003-eventos-para-evolucoes.js'
import { up as up004 } from './004-semear-checklists.js'

/**
 * Runner de migrações.
 *
 * Mongoose schemas são o schema deste projeto — não há DDL. Mas mover documentos
 * existentes ainda precisa de ordem, de registro e de garantia de execução única,
 * e é isso que este arquivo dá.
 *
 * Duas propriedades sustentam tudo:
 *
 * 1. **Claim atômico.** O `_id` da migração é o nome dela, então reivindicar é um
 *    `findOneAndUpdate` com upsert. Dois cold starts serverless simultâneos
 *    disputam o mesmo documento e exatamente um ganha; o perdedor leva E11000 e
 *    segue em frente.
 * 2. **Lease com expiração.** Um processo que morre no meio deixa a migração
 *    `rodando` para sempre. Por isso um `rodando` mais velho que JANELA_TRAVA_MS
 *    é reivindicável de novo — o que exige que todo `up()` seja idempotente, e
 *    eles são.
 *
 * A lista é ordenada e a execução para no primeiro erro: rodar a migração
 * seguinte sobre um estado parcial é pior do que não rodar nada.
 */

interface Migracion {
  nome: string
  up: () => Promise<void>
}

/** Ordem importa. Nunca reordenar nem renomear uma entrada já publicada. */
const MIGRACOES: Migracion[] = [
  { nome: '001-solicitacoes-para-agendamentos', up: up001 },
  { nome: '002-programa-em-jornadas', up: up002 },
  { nome: '003-eventos-para-evolucoes', up: up003 },
  { nome: '004-semear-checklists', up: up004 },
]

/**
 * Depois disso, um `rodando` é considerado abandonado. Generoso de propósito: uma
 * migração lenta que ainda está viva não pode ser roubada por outro processo.
 */
const JANELA_TRAVA_MS = 10 * 60 * 1000

async function reivindicar(nome: string): Promise<boolean> {
  const limite = new Date(Date.now() - JANELA_TRAVA_MS)
  try {
    const doc = await Migracao.findOneAndUpdate(
      {
        _id: nome,
        // Nunca casa com `aplicada` — é o que impede a segunda execução.
        $or: [{ estado: 'falhou' }, { estado: 'rodando', iniciadaEm: { $lt: limite } }],
      },
      { $set: { estado: 'rodando', iniciadaEm: new Date(), erro: '' } },
      { upsert: true, returnDocument: 'after' },
    )
    return Boolean(doc)
  } catch (err) {
    // E11000 = o documento existe e não casou com o filtro. Ou já está aplicada,
    // ou outro processo reivindicou primeiro. Nos dois casos: não é nossa.
    if ((err as { code?: number }).code === 11000) return false
    throw err
  }
}

export async function runMigracoes(): Promise<void> {
  for (const { nome, up } of MIGRACOES) {
    if (!(await reivindicar(nome))) continue

    try {
      await up()
      await Migracao.updateOne(
        { _id: nome },
        { $set: { estado: 'aplicada', aplicadaEm: new Date(), erro: '' } },
      )
      console.info(`[migracao] ${nome} aplicada.`)
    } catch (err) {
      const mensagem = err instanceof Error ? err.message : String(err)
      await Migracao.updateOne(
        { _id: nome },
        { $set: { estado: 'falhou', erro: mensagem.slice(0, 500) } },
      )
      console.error(`[migracao] ${nome} falhou:`, err)
      return
    }
  }
}
