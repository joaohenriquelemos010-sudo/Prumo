/**
 * Server-side text normalisation. We don't run a DOM here, so instead of
 * DOMPurify we strip anything tag-like, collapse whitespace and clamp length.
 * Stored text is rendered by React on the client (which escapes by default), so
 * this is defence in depth against stored markup, not the only line.
 */
export function normalizeField(value: string, maxLength = 240): string {
  return value
    .replace(/<[^>]*>/g, '') // drop tag-like sequences
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength)
}

/**
 * Same defence, but keeps the line breaks.
 *
 * `normalizeField` colapsa `\s+` num espaço só, o que está certo para um nome ou
 * um título e está errado para uma nota clínica: um SOAP digitado em parágrafos
 * chegava ao banco como um bloco corrido. Aqui as quebras sobrevivem — no máximo
 * duas seguidas, para que ninguém empurre a próxima seção da tela com trinta
 * enters — e o resto do espaçamento horizontal ainda é normalizado.
 */
export function normalizeTexto(value: string, maxLength = 3000): string {
  return value
    .replace(/<[^>]*>/g, '')
    .replace(/\r\n?/g, '\n')
    .replace(/[^\S\n]+/g, ' ') // espaço horizontal colapsa; \n não
    .replace(/\n{3,}/g, '\n\n')
    .split('\n')
    .map((linha) => linha.trim())
    .join('\n')
    .trim()
    .slice(0, maxLength)
}
