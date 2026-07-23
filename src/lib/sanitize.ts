import DOMPurify from 'dompurify'

/**
 * Sanitisation helpers. Any string that will be rendered — even ones the user
 * typed themselves — passes through here first. React escapes text nodes by
 * default, but the moment we touch `dangerouslySetInnerHTML`, tooltips built
 * from data, or copy assembled from user input, DOMPurify is the backstop.
 */

/** Strip every tag — use for names, plain fields, anything shown as text. */
export function sanitizeText(value: string): string {
  return DOMPurify.sanitize(value, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] }).trim()
}

/** Allow a tiny, safe subset for rich notes (no scripts, no event handlers). */
export function sanitizeRichText(value: string): string {
  return DOMPurify.sanitize(value, {
    ALLOWED_TAGS: ['b', 'strong', 'em', 'br', 'p', 'ul', 'ol', 'li'],
    ALLOWED_ATTR: [],
  })
}

/** Collapse whitespace and clamp length — defensive for free-text inputs. */
export function normalizeField(value: string, maxLength = 240): string {
  return sanitizeText(value).replace(/\s+/g, ' ').slice(0, maxLength)
}
