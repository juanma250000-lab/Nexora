import { memo } from 'react';
import { ArrowRight, ChevronRight, RotateCcw, Wallet } from 'lucide-react';
import { formatCOP, formatCrypto, formatPercent } from '../lib/format';
import { NavAnchor } from './NavAnchor';
import { Change, CoinIcon } from './primitives';
import { SectionHeading } from './SectionHeading';

function PortfolioSectionImpl({
  distribution,
  portfolioValue,
  portfolioChange,
  cash,
  onSelectAsset,
  onNavigate,
  onRequestReset,
}) {
  const holdings = distribution.holdings;

  return (
    <section className="nx-section nx-portfolio-section" id="portafolio" aria-labelledby="nx-portfolio-title">
      <SectionHeading
        index="04 · Tu espacio"
        titleId="nx-portfolio-title"
        title="Tu portafolio, a tu manera."
        description="Una vista clara de los activos en tu cuenta de demostración."
      >
        <div className="nx-portfolio-total">
          <span className="nx-eyebrow is-muted">Valor de demostración</span>
          <b>{formatCOP(portfolioValue)}</b>
          <Change value={portfolioChange} />
        </div>
      </SectionHeading>

      <div className="nx-portfolio-layout">
        <div className="nx-panel nx-allocation-panel">
          <div className="nx-panel-head">
            <h3 className="nx-eyebrow is-muted">Distribución de activos</h3>
            <span className="nx-panel-meta">
              {holdings.length} {holdings.length === 1 ? 'posición' : 'posiciones'}
            </span>
          </div>

          {holdings.length ? (
            <div className="nx-allocation-content">
              <div
                className="nx-donut"
                style={{ '--nx-donut': distribution.gradient }}
                role="img"
                aria-label={`Distribución: ${holdings
                  .slice(0, 6)
                  .map((coin) => `${coin.name} ${formatPercent(coin.share, 1)}`)
                  .join(', ')}`}
              >
                <div>
                  <span>Valor total</span>
                  <b>{formatCOP(distribution.total)}</b>
                </div>
              </div>

              <ul className="nx-allocation-legend">
                {holdings.slice(0, 6).map((coin) => (
                  <li className="nx-legend-row" key={coin.id}>
                    <i style={{ background: coin.color }} aria-hidden="true" />
                    <span>
                      {coin.name}
                      <small>{coin.symbol}</small>
                    </span>
                    <b>{formatPercent(coin.share, 1)}</b>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="nx-empty-state">
              <span className="nx-empty-mark" aria-hidden="true">
                <Wallet size={22} />
              </span>
              <h3>Tu portafolio espera su primer movimiento.</h3>
              <p>Explora el mercado y simula una compra para verlo crecer.</p>
              <NavAnchor className="nx-text-action" target="mercado" onNavigate={onNavigate}>
                Explorar mercado <ArrowRight size={15} aria-hidden="true" />
              </NavAnchor>
            </div>
          )}
        </div>

        <div className="nx-panel nx-holdings-panel">
          <div className="nx-panel-head">
            <h3 className="nx-eyebrow is-muted">Tus activos</h3>
            <span className="nx-panel-meta">Valor en COP</span>
          </div>

          {holdings.length ? (
            <ul className="nx-holdings">
              {holdings.map((coin) => (
                <li key={coin.id}>
                  <button className="nx-holding-row" type="button" onClick={() => onSelectAsset(coin.id)}>
                    <CoinIcon coin={coin} />
                    <span className="nx-holding-name">
                      <b>{coin.name}</b>
                      <small>
                        {formatCrypto(coin.quantity)} {coin.symbol}
                      </small>
                    </span>
                    <span className="nx-holding-value">
                      <b>{formatCOP(coin.value)}</b>
                      <Change value={coin.change24h} />
                    </span>
                    <ChevronRight size={16} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="nx-holdings-empty">Las posiciones aparecerán aquí.</p>
          )}

          <div className="nx-cash-row">
            <span>
              <Wallet size={16} aria-hidden="true" /> Saldo disponible de prueba
            </span>
            <b>{formatCOP(cash)}</b>
          </div>

          <button className="nx-text-action nx-reset-action" type="button" onClick={onRequestReset}>
            <RotateCcw size={14} aria-hidden="true" /> Restablecer portafolio de prueba
          </button>
        </div>
      </div>
    </section>
  );
}

/** Memoised: section props are stable, so heavy tables and charts only re-render when their data changes. */
export const PortfolioSection = memo(PortfolioSectionImpl);
