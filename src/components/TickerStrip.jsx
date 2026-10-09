import { memo } from 'react';
import { Globe2 } from 'lucide-react';
import { formatCOP } from '../lib/format';
import { MARKET_SOURCES } from '../lib/marketApi';
import { Change } from './primitives';

/** Horizontal strip with the most relevant quotes of the current page. */
function TickerStripImpl({ coins, onSelectAsset, dataSource }) {
  if (!coins.length) return null;

  return (
    <section className="nx-ticker-strip" aria-label="Cotizaciones destacadas">
      <p className="nx-ticker-label">
        <span className="nx-ticker-pulse" aria-hidden="true" /> PULSO DEL MERCADO
      </p>

      {coins.slice(0, 4).map((coin) => (
        <button
          key={coin.id}
          className="nx-ticker-item"
          type="button"
          onClick={() => onSelectAsset(coin.id)}
        >
          <span>{coin.symbol}</span>
          <b>{formatCOP(coin.price)}</b>
          <Change value={coin.change24h} />
        </button>
      ))}

      <p className="nx-ticker-source">
        {/* Was hard-coded to "CoinGecko" even while the fallback source fed the page. */}
        <Globe2 size={13} aria-hidden="true" /> Fuente:{' '}
        {dataSource === MARKET_SOURCES.COINPAPRIKA ? 'Coinpaprika' : 'CoinGecko'}
      </p>
    </section>
  );
}

/** Memoised: section props are stable, so heavy tables and charts only re-render when their data changes. */
export const TickerStrip = memo(TickerStripImpl);
