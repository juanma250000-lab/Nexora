import { REFRESH_MS } from './constants';

/** Upper bound for every automatic retry so a third-party API is never hammered. */
export const RETRY_MAX_MS = 5 * 60 * 1000;

/**
 * Reads the `Retry-After` response header.
 * CoinGecko answers `429` either with a delay in seconds or with an HTTP date.
 *
 * @param {string|null} value raw header value
 * @param {number} now epoch milliseconds used to resolve date based values
 * @returns {number|null} delay in milliseconds, or null when unusable
 */
export function parseRetryAfter(value, now = Date.now()) {
  if (value == null) return null;
  const raw = String(value).trim();
  if (raw === '') return null;
  if (/^\d+$/.test(raw)) return Number(raw) * 1000;
  const date = Date.parse(raw);
  if (Number.isNaN(date)) return null;
  return Math.max(0, date - now);
}

/**
 * Exponential backoff that never runs faster than the regular polling
 * interval and never slower than `maxMs`. A `Retry-After` value from the
 * server acts as a floor, not as an override.
 *
 * attempt 1 -> 30 s, 2 -> 60 s, 3 -> 120 s, 4 -> 240 s, 5+ -> 300 s (cap)
 */
export function nextRetryDelay({
  attempt = 1,
  retryAfterMs = null,
  baseMs = REFRESH_MS,
  maxMs = RETRY_MAX_MS,
} = {}) {
  const exponent = Math.max(0, Math.min(attempt, 20) - 1);
  const backoff = Math.min(baseMs * 2 ** exponent, maxMs);
  const server =
    Number.isFinite(retryAfterMs) && retryAfterMs > 0 ? retryAfterMs : 0;
  return Math.min(Math.max(backoff, server), maxMs);
}

/**
 * Human readable copy for each failure reason, in Spanish.
 * The UI must never claim "check your connection" when the provider is
 * simply rate limiting us.
 */
export const MARKET_ERROR_MESSAGES = {
  limitado: 'La fuente de datos está limitando las consultas temporales.',
  servidor: 'La fuente de datos no está disponible en este momento.',
  rechazado: 'La fuente de datos rechazó la solicitud.',
  vacio: 'La fuente de datos no devolvió cotizaciones.',
  pagina: 'Esa página de activos ya no existe en la fuente de respaldo.',
  'sin-conexion': 'No pudimos conectar con el mercado. Revisa tu conexión y vuelve a intentar.',
};
