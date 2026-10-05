import { ArrowLeftRight, ArrowRight, ShieldCheck } from 'lucide-react';
import { FEE_RATE } from '../lib/constants';
import { formatCOP, formatCrypto } from '../lib/format';
import { CoinIcon } from './primitives';
import { ModalShell } from './ModalShell';

const FEE_LABEL = `${String(FEE_RATE * 100).replace('.', ',')} %`;

/** Second step of a simulated order: reviews the numbers before applying them. */
export function TradeReviewModal({
  coin,
  tradeType,
  amount,
  receivedCrypto,
  feeCOP,
  totalWithFee,
  netProceeds,
  onClose,
  onConfirm,
}) {
  if (!coin) return null;
  const isBuy = tradeType === 'buy';

  return (
    <ModalShell onClose={onClose} labelledBy="nx-review-title" describedBy="nx-review-description">
      <div className="nx-modal-mark" aria-hidden="true">
        <ArrowLeftRight size={21} />
      </div>
      <p className="nx-eyebrow">Revisión de prueba</p>
      <h2 id="nx-review-title">Confirma el movimiento.</h2>
      <p id="nx-review-description">
        Esta operación solo actualizará el portafolio de demostración de este dispositivo.
      </p>

      <div className="nx-review-asset">
        <CoinIcon coin={coin} />
        <span>
          <b>{coin.name}</b>
          <small>
            {coin.symbol} · {formatCOP(coin.price)}
          </small>
        </span>
        <span className={`nx-pill ${isBuy ? 'is-accent' : 'is-danger'}`}>{isBuy ? 'Compra' : 'Venta'}</span>
      </div>

      <dl className="nx-summary nx-review-lines">
        <div>
          <dt>{isBuy ? 'Monto invertido' : 'Cantidad vendida'}</dt>
          <dd>{isBuy ? formatCOP(amount) : `${formatCrypto(amount)} ${coin.symbol}`}</dd>
        </div>
        <div>
          <dt>{isBuy ? 'Activo estimado' : 'Valor estimado'}</dt>
          <dd>{isBuy ? `${formatCrypto(receivedCrypto)} ${coin.symbol}` : formatCOP(amount * coin.price)}</dd>
        </div>
        <div>
          <dt>Comisión · {FEE_LABEL}</dt>
          <dd>{formatCOP(feeCOP)}</dd>
        </div>
        <div className="nx-summary-total">
          <dt>{isBuy ? 'Total estimado' : 'Recibirás'}</dt>
          <dd>{formatCOP(isBuy ? totalWithFee : netProceeds)}</dd>
        </div>
      </dl>

      <div className="nx-modal-actions">
        <button className="nx-button nx-button-secondary" type="button" onClick={onClose}>
          Volver
        </button>
        <button className="nx-button nx-button-primary" type="button" onClick={onConfirm}>
          Confirmar operación simulada <ArrowRight size={16} aria-hidden="true" />
        </button>
      </div>

      <p className="nx-modal-note">
        <ShieldCheck size={14} aria-hidden="true" /> No se transferirá dinero ni criptoactivos reales.
      </p>
    </ModalShell>
  );
}
