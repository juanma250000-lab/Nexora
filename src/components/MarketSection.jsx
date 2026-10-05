import { memo } from 'react';
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Plus,
  RefreshCw,
  Search,
  SearchX,
  TriangleAlert,
  X,
} from 'lucide-react';
import { formatCOP } from '../lib/format';
import { MARKET_SOURCES } from '../lib/marketApi';
import { MARKET_ERROR_MESSAGES } from '../lib/retry';
import { Change, CoinIcon, Sparkline } from './primitives';
import { SectionHeading } from './SectionHeading';

/** Clicks on the row's own buttons are handled by those buttons. */
const stop = (event) => event.stopPropagation();

const MarketRow = memo(function MarketRow({ coin, isSelected, onSelectAsset, onStartTrade }) {
  return (
    // The whole row is a mouse/touch target; keyboard and screen-reader users
    // get the same action from the asset button, so the price needs no
    // duplicate tab stop of its own.
    <li
      className={`nx-market-row ${isSelected ? 'is-selected' : ''}`.trim()}
      onClick={() => onSelectAsset(coin.id)}
    >
      <button
        className="nx-market-asset"
        type="button"
        onClick={(event) => {
          stop(event);
          onSelectAsset(coin.id);
        }}
        aria-current={isSelected ? 'true' : undefined}
      >
        <span className="nx-rank" aria-hidden="true">
          {coin.rank}
        </span>
        <CoinIcon coin={coin} />
        <span className="nx-asset-copy">
          <b>{coin.name}</b>
          <small>{coin.symbol}</small>
        </span>
      </button>

      <span className="nx-market-price">
        <span className="nx-sr-only">Precio: </span>
        {formatCOP(coin.price)}
      </span>

      <Change value={coin.change24h} className="nx-market-change" />

      <div className="nx-row-spark" aria-hidden="true">
        <Sparkline coin={coin} />
      </div>

      <span className="nx-market-cap">
        <span className="nx-sr-only">Capitalización: </span>
        {formatCOP(coin.marketCap)}
      </span>

      <button
        className="nx-row-action"
        type="button"
        aria-label={`Comprar ${coin.name}`}
        title={`Simular compra de ${coin.symbol}`}
        onClick={(event) => {
          stop(event);
          onStartTrade(coin, 'buy');
        }}
      >
        <Plus size={16} aria-hidden="true" />
      </button>
    </li>
  );
});

function MarketSectionImpl({
  coins,
  filteredCoins,
  searchTerm,
  onSearchChange,
  selectedId,
  onSelectAsset,
  marketState,
  liveLabel,
  updatedAtLabel,
  marketPage,
  onChangePage,
  pageSize,
  selectedCoin,
  marketCapTotal,
  volumeTotal,
  onStartTrade,
  onRefresh,
  marketError,
  retryInSeconds,
  dataSource,
  // Reported by the source that actually answered: pagination must stop
  // where the data stops, not where `coins.length` happens to fall.
  hasMore = true,
}) {
  const isFallbackSource = dataSource === MARKET_SOURCES.COINPAPRIKA;
  const errorMessage =
    MARKET_ERROR_MESSAGES[marketError] || MARKET_ERROR_MESSAGES['sin-conexion'];
  const isLoading = !coins.length && marketState !== 'sin-conexion';
  const isOffline = !coins.length && marketState === 'sin-conexion';
  const noMatches = coins.length > 0 && !filteredCoins.length;

  return (
    <section className="nx-section nx-market-section" id="mercado" aria-labelledby="nx-market-title">
      <SectionHeading
        index="01 · Descubrir"
        titleId="nx-market-title"
        title="El mercado, en movimiento."
        description="Precios y variaciones en pesos colombianos, actualizados desde el mercado global."
      >
        <dl className="nx-stat-group">
          <div className="nx-stat">
            <dt>Capitalización · top 100 visibles</dt>
            <dd>{formatCOP(marketCapTotal)}</dd>
          </div>
          <div className="nx-stat">
            <dt>Volumen 24 h · top 100</dt>
            <dd>{formatCOP(volumeTotal)}</dd>
          </div>
        </dl>
      </SectionHeading>

      <div className="nx-market-layout">
        <div className="nx-panel nx-market-panel">
          <div className="nx-market-toolbar">
            <div className="nx-search">
              <Search size={16} aria-hidden="true" />
              <label htmlFor="nx-market-search" className="nx-sr-only">
                Buscar criptomonedas
              </label>
              <input
                id="nx-market-search"
                type="search"
                placeholder="Buscar activo o símbolo"
                autoComplete="off"
                spellCheck="false"
                enterKeyHint="search"
                value={searchTerm}
                onChange={(event) => onSearchChange(event.target.value)}
              />
              {searchTerm && (
                <button
                  type="button"
                  className="nx-search-clear"
                  aria-label="Limpiar búsqueda"
                  onClick={() => onSearchChange('')}
                >
                  <X size={15} aria-hidden="true" />
                </button>
              )}
            </div>

            <div className="nx-toolbar-meta">
              <span className="nx-result-count" aria-live="polite">
                {filteredCoins.length} de {coins.length} activos
              </span>
              {isFallbackSource && (
                <span
                  className="nx-pill is-warning"
                  title="CoinGecko está limitando las consultas; mostramos la fuente de respaldo."
                >
                  Fuente de respaldo
                </span>
              )}
              <span className={`nx-pill nx-status-pill is-${marketState}`}>
                <i aria-hidden="true" />
                {liveLabel}
              </span>
            </div>
          </div>

          <div className="nx-market-head" aria-hidden="true">
            <span>Activo</span>
            <span>Precio</span>
            <span>24 h</span>
            <span>7 días</span>
            <span>Capitalización</span>
            <span />
          </div>

          <div className="nx-market-scroll">
            {filteredCoins.length > 0 && (
              <ul className="nx-market-rows" aria-label="Cotizaciones del mercado">
                {filteredCoins.map((coin) => (
                  <MarketRow
                    key={coin.id}
                    coin={coin}
                    isSelected={selectedId === coin.id}
                    onSelectAsset={onSelectAsset}
                    onStartTrade={onStartTrade}
                  />
                ))}
              </ul>
            )}

            {isLoading && (
              <div role="status" aria-live="polite">
                <span className="nx-sr-only">Cargando cotizaciones del mercado…</span>
                {Array.from({ length: 6 }, (_, index) => (
                  <div className="nx-skeleton-row" key={index} aria-hidden="true">
                    <span className="nx-skeleton is-strong" />
                    <span className="nx-skeleton" />
                    <span className="nx-skeleton" />
                    <span className="nx-skeleton" />
                    <span className="nx-skeleton" />
                    <span className="nx-skeleton" />
                  </div>
                ))}
              </div>
            )}

            {(noMatches || isOffline) && (
              <div className="nx-market-empty" role="status">
                <span className={`nx-empty-mark ${isOffline ? 'is-warning' : ''}`.trim()} aria-hidden="true">
                  {isOffline ? <TriangleAlert size={20} /> : <SearchX size={20} />}
                </span>
                <p>{noMatches ? 'No encontramos ese activo en esta página.' : errorMessage}</p>

                {noMatches && (
                  <button type="button" className="nx-text-action" onClick={() => onSearchChange('')}>
                    Limpiar búsqueda
                  </button>
                )}

                {isOffline && (
                  <div className="nx-market-empty-actions">
                    <span>
                      {retryInSeconds > 0
                        ? `Reintentamos automáticamente en ${retryInSeconds} s`
                        : 'Reintentando…'}
                    </span>
                    <button type="button" className="nx-button nx-button-secondary nx-button-sm" onClick={onRefresh}>
                      <RefreshCw size={14} aria-hidden="true" /> Reintentar ahora
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="nx-market-pagination" role="group" aria-label="Páginas del mercado">
            <button
              type="button"
              className="nx-icon-button"
              aria-label="Página anterior"
              disabled={marketPage === 1}
              onClick={() => onChangePage(Math.max(1, marketPage - 1))}
            >
              <ChevronLeft size={17} aria-hidden="true" />
            </button>
            <span>
              Página <b>{marketPage}</b> <i aria-hidden="true" /> {pageSize} activos por página
            </span>
            <button
              type="button"
              className="nx-icon-button"
              aria-label="Página siguiente"
              disabled={!hasMore}
              onClick={() => onChangePage(marketPage + 1)}
            >
              <ChevronRight size={17} aria-hidden="true" />
            </button>
          </div>

          <div className="nx-market-footer">
            <span>
              <RefreshCw size={13} aria-hidden="true" /> Actualización automática cada 30 segundos
            </span>
            <span className="nx-market-footer-end">
              <span>Última: {updatedAtLabel}</span>
              <button type="button" className="nx-text-action" onClick={onRefresh}>
                {marketState === 'sin-conexion' ? 'Reintentar ahora' : 'Actualizar ahora'}
              </button>
            </span>
          </div>
        </div>

        <aside className="nx-panel nx-market-aside" aria-labelledby="nx-aside-title">
          <p className="nx-eyebrow" id="nx-aside-title">
            Activo seleccionado
          </p>
          {selectedCoin ? (
            <>
              <div className="nx-aside-identity">
                <CoinIcon coin={selectedCoin} size="large" />
                <div>
                  <h3>{selectedCoin.name}</h3>
                  <p className="nx-aside-symbol">
                    {selectedCoin.symbol} <span>#{selectedCoin.rank}</span>
                  </p>
                </div>
              </div>
              <div className="nx-aside-quote">
                <strong className="nx-aside-price">{formatCOP(selectedCoin.price)}</strong>
                <Change value={selectedCoin.change24h} />
              </div>
              <dl className="nx-aside-stats">
                <div>
                  <dt>Capitalización</dt>
                  <dd>{formatCOP(selectedCoin.marketCap)}</dd>
                </div>
                <div>
                  <dt>Volumen · 24 h</dt>
                  <dd>{formatCOP(selectedCoin.volume)}</dd>
                </div>
              </dl>
              <button
                className="nx-button nx-button-primary nx-aside-buy"
                type="button"
                onClick={() => onStartTrade(selectedCoin, 'buy')}
              >
                Explorar compra <ArrowRight size={15} aria-hidden="true" />
              </button>
            </>
          ) : (
            <p className="nx-aside-empty">Selecciona un activo para consultar sus datos.</p>
          )}
        </aside>
      </div>
    </section>
  );
}

/** Memoised: section props are stable, so heavy tables and charts only re-render when their data changes. */
export const MarketSection = memo(MarketSectionImpl);
