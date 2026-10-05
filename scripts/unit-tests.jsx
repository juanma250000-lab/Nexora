/**
 * Unit tests for the data layer: retry/backoff, API error classification,
 * source fallbacks, mapping and formatting.
 *
 * Everything runs offline: `fetch` is stubbed per test, so these tests prove
 * the exact behaviour we rely on when CoinGecko answers 403/429.
 *
 * Run with: npm test
 */
import './shims.js';

import {
  FALLBACK_MAX_PAGE,
  MARKET_SOURCES,
  MarketApiError,
  mapFallbackData,
  mapMarketData,
  requestFallbackMarketPage,
  requestMarket,
  requestMarketPage,
  requestUsdCopRate,
} from '../src/lib/marketApi.js';
import { PRICE_TOLERANCE, matchesPrice, parseKlines, requestDailyCloses } from '../src/lib/priceSeries.js';
import { MARKET_ERROR_MESSAGES, nextRetryDelay, parseRetryAfter } from '../src/lib/retry.js';
import { canonicalCoinId, COIN_ID_ALIASES } from '../src/lib/coinAliases.js';
import { PAGE_SIZE, REFRESH_MS, resolveNavFromSection } from '../src/lib/constants.js';
import { mergeCoins } from '../src/lib/collections.js';
import {
  formatClock,
  formatCOP,
  formatCrypto,
  formatPercent,
  formatTimestamp,
  pricePath,
  toLowerCaseLocale,
} from '../src/lib/format.js';
import { readDemoPortfolio } from '../src/lib/storage.js';
import { INITIAL_BALANCES, INITIAL_CASH, PORTFOLIO_KEY } from '../src/lib/constants.js';

/* ------------------------------------------------------------------ *
 * Tiny assertion helpers
 * ------------------------------------------------------------------ */

let passed = 0;
const failures = [];
const cases = [];

function assert(condition, message = 'se esperaba `true`') {
  if (!condition) throw new Error(message);
}

function assertEqual(actual, expected, label = 'valor') {
  if (actual !== expected) {
    throw new Error(`${label}: esperado ${JSON.stringify(expected)}, obtenido ${JSON.stringify(actual)}`);
  }
}

function assertClose(actual, expected, label = 'valor', tolerance = 1e-6) {
  if (!(Math.abs(actual - expected) <= tolerance)) {
    throw new Error(`${label}: esperado ~${expected}, obtenido ${actual}`);
  }
}

/** Registers a case; they all run sequentially from `main()`. */
function test(label, fn) {
  cases.push([label, fn]);
}

/** Route-requests stub. Every test decides what `fetch` answers. */
function mockFetch(handler) {
  globalThis.fetch = async (url, options = {}) => handler(String(url), options || {});
}

function respond(body, { status = 200, headers = {} } = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name) => (name in headers ? headers[name] : null) },
    json: async () => body,
  };
}

/** Minimal CoinGecko style row. */
function geckoRow(index) {
  return {
    id: `coin-${index}`,
    name: `Coin ${index}`,
    symbol: `c${index}`,
    image: `https://img/${index}.png`,
    current_price: 10 + index,
    price_change_percentage_24h: index % 2 === 0 ? 1.5 : -2.5,
    price_change_percentage_7d_in_currency: 3.25,
    market_cap: 1000 + index,
    total_volume: 500 + index,
    sparkline_in_7d: { price: [1, 2, 3, 4] },
  };
}

/** Minimal Coinpaprika style row. */
function paprikaRow(index) {
  return {
    id: `pap-${index}`,
    name: `Pap ${index}`,
    symbol: `p${index}`,
    rank: index + 1,
    quotes: {
      USD: {
        price: 20 + index,
        market_cap: 2000 + index,
        volume_24h: 700 + index,
        percent_change_24h: index % 2 === 0 ? 2 : -1,
        percent_change_7d: -4.5,
      },
    },
  };
}

/* ------------------------------------------------------------------ *
 * Retry / backoff
 * ------------------------------------------------------------------ */

test('parseRetryAfter lee segundos', () => {
  assertEqual(parseRetryAfter('60'), 60000, 'delay');
  assertEqual(parseRetryAfter(' 5 '), 5000, 'delay con espacios');
});

test('parseRetryAfter lee fechas HTTP', () => {
  const now = Date.parse('2026-01-01T00:00:00Z');
  assertEqual(parseRetryAfter('Thu, 01 Jan 2026 00:01:00 GMT', now), 60000, 'delay');
  // A date in the past never schedules a request in the past.
  assertEqual(parseRetryAfter('Wed, 31 Dec 2025 00:00:00 GMT', now), 0, 'delay pasada');
});

test('parseRetryAfter descarta entradas inútiles', () => {
  assertEqual(parseRetryAfter(null), null, 'null');
  assertEqual(parseRetryAfter(undefined), null, 'undefined');
  assertEqual(parseRetryAfter(''), null, 'vacío');
  assertEqual(parseRetryAfter('   '), null, 'espacios');
  assertEqual(parseRetryAfter('pronto'), null, 'texto');
});

test('nextRetryDelay crece exponencialmente desde REFRESH_MS', () => {
  assertEqual(nextRetryDelay({ attempt: 1 }), REFRESH_MS, 'intento 1');
  assertEqual(nextRetryDelay({ attempt: 2 }), REFRESH_MS * 2, 'intento 2');
  assertEqual(nextRetryDelay({ attempt: 3 }), REFRESH_MS * 4, 'intento 3');
  assertEqual(nextRetryDelay({ attempt: 4 }), REFRESH_MS * 8, 'intento 4');
});

test('nextRetryDelay nunca supera el tope de 5 minutos', () => {
  const cap = 5 * 60 * 1000;
  assertEqual(nextRetryDelay({ attempt: 5 }), cap, 'intento 5');
  assertEqual(nextRetryDelay({ attempt: 50 }), cap, 'intento 50');
  assertEqual(nextRetryDelay({ attempt: 5000 }), cap, 'intento enorme');
});

test('nextRetryDelay respeta Retry-After como piso', () => {
  // El servidor pide 60 s: no podemos ir más rápido aunque el backoff diga 30 s.
  assertEqual(nextRetryDelay({ attempt: 1, retryAfterMs: 60000 }), 60000, 'piso del servidor');
  // Y tampoco más lento que el tope.
  assertEqual(nextRetryDelay({ attempt: 1, retryAfterMs: 10 * 60 * 1000 }), 5 * 60 * 1000, 'techo');
  // Valores inválidos se ignoran.
  assertEqual(nextRetryDelay({ attempt: 1, retryAfterMs: null }), REFRESH_MS, 'null');
  assertEqual(nextRetryDelay({ attempt: 1, retryAfterMs: Number.NaN }), REFRESH_MS, 'NaN');
  assertEqual(nextRetryDelay({ attempt: 1, retryAfterMs: -5 }), REFRESH_MS, 'negativo');
});

test('una caída prolongada nunca dispara más de 1 petición cada 30 s', () => {
  let elapsed = 0;
  const delays = [];
  for (let attempt = 1; attempt <= 20; attempt += 1) {
    const delay = nextRetryDelay({ attempt });
    delays.push(delay);
    elapsed += delay;
  }
  const maxDelay = Math.max(...delays);
  assert(maxDelay <= 5 * 60 * 1000, 'ningún reintento supera los 5 minutos');
  assert(elapsed >= 20 * REFRESH_MS, 'la suma respeta el mínimo');
  // 20 intentos == 6 intentos como máximo en los primeros 5 minutos.
  const withinFirstFiveMinutes = delays.filter((d, i) => delays.slice(0, i + 1).reduce((a, b) => a + b, 0) <= 5 * 60 * 1000).length;
  assert(withinFirstFiveMinutes <= 6, `demasiados reintentos rápidos (${withinFirstFiveMinutes})`);
});

test('todos los motivos de error tienen mensaje en español', () => {
  for (const reason of ['limitado', 'servidor', 'rechazado', 'vacio', 'sin-conexion']) {
    const message = MARKET_ERROR_MESSAGES[reason];
    assert(typeof message === 'string' && message.length > 10, `falta mensaje para ${reason}`);
    assert(/[áéíóúñ¿]/i.test(message), `el mensaje de ${reason} no está en español`);
  }
  // Un límite de tasa jamás debe achacarse a la conexión del usuario.
  assert(
    !/conexión|conect/i.test(MARKET_ERROR_MESSAGES.limitado),
    'el mensaje de límite de tasa menciona la conexión del usuario'
  );
});

/* ------------------------------------------------------------------ *
 * Mapping
 * ------------------------------------------------------------------ */

test('mapMarketData convierte USD a COP y pagina el rank', () => {
  const rows = [geckoRow(0), geckoRow(1)];
  const coins = mapMarketData(rows, 3, 4000);

  assertEqual(coins.length, 2, 'cantidad');
  assertEqual(coins[0].price, 10 * 4000, 'precio COP');
  assertEqual(coins[0].marketCap, 1000 * 4000, 'capitalización COP');
  assertEqual(coins[0].volume, 500 * 4000, 'volumen COP');
  assertEqual(coins[0].rank, (3 - 1) * PAGE_SIZE + 1, 'rank primera');
  assertEqual(coins[1].rank, (3 - 1) * PAGE_SIZE + 2, 'rank segunda');
  assertEqual(coins[0].symbol, 'C0', 'símbolo en mayúsculas');
  assertEqual(coins[0].history.length, 4, 'sparkline');
  assertEqual(coins[0].history[0], 1 * 4000, 'sparkline en COP');
});

test('mapMarketData tolera campos ausentes sin producir NaN', () => {
  const coins = mapMarketData([{ id: 'x', name: 'X' }], 1, 4000);
  const coin = coins[0];
  assertEqual(coin.price, 0, 'precio');
  assertEqual(coin.change24h, 0, 'variación 24 h');
  assertEqual(coin.change7d, 0, 'variación 7 d');
  assertEqual(coin.marketCap, 0, 'capitalización');
  assertEqual(coin.volume, 0, 'volumen');
  assert(Array.isArray(coin.history) && coin.history.length === 0, 'historial vacío');
  assertEqual(coin.symbol, '', 'símbolo');
  for (const [key, value] of Object.entries(coin)) {
    if (typeof value === 'number') assert(Number.isFinite(value), `${key} debe ser finito`);
  }
});

test('mapFallbackData trocea la respuesta según la página', () => {
  const rows = Array.from({ length: PAGE_SIZE * 2 }, (_, i) => paprikaRow(i));
  const page1 = mapFallbackData(rows, 1, 1);
  const page2 = mapFallbackData(rows, 2, 1);

  assertEqual(page1.length, PAGE_SIZE, 'tamaño página 1');
  assertEqual(page2.length, PAGE_SIZE, 'tamaño página 2');
  assertEqual(page1[0].id, 'pap-0', 'primero página 1');
  assertEqual(page2[0].id, `pap-${PAGE_SIZE}`, 'primero página 2');
  assertEqual(page2[PAGE_SIZE - 1].id, `pap-${PAGE_SIZE * 2 - 1}`, 'último página 2');
});

test('mapFallbackData convierte a COP y marca el historial vacío', () => {
  const coins = mapFallbackData([paprikaRow(0)], 1, 3300);
  const coin = coins[0];
  assertClose(coin.price, 20 * 3300, 'precio COP');
  assertClose(coin.marketCap, 2000 * 3300, 'capitalización COP');
  assertClose(coin.volume, 700 * 3300, 'volumen COP');
  assertEqual(coin.change24h, 2, 'variación 24 h');
  assertEqual(coin.change7d, -4.5, 'variación 7 d');
  assertEqual(coin.rank, 1, 'rank');
  assert(Array.isArray(coin.history) && coin.history.length === 0, 'sin sparkline');
  assertEqual(coin.image, null, 'sin logotipo (usa el icono de respaldo)');
});

/* ------------------------------------------------------------------ *
 * fetch handling
 * ------------------------------------------------------------------ */

test('requestMarketPage devuelve monedas cuando la API responde 200', async () => {
  let requested = '';
  mockFetch((url) => {
    requested = url;
    return respond([geckoRow(0), geckoRow(1)]);
  });

  const coins = await requestMarketPage(1, undefined, 4000);
  assertEqual(coins.length, 2, 'cantidad');
  assert(requested.includes('api.coingecko.com'), 'debe usar CoinGecko');
  assert(requested.includes('per_page=250'), 'debe pedir la página completa');
});

test('429 con Retry-After se clasifica como límite y guarda la espera', async () => {
  mockFetch(() => respond({ error: 'rate limited' }, { status: 429, headers: { 'Retry-After': '60' } }));

  let error = null;
  try {
    await requestMarketPage(1, undefined, 4000);
  } catch (caught) {
    error = caught;
  }

  assert(error instanceof MarketApiError, 'debe lanzar MarketApiError');
  assertEqual(error.reason, 'limitado', 'motivo');
  assertEqual(error.status, 429, 'estado');
  assertEqual(error.retryAfterMs, 60000, 'Retry-After');
  assertEqual(MARKET_SOURCES.COINGECKO, 'coingecko', 'identificador de fuente');
  assertEqual(error.source, MARKET_SOURCES.COINGECKO, 'fuente');
});

test('403 (bloqueo WAF) también se trata como límite', async () => {
  mockFetch(() => respond('<html>blocked</html>', { status: 403 }));
  let error = null;
  try {
    await requestMarketPage(1, undefined, 4000);
  } catch (caught) {
    error = caught;
  }
  assertEqual(error.reason, 'limitado', 'motivo');
  assertEqual(error.retryAfterMs, null, 'sin Retry-After');
});

test('5xx se clasifica como servidor y 4xx restantes como rechazado', async () => {
  mockFetch(() => respond({}, { status: 503, headers: { 'Retry-After': '120' } }));
  let serverError = null;
  try {
    await requestMarketPage(1, undefined, 4000);
  } catch (caught) {
    serverError = caught;
  }
  assertEqual(serverError.reason, 'servidor', '503');
  assertEqual(serverError.retryAfterMs, 120000, '503 aún conserva Retry-After');

  mockFetch(() => respond({}, { status: 500 }));
  let outage = null;
  try {
    await requestMarketPage(1, undefined, 4000);
  } catch (caught) {
    outage = caught;
  }
  assertEqual(outage.reason, 'servidor', '500');

  mockFetch(() => respond({}, { status: 404 }));
  let rejected = null;
  try {
    await requestMarketPage(1, undefined, 4000);
  } catch (caught) {
    rejected = caught;
  }
  assertEqual(rejected.reason, 'rechazado', '404');
});

test('red caída se clasifica como sin-conexion', async () => {
  mockFetch(() => {
    throw new TypeError('Failed to fetch');
  });
  let error = null;
  try {
    await requestMarketPage(1, undefined, 4000);
  } catch (caught) {
    error = caught;
  }
  assertEqual(error.reason, 'sin-conexion', 'motivo');
  assertEqual(error.status, 0, 'sin estado HTTP');
  assert(error.cause instanceof TypeError, 'conserva la causa original');
});

test('respuesta 200 sin cotizaciones se clasifica como vacío', async () => {
  mockFetch(() => respond([]));
  let error = null;
  try {
    await requestMarketPage(1, undefined, 4000);
  } catch (caught) {
    error = caught;
  }
  assertEqual(error.reason, 'vacio', 'motivo');
});

test('respuestas ilegibles se clasifican como servidor', async () => {
  mockFetch(() => ({
    ok: true,
    status: 200,
    headers: { get: () => null },
    json: async () => {
      throw new SyntaxError('Unexpected token');
    },
  }));
  let error = null;
  try {
    await requestMarketPage(1, undefined, 4000);
  } catch (caught) {
    error = caught;
  }
  assertEqual(error.reason, 'servidor', 'motivo');
});

/* ------------------------------------------------------------------ *
 * Source fallbacks
 * ------------------------------------------------------------------ */

test('requestMarket usa CoinGecko cuando responde bien', async () => {
  mockFetch(() => respond([geckoRow(0)]));
  const result = await requestMarket(1, undefined, 1);
  assertEqual(result.source, MARKET_SOURCES.COINGECKO, 'fuente');
  assertEqual(result.coins.length, 1, 'cantidad');
});

test('requestMarket cae a Coinpaprika cuando CoinGecko devuelve 429', async () => {
  const calls = [];
  const paprikaRows = Array.from({ length: PAGE_SIZE }, (_, i) => paprikaRow(i));

  mockFetch((url) => {
    calls.push(url);
    if (url.includes('coingecko')) return respond({}, { status: 429, headers: { 'Retry-After': '60' } });
    return respond(paprikaRows);
  });

  const result = await requestMarket(1, undefined, 1);
  assertEqual(result.source, MARKET_SOURCES.COINPAPRIKA, 'fuente de respaldo');
  assertEqual(result.coins.length, PAGE_SIZE, 'cantidad');
  assertEqual(result.coins[0].id, 'pap-0', 'primer activo');
  assertEqual(calls.length, 2, 'primero CoinGecko, después Coinpaprika');
});

test('requestMarket cae a Coinpaprika cuando CoinGecko devuelve 403', async () => {
  mockFetch((url) => {
    if (url.includes('coingecko')) return respond('<html></html>', { status: 403 });
    return respond(Array.from({ length: 5 }, (_, i) => paprikaRow(i)));
  });

  const result = await requestMarket(1, undefined, 1);
  assertEqual(result.source, MARKET_SOURCES.COINPAPRIKA, 'fuente de respaldo');
  assertEqual(result.coins.length, 5, 'cantidad');
});

test('si fallan las dos fuentes se propaga el error primario', async () => {
  mockFetch((url) => {
    if (url.includes('coingecko')) return respond({}, { status: 429, headers: { 'Retry-After': '45' } });
    return respond({}, { status: 500 });
  });

  let error = null;
  try {
    await requestMarket(1, undefined, 1);
  } catch (caught) {
    error = caught;
  }

  assert(error instanceof MarketApiError, 'debe lanzar MarketApiError');
  assertEqual(error.reason, 'limitado', 'prevalece el diagnóstico de la fuente principal');
  assertEqual(error.retryAfterMs, 45000, 'Retry-After de la fuente principal');
});

test('un aborto nunca dispara el fallback', async () => {
  let fallbackCalled = false;
  mockFetch((url) => {
    if (url.includes('coinpaprika')) {
      fallbackCalled = true;
      return respond(Array.from({ length: 5 }, (_, i) => paprikaRow(i)));
    }
    const error = new Error('aborted');
    error.name = 'AbortError';
    throw error;
  });

  let error = null;
  try {
    await requestMarket(1, undefined, 1);
  } catch (caught) {
    error = caught;
  }

  assertEqual(error && error.name, 'AbortError', 'propaga el aborto');
  assert(!fallbackCalled, 'no debe llamar al fallback tras un aborto');
});

test('requestFallbackMarketPage pide solo lo necesario y filtra precios a 0', async () => {
  let requested = '';
  const rows = Array.from({ length: 500 }, (_, i) => paprikaRow(i));
  // Page 2 starts at index 250, so that is the row the filter must drop.
  rows[250] = { ...rows[250], quotes: { USD: { ...rows[250].quotes.USD, price: 0 } } };

  mockFetch((url) => {
    requested = url;
    return respond(rows);
  });

  const coins = await requestFallbackMarketPage(2, undefined, 1);
  assert(requested.includes('limit=500'), `debe pedir 500 filas para la página 2 (fue: ${requested})`);
  assertEqual(coins.length, PAGE_SIZE - 1, 'se descarta la fila con precio 0');
  assertEqual(coins[0].id, 'pap-251', 'empieza en la fila 251 tras filtrar');
});

test('requestFallbackMarketPage rechaza las páginas que no existen', async () => {
  let requested = 0;
  mockFetch(() => {
    requested += 1;
    return respond(Array.from({ length: 10 }, (_, i) => paprikaRow(i)));
  });

  // Past the provider's cap: reported as `pagina` and never even requested.
  let error = null;
  try {
    await requestFallbackMarketPage(FALLBACK_MAX_PAGE + 1, undefined, 1);
  } catch (caught) {
    error = caught;
  }
  assertEqual(error.reason, 'pagina', 'motivo');
  assertEqual(error.maxPage, FALLBACK_MAX_PAGE, 'última página disponible');
  assertEqual(error.source, MARKET_SOURCES.COINPAPRIKA, 'fuente');
  assertEqual(requested, 0, 'no debe pedir una página inexistente');

  // Inside the cap but with no rows: still an empty page, and the request
  // does go out.
  error = null;
  try {
    await requestFallbackMarketPage(FALLBACK_MAX_PAGE, undefined, 1);
  } catch (caught) {
    error = caught;
  }
  assertEqual(error.reason, 'vacio', 'motivo de página vacía');
  assertEqual(requested, 1, 'sí pide una página dentro del rango');
});

test('la paginación solo anuncia páginas que la fuente puede servir', async () => {
  // CoinGecko: a full page means there is probably another one.
  mockFetch(() => respond(Array.from({ length: PAGE_SIZE }, (_, i) => geckoRow(i))));
  let result = await requestMarket(1, undefined, 1);
  assertEqual(result.hasMore, true, 'CoinGecko con página completa');

  mockFetch(() => respond(Array.from({ length: 7 }, (_, i) => geckoRow(i))));
  result = await requestMarket(3, undefined, 1);
  assertEqual(result.hasMore, false, 'CoinGecko con página corta');

  // Fallback: the answer is capped, so the last page must disable "siguiente".
  mockFetch((url) => {
    if (url.includes('coingecko')) return respond({}, { status: 429 });
    // The fallback over-fetches and slices, so the full 2000-row payload is
    // needed before any of these pages can be assembled.
    return respond(Array.from({ length: 2000 }, (_, i) => paprikaRow(i)));
  });
  result = await requestMarket(FALLBACK_MAX_PAGE - 1, undefined, 1);
  assertEqual(result.hasMore, true, 'respaldo antes de la última página');
  result = await requestMarket(FALLBACK_MAX_PAGE, undefined, 1);
  assertEqual(result.hasMore, false, 'respaldo en la última página');
});

test('requestMarket prefiere el motivo "pagina" cuando la página no existe', async () => {
  mockFetch((url) => {
    if (url.includes('coingecko')) return respond({}, { status: 429 });
    return respond(Array.from({ length: 3 }, (_, i) => paprikaRow(i)));
  });

  let error = null;
  try {
    await requestMarket(FALLBACK_MAX_PAGE + 2, undefined, 1);
  } catch (caught) {
    error = caught;
  }
  // Otherwise the caller would show "revisa tu conexión" for a page that was
  // never going to exist on the fallback source.
  assertEqual(error.reason, 'pagina', 'motivo');
  assertEqual(error.maxPage, FALLBACK_MAX_PAGE, 'última página disponible');
});

/* ------------------------------------------------------------------ *
 * Real-time daily series (Binance)
 * ------------------------------------------------------------------ */

test('parseKlines lee el cierre de cada vela y descarta la basura', () => {
  const rows = [
    [1_700_000_000_000, 'x', 1, 2, 83489.76, 'y', 0, 0, 0, 0, 0, 0],
    [1_700_000_000_000, 'x', 1, 2, 84000, 'y', 0, 0, 0, 0, 0, 0],
    'nope',
    { close: 'garbage' },
  ];
  assertEqual(parseKlines(rows).length, 2, 'solo se conservan los cierres válidos');
  assertEqual(parseKlines(rows)[1], 84000, 'segundo cierre');
  assertEqual(parseKlines('no-array').length, 0, 'entradas ilegibles');
  assertEqual(parseKlines([[0, 'x', 0, 0, 0]]).length, 0, 'se descarta un cierre en 0');
});

test('matchesPrice evita dibujar el gráfico de otro activo', () => {
  assert(matchesPrice([100, 101, 102], 102), 'acepta una serie coherente');
  assert(!matchesPrice([100, 101, 102], 500), 'rechaza una serie desalineada');
  assert(matchesPrice([100, 200, 120], 100), 'tolera la volatilidad normal');
  assert(
    !matchesPrice([100, 200, 120], 100, 0.1),
    'la tolerancia es configurable'
  );
  assert(!matchesPrice([], 100), 'rechaza series vacías');
  assert(!matchesPrice([100], Number.NaN), 'rechaza precios no numéricos');
  assert(PRICE_TOLERANCE > 0, 'la tolerancia por defecto existe');
});

test('requestDailyCloses devuelve cierres o null, nunca lanza', async () => {
  mockFetch(() =>
    respond(
      Array.from({ length: 8 }, (_, i) => [0, 'x', 0, 0, 90_000 + i])
    )
  );
  const closes = await requestDailyCloses('btc', undefined);
  assertEqual(closes.length, 8, 'ocho cierres diarios');
  assertClose(closes[7], 90_007, 'último cierre');

  // Binance answers 400 for pairs it does not list.
  mockFetch(() => respond({ msg: 'Invalid symbol' }, { status: 400 }));
  assertEqual(await requestDailyCloses('noexiste', undefined), null, 'par inexistente');

  mockFetch(() => {
    throw new TypeError('Failed to fetch');
  });
  assertEqual(await requestDailyCloses('btc', undefined), null, 'red caída');

  assertEqual(await requestDailyCloses('', undefined), null, 'símbolo vacío');
  assertEqual(
    await requestDailyCloses('DROP TABLE', undefined),
    null,
    'símbolo inválido'
  );
});

/* ------------------------------------------------------------------ *
 * FX fallback
 * ------------------------------------------------------------------ */

test('requestUsdCopRate usa el proveedor principal', async () => {
  mockFetch(() => respond({ result: 'success', rates: { COP: 3300.5 } }));
  assertClose(await requestUsdCopRate(undefined), 3300.5, 'tasa');
});

test('requestUsdCopRate cae al CDN cuando el principal falla', async () => {
  mockFetch((url) => {
    if (url.includes('open.er-api')) return respond({}, { status: 500 });
    return respond({ date: '2026-09-29', usd: { cop: 3310.25 } });
  });
  assertClose(await requestUsdCopRate(undefined), 3310.25, 'tasa de respaldo');
});

test('requestUsdCopRate rechaza tasas inválidas', async () => {
  mockFetch(() => respond({ result: 'error', rates: {} }));
  let error = null;
  try {
    await requestUsdCopRate(undefined);
  } catch (caught) {
    error = caught;
  }
  assert(error, 'debe lanzar');
  assertEqual(error.reason, 'vacio', 'motivo');
});

test('requestUsdCopRate propaga el error primario si fallan las dos fuentes', async () => {
  mockFetch((url) => {
    if (url.includes('open.er-api')) return respond({}, { status: 429 });
    return respond({ usd: {} });
  });
  let error = null;
  try {
    await requestUsdCopRate(undefined);
  } catch (caught) {
    error = caught;
  }
  assertEqual(error.status, 429, 'estado del proveedor principal');
});

test('mapFallbackData traslada los ids al espacio canónico de CoinGecko', () => {
  // Sin esta traducción balances[coin.id] devolvería 0 mientras la fuente de
  // respaldo esté activa y el portafolio demo parecería vacío.
  const seeded = [
    ['btc-bitcoin', 'bitcoin'],
    ['eth-ethereum', 'ethereum'],
    ['sol-solana', 'solana'],
    ['ada-cardano', 'cardano'],
    ['xrp-xrp', 'ripple'],
  ];
  for (const [source, canonical] of seeded) {
    assertEqual(canonicalCoinId(source), canonical, `alias ${source}`);
  }

  const coins = mapFallbackData(
    seeded.map(([id], index) => ({ ...paprikaRow(index), id })),
    1,
    1
  );
  assertEqual(
    coins.map((coin) => coin.id).join(','),
    seeded.map(([, canonical]) => canonical).join(','),
    'ids expuestos a la UI'
  );

  // Un id desconocido conserva su propio valor: sigue siendo una clave única.
  assertEqual(canonicalCoinId('pap-0'), 'pap-0', 'id desconocido');
  assertEqual(canonicalCoinId(undefined), undefined, 'id ausente');
});

test('la tabla de alias es inyectiva y cubre el catálogo principal', () => {
  const targets = Object.values(COIN_ID_ALIASES);
  assert(targets.length > 200, `cobertura insuficiente: ${targets.length}`);
  assert(new Set(targets).size === targets.length, 'ningún id canónico repetido');
  assert(
    Object.entries(COIN_ID_ALIASES).every(([from, to]) => from !== to),
    'ningún mapeo identidad'
  );
  assert(
    Object.entries(COIN_ID_ALIASES).every(([from, to]) => typeof from === 'string' && typeof to === 'string'),
    'todas las entradas son texto'
  );
});

/* ------------------------------------------------------------------ *
 * Navigation, collections, formatting
 * ------------------------------------------------------------------ */

test('resolveNavFromSection distingue comprar de vender', () => {
  assertEqual(resolveNavFromSection('comprar', 'buy'), 'comprar', 'compra');
  assertEqual(resolveNavFromSection('comprar', 'sell'), 'vender', 'venta');
  assertEqual(resolveNavFromSection('mercado', 'buy'), 'mercado', 'mercado');
  assertEqual(resolveNavFromSection('detalle', 'buy'), 'mercado', 'detalle');
  assertEqual(resolveNavFromSection('desconocido', 'buy'), null, 'desconocido');
});

test('mergeCoins elimina duplicados y conserva el orden', () => {
  const a = [{ id: 'x' }, { id: 'y' }];
  const b = [{ id: 'y', nuevo: true }, { id: 'z' }];
  const merged = mergeCoins(a, b);
  assertEqual(merged.length, 3, 'cantidad');
  assertEqual(merged.map((c) => c.id).join(','), 'x,y,z', 'orden');
  assertEqual(merged[1].nuevo, true, 'prevalece el dato más reciente');
});

test('pricePath devuelve una ruta válida y la muestrea', () => {
  const short = pricePath([1, 2, 3], 220, 70);
  assert(typeof short === 'string' && short.startsWith('M'), 'formato de ruta');

  const long = pricePath(Array.from({ length: 5000 }, (_, i) => Math.sin(i / 10) * 100), 150, 44, 4);
  const points = long.split('L').length - 1;
  assert(points <= 96, `debe muestrear a 96 puntos o menos (fueron ${points})`);
  assert(!long.includes('NaN'), 'sin NaN en la ruta');
});

test('pricePath devuelve una ruta sin NaN aunque el proveedor mande basura', () => {
  const dirty = pricePath([1, Number.NaN, 3, null, undefined, 'x', 4], 220, 70);
  assert(typeof dirty === 'string' && dirty.length > 0, 'debe seguir dibujando');
  assert(!dirty.includes('NaN'), 'sin NaN en la ruta');
});

test('pricePath no dibuja cuando no hay histórico suficiente', () => {
  assert(!pricePath([], 220, 70), 'vacío');
  assert(!pricePath([5], 220, 70), 'un solo punto');
  assert(!pricePath(undefined, 220, 70), 'undefined');
  assert(!pricePath(null, 220, 70), 'null');
  assert(!pricePath([Number.NaN, Number.NaN], 220, 70), 'solo NaN');
});

test('los formateadores no producen NaN ni undefined', () => {
  assert(!formatCOP(Number.NaN).includes('NaN'), 'formatCOP con NaN');
  assert(!formatCOP(undefined).includes('NaN'), 'formatCOP con undefined');
  assert(!formatCrypto(Number.NaN).includes('NaN'), 'formatCrypto con NaN');
  assert(formatCOP(1500000).includes('1.500.000'), 'formatCOP en español');
  // La normalización solo cambia mayúsculas/minúsculas; los acentos se
  // conservan porque ambas partes de la comparación pasan por la misma rutina.
  assertEqual(toLowerCaseLocale('  ÁvAl  '.trim()), 'ával', 'normalización de búsqueda');
  assertEqual(formatClock(null), 'Esperando cotizaciones', 'reloj sin fecha');
});

test('formatPercent usa coma decimal y nunca muestra NaN', () => {
  assertEqual(formatPercent(1.4), '1,40 %', 'dos decimales');
  assertEqual(formatPercent(-3.256), '3,26 %', 'valor absoluto: el signo lo pone la UI');
  assertEqual(formatPercent(54.27, 1), '54,3 %', 'un decimal');
  assertEqual(formatPercent(Number.NaN), '0,00 %', 'NaN');
});

test('formatCOP reutiliza formateadores sin perder decimales en montos pequeños', () => {
  assert(formatCOP(0.5).includes('0,50'), 'menos de un peso conserva decimales');
  assert(!formatCOP(1234.56).includes(','), 'montos grandes sin decimales');
  assert(!formatCOP(0).includes(','), 'cero sin decimales');
});

test('formatTimestamp no imprime "Invalid Date"', () => {
  assertEqual(formatTimestamp('no-es-una-fecha'), 'Fecha no disponible', 'fecha corrupta');
  assert(/2026/.test(formatTimestamp('2026-01-15T10:00:00.000Z')), 'fecha válida');
});

test('readDemoPortfolio descarta registros corruptos del almacenamiento local', () => {
  localStorage.setItem(
    PORTFOLIO_KEY,
    JSON.stringify({
      cash: 'mucho',
      balances: { bitcoin: -2, ethereum: 3, solana: 'diez' },
      activity: [
        null,
        { id: 'NX-1', type: 'buy', quantity: 1, total: 100 },
        { id: 'NX-2', type: 'robo', quantity: 1, total: 100 },
        { id: 3, type: 'sell', quantity: 1, total: 100 },
        { id: 'NX-4', type: 'sell', quantity: Number.NaN, total: 100 },
      ],
    })
  );
  const portfolio = readDemoPortfolio();
  assertEqual(portfolio.cash, INITIAL_CASH, 'saldo inválido vuelve al inicial');
  assertEqual(portfolio.balances.bitcoin, INITIAL_BALANCES.bitcoin, 'saldo negativo ignorado');
  assertEqual(portfolio.balances.ethereum, 3, 'saldo válido conservado');
  assertEqual(portfolio.balances.solana, INITIAL_BALANCES.solana, 'saldo no numérico ignorado');
  assertEqual(portfolio.activity.length, 1, 'solo sobrevive el registro válido');
  assertEqual(portfolio.activity[0].id, 'NX-1', 'registro válido');
  localStorage.removeItem(PORTFOLIO_KEY);
});

test('readDemoPortfolio sobrevive a JSON ilegible', () => {
  localStorage.setItem(PORTFOLIO_KEY, '{roto');
  const portfolio = readDemoPortfolio();
  assertEqual(portfolio.cash, INITIAL_CASH, 'saldo inicial');
  assertEqual(portfolio.activity.length, 0, 'sin historial');
  localStorage.removeItem(PORTFOLIO_KEY);
});

/* ------------------------------------------------------------------ *
 * Runner
 * ------------------------------------------------------------------ */

async function main() {
  for (const [label, fn] of cases) {
    try {
      await fn();
      passed += 1;
      console.log(`PASS  ${label}`);
    } catch (error) {
      failures.push(label);
      console.log(`FAIL  ${label}\n      ${error && error.message}`);
    }
  }

  console.log('');
  if (failures.length > 0) {
    console.error(`${failures.length} test(s) fallaron:`);
    for (const label of failures) console.error(`  - ${label}`);
    process.exit(1);
  }
  console.log(`All ${passed} unit tests passed.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
