/**
 * Render smoke test.
 *
 * Renders the whole application with react-dom/server. This exercises every
 * component, memo, derived calculation and formatting helper in a single pass
 * and fails loudly on any runtime error (undefined variables, bad imports,
 * null dereferences, malformed JSX, etc.).
 *
 * It then renders the market panel in the three states that actually break in
 * production: rate limited, offline, and running on the fallback source.
 *
 * Run with: npm test
 */
import './shims.js';

import { renderToString } from 'react-dom/server';
import { createElement } from 'react';
import Nexora from '../src/Nexora.jsx';
import { MarketSection } from '../src/components/MarketSection.jsx';
import { DetailSection } from '../src/components/DetailSection.jsx';
import { TickerStrip } from '../src/components/TickerStrip.jsx';
import { GuidedTour } from '../src/components/GuidedTour.jsx';
import { MARKET_ERROR_MESSAGES } from '../src/lib/retry.js';

const noop = () => {};

const markup = renderToString(createElement(Nexora));

/* ------------------------------------------------------------------ *
 * Market panel states
 * ------------------------------------------------------------------ */

const sampleCoin = {
  id: 'bitcoin',
  name: 'Bitcoin',
  symbol: 'BTC',
  image: 'https://assets.example/btc.png',
  rank: 1,
  price: 275_000_000,
  change24h: 1.4,
  change7d: -3.2,
  marketCap: 5_400_000_000_000,
  volume: 210_000_000_000,
  history: [],
};

const baseProps = {
  searchTerm: '',
  onSearchChange: noop,
  selectedId: 'bitcoin',
  onSelectAsset: noop,
  liveLabel: 'Sin conexión con el mercado',
  updatedAtLabel: 'Sin datos',
  marketPage: 1,
  onChangePage: noop,
  pageSize: 250,
  selectedCoin: null,
  marketCapTotal: 0,
  volumeTotal: 0,
  onStartTrade: noop,
  onRefresh: noop,
};

const renderState = (overrides) =>
  renderToString(
    createElement(MarketSection, {
      ...baseProps,
      coins: [],
      filteredCoins: [],
      marketState: 'sin-conexion',
      marketError: 'sin-conexion',
      retryInSeconds: 0,
      dataSource: 'coingecko',
      ...overrides,
    })
  );

/** CoinGecko is rate limiting us: must blame the provider, not the user. */
const rateLimited = renderState({ marketError: 'limitado', retryInSeconds: 47 });

/** Everything is down: the classic connection message is still correct here. */
const offline = renderState({ marketError: 'sin-conexion', retryInSeconds: 12 });

/** Primary source blocked, fallback serving real quotes. */
const fallback = renderState({
  marketState: 'en-vivo',
  marketError: null,
  liveLabel: 'Mercado en vivo',
  coins: [sampleCoin],
  filteredCoins: [sampleCoin],
  selectedCoin: sampleCoin,
  dataSource: 'coinpaprika',
});

/**
 * Detail panel while the app runs on the fallback source: the market row
 * ships no sparkline, so the series has to be fetched (SSR renders the
 * "cargando" branch, never a dead-end message).
 */
const detailFallback = renderToString(
  createElement(DetailSection, { coin: sampleCoin, usdCopRate: 3300 })
);

/** Same panel when the provider does ship a seven-day sparkline. */
const detailWithHistory = renderToString(
  createElement(DetailSection, {
    coin: { ...sampleCoin, history: [270, 268, 272, 269, 274, 271, 275] },
    usdCopRate: 3300,
  })
);

/** Pagination: the next arrow must stop where the data stops. */
/** Is the "next page" button rendered as disabled in this markup? */
const nextDisabled = (html) => {
  const label = html.indexOf('Página siguiente');
  if (label < 0) return false;
  const open = html.lastIndexOf('<button', label);
  const close = html.indexOf('>', label);
  return open >= 0 && close > open && /disabled/.test(html.slice(open, close));
};
const lastPage = renderState({ hasMore: false, marketPage: 4 });
const middlePage = renderState({ hasMore: true, marketPage: 4 });

/** The ticker must name the source that is really feeding it. */
const tickerFallback = renderToString(
  createElement(TickerStrip, { coins: [sampleCoin], onSelectAsset: noop, dataSource: 'coinpaprika' })
);
const tickerPrimary = renderToString(
  createElement(TickerStrip, { coins: [sampleCoin], onSelectAsset: noop, dataSource: 'coingecko' })
);
const tour = renderToString(createElement(GuidedTour, { onFinish: noop }));

const checks = [
  ['render produced markup', markup.length > 5000],
  ['brand is present', markup.includes('NEXORA')],
  ['hero heading is in Spanish', markup.includes('de ver')],
  ['market section exists', markup.includes('id="mercado"')],
  ['detail section exists', markup.includes('id="detalle"')],
  ['trade section exists', markup.includes('id="comprar"')],
  ['portfolio section exists', markup.includes('id="portafolio"')],
  ['activity section exists', markup.includes('id="actividad"')],
  ['legal anchor exists', markup.includes('id="legal"')],
  ['loading state shown', markup.includes('Cargando cotizaciones')],
  ['demo disclaimer shown', markup.includes('SIN DINERO REAL') || markup.includes('sin dinero real')],
  ['mobile navigation rendered', markup.includes('nx-mobile-nav')],
  ['no undefined leaked', !markup.includes('>undefined<')],
  ['no NaN leaked', !markup.includes('NaN')],
  ['no [object Object] leaked', !markup.includes('[object Object]')],

  /* rate limited ---------------------------------------------------- */
  ['rate limit blames the provider', rateLimited.includes('limitando las consultas temporales')],
  ['rate limit never blames the user connection', !rateLimited.includes('Revisa tu conexión')],
  ['rate limit shows the countdown', rateLimited.includes('Reintentamos automáticamente en 47 s')],
  ['rate limit offers an immediate retry', rateLimited.includes('Reintentar ahora')],
  ['rate limit is announced politely', rateLimited.includes('role="status"')],
  ['rate limit has no NaN', !rateLimited.includes('NaN')],
  ['rate limit has no undefined', !rateLimited.includes('>undefined<')],

  /* offline --------------------------------------------------------- */
  ['offline keeps the connection message', offline.includes('Revisa tu conexión')],
  ['offline shows the countdown', offline.includes('en 12 s')],
  ['offline has no NaN', !offline.includes('NaN')],

  /* fallback source -------------------------------------------------- */
  ['fallback source is disclosed', fallback.includes('Fuente de respaldo')],
  ['fallback still lists the asset', fallback.includes('Bitcoin') && fallback.includes('BTC')],
  ['fallback hides the empty state', !fallback.includes('No pudimos conectar')],
  ['fallback renders the price', fallback.includes('275.000.000') || fallback.includes('275000000')],
  ['fallback has no NaN', !fallback.includes('NaN')],
  ['fallback has no undefined', !fallback.includes('>undefined<')],

  /* pagination -------------------------------------------------------- */
  ['pagination stops at the last available page', nextDisabled(lastPage)],
  ['pagination keeps moving while pages remain', !nextDisabled(middlePage)],

  /* seven-day chart --------------------------------------------------- */
  ['chart waits instead of showing a dead end', detailFallback.includes('Cargando gráfico…')],
  ['chart never shows the dead-end copy while loading', !detailFallback.includes('Gráfico en preparación')],
  ['chart draws the bundled sparkline', detailWithHistory.includes('nx-chart-svg')],
  ['chart panel has no NaN', !detailFallback.includes('NaN') && !detailWithHistory.includes('NaN')],

  /* help, navigation and links ------------------------------------- */
  ['guide button in the header', markup.includes('data-tour="guide"') && markup.includes('Guía')],
  ['guide link in the footer', markup.includes('Guía de uso')],
  ['no placeholder e-mail left', !markup.includes('nexora.example')],
  ['privacy copy behind the Privacidad link', markup.includes('Privacidad: el portafolio de prueba')],
  ['portfolio can be reset', markup.includes('Restablecer portafolio')],
  ['amount field accepts local format', markup.includes('placeholder="500.000"') && !markup.includes('type="number"')],
  ['ticker names the fallback source', tickerFallback.includes('Coinpaprika') && !tickerFallback.includes('CoinGecko')],
  ['ticker names the primary source', tickerPrimary.includes('CoinGecko')],
  ['tour renders as an accessible dialog', tour.includes('role="dialog"') && tour.includes('aria-modal="true"')],
  ['tour shows progress', tour.includes('Paso 1 de') && tour.includes('role="progressbar"')],
  ['tour offers to skip', tour.includes('Saltar guía')],

  /* error copy ------------------------------------------------------- */
  ['every failure reason has Spanish copy', Object.values(MARKET_ERROR_MESSAGES).every((m) => /[áéíóúñ¿]/i.test(m))],
];

let failed = 0;
for (const [label, ok] of checks) {
  if (!ok) failed += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`);
}

if (failed > 0) {
  console.error(`\n${failed} check(s) failed.`);
  process.exit(1);
}

console.log(`\nAll ${checks.length} checks passed (rendered ${markup.length} chars).`);
