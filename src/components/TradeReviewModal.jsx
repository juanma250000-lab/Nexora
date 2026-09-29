import { ArrowLeftRight, ArrowRight, ShieldCheck } from 'lucide-react';
import { formatCOP, formatCrypto } from '../lib/format';
import { CoinIcon } from './primitives';
import { ModalShell } from './ModalShell';

/** Second step of a simulated order: reviews the numbers before applying them. */
export function TradeReviewModal({ coin, tradeType, amount, receivedCrypto, feeCOP, totalWithFee, netProceeds, onClose, onConfirm }) {
  if (!coin) return null;
  const isBuy = tradeType === 'buy';

  return (
    <ModalShell onClose={onClose} labelledBy="nx-review-title">
      <div className="nx-modal-mark" aria-hidden="true">
        <ArrowLeftRight size={21} />
      </div>
      <span className="nx-section-index">REVISIÓN DE PRUEBA</span>
      <h2 id="nx-review-title">Confirma el movimiento.</h2>
      <p>
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
        <span className="nx-review-type">{isBuy ? 'COMPRA' : 'VENTA'}</span>
      </div>

      <div className="nx-review-lines">
        <div>
          <span>{isBuy ? 'Monto invertido' : 'Cantidad vendida'}</span>
          <b>{isBuy ? formatCOP(amount) : `${formatCrypto(amount)} ${coin.symbol}`}</b>
        </div>
        <div>
          <span>Activo estimado</span>
          <b>{isBuy ? `${formatCrypto(receivedCrypto)} ${coin.symbol}` : formatCOP(amount * coin.price)}</b>
        </div>
        <div>
          <span>Comisión · 0,1 %</span>
          <b>{formatCOP(feeCOP)}</b>
        </div>
        <div className="nx-review-total">
          <span>{isBuy ? 'Total estimado' : 'Recibirás'}</span>
          <b>{formatCOP(isBuy ? totalWithFee : netProceeds)}</b>
        </div>
      </div>

      <button className="nx-button nx-button-primary nx-modal-confirm" type="button" onClick={onConfirm}>
        Confirmar operación simulada <ArrowRight size={16} aria-hidden="true" />
      </button>

      <p className="nx-modal-note">
        <ShieldCheck size={14} aria-hidden="true" /> No se transferirá dinero ni criptoactivos
        reales.
      </p>
    </ModalShell>
  );
}
