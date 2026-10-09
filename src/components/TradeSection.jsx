import { memo } from 'react';
import { ArrowDownLeft, ArrowRight, ArrowUpRight, ChevronDown, LockKeyhole, ShieldCheck } from 'lucide-react';
import { formatCOP, formatCrypto } from '../lib/format';

/** How the simulator works, in the same terms the guided tour uses. */
const TRADE_STEPS = [
  { title: 'Elige la operación', text: 'Comprar o vender, y el activo digital.' },
  { title: 'Escribe el monto', text: 'En pesos para comprar; en unidades del activo para vender.' },
  { title: 'Revisa y confirma', text: 'Verás la comisión y el total antes de confirmar.' },
];

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
  onUseAll,
  onReview,
  canSubmit,
}) {
  const isBuy = tradeType === 'buy';
  const showError = Boolean(hasAmount && error);

  return (
    <section
      className="nx-section nx-trade-section"
      id="comprar"
      aria-labelledby="nx-trade-title"
    >
      <div className="nx-trade-intro">
        <span className="nx-section-index">
          <span className="nx-section-number">03</span> Simular
        </span>
        <h2 id="nx-trade-title">
          Prueba <span>una estrategia.</span>
        </h2>
        <p className="nx-section-lead">
          Calcula una compra o venta con precios reales. Los movimientos solo modifican este
          portafolio de prueba.
        </p>
        {/* role="list" keeps list semantics in Safari once the bullets are styled away. */}
        <ol className="nx-trade-steps" role="list">
          {TRADE_STEPS.map(({ title, text }, index) => (
            <li key={title}>
              <span className="nx-trade-step-number" aria-hidden="true">
                {index + 1}
              </span>
              <b>{title}</b>
              <span className="nx-trade-step-text">{text}</span>
            </li>
          ))}
        </ol>
        <p className="nx-demo-stamp">
          <ShieldCheck size={16} aria-hidden="true" /> OPERACIÓN SIMULADA · SIN DINERO REAL
        </p>
      </div>

      <div className="nx-trade-card" data-tour="trade-card">
        <div className="nx-trade-card-top">
          <span>ORDEN DE PRUEBA</span>
          <span className="nx-cop-badge">COP</span>
        </div>

        <div
          className={`nx-trade-switch ${isBuy ? '' : 'is-sell'}`.trim()}
          role="group"
          aria-label="Tipo de operación"
        >
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
          {/* Text, not type="number": a number field read "500.000" as 500 and
              rejected the decimal comma Colombian users type. */}
          <input
            id="nx-amount"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            placeholder={isBuy ? '500.000' : '0,00'}
            value={amount}
            aria-invalid={showError ? 'true' : undefined}
            aria-describedby={showError ? 'nx-amount-hint nx-amount-error' : 'nx-amount-hint'}
            onChange={(event) => onAmountChange(event.target.value)}
          />
          {!isBuy && availableBalance > 0 ? (
            <button className="nx-amount-max" type="button" onClick={onUseAll}>
              USAR TODO
            </button>
          ) : (
            <small>{isBuy ? 'COP' : 'UNIDADES'}</small>
          )}
        </div>
        <p className="nx-field-hint" id="nx-amount-hint">
          {isBuy
            ? 'Escribe el monto en pesos, por ejemplo 500.000.'
            : `Disponible: ${formatCrypto(availableBalance)} ${coin?.symbol || ''}. Usa coma para decimales.`}
        </p>

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

        {showError && (
          <p className="nx-field-error" id="nx-amount-error" role="alert">
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
