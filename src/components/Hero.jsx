import { memo, useMemo } from 'react';
import { Activity, ArrowRight, ShieldCheck, Sparkles } from 'lucide-react';
import { formatCOP, formatPercent } from '../lib/format';
import { useCoinHistory } from '../hooks/useCoinHistory';
import { NavAnchor } from './NavAnchor';
import { ACCENT_COLOR, Change, CoinIcon, LiveBadge, Sparkline } from './primitives';

function HeroImpl({
  liveLabel,
  updatedAtLabel,
  portfolioValue,
  dayChangeCOP,
  portfolioChange,
  heroCoin,
  topCoins,
  visibleAssets,
  marketState,
  onNavigate,
  onOpenAuth,
  onSelectAsset,
  usdCopRate,
}) {
  const { series, status } = useCoinHistory(heroCoin, usdCopRate);
  const heroChartCoin = useMemo(
    () => (heroCoin && series ? { ...heroCoin, history: series } : heroCoin),
    [heroCoin, series]
  );
  const isOffline = marketState === 'sin-conexion';
  const rising = dayChangeCOP >= 0;

  return (
    <section className="nx-hero" id="inicio" aria-labelledby="nx-hero-title">
      <div className="nx-hero-copy">
        <p className="nx-kicker">
          <span className={`nx-live-dot ${isOffline ? 'is-offline' : ''}`.trim()} aria-hidden="true" />
          <span>{liveLabel}</span>
          <span className="nx-kicker-divider" aria-hidden="true" />
          <span>COP · {updatedAtLabel}</span>
        </p>

        <h1 id="nx-hero-title">
          Una nueva forma de ver <span className="nx-hero-accent">tu futuro.</span>
        </h1>

        <p className="nx-hero-description">
          Explora activos digitales, sigue el pulso del mercado y prueba nuevas estrategias desde un
          solo lugar.
        </p>

        <div className="nx-hero-actions">
          <NavAnchor
            className="nx-button nx-button-primary nx-button-lg"
            target="mercado"
            onNavigate={onNavigate}
          >
            Explorar mercado <ArrowRight size={17} aria-hidden="true" />
          </NavAnchor>
          <button className="nx-button nx-button-secondary nx-button-lg" type="button" onClick={onOpenAuth}>
            <Sparkles size={16} aria-hidden="true" /> Crear cuenta de prueba
          </button>
        </div>

        <ul className="nx-hero-facts" aria-label="Lo que ofrece NEXORA">
          <li>
            <b>{visibleAssets || '—'}</b>
            <span>activos con precio en COP</span>
          </li>
          <li>
            <b>30 s</b>
            <span>entre cada actualización</span>
          </li>
          <li>
            <b>$0</b>
            <span>de dinero real en juego</span>
          </li>
        </ul>
      </div>

      <div className="nx-hero-visual">
        <div className="nx-hero-card" role="group" aria-labelledby="nx-hero-card-title">
          <div className="nx-hero-card-top">
            <span id="nx-hero-card-title">Tu portafolio de prueba</span>
            <LiveBadge isLive={marketState === 'en-vivo'} hasData={visibleAssets > 0} />
          </div>

          <p className="nx-hero-total">{formatCOP(portfolioValue)}</p>
          <p className="nx-hero-performance">
            <span className={rising ? 'nx-up' : 'nx-down'}>
              {rising ? '+' : ''}
              {formatCOP(dayChangeCOP)}
            </span>
            <span>
              hoy · {portfolioChange >= 0 ? '+' : '−'}
              {formatPercent(portfolioChange)}
            </span>
          </p>

          <div className="nx-hero-chart">
            {heroCoin ? (
              <Sparkline
                coin={heroChartCoin}
                large
                tone={ACCENT_COLOR}
                emptyLabel={status === 'cargando' ? 'Cargando gráfico…' : 'Gráfico en preparación'}
              />
            ) : (
              <div className="nx-chart-loading" role="status">
                <span className="nx-sr-only">Cargando el gráfico del mercado</span>
                {Array.from({ length: 8 }, (_, index) => (
                  <span key={index} aria-hidden="true" />
                ))}
              </div>
            )}
          </div>
          <div className="nx-chart-labels" aria-hidden="true">
            <span>{heroCoin ? `${heroCoin.symbol} · hace 7 días` : 'Hace 7 días'}</span>
            <span>Ahora</span>
          </div>

          <ul className="nx-hero-coins" aria-label="Activos destacados">
            {topCoins.slice(0, 3).map((coin) => (
              <li key={coin.id}>
                <button
                  className="nx-hero-coin"
                  type="button"
                  onClick={() => onSelectAsset(coin.id)}
                >
                  <CoinIcon coin={coin} />
                  <span className="nx-hero-coin-copy">
                    <b>{coin.symbol}</b>
                    <small>{formatCOP(coin.price)}</small>
                  </span>
                  <Change value={coin.change24h} />
                </button>
              </li>
            ))}
          </ul>

          <p className="nx-hero-card-foot">
            <Activity size={14} aria-hidden="true" />
            <span>
              {visibleAssets ? `${visibleAssets} activos visibles` : 'Conectando al mercado'}
            </span>
            <span className="nx-hero-card-foot-sep" aria-hidden="true" />
            <ShieldCheck size={14} aria-hidden="true" />
            <span>Solo simulación</span>
          </p>
        </div>
      </div>
    </section>
  );
}

/** Memoised: section props are stable, so heavy tables and charts only re-render when their data changes. */
export const Hero = memo(HeroImpl);
