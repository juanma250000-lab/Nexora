import { memo, useMemo } from 'react';
import { CircleHelp } from 'lucide-react';
import { formatCOP } from '../lib/format';
import { useCoinHistory } from '../hooks/useCoinHistory';
import { Change, CoinIcon, Sparkline } from './primitives';

function DetailSectionImpl({ coin, usdCopRate }) {
  const { series, status } = useCoinHistory(coin, usdCopRate);
  const history = series || [];

  // The chart reads `coin.history`, so the resolved series is injected here
  // rather than mutating the market row shared with the rest of the screen.
  const chartCoin = useMemo(
    () => (coin && series ? { ...coin, history: series } : coin),
    [coin, series]
  );

  return (
    <section className="nx-section nx-detail-section" id="detalle" aria-labelledby="nx-detail-title">
      <div className="nx-detail-heading">
        <div>
          <span className="nx-section-index">02 / ANALIZAR</span>
          <h2 id="nx-detail-title">Conoce cada movimiento.</h2>
          <p>Historial real de precios disponible para los últimos siete días.</p>
        </div>

        {coin && (
          <div className="nx-detail-current">
            <CoinIcon coin={coin} />
            <span>
              <b>{coin.name}</b>
              <small>{coin.symbol}</small>
            </span>
            <strong>{formatCOP(coin.price)}</strong>
            <Change value={coin.change24h} />
          </div>
        )}
      </div>

      <div className="nx-detail-layout">
        <div className="nx-chart-panel">
          <div className="nx-chart-panel-head">
            <div>
              <span>EVOLUCIÓN DEL PRECIO</span>
              <h3>
                {coin?.name || 'Mercado'} <small>/ COP</small>
              </h3>
            </div>
            <span className="nx-chart-period">7 DÍAS</span>
          </div>

          <div className="nx-history-chart">
            {coin ? (
              <Sparkline
                coin={chartCoin}
                large
                emptyLabel={status === 'cargando' ? 'Cargando gráfico…' : 'Gráfico en preparación'}
              />
            ) : (
              <p className="nx-chart-empty">Esperando el primer dato de mercado</p>
            )}
          </div>

          <div className="nx-chart-axis" aria-hidden="true">
            <span>HACE 7 DÍAS</span>
            <span>HACE 5 DÍAS</span>
            <span>HACE 3 DÍAS</span>
            <span>AHORA</span>
          </div>
        </div>

        <div className="nx-data-rail">
          <div className="nx-data-rail-head">
            <span>DATOS DEL ACTIVO</span>
            <span className="nx-data-indicator">
              <i aria-hidden="true" /> EN VIVO
            </span>
          </div>

          <div className="nx-data-cell">
            <span>Variación · 24 h</span>
            <Change value={coin?.change24h || 0} />
          </div>
          <div className="nx-data-cell">
            <span>Variación · 7 días</span>
            <Change value={coin?.change7d || 0} />
          </div>
          <div className="nx-data-cell">
            <span>Precio máximo visible</span>
            <b>{formatCOP(history.length ? Math.max(...history) : coin?.price || 0)}</b>
          </div>
          <div className="nx-data-cell">
            <span>Precio mínimo visible</span>
            <b>{formatCOP(history.length ? Math.min(...history) : coin?.price || 0)}</b>
          </div>

          <p className="nx-data-note">
            <CircleHelp size={15} aria-hidden="true" /> Datos de mercado; no constituyen asesoría
            financiera.
          </p>
        </div>
      </div>
    </section>
  );
}

/** Memoised: section props are stable, so heavy tables and charts only re-render when their data changes. */
export const DetailSection = memo(DetailSectionImpl);
