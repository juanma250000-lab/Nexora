import {
  CACHE_KEY,
  FX_CACHE_KEY,
  INITIAL_BALANCES,
  INITIAL_CASH,
  MAX_CACHED_PAGES,
  PORTFOLIO_KEY,
} from './constants';

/**
 * localStorage access with a tiny in-memory memo.
 *
 * The market cache can hold several hundred kilobytes; parsing it on every
 * render is wasteful, so the parsed result is reused as long as the raw
 * string has not changed.
 */

let rawMarketCache;
let parsedMarketCache = null;

function parse(raw, fallback) {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function readMarketPages() {
  let raw;
  try {
    raw = localStorage.getItem(CACHE_KEY);
  } catch {
    return {};
  }
  if (raw === rawMarketCache && parsedMarketCache) return parsedMarketCache;

  const value = parse(raw, {});
  rawMarketCache = raw;
  parsedMarketCache = value?.pages && typeof value.pages === 'object' ? value.pages : {};
  return parsedMarketCache;
}

export function readMarketPage(page) {
  const cached = readMarketPages()[page];
  return Array.isArray(cached?.coins) ? cached : null;
}

export function saveMarketPage(page, coins, updatedAt) {
  try {
    const pages = { ...readMarketPages(), [page]: { coins, updatedAt } };
    const recent = Object.entries(pages)
      .sort(([, first], [, second]) => Date.parse(second.updatedAt) - Date.parse(first.updatedAt))
      .slice(0, MAX_CACHED_PAGES);
    localStorage.setItem(CACHE_KEY, JSON.stringify({ pages: Object.fromEntries(recent) }));
    rawMarketCache = undefined;
    parsedMarketCache = null;
  } catch {
    // The live market keeps working when storage is unavailable or full.
  }
}

export function readFxCache() {
  try {
    const value = parse(localStorage.getItem(FX_CACHE_KEY), null);
    return Number.isFinite(value?.rate) && value.rate > 0 ? value : null;
  } catch {
    return null;
  }
}

export function saveFxCache(rate, updatedAt) {
  try {
    localStorage.setItem(FX_CACHE_KEY, JSON.stringify({ rate, updatedAt }));
  } catch {
    // The rate stays in memory for this session.
  }
}

export function readDemoPortfolio() {
  let value = null;
  try {
    value = parse(localStorage.getItem(PORTFOLIO_KEY), null);
  } catch {
    value = null;
  }
  return {
    balances: { ...INITIAL_BALANCES, ...(value?.balances || {}) },
    cash: Number.isFinite(value?.cash) ? value.cash : INITIAL_CASH,
    activity: Array.isArray(value?.activity) ? value.activity : [],
  };
}

export function saveDemoPortfolio(portfolio) {
  try {
    localStorage.setItem(PORTFOLIO_KEY, JSON.stringify(portfolio));
  } catch {
    // The demo portfolio stays available for this session only.
  }
}
