import { useCallback, useEffect, useRef, useState } from 'react';
import { PAGE_SIZE, PREFETCH_DELAY_MS, REFRESH_MS } from '../lib/constants';
import { mergeCoins } from '../lib/collections';
import { MARKET_SOURCES, requestMarket } from '../lib/marketApi';
import { nextRetryDelay } from '../lib/retry';
import { readMarketPage, saveMarketPage } from '../lib/storage';

/** In-flight page requests, shared across mounts so double effects never refetch. */
const PREFETCHES = new Map();

/**
 * Loads and refreshes one page of the market, converted to COP.
 *
 * The FX rate is a hard dependency: prices are stored already converted,
 * so the effect waits until a rate exists before requesting anything.
 *
 * Scheduling is a self-resolving timeout instead of an interval so a failed
 * request can push the next attempt away (exponential backoff honouring the
 * provider's `Retry-After`) instead of hammering the API every 30 seconds.
 *
 * marketState: 'cargando' | 'actualizando' | 'en-vivo' | 'sin-conexion'
 * marketError: 'limitado' | 'servidor' | 'rechazado' | 'vacio' | 'sin-conexion' | null
 */
export function useMarket(usdCopRate, notify) {
  const [marketPage, setMarketPage] = useState(1);
  const [coins, setCoins] = useState(() => readMarketPage(1)?.coins || []);
  const [coinUniverse, setCoinUniverse] = useState(() => readMarketPage(1)?.coins || []);
  const [hasMore, setHasMore] = useState(true);
  const [marketState, setMarketState] = useState(() =>
    readMarketPage(1) ? 'actualizando' : 'cargando'
  );
  const [marketError, setMarketError] = useState(null);
  const [nextRetryAt, setNextRetryAt] = useState(null);
  const [dataSource, setDataSource] = useState(null);
  const [updatedAt, setUpdatedAt] = useState(() => {
    const cached = readMarketPage(1)?.updatedAt;
    return cached ? new Date(cached) : null;
  });

  // Exposed so a manual refresh can reuse the same effect body.
  const reloadRef = useRef(null);
  const attemptRef = useRef(0);

  // Kept in a ref so the notice below never re-runs the polling effect.
  const notifyRef = useRef(null);
  useEffect(() => {
    notifyRef.current = typeof notify === 'function' ? notify : null;
  }, [notify]);

  useEffect(() => {
    let mounted = true;
    let activeController = null;
    let prefetchTimer = null;
    let retryTimer = null;
    let didPrefetch = false;

    if (!usdCopRate) {
      // Keep showing cached quotes while the exchange rate is unavailable;
      // only fall back to the loading state when there is nothing to show.
      setMarketState(readMarketPage(marketPage)?.coins?.length ? 'actualizando' : 'cargando');
      return () => {
        mounted = false;
        window.clearTimeout(retryTimer);
      };
    }

    const cachedPage = readMarketPage(marketPage);
    if (cachedPage?.coins?.length) {
      setCoins(cachedPage.coins);
      setCoinUniverse((previous) => mergeCoins(previous, cachedPage.coins));
      setUpdatedAt(new Date(cachedPage.updatedAt));
      setMarketState('actualizando');
    } else {
      setCoins([]);
      setMarketState('cargando');
    }

    /** Queues the next attempt. Only failures publish a visible countdown. */
    function schedule(delay, announce) {
      window.clearTimeout(retryTimer);
      if (!mounted) return;
      setNextRetryAt(announce ? new Date(Date.now() + delay) : null);
      retryTimer = window.setTimeout(tick, delay);
    }

    async function loadPage() {
      activeController?.abort();
      activeController = new AbortController();

      const existingPrefetch = PREFETCHES.get(marketPage);
      try {
        // A prefetch that failed resolves to null, so fall back to a direct
        // request instead of treating it as a successful load.
        let result = existingPrefetch ? await existingPrefetch : null;
        if (!result?.coins?.length) {
          result = await requestMarket(marketPage, activeController.signal, usdCopRate);
        }

        if (!mounted) return;
        const { coins: nextCoins, source } = result;
        const timestamp = new Date();

        attemptRef.current = 0;
        setCoins(nextCoins);
        setCoinUniverse((previous) => mergeCoins(previous, nextCoins));
        setMarketState('en-vivo');
        setMarketError(null);
        setDataSource(source);
        setHasMore(result.hasMore !== false);
        setUpdatedAt(timestamp);
        saveMarketPage(marketPage, nextCoins, timestamp.toISOString());

        if (!didPrefetch && nextCoins.length === PAGE_SIZE) {
          didPrefetch = true;
          prefetchTimer = window.setTimeout(() => {
            const nextPage = marketPage + 1;
            const freshCache = readMarketPage(nextPage);
            if (
              !mounted ||
              (freshCache && Date.now() - Date.parse(freshCache.updatedAt) < REFRESH_MS) ||
              PREFETCHES.has(nextPage)
            ) {
              return;
            }

            const controller = new AbortController();
            const request = requestMarket(nextPage, controller.signal, usdCopRate)
              .then((prefetched) => {
                saveMarketPage(nextPage, prefetched.coins, new Date().toISOString());
                if (mounted) setCoinUniverse((previous) => mergeCoins(previous, prefetched.coins));
                return prefetched;
              })
              .catch(() => null)
              .finally(() => PREFETCHES.delete(nextPage));

            PREFETCHES.set(nextPage, request);
          }, PREFETCH_DELAY_MS);
        }

        schedule(REFRESH_MS, false);
      } catch (error) {
        if (!mounted || error.name === 'AbortError') return;

        // The requested page does not exist on the source that is answering.
        // Jump back to the last page that does, instead of showing a connection
        // error for a request that could never succeed.
        if (error.reason === 'pagina' && marketPage > 1) {
          const target = Math.max(1, Math.min(Number(error.maxPage) || 1, marketPage - 1));
          if (target < marketPage) {
            notifyRef.current?.(
              'success',
              `La fuente de respaldo no llega hasta la página ${marketPage}. Volvimos a la página ${target}.`
            );
            setMarketPage(target);
            return;
          }
        }

        attemptRef.current += 1;
        const delay = nextRetryDelay({
          attempt: attemptRef.current,
          retryAfterMs: error.retryAfterMs ?? null,
        });

        console.warn('No se pudo actualizar el mercado, se reintentará en %d s:', delay / 1000, error);
        setMarketState('sin-conexion');
        setMarketError(error.reason || 'sin-conexion');
        schedule(delay, true);
      }
    }

    function tick() {
      loadPage();
    }

    /** Manual refresh: drop the backoff and try again immediately. */
    reloadRef.current = () => {
      window.clearTimeout(retryTimer);
      attemptRef.current = 0;
      loadPage();
    };

    loadPage();

    return () => {
      mounted = false;
      window.clearTimeout(retryTimer);
      window.clearTimeout(prefetchTimer);
      activeController?.abort();
    };
  }, [marketPage, usdCopRate]);

  const refresh = useCallback(() => {
    reloadRef.current?.();
  }, []);

  return {
    marketPage,
    setMarketPage,
    coins,
    coinUniverse,
    marketState,
    marketError,
    nextRetryAt,
    dataSource: dataSource || (coins.length ? MARKET_SOURCES.COINGECKO : null),
    hasMore,
    updatedAt,
    refresh,
    pageSize: PAGE_SIZE,
  };
}
