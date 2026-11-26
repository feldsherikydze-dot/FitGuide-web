/**
 * UUID v4 для записей.
 *
 * `crypto.randomUUID()` появился в Safari 15.4 (март 2022) и в старых
 * Android WebView его нет — там приложение падало бы на создании записи.
 * Свой генератор на `crypto.getRandomValues` даёт тот же формат RFC 4122.
 */
export function newId(): string {
  const c = typeof crypto !== 'undefined' ? (crypto as Crypto) : undefined;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();

  const bytes = new Uint8Array(16);
  if (c && typeof c.getRandomValues === 'function') {
    c.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // версия 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // вариант RFC 4122

  let hex = '';
  for (let i = 0; i < bytes.length; i += 1) hex += bytes[i].toString(16).padStart(2, '0');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
