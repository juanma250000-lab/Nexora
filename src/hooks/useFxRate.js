import { useEffect, useState } from 'react';
import { FX_REFRESH_MS, FX_RETRY_MS } from '../lib/constants';
import { requestUsdCopRate } from '../lib/marketApi';
import { readFxCache, saveFxCache } from '../lib/storage';

/**
 * Keeps the USD -> COP reference rate up to date.
 *
 * Behaviour:
 *  - a cached rate is adopted immediately so the UI never blocks on the network;
 *  - a fresh cache (< 1 h) skips the request entirely;
 *  - a failed request retries with exponential backoff (20 s, 40 s, 80 s …
 *    capped at 5 min) instead of waiting a full hour or hammering the API.
 *
 * Status values: 'cargando' | 'listo' | 'reintentando'
 */
export function useFxRate() {
  const [rate, setRate] = useState(() => readFxCache()?.rate || 0);
  const [status, setStatus] = useState(() => (readFxCache() ? 'listo' : 'cargando'));

  useEffect(() => {
    let mounted = true;
    let controller = null;
    let timer = null;
    let attempt = 0;

    const schedule = (delay) => {
      window.clearTimeout(timer);
      timer = window.setTimeout(run, delay);
    };

    async function run() {
      const cached = readFxCache();
      if (cached?.rate) {
        setRate((current) => (current === cached.rate ? current : cached.rate));
      }

      const isFresh = cached && Date.now() - Date.parse(cached.updatedAt) < FX_REFRESH_MS;
      if (isFresh) {
        attempt = 0;
        setStatus('listo');
        schedule(FX_REFRESH_MS);
        return;
      }

      controller?.abort();
      controller = new AbortController();
      // Status is intentionally not touched here: the first load already starts
      // as 'cargando', a background refresh keeps showing 'listo', and a backoff
      // retry keeps showing 'reintentando'. This avoids label flicker.

      try {
        const nextRate = await requestUsdCopRate(controller.signal);
        if (!mounted) return;
        attempt = 0;
        setRate(nextRate);
        setStatus('listo');
        saveFxCache(nextRate, new Date().toISOString());
        schedule(FX_REFRESH_MS);
      } catch (error) {
        if (!mounted || error.name === 'AbortError') return;
        console.warn('No se pudo actualizar la tasa USD/COP:', error);
        attempt += 1;
        setStatus('reintentando');
        schedule(Math.min(FX_RETRY_MS * 2 ** (attempt - 1), 5 * 60 * 1000));
      }
    }

    run();

    return () => {
      mounted = false;
      window.clearTimeout(timer);
      controller?.abort();
    };
  }, []);

  return { rate, status };
}
