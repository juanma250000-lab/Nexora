import { useEffect, useMemo, useState } from 'react';
import { matchesPrice, requestDailyCloses } from '../lib/priceSeries';

/** Pairs already resolved, so switching assets never refetches the same data. */
const CACHE = new Map();
/** Daily candles barely move, so a short TTL is enough to stay cheap. */
const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Resolves the seven-day series used by the big charts.
 *
 * Uses the sparkline bundled with the market row when there is one. When the
 * app is running on the fallback source, which has no history at all, the
 * series is fetched from Binance and its final point is replaced with the live
 * price, so the "AHORA" end of the axis really is the price on screen.
 *
 * status: 'cargando' | 'listo' | 'sin-datos'
 *
 * @returns {{series: number[]|null, status: string}}
 */
export function useCoinHistory(coin, usdCopRate) {
  const symbol = coin?.symbol || '';
  const native =
    Array.isArray(coin?.history) && coin.history.length >= 2 ? coin.history : null;

  const [fetched, setFetched] = useState(() => null);
  const [phase, setPhase] = useState(() => 'cargando');

  useEffect(() => {
    if (native) {
      // Bundled sparkline: nothing to request. These setters bail out when the
      // value is unchanged, so the 30 s market tick costs nothing here.
      setFetched(null);
      setPhase('listo');
      return undefined;
    }
    if (!symbol) {
      setFetched(null);
      setPhase('sin-datos');
      return undefined;
    }
    if (!Number.isFinite(usdCopRate) || usdCopRate <= 0) {
      // The series is quoted in USD but drawn in COP: still waiting for the
      // rate, which is a loading state, not a failure.
      setFetched(null);
      setPhase('cargando');
      return undefined;
    }

    const ticker = symbol.toUpperCase();
    const cached = CACHE.get(ticker);
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
      setFetched(cached.closes);
      setPhase('listo');
      return undefined;
    }

    let cancelled = false;
    const controller = new AbortController();
    setPhase('cargando');

    requestDailyCloses(ticker, controller.signal).then((closes) => {
      if (cancelled) return;
      if (closes) {
        CACHE.set(ticker, { closes, at: Date.now() });
        setFetched(closes);
        setPhase('listo');
      } else {
        setFetched(null);
        setPhase('sin-datos');
      }
    });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [native, symbol, usdCopRate]);

  const series = useMemo(() => {
    if (native) return native;
    if (!fetched) return null;

    const price = coin?.price;
    if (!Number.isFinite(price) || !Number.isFinite(usdCopRate) || usdCopRate <= 0) return null;

    // Same asset? The pair belongs to a ticker, not to a coin id, so it has
    // to be checked against the price we are already showing.
    if (!matchesPrice(fetched, price / usdCopRate)) return null;

    const points = fetched.map((close) => close * usdCopRate);
    points[points.length - 1] = price;
    return points;
  }, [native, fetched, coin?.price, usdCopRate]);

  const status = native ? 'listo' : series ? 'listo' : fetched ? 'sin-datos' : phase;

  return { series, status };
}
