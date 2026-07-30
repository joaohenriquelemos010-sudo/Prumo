/**
 * Camada de compatibilidade sobre `services/jornada.ts`.
 *
 * A lógica de acesso mudou de casa (e de vocabulário: `Crianca` → `Jornada`), mas
 * as ~15 rotas que importam daqui não têm motivo para saber disso. Elas seguem
 * compilando sem uma linha de diferença, e migram para `jornada.js` no ritmo em
 * que forem editadas por outro motivo — nunca numa refatoração de um commit só.
 *
 * Código novo deve importar de `services/jornada.js`.
 */
export {
  resolveJornada as resolveCrianca,
  resolveJornadaOr403 as resolveCriancaOr403,
  programaDe,
} from './jornada.js'
