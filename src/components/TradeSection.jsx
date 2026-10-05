import { memo } from 'react';
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  ChevronDown,
  CircleAlert,
  LockKeyhole,
  ShieldCheck,
} from 'lucide-react';
import { FEE_RATE } from '../lib/constants';
import { formatCOP, formatCrypto } from '../lib/format';
import { SectionHeading } from './SectionHeading';

const BUY_PRESETS = [100000, 500000, 1000000];
const SELL_PRESETS = [0.25, 0.5, 1];
const FEE_LABEL = `${String(FEE_RATE * 100).replace('.', ',')} %`;

const STEPS = [
  { title: 'Elige un activo', text: 'Cualquiera de los que ves en el mercado, con su precio real.' },
  { title: 'Define el monto', text: 'En pesos para comprar o en unidades para vender.' },
  { title: 'Revisa y confirma', text: 'Ves la comisión y el total antes de aplicar el movimiento.' },
];

/** Shortcut chips: whole-peso amounts for buys, shares of the balance for sells. */
function QuickAmounts({ isBuy, cash, availableBalance, onAmountChange }) {
  if (isBuy) {
    // The fee is charged on top of the amount, so "all of it" leaves room for it.
    const maxBuy = Math.floor(Math.max(0, cash) / (1 + FEE_RATE));
    return (
      <div className="nx-chips" role="group" aria-label="Montos rápidos">
        {BUY_PRESETS.map((value) => (
          <button key={value} type="button" className="nx-chip" onClick={() => onAmountChange(String(value))}>
            {formatCOP(value)}
          </button>
        ))}
        <button
          type="button"
          className="nx-chip"
          disabled={maxBuy <= 0}
          onClick={() => onAmountChange(String(maxBuy))}
        >
          Máximo
        </button>
      </div>
    );
  }

  return (
    <div className="nx-chips" role="group" aria-label="Porción del saldo a vender">
      {SELL_PRESETS.map((share) => (
        <button
          key={share}
          type="button"
          className="nx-chip"
          disabled={availableBalance <= 0}
          onClick={() => onAmountChange(String(Number((availableBalance * share).toFixed(8))))}
        >
          {share === 1 ? 'Todo' : `${share * 100} %`}
        </button>
      ))}
    </div>
  );
}

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
  cash,
  totalWithFee,
  error,
  hasAmount,
  onReview,
  canSubmit,
}) {
  const isBuy = tradeType === 'buy';
  const showError = Boolean(hasAmount && error);
  const symbol = coin?.symbol || '';

  const handleSubmit = (event) => {
    event.preventDefault();
    if (canSubmit) onReview();
  };

  return (
    <section className="nx-section nx-trade-section" id="comprar" aria-labelledby="nx-trade-title">
      <div className="nx-trade-intro">
        <SectionHeading
          index="03 · Simular"
          titleId="nx-trade-title"
          title="Prueba una estrategia."
          description="Calcula una compra o venta con precios reales. Los movimientos solo modifican este portafolio de prueba."
        />

        <ol className="nx-steps">
          {STEPS.map((step, index) => (
            <li key={step.title}>
              <span className="nx-step-index" aria-hidden="true">
                {index + 1}
              </span>
              <span>
                <b>{step.title}</b>
                <small>{step.text}</small>
              </span>
            </li>
          ))}
        </ol>

        <p className="nx-demo-stamp">
          <ShieldCheck size={16} aria-hidden="true" /> Operación simulada · sin dinero real
        </p>
      </div>

      <form className="nx-panel nx-trade-card" onSubmit={handleSubmit} noValidate>
        <div className="nx-trade-card-top">
          <span className="nx-eyebrow is-muted">Orden de prueba</span>
          <span className="nx-pill is-accent">COP</span>
        </div>

        <div className="nx-segmented" role="group" aria-label="Tipo de operación">
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
            className={!isBuy ? 'is-active is-sell' : ''}
            aria-pressed={!isBuy}
            onClick={() => onTradeTypeChange('sell')}
          >
            <ArrowUpRight size={16} aria-hidden="true" /> Vender
          </button>
        </div>

        <label className="nx-field-label" htmlFor="nx-asset-select">
          Activo digital
        </label>
        <div className="nx-select">
          <select
            id="nx-asset-select"
            value={coin?.id || ''}
            disabled={!options.length}
            onChange={(event) => onAssetChange(event.target.value)}
          >
            {!options.length && <option value="">Cargando activos…</option>}
            {options.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name} · {option.symbol}
              </option>
            ))}
          </select>
          <ChevronDown size={16} aria-hidden="true" />
        </div>

        <div className="nx-field-row">
          <label className="nx-field-label" htmlFor="nx-amount">
            {isBuy ? 'Monto en pesos colombianos' : `Cantidad en ${symbol || 'cripto'}`}
          </label>
          <span className="nx-field-hint" id="nx-amount-hint">
            {isBuy
              ? `Disponible: ${formatCOP(cash)}`
              : `Disponible: ${formatCrypto(availableBalance)} ${symbol}`}
          </span>
        </div>
        <div className={`nx-amount-field ${showError ? 'is-invalid' : ''}`.trim()}>
          <span aria-hidden="true">{isBuy ? '$' : symbol}</span>
          <input
            id="nx-amount"
            type="number"
            min="0"
            step={isBuy ? '1000' : 'any'}
            inputMode="decimal"
            placeholder={isBuy ? '500000' : '0,00'}
            value={amount}
            aria-invalid={showError || undefined}
            aria-describedby={showError ? 'nx-amount-hint nx-amount-error' : 'nx-amount-hint'}
            onChange={(event) => onAmountChange(event.target.value)}
          />
          <small>{isBuy ? 'COP' : 'Unidades'}</small>
        </div>

        <QuickAmounts
          isBuy={isBuy}
          cash={cash}
          availableBalance={availableBalance}
          onAmountChange={onAmountChange}
        />

        {showError && (
          <p className="nx-field-error" id="nx-amount-error" role="alert">
            <CircleAlert size={15} aria-hidden="true" /> {error}
          </p>
        )}

        <div className="nx-estimate">
          <span>Recibirás aproximadamente</span>
          <b>{isBuy ? `${formatCrypto(receivedCrypto)} ${symbol}` : formatCOP(tradeValueCOP)}</b>
        </div>

        <dl className="nx-summary">
          <div>
            <dt>Precio de referencia</dt>
            <dd>
              {formatCOP(coin?.price || 0)} / {symbol || 'activo'}
            </dd>
          </div>
          <div>
            <dt>Comisión estimada · {FEE_LABEL}</dt>
            <dd>{formatCOP(feeCOP)}</dd>
          </div>
          <div className="nx-summary-total">
            <dt>{isBuy ? 'Total estimado' : 'Saldo disponible'}</dt>
            <dd>
              {isBuy ? formatCOP(totalWithFee) : `${formatCrypto(availableBalance)} ${symbol}`}
            </dd>
          </div>
        </dl>

        <button className="nx-button nx-button-primary nx-button-block" type="submit" disabled={!canSubmit}>
          {isBuy ? 'Revisar compra' : 'Revisar venta'} <ArrowRight size={16} aria-hidden="true" />
        </button>

        <p className="nx-form-foot">
          <LockKeyhole size={13} aria-hidden="true" /> Vista previa; nada se ejecuta en una plataforma
          de intercambio.
        </p>
      </form>
    </section>
  );
}

/** Memoised: section props are stable, so heavy tables and charts only re-render when their data changes. */
export const TradeSection = memo(TradeSectionImpl);
