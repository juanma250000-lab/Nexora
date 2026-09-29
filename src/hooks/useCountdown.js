import { useEffect, useState } from 'react';

/**
 * Seconds remaining until `target` (a Date, or null when there is nothing to
 * wait for). Ticks once per second and stops as soon as the countdown runs out.
 *
 * Used by the market panel to explain *why* the next automatic retry is delayed
 * instead of leaving the user staring at a frozen error message.
 */
export function useCountdown(target) {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (!(target instanceof Date) || Number.isNaN(target.getTime())) {
      setSeconds(0);
      return undefined;
    }

    const compute = () => Math.max(0, Math.ceil((target.getTime() - Date.now()) / 1000));
    setSeconds(compute());

    const timer = window.setInterval(() => {
      const remaining = compute();
      setSeconds(remaining);
      if (remaining <= 0) window.clearInterval(timer);
    }, 1000);

    return () => window.clearInterval(timer);
  }, [target]);

  return seconds;
}
