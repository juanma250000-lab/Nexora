import { PAGE_SIZE } from './constants';
import { canonicalCoinId } from './coinAliases';
import { parseRetryAfter } from './retry';

const MARKET_ENDPOINT = 'https://api.coingecko.com/api/v3/coins/markets';
/**
 * Coinpaprika is used as an automatic fallback. The keyless CoinGecko tier is
 * shared per IP (~10-30 calls/min) and answers 403/429 when that budget is
 * exhausted, so the app must be able to keep rendering from another source.
 */
const FALLBACK_MARKET_ENDPOINT = 'https://api.coinpaprika.com/v1/tickers';
/**
 * Coinpaprika ignores `start`, so a page is obtained by over-fetching and
 * slicing, and it hard-caps the answer at 2000 tickers. Anything beyond
 * `FALLBACK_MAX_PAGE` genuinely does not exist and must never be requested:
 * the request would come back empty and look like a network outage.
 */
const FALLBACK_MAX_ROWS = 2000;
export const FALLBACK_MAX_PAGE = FALLBACK_MAX_ROWS / PAGE_SIZE;

const FX_ENDPOINT = 'https://open.er-api.com/v6/latest/USD';
const FALLBACK_FX_ENDPOINT =
  'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json';

/** Identifier of every market source the UI can be reading from. */
export const MARKET_SOURCES = {
  COINGECKO: 'coingecko',
  COINPAPRIKA: 'coinpaprika',
};

/**
 * Typed failure carrying everything the retry strategy needs:
 * `reason` drives the Spanish message and `retryAfterMs` the backoff floor.
 */
export class MarketApiError extends Error {
  constructor(
    message,
    {
      reason = 'sin-conexion',
      status = 0,
      retryAfterMs = null,
      source = null,
      maxPage = null,
      cause = null,
    } = {}
  ) {
    super(message);
    this.name = 'MarketApiError';
    this.reason = reason;
    this.status = status;
    this.retryAfterMs = retryAfterMs;
    this.source = source;
    this.maxPage = maxPage;
    this.cause = cause;
  }
}

/**
 * 403 (WAF block) and 429 (rate limit) mean "come back later"; every other
 * 5xx is a provider outage and any remaining 4xx is a request we must fix.
 * 503 is reported as an outage, although its `Retry-After` is still honoured.
 */
function reasonForStatus(status) {
  if (status === 403 || status === 429) return 'limitado';
  if (status >= 500) return 'servidor';
  return 'rechazado';
}

const isAbort = (error) => error?.name === 'AbortError';

/** Fetches and parses JSON, translating every failure into a MarketApiError. */
async function requestJson(url, { signal, source }) {
  let response;
  try {
    response = await fetch(url, { signal });
  } catch (error) {
    if (isAbort(error)) throw error;
    throw new MarketApiError('No se pudo contactar con la fuente de datos', {
      reason: 'sin-conexion',
      source,
      cause: error,
    });
  }

  if (!response.ok) {
    let retryAfterMs = null;
    try {
      retryAfterMs = parseRetryAfter(response.headers?.get?.('Retry-After'));
    } catch {
      /* headers are optional; the backoff still works without them */
    }
    throw new MarketApiError(`La fuente de datos respondió ${response.status}`, {
      reason: reasonForStatus(response.status),
      status: response.status,
      retryAfterMs,
      source,
    });
  }

  try {
    return await response.json();
  } catch (error) {
    if (isAbort(error)) throw error;
    throw new MarketApiError('La fuente de datos devolvió una respuesta ilegible', {
      reason: 'servidor',
      status: response.status,
      source,
      cause: error,
    });
  }
}

/* ------------------------------------------------------------------ *
 * USD -> COP
 * ------------------------------------------------------------------ */

/** Fetches the USD -> COP reference rate from the primary provider. */
export async function requestPrimaryRate(signal) {
  const data = await requestJson(FX_ENDPOINT, { signal, source: 'open-er-api' });
  if (data.result !== 'success' || !Number.isFinite(data.rates?.COP)) {
    throw new MarketApiError('No se recibió una tasa USD/COP válida', { reason: 'vacio' });
  }
  return Number(data.rates.COP);
}

/** Static CDN mirror of the daily reference rate (no rate limit, CORS enabled). */
export async function requestFallbackRate(signal) {
  const data = await requestJson(FALLBACK_FX_ENDPOINT, { signal, source: 'currency-api' });
  const rate = Number(data?.usd?.cop);
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new MarketApiError('No se recibió una tasa USD/COP válida', { reason: 'vacio' });
  }
  return rate;
}

/** USD -> COP rate, with an automatic fallback so the app never blocks on FX. */
export async function requestUsdCopRate(signal) {
  try {
    return await requestPrimaryRate(signal);
  } catch (primaryError) {
    if (isAbort(primaryError)) throw primaryError;
    try {
      return await requestFallbackRate(signal);
    } catch (fallbackError) {
      if (isAbort(fallbackError)) throw fallbackError;
      throw primaryError;
    }
  }
}

/* ------------------------------------------------------------------ *
 * Market
 * ------------------------------------------------------------------ */

/** Normalises a raw CoinGecko row into the shape the UI expects (prices in COP). */
export function mapMarketData(data, page, usdCopRate) {
  return data.map((coin, index) => ({
    id: coin.id,
    name: coin.name,
    symbol: String(coin.symbol || '').toUpperCase(),
    image: coin.image,
    rank: (page - 1) * PAGE_SIZE + index + 1,
    price: (Number(coin.current_price) || 0) * usdCopRate,
    change24h: Number(coin.price_change_percentage_24h) || 0,
    change7d: Number(coin.price_change_percentage_7d_in_currency) || 0,
    marketCap: (Number(coin.market_cap) || 0) * usdCopRate,
    volume: (Number(coin.total_volume) || 0) * usdCopRate,
    history: Array.isArray(coin.sparkline_in_7d?.price)
      ? coin.sparkline_in_7d.price.map((price) => price * usdCopRate)
      : [],
  }));
}

/**
 * Normalises a raw Coinpaprika row.
 *
 * Two things differ from CoinGecko: there is no sparkline (`history` stays
 * empty and the chart components fall back to their "Sin histórico" state) and
 * the ids live in another namespace (`btc-bitcoin` vs `bitcoin`), so they are
 * translated to the canonical CoinGecko id here. Without that translation
 * every `balances[coin.id]` lookup would return 0 while the fallback is on.
 */
export function mapFallbackData(rows, page, usdCopRate) {
  const start = (page - 1) * PAGE_SIZE;
  return rows.slice(start, start + PAGE_SIZE).map((row, index) => {
    const quote = row?.quotes?.USD || {};
    return {
      id: canonicalCoinId(row?.id),
      name: row?.name,
      symbol: String(row?.symbol || '').toUpperCase(),
      image: null,
      rank: Number(row?.rank) || start + index + 1,
      price: (Number(quote.price) || 0) * usdCopRate,
      change24h: Number(quote.percent_change_24h) || 0,
      change7d: Number(quote.percent_change_7d) || 0,
      marketCap: (Number(quote.market_cap) || 0) * usdCopRate,
      volume: (Number(quote.volume_24h) || 0) * usdCopRate,
      history: [],
    };
  });
}

/** Requests one page of the market from CoinGecko and converts it to COP. */
export async function requestMarketPage(page, signal, usdCopRate) {
  const params = new URLSearchParams({
    vs_currency: 'usd',
    order: 'market_cap_desc',
    per_page: String(PAGE_SIZE),
    page: String(page),
    sparkline: 'true',
    price_change_percentage: '24h,7d',
  });

  const data = await requestJson(`${MARKET_ENDPOINT}?${params}`, {
    signal,
    source: MARKET_SOURCES.COINGECKO,
  });
  if (!Array.isArray(data) || data.length === 0) {
    throw new MarketApiError('La fuente de mercado no devolvió cotizaciones', {
      reason: 'vacio',
      source: MARKET_SOURCES.COINGECKO,
    });
  }

  return mapMarketData(data, page, usdCopRate);
}

/** Requests one page of the market from the Coinpaprika fallback source. */
export async function requestFallbackMarketPage(page, signal, usdCopRate) {
  const start = (page - 1) * PAGE_SIZE;
  if (start >= FALLBACK_MAX_ROWS) {
    // A page past the provider's cap cannot exist. Reporting it as "pagina"
    // lets the caller jump back to the last real page instead of showing a
    // connection error for a request that was never going to succeed.
    throw new MarketApiError(
      `La fuente de respaldo solo publica ${FALLBACK_MAX_ROWS} activos (la página ${page} no existe)`,
      {
        reason: 'pagina',
        source: MARKET_SOURCES.COINPAPRIKA,
        maxPage: FALLBACK_MAX_PAGE,
      }
    );
  }

  const params = new URLSearchParams({
    limit: String(Math.min(page * PAGE_SIZE, FALLBACK_MAX_ROWS)),
  });

  const data = await requestJson(`${FALLBACK_MARKET_ENDPOINT}?${params}`, {
    signal,
    source: MARKET_SOURCES.COINPAPRIKA,
  });
  if (!Array.isArray(data)) {
    throw new MarketApiError('La fuente de respaldo no devolvió cotizaciones', {
      reason: 'vacio',
      source: MARKET_SOURCES.COINPAPRIKA,
    });
  }

  const coins = mapFallbackData(data, page, usdCopRate).filter(
    (coin) => coin.id && Number.isFinite(coin.price) && coin.price > 0
  );
  if (coins.length === 0) {
    throw new MarketApiError('La fuente de respaldo no cubre esta página', {
      reason: 'vacio',
      source: MARKET_SOURCES.COINPAPRIKA,
    });
  }

  return coins;
}

/**
 * Requests one market page, falling back to Coinpaprika whenever CoinGecko
 * is unavailable (rate limit, WAF block, outage, offline).
 *
 * `hasMore` tells the UI whether a next page exists **on the source that
 * actually answered**, so pagination stops where the data stops instead of
 * offering pages that would render "0 de 0 activos".
 *
 * @returns {Promise<{coins: Array, source: string, hasMore: boolean}>}
 */
export async function requestMarket(page, signal, usdCopRate) {
  try {
    const coins = await requestMarketPage(page, signal, usdCopRate);
    return {
      coins,
      source: MARKET_SOURCES.COINGECKO,
      hasMore: coins.length >= PAGE_SIZE,
    };
  } catch (primaryError) {
    if (isAbort(primaryError)) throw primaryError;
    try {
      const coins = await requestFallbackMarketPage(page, signal, usdCopRate);
      return {
        coins,
        source: MARKET_SOURCES.COINPAPRIKA,
        hasMore: page < FALLBACK_MAX_PAGE,
      };
    } catch (fallbackError) {
      if (isAbort(fallbackError)) throw fallbackError;
      // A page that cannot exist is more actionable than "the provider is
      // rate limiting us": the caller can jump back to a real page.
      if (fallbackError instanceof MarketApiError && fallbackError.reason === 'pagina') {
        throw fallbackError;
      }
      // The primary source is the one retried first, so its diagnosis wins.
      throw primaryError;
    }
  }
}
