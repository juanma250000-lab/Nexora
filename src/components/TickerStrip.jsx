import { memo } from 'react';
import { Globe2 } from 'lucide-react';
import { formatCOP } from '../lib/format';
import { MARKET_SOURCES } from '../lib/marketApi';
import { Change } from './primitives';

const SOURCE_LABELS = {
  [MARKET_SOURCES.COINGECKO]: 'Datos: CoinGecko',
  [MARKET_SOURCES.COINPAPRIKA]: 'Datos: Coinpaprika (respaldo)',
};

/** Horizontal strip with the most relevant quotes of the current page. */
function TickerStripImpl({ coins, dataSource, onSelectAsset }) {
  if (!coins.length) return null;
  const sourceLabel = SOURCE_LABELS[dataSource];

  return (
    <section className="nx-ticker" aria-labelledby="nx-ticker-title">
      <div className="nx-ticker-inner">
        <h2 className="nx-ticker-label" id="nx-ticker-title">
          <span className="nx-live-dot" aria-hidden="true" /> Pulso del mercado
        </h2>

        <ul className="nx-ticker-list">
          {coins.slice(0, 4).map((coin) => (
            <li key={coin.id}>
              <button
                className="nx-ticker-item"
                type="button"
                onClick={() => onSelectAsset(coin.id)}
              >
                <span className="nx-ticker-symbol">{coin.symbol}</span>
                <b>{formatCOP(coin.price)}</b>
                <Change value={coin.change24h} />
              </button>
            </li>
          ))}
        </ul>

        {sourceLabel && (
          <p className="nx-ticker-source">
            <Globe2 size={13} aria-hidden="true" /> {sourceLabel}
          </p>
        )}
      </div>
    </section>
  );
}

/** Memoised: section props are stable, so heavy tables and charts only re-render when their data changes. */
export const TickerStrip = memo(TickerStripImpl);
