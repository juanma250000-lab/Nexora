import { memo, useId, useMemo, useState } from 'react';
import { pricePath } from '../lib/format';

// Literal colours: SVG presentation attributes are not reliably able to
// resolve CSS custom properties across browsers.
const UP_COLOR = '#5fe3ae';
const DOWN_COLOR = '#ff8590';
export const ACCENT_COLOR = '#7df0cb';

/**
 * Seven-day price curve rendered as an inline SVG.
 * The path is memoised because rows re-render on every market tick.
 */
export const Sparkline = memo(function Sparkline({ coin, large = false, tone, emptyLabel }) {
  // The gradient reference must be unique per instance: the hero and the
  // detail panel both render a large sparkline at the same time.
  const gradientId = `nx-fill-${useId().replace(/:/g, '')}`;
  const width = large ? 720 : 150;
  const height = large ? 230 : 44;
  const history = coin?.history;

  const path = useMemo(
    () => pricePath(history, width, height, large ? 10 : 4),
    [history, width, height, large]
  );

  if (!path) {
    return (
      <div className={large ? 'nx-chart-empty' : 'nx-spark-empty'}>
        {emptyLabel || (large ? 'Gráfico en preparación' : 'Sin histórico')}
      </div>
    );
  }

  const fill = `${path} L${width},${height} L0,${height} Z`;
  const color = tone || (coin.change24h >= 0 ? UP_COLOR : DOWN_COLOR);

  return (
    <svg
      className={large ? 'nx-chart-svg' : 'nx-spark-svg'}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={`Variación de ${coin.name} durante los últimos siete días`}
    >
      {large && (
        <defs>
          <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.28" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
      )}
      {large && <path d={fill} fill={`url(#${gradientId})`} />}
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={large ? 2.5 : 2}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
});

/** Signed percentage change with an up/down colour cue. */
export const Change = memo(function Change({ value, className = '' }) {
  const safe = Number.isFinite(value) ? value : 0;
  const rising = safe >= 0;
  const text = `${Math.abs(safe).toFixed(2)}%`;

  return (
    <span className={`nx-change ${rising ? 'is-up' : 'is-down'} ${className}`.trim()}>
      <span aria-hidden="true">{`${rising ? '+' : '-'}${text}`}</span>
      <span className="nx-sr-only">{`${text}, ${rising ? 'de aumento' : 'de descenso'}`}</span>
    </span>
  );
});

/** Coin logo with a letter fallback when the CDN image is missing or fails to load. */
export const CoinIcon = memo(function CoinIcon({ coin, size = 'normal' }) {
  const large = size === 'large';
  // Remembers which URL failed, so a new coin gets a fresh attempt.
  const [failedSrc, setFailedSrc] = useState(null);
  if (coin.image && coin.image !== failedSrc) {
    return (
      <img
        className={`nx-coin-icon ${large ? 'is-large' : ''}`.trim()}
        src={coin.image}
        alt=""
        width={large ? 49 : 30}
        height={large ? 49 : 30}
        loading="lazy"
        decoding="async"
        onError={() => setFailedSrc(coin.image)}
      />
    );
  }
  return (
    <span
      className={`nx-coin-icon nx-coin-fallback ${large ? 'is-large' : ''}`.trim()}
      aria-hidden="true"
    >
      {String(coin.symbol || coin.name || '?').slice(0, 1)}
    </span>
  );
});
