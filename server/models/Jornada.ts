/**
 * `Jornada` é o nome geral do que hoje se chama `Crianca`.
 *
 * Um alias, não um model novo — e essa é a decisão inteira. Renomear a collection
 * significaria migrar todo documento e toda `ref` do projeto de uma vez, sem
 * ganho funcional. Em vez disso o vocabulário novo entra por aqui, e o código
 * novo é escrito em termos de jornada enquanto o banco segue falando `Crianca`.
 *
 * Regra para quem escrever model novo: referencie como
 * `{ jornada: { type: ObjectId, ref: 'Crianca' } }` — nome novo, ref antiga.
 */
export { Crianca as Jornada } from './Crianca.js'
export type { CriancaDoc as JornadaDoc } from './Crianca.js'
