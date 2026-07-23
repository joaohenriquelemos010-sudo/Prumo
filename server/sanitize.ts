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
