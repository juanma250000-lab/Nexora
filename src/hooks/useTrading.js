import { FEE_RATE } from '../lib/constants';
import { parseAmount } from '../lib/format';

/**
 * Derives everything the trade form needs and validates the current
 * attempt. Returns `error` as a ready-to-show Spanish message (or null),
 * so the orchestrator only has to branch on it.
 *
 * Buy amounts are pesos and sell amounts are units of the coin; both are
 * parsed with the Colombian conventions ("500.000", "0,25").
 */
export function useTrading({ coin, tradeType, amount, cash, balances }) {
  const raw = String(amount ?? '').trim();
  const parsed = raw ? parseAmount(raw, tradeType === 'buy' ? 'cop' : 'crypto') : 0;
  const isMalformed = raw !== '' && !Number.isFinite(parsed);
  const currentAmount = Number.isFinite(parsed) ? parsed : 0;

  const price = coin?.price || 0;
  const availableBalance = coin ? balances[coin.id] || 0 : 0;

  const receivedCrypto =
    tradeType === 'buy' ? (price > 0 ? currentAmount / price : 0) : currentAmount;
  const tradeValueCOP = tradeType === 'buy' ? currentAmount : currentAmount * price;
  const feeCOP = (Number.isFinite(tradeValueCOP) ? tradeValueCOP : 0) * FEE_RATE;

  let error = null;
  if (!coin) {
    error = 'Selecciona un activo para continuar.';
  } else if (isMalformed) {
    error =
      tradeType === 'buy'
        ? 'Escribe solo números, por ejemplo 500.000.'
        : 'Escribe solo números, por ejemplo 0,25.';
  } else if (!(currentAmount > 0)) {
    error = 'Ingresa un monto mayor que cero.';
  } else if (!(price > 0)) {
    error = 'Este activo no tiene un precio disponible en este momento.';
  } else if (tradeType === 'buy' && currentAmount + feeCOP > cash) {
    error = 'El saldo de demostración no alcanza para esta compra.';
  } else if (tradeType === 'sell' && currentAmount > availableBalance) {
    error = `No tienes suficiente ${coin.symbol} en el portafolio de prueba.`;
  }

  return {
    currentAmount,
    availableBalance,
    receivedCrypto,
    tradeValueCOP,
    feeCOP,
    totalWithFee: tradeValueCOP + feeCOP,
    netProceeds: tradeValueCOP - feeCOP,
    error,
    hasInput: raw !== '',
    canSubmit: Boolean(coin) && currentAmount > 0 && !isMalformed,
  };
}
