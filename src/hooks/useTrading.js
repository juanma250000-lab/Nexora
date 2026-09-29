import { FEE_RATE } from '../lib/constants';

/**
 * Derives everything the trade form needs and validates the current
 * attempt. Returns `error` as a ready-to-show Spanish message (or null),
 * so the orchestrator only has to branch on it.
 */
export function useTrading({ coin, tradeType, amount, cash, balances }) {
  const currentAmount = Number.parseFloat(amount) || 0;
  const price = coin?.price || 0;
  const availableBalance = coin ? balances[coin.id] || 0 : 0;

  const receivedCrypto =
    tradeType === 'buy' ? (price > 0 ? currentAmount / price : 0) : currentAmount;
  const tradeValueCOP = tradeType === 'buy' ? currentAmount : currentAmount * price;
  const feeCOP = (Number.isFinite(tradeValueCOP) ? tradeValueCOP : 0) * FEE_RATE;

  let error = null;
  if (!coin) {
    error = 'Selecciona un activo para continuar.';
  } else if (!(currentAmount > 0)) {
    error = 'Ingresa un monto válido para continuar.';
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
    canSubmit: Boolean(coin) && currentAmount > 0,
  };
}
