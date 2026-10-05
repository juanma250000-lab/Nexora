import { memo, useMemo } from 'react';
import { CircleHelp } from 'lucide-react';
import { formatCOP } from '../lib/format';
import { useCoinHistory } from '../hooks/useCoinHistory';
import { Change, CoinIcon, LiveBadge, Sparkline } from './primitives';
import { SectionHeading } from './SectionHeading';

function DetailSectionImpl({ coin, usdCopRate, isLive = true }) {
  const { series, status } = useCoinHistory(coin, usdCopRate);
  const history = series || [];

  // The chart reads `coin.history`, so the resolved series is injected here
  // rather than mutating the market row shared with the rest of the screen.
  const chartCoin = useMemo(
    () => (coin && series ? { ...coin, history: series } : coin),
    [coin, series]
  );

  const range = useMemo(() => {
    const clean = history.filter(Number.isFinite);
    if (!clean.length) return { high: coin?.price || 0, low: coin?.price || 0 };
    return { high: Math.max(...clean), low: Math.min(...clean) };
  }, [history, coin?.price]);

  return (
    <section className="nx-section nx-detail-section" id="detalle" aria-labelledby="nx-detail-title">
      <SectionHeading
        index="02 · Analizar"
        titleId="nx-detail-title"
        title="Conoce cada movimiento."
        description="Historial real de precios disponible para los últimos siete días."
      >
        {coin && (
          <div className="nx-detail-current">
            <CoinIcon coin={coin} />
            <span className="nx-detail-current-name">
              <b>{coin.name}</b>
              <small>{coin.symbol}</small>
            </span>
            <span className="nx-detail-current-quote">
              <strong>{formatCOP(coin.price)}</strong>
              <Change value={coin.change24h} />
            </span>
          </div>
        )}
      </SectionHeading>

      <div className="nx-detail-layout">
        <div className="nx-panel nx-chart-panel">
          <div className="nx-panel-head">
            <div>
              <p className="nx-eyebrow is-muted">Evolución del precio</p>
              <h3>
                {coin?.name || 'Mercado'} <small>/ COP</small>
              </h3>
            </div>
            <span className="nx-pill is-accent">7 días</span>
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

          <div className="nx-chart-labels" aria-hidden="true">
            <span>Hace 7 días</span>
            <span>Hace 5 días</span>
            <span>Hace 3 días</span>
            <span>Ahora</span>
          </div>
        </div>

        <div className="nx-panel nx-data-rail">
          <div className="nx-panel-head">
            <p className="nx-eyebrow is-muted">Datos del activo</p>
            <LiveBadge isLive={isLive} />
          </div>

          <dl className="nx-data-list">
            <div>
              <dt>Variación · 24 h</dt>
              <dd>
                <Change value={coin?.change24h || 0} />
              </dd>
            </div>
            <div>
              <dt>Variación · 7 días</dt>
              <dd>
                <Change value={coin?.change7d || 0} />
              </dd>
            </div>
            <div>
              <dt>Máximo en 7 días</dt>
              <dd>{formatCOP(range.high)}</dd>
            </div>
            <div>
              <dt>Mínimo en 7 días</dt>
              <dd>{formatCOP(range.low)}</dd>
            </div>
          </dl>

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
