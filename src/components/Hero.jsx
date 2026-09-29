import { memo, useMemo } from 'react';
import { Activity, ArrowRight, ArrowUpRight, ShieldCheck } from 'lucide-react';
import { formatCOP } from '../lib/format';
import { useCoinHistory } from '../hooks/useCoinHistory';
import { ACCENT_COLOR, Change, CoinIcon, Sparkline } from './primitives';

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

  return (
    <section className="nx-hero nx-section" id="inicio" aria-labelledby="nx-hero-title">
      <div className="nx-hero-copy">
        <p className="nx-kicker">
          <span
            className={`nx-live-dot ${marketState === 'sin-conexion' ? 'is-offline' : ''}`.trim()}
            aria-hidden="true"
          />
          {liveLabel}
          <span className="nx-kicker-divider" aria-hidden="true" />
          COP · {updatedAtLabel}
        </p>

        <h1 id="nx-hero-title">
          Una nueva forma
          <br />
          de ver <span>tu futuro.</span>
        </h1>

        <p className="nx-hero-description">
          Explora activos digitales, sigue el pulso del mercado y prueba nuevas estrategias desde un
          solo lugar.
        </p>

        <div className="nx-hero-actions">
          <button className="nx-button nx-button-primary" type="button" onClick={() => onNavigate('mercado')}>
            Explorar mercado <ArrowRight size={17} aria-hidden="true" />
          </button>
          <button className="nx-button nx-button-quiet" type="button" onClick={onOpenAuth}>
            Crear cuenta de prueba <ArrowUpRight size={16} aria-hidden="true" />
          </button>
        </div>

        <p className="nx-proof-line">
          <ShieldCheck size={15} aria-hidden="true" /> Solo simulación · Sin movimientos de dinero
          real
        </p>
      </div>

      <div className="nx-market-orbit" role="group" aria-label="Vista previa del mercado">
        <div className="nx-hero-market-glass">
          <div className="nx-preview-topline">
            <span>Vista del mercado</span>
            <span className="nx-preview-live">
              <i aria-hidden="true" /> EN VIVO
            </span>
          </div>

          <p className="nx-preview-total-label">Tu portafolio de prueba</p>
          <p className="nx-preview-total">{formatCOP(portfolioValue)}</p>

          <p className="nx-preview-performance">
            <span className={dayChangeCOP >= 0 ? 'nx-up' : 'nx-down'}>
              {dayChangeCOP >= 0 ? '+' : ''}
              {formatCOP(dayChangeCOP)}
            </span>
            <span className="nx-caption"> hoy · {portfolioChange.toFixed(2)}%</span>
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
              <div className="nx-chart-loading" role="status" aria-label="Cargando el gráfico del mercado">
                <span />
                <span />
                <span />
                <span />
                <span />
                <span />
                <span />
                <span />
              </div>
            )}
          </div>

          <div className="nx-preview-chart-labels">
            <span>HACE 7 DÍAS</span>
            <span>AHORA</span>
          </div>

          <div className="nx-preview-coins">
            {topCoins.slice(0, 3).map((coin) => (
              <button
                className="nx-preview-coin"
                type="button"
                key={coin.id}
                onClick={() => onSelectAsset(coin.id)}
              >
                <CoinIcon coin={coin} />
                <span className="nx-preview-coin-name">
                  <b>{coin.symbol}</b>
                  <small>{formatCOP(coin.price)}</small>
                </span>
                <Change value={coin.change24h} />
              </button>
            ))}
          </div>
        </div>

        <div className="nx-floating-note">
          <span className="nx-note-icon">
            <Activity size={15} aria-hidden="true" />
          </span>
          <span>
            <b>Mercado activo</b>
            <small>{visibleAssets} activos visibles</small>
          </span>
        </div>

        <p className="nx-orbit-caption">DATOS ACTUALIZADOS CADA 30 S</p>
      </div>
    </section>
  );
}

/** Memoised: section props are stable, so heavy tables and charts only re-render when their data changes. */
export const Hero = memo(HeroImpl);
