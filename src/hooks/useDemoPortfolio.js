import { useCallback, useEffect, useRef, useState } from 'react';
import { INITIAL_CASH, INITIAL_BALANCES, TOAST_DURATION_MS } from '../lib/constants';
import { readDemoPortfolio, saveDemoPortfolio } from '../lib/storage';

/** Short, human-readable reference that stays unique within the session. */
let sequence = 0;
function nextRecordId() {
  sequence = (sequence + 1) % 100;
  return `NX-${Date.now().toString().slice(-7)}${String(sequence).padStart(2, '0')}`;
}

/**
 * Demo portfolio state: fiat balance, coin balances and the local activity log.
 * Everything is persisted to localStorage and never leaves the device.
 */
export function useDemoPortfolio() {
  const initial = useRef(readDemoPortfolio());
  const [balances, setBalances] = useState(initial.current.balances);
  const [cash, setCash] = useState(initial.current.cash);
  const [activity, setActivity] = useState(initial.current.activity);

  useEffect(() => {
    saveDemoPortfolio({ balances, cash, activity });
  }, [balances, cash, activity]);

  /** Applies a simulated trade to balances, cash and the activity log. */
  const executeTrade = useCallback(({ coin, type, quantity, total, fee }) => {
    if (!coin) return null;

    const record = {
      id: nextRecordId(),
      coinId: coin.id,
      name: coin.name,
      symbol: coin.symbol,
      type,
      quantity,
      price: coin.price,
      total,
      fee,
      date: new Date().toISOString(),
      simulated: true,
    };

    setBalances((previous) => ({
      ...previous,
      [coin.id]: Math.max(0, (previous[coin.id] || 0) + (type === 'buy' ? quantity : -quantity)),
    }));
    setCash((previous) => previous + (type === 'buy' ? -(total + fee) : total - fee));
    setActivity((previous) => [record, ...previous]);

    return record;
  }, []);

  /** Restores the factory demo state. */
  const resetPortfolio = useCallback(() => {
    setBalances({ ...INITIAL_BALANCES });
    setCash(INITIAL_CASH);
    setActivity([]);
  }, []);

  return { balances, cash, activity, executeTrade, resetPortfolio };
}

/** Simple toast state with automatic dismissal. */
export function useToast() {
  const [toast, setToast] = useState(null);
  const timerRef = useRef(null);

  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  const notify = useCallback((type, text) => {
    setToast({ type, text, id: Date.now() });
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setToast(null), TOAST_DURATION_MS);
  }, []);

  const dismissToast = useCallback(() => {
    window.clearTimeout(timerRef.current);
    setToast(null);
  }, []);

  return { toast, notify, dismissToast };
}
