import { memo, useState } from 'react';
import { ArrowRight, ChevronRight, RotateCcw, Wallet } from 'lucide-react';
import { formatCOP, formatCrypto } from '../lib/format';
import { Change, CoinIcon } from './primitives';

function PortfolioSectionImpl({
  distribution,
  portfolioValue,
  portfolioChange,
  cash,
  onSelectAsset,
  onNavigate,
  onReset,
}) {
  const holdings = distribution.holdings;
  // Two-step reset: wiping balances and history must never be a single misclick.
  const [confirmingReset, setConfirmingReset] = useState(false);

  return (
    <section
      className="nx-section nx-portfolio-section"
      id="portafolio"
      aria-labelledby="nx-portfolio-title"
    >
      <div className="nx-section-heading">
        <div>
          <span className="nx-section-index">04 / TU ESPACIO</span>
          <h2 id="nx-portfolio-title">
            Tu portafolio,
            <br className="nx-mobile-break" /> a tu manera.
          </h2>
          <p>Una vista clara de los activos en tu cuenta de demostración.</p>
        </div>

        <div className="nx-portfolio-total">
          <span>VALOR DE DEMOSTRACIÓN</span>
          <b>{formatCOP(portfolioValue)}</b>
          <Change value={portfolioChange} />
        </div>
      </div>

      <div className="nx-portfolio-layout">
        <div className="nx-allocation-panel">
          <div className="nx-allocation-head">
            <span>DISTRIBUCIÓN DE ACTIVOS</span>
            <span>{holdings.length} posiciones</span>
          </div>

          {holdings.length ? (
            <div className="nx-allocation-content">
              <div className="nx-donut" style={{ '--nx-donut': distribution.gradient }}>
                <div>
                  <span>VALOR TOTAL</span>
                  <b>{formatCOP(distribution.total)}</b>
                </div>
              </div>

              <div className="nx-allocation-legend">
                {holdings.slice(0, 6).map((coin) => (
                  <div className="nx-legend-row" key={coin.id}>
                    <i style={{ background: coin.color }} aria-hidden="true" />
                    <span>
                      {coin.name}
                      <small>{coin.symbol}</small>
                    </span>
                    <b>{coin.share.toFixed(1)}%</b>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="nx-empty-state">
              <span className="nx-empty-mark">
                <Wallet size={22} aria-hidden="true" />
              </span>
              <h3>Tu portafolio espera su primer movimiento.</h3>
              <p>Explora el mercado y simula una compra para verlo crecer.</p>
              <button className="nx-text-action" type="button" onClick={() => onNavigate('mercado')}>
                Explorar mercado <ArrowRight size={15} aria-hidden="true" />
              </button>
            </div>
          )}
        </div>

        <div className="nx-holdings-panel" data-tour="portfolio">
          <div className="nx-allocation-head">
            <span>TUS ACTIVOS</span>
            <span>PRECIO EN COP</span>
          </div>

          {holdings.length ? (
            holdings.map((coin) => (
              <button
                key={coin.id}
                className="nx-holding-row"
                type="button"
                onClick={() => onSelectAsset(coin.id)}
              >
                <CoinIcon coin={coin} />
                <span className="nx-holding-name">
                  <b>{coin.name}</b>
                  <small>
                    {formatCrypto(coin.quantity)} {coin.symbol}
                  </small>
                </span>
                <span className="nx-holding-value">
                  <b>{formatCOP(coin.value)}</b>
                  <small>
                    <Change value={coin.change24h} />
                  </small>
                </span>
                <ChevronRight size={16} aria-hidden="true" />
              </button>
            ))
          ) : (
            <p className="nx-holdings-empty">Las posiciones aparecerán aquí.</p>
          )}

          <p className="nx-cash-row">
            <span>
              <Wallet size={16} aria-hidden="true" /> Saldo disponible de prueba
            </span>
            <b>{formatCOP(cash)}</b>
          </p>

          <div className="nx-portfolio-reset">
            {confirmingReset ? (
              <>
                <span role="alert">¿Restablecer saldos e historial de prueba?</span>
                <button
                  className="nx-text-action is-danger"
                  type="button"
                  onClick={() => {
                    setConfirmingReset(false);
                    onReset();
                  }}
                >
                  Sí, restablecer
                </button>
                <button className="nx-text-action" type="button" onClick={() => setConfirmingReset(false)}>
                  Cancelar
                </button>
              </>
            ) : (
              <button className="nx-text-action" type="button" onClick={() => setConfirmingReset(true)}>
                <RotateCcw size={14} aria-hidden="true" /> Restablecer portafolio
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

/** Memoised: section props are stable, so heavy tables and charts only re-render when their data changes. */
export const PortfolioSection = memo(PortfolioSectionImpl);
