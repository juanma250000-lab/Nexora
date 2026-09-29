import { memo } from 'react';
import { ArrowDownLeft, ArrowRight, ArrowUpRight, ChevronDown, LockKeyhole, ShieldCheck } from 'lucide-react';
import { formatCOP, formatCrypto } from '../lib/format';

function TradeSectionImpl({
  coin,
  options,
  tradeType,
  onTradeTypeChange,
  amount,
  onAmountChange,
  onAssetChange,
  receivedCrypto,
  tradeValueCOP,
  feeCOP,
  availableBalance,
  totalWithFee,
  error,
  hasAmount,
  onReview,
  canSubmit,
}) {
  const isBuy = tradeType === 'buy';

  return (
    <section
      className="nx-section nx-trade-section"
      id="comprar"
      aria-labelledby="nx-trade-title"
    >
      <div className="nx-trade-intro">
        <span className="nx-section-index">03 / SIMULAR</span>
        <h2 id="nx-trade-title">Prueba una estrategia.</h2>
        <p>
          Calcula una compra o venta con precios reales. Los movimientos solo modifican este
          portafolio de prueba.
        </p>
        <p className="nx-demo-stamp">
          <ShieldCheck size={16} aria-hidden="true" /> OPERACIÓN SIMULADA · SIN DINERO REAL
        </p>
      </div>

      <div className="nx-trade-card">
        <div className="nx-trade-card-top">
          <span>ORDEN DE PRUEBA</span>
          <span className="nx-cop-badge">COP</span>
        </div>

        <div className="nx-trade-switch" role="group" aria-label="Tipo de operación">
          <button
            type="button"
            className={isBuy ? 'is-active' : ''}
            aria-pressed={isBuy}
            onClick={() => onTradeTypeChange('buy')}
          >
            <ArrowDownLeft size={16} aria-hidden="true" /> Comprar
          </button>
          <button
            type="button"
            className={!isBuy ? 'is-active' : ''}
            aria-pressed={!isBuy}
            onClick={() => onTradeTypeChange('sell')}
          >
            <ArrowUpRight size={16} aria-hidden="true" /> Vender
          </button>
        </div>

        <label className="nx-field-label" htmlFor="nx-asset-select">
          Activo digital
        </label>
        <div className="nx-select-wrap">
          <select
            id="nx-asset-select"
            value={coin?.id || ''}
            onChange={(event) => onAssetChange(event.target.value)}
          >
            {options.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name} · {option.symbol}
              </option>
            ))}
          </select>
          <ChevronDown size={16} aria-hidden="true" />
        </div>

        <label className="nx-field-label" htmlFor="nx-amount">
          {isBuy ? 'Monto en pesos colombianos' : `Cantidad en ${coin?.symbol || 'cripto'}`}
        </label>
        <div className="nx-amount-field">
          <span aria-hidden="true">{isBuy ? '$' : coin?.symbol}</span>
          <input
            id="nx-amount"
            type="number"
            min="0"
            step={isBuy ? '1000' : 'any'}
            inputMode="decimal"
            placeholder={isBuy ? '500000' : '0,00'}
            value={amount}
            onChange={(event) => onAmountChange(event.target.value)}
          />
          <small>{isBuy ? 'COP' : 'UNIDADES'}</small>
        </div>

        <div className="nx-estimate">
          <span>Recibirás aproximadamente</span>
          <b>
            {isBuy
              ? `${formatCrypto(receivedCrypto)} ${coin?.symbol || ''}`
              : formatCOP(tradeValueCOP)}
          </b>
        </div>

        <div className="nx-trade-lines">
          <div>
            <span>Precio de referencia</span>
            <b>
              {formatCOP(coin?.price || 0)} / {coin?.symbol || 'activo'}
            </b>
          </div>
          <div>
            <span>Comisión estimada · 0,1 %</span>
            <b>{formatCOP(feeCOP)}</b>
          </div>
          <div className="nx-trade-total">
            <span>{isBuy ? 'Total estimado' : 'Saldo disponible'}</span>
            <b>
              {isBuy
                ? formatCOP(totalWithFee)
                : `${formatCrypto(availableBalance)} ${coin?.symbol || ''}`}
            </b>
          </div>
        </div>

        {hasAmount && error && (
          <p className="nx-field-error" role="alert">
            {error}
          </p>
        )}

        <button
          className="nx-button nx-button-primary nx-trade-submit"
          type="button"
          onClick={onReview}
          disabled={!canSubmit}
        >
          {isBuy ? 'Revisar compra' : 'Revisar venta'} <ArrowRight size={16} aria-hidden="true" />
        </button>

        <p className="nx-trade-foot">
          <LockKeyhole size={13} aria-hidden="true" /> Vista previa; nada se ejecuta en una
          plataforma de intercambio.
        </p>
      </div>
    </section>
  );
}

/** Memoised: section props are stable, so heavy tables and charts only re-render when their data changes. */
export const TradeSection = memo(TradeSectionImpl);
