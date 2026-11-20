/**
 * Sanitizes rich HTML snippets produced by the admin description editor or product catalog
 * before rendering via dangerouslySetInnerHTML. Strips executable tags, event handlers,
 * and unsafe URI schemes while preserving clean editorial formatting.
 */
export function sanitizeHtml(raw?: string | null): string {
  if (!raw) return '';
  let clean = String(raw);

  // Strip dangerous container tags and their contents
  clean = clean.replace(/<(script|style|iframe|object|embed|form|input|button|textarea|select|meta|link|base)[^>]*>[\s\S]*?<\/\1>/gi, '');
  clean = clean.replace(/<(script|style|iframe|object|embed|form|input|button|textarea|select|meta|link|base)[^>]*\/?>/gi, '');

  // Strip inline event handlers (onclick, onerror, onload, etc.)
  clean = clean.replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');

  // Strip javascript:, data:text/html, vbscript: URLs
  clean = clean.replace(/(href|src)\s*=\s*(["'])\s*(?:javascript|vbscript|data:text\/html)[^"']*\2/gi, '$1="#"');

  return clean.trim();
}

export function stripHtml(raw?: string | null): string {
  if (!raw) return '';
  return String(raw)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalizes Nigerian phone/WhatsApp number (e.g. 07051959290 -> 2347051959290)
 * and builds an official https://wa.me/... URL with optional encoded message.
 */
export function normalizeWhatsAppDigits(phone?: string | null): string {
  const fallback = '2347051959290';
  if (!phone) return fallback;
  const digits = phone.replace(/\D/g, '');
  if (!digits) return fallback;
  if (digits.startsWith('234') && digits.length >= 12) return digits;
  if (digits.startsWith('0') && digits.length === 11) return `234${digits.slice(1)}`;
  if (digits.length === 10 && /^[789]/.test(digits)) return `234${digits}`;
  return digits;
}

export function buildWhatsAppUrl(phone?: string | null, message?: string): string {
  const digits = normalizeWhatsAppDigits(phone);
  const base = `https://wa.me/${digits}`;
  if (!message || !message.trim()) return base;
  return `${base}?text=${encodeURIComponent(message.trim())}`;
}

export function buildProductWhatsAppUrl(
  phone: string | undefined | null,
  productName: string,
  productUrl?: string
): string {
  const resolvedUrl =
    productUrl || (typeof window !== 'undefined' ? window.location.href : '');
  const text = resolvedUrl
    ? `Hello Diamond Market, I am interested in ${productName}. Please provide more information. ${resolvedUrl}`
    : `Hello Diamond Market, I am interested in ${productName}. Please provide more information.`;
  return buildWhatsAppUrl(phone, text);
}
