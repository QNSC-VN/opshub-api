/**
 * Strips dangerous HTML markup from string inputs (OWASP A03 — XSS prevention).
 * Regex-based, no external dependency. Applied before Zod validation.
 */
export function sanitizeString(input: string): string {
  return input
    .replace(/<\s*script[^>]*>.*?<\s*\/\s*script>/gis, '')
    .replace(/<\s*\/?(?:script|iframe|object|embed|form|input|textarea|style)\b[^>]*>/gis, '')
    .replace(/\bon\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gis, '')
    .trim();
}

export function sanitizeObject<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'string') {
      out[k] = sanitizeString(v);
    } else if (Array.isArray(v)) {
      out[k] = v.map((item) =>
        typeof item === 'string'
          ? sanitizeString(item)
          : item && typeof item === 'object' && item.constructor === Object
            ? sanitizeObject(item as Record<string, unknown>)
            : item,
      );
    } else if (v && typeof v === 'object' && v.constructor === Object) {
      out[k] = sanitizeObject(v as Record<string, unknown>);
    } else {
      out[k] = v;
    }
  }
  return out as T;
}
