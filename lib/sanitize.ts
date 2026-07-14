import DOMPurify from 'dompurify';

const ALLOWED_TAGS = ['a', 'b', 'i', 'em', 'strong', 'span', 'br'];

/** Sanitizes remote Wiktionary HTML before it's set via dangerouslySetInnerHTML. */
export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR: ['href'],
  });
}

/** Strips all markup, for compact text-only display (quiz options, list previews). */
export function stripToText(html: string): string {
  return DOMPurify.sanitize(html, { ALLOWED_TAGS: [] }).trim();
}
