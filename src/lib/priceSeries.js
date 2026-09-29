/**
 * Seven-day daily price series from Binance.
 *
 * CoinGecko ships a sparkline with every market row, but the app regularly
 * runs on the fallback source (Coinpaprika), which publishes no history at
 * all - that is why the detail panel used to render "Gráfico en preparación".
 *
 * Binance publishes daily candles for every listed pair, with CORS enabled,
 * without a key and without an aggressive rate limit, so the big charts can
 * keep showing real data. Nothing here ever throws: a missing chart must
 * degrade to an empty state, never break the panel.
 */

const KLINES_ENDPOINT = 'https://api.binance.com/api/v3/klines';

/** Daily candles requested (seven days plus the live one). */
export const SERIES_POINTS = 8;

/**
 * Maximum accepted deviation between the pair's last close and the price the
 * app already displays. A `{SYMBOL}USDT` pair can exist while belonging to a
 * completely different asset, and that would draw a wrong chart in silence.
 */
export const PRICE_TOLERANCE = 0.25;

/** Binance kline rows are arrays whose index 4 holds the close price. */
export function parseKlines(rows) {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row) => Number(Array.isArray(row) ? row[4] : row?.close))
    .filter((value) => Number.isFinite(value) && value > 0);
}

/**
 * True when the series actually tracks the coin we are drawing.
 *
 * @param {number[]} closes daily closes in USD
 * @param {number} usdPrice the same asset's price in USD
 */
export function matchesPrice(closes, usdPrice, tolerance = PRICE_TOLERANCE) {
  if (!Array.isArray(closes) || closes.length === 0) return false;
  if (!Number.isFinite(usdPrice) || usdPrice <= 0) return false;
  const last = closes[closes.length - 1];
  if (!Number.isFinite(last) || last <= 0) return false;
  return Math.abs(last - usdPrice) / usdPrice <= tolerance;
}

/**
 * Daily closes (USD) for `{SYMBOL}USDT`.
 *
 * Returns `null` for pairs Binance does not list, for rate limits and for
 * network failures alike - the caller only needs to know "no series".
 */
export async function requestDailyCloses(symbol, signal) {
  const ticker = String(symbol || '').trim().toUpperCase();
  if (!ticker || !/^[A-Z0-9.:-]+$/.test(ticker)) return null;

  const url =
    `${KLINES_ENDPOINT}?symbol=${encodeURIComponent(`${ticker}USDT`)}` +
    `&interval=1d&limit=${SERIES_POINTS}`;

  try {
    const response = await fetch(url, { signal });
    if (!response.ok) return null;
    const closes = parseKlines(await response.json());
    return closes.length >= 2 ? closes : null;
  } catch {
    // Includes aborted requests and offline browsers: never surface a chart
    // failure as an application error.
    return null;
  }
}
