import { memo } from 'react';
import { ArrowRight, ArrowUpRight, ChevronLeft, ChevronRight, RefreshCw, Search, TriangleAlert } from 'lucide-react';
import { formatCOP } from '../lib/format';
import { MARKET_SOURCES } from '../lib/marketApi';
import { MARKET_ERROR_MESSAGES } from '../lib/retry';
import { Change, CoinIcon, Sparkline } from './primitives';

const MarketRow = memo(function MarketRow({
  coin,
  isSelected,
  isFirst,
  onSelectAsset,
  onStartTrade,
}) {
  return (
    <article
      className={`nx-market-row ${isSelected ? 'is-selected' : ''}`.trim()}
      aria-current={isSelected ? 'true' : undefined}
      data-tour={isFirst ? 'market-row' : undefined}
    >
      <button
        className="nx-market-asset"
        type="button"
        onClick={() => onSelectAsset(coin.id)}
        aria-label={`Ver detalles de ${coin.name}`}
      >
        <span className="nx-rank" aria-hidden="true">
          {coin.rank}
        </span>
        <CoinIcon coin={coin} />
        <span className="nx-asset-copy">
          {/* Long names are truncated with an ellipsis; the tooltip shows them whole. */}
          <b title={coin.name}>{coin.name}</b>
          <small>{coin.symbol}</small>
        </span>
      </button>

      <button
        className="nx-market-price"
        type="button"
        onClick={() => onSelectAsset(coin.id)}
        aria-label={`Precio de ${coin.name}: ${formatCOP(coin.price)}`}
      >
        {formatCOP(coin.price)}
      </button>

      <Change value={coin.change24h} />

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
        onClick={() => onStartTrade(coin, 'buy')}
      >
        <ArrowUpRight size={17} aria-hidden="true" />
      </button>
    </article>
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

  return (
    <section className="nx-section nx-market-section" id="mercado" aria-labelledby="nx-market-title">
      <div className="nx-section-heading">
        <div>
          <span className="nx-section-index">
            <span className="nx-section-number">01</span> Descubrir
          </span>
          <h2 id="nx-market-title">
            El mercado,
            <br className="nx-mobile-break" /> <span>en movimiento.</span>
          </h2>
          <p className="nx-section-lead">
            Precios y variaciones en pesos colombianos, actualizados desde el mercado global.
          </p>
        </div>

        <div className="nx-market-stats">
          <div>
            <span>CAPITALIZACIÓN · TOP 100 VISIBLES</span>
            <b>{formatCOP(marketCapTotal)}</b>
          </div>
          <div>
            <span>VOLUMEN · 24 H · TOP 100</span>
            <b>{formatCOP(volumeTotal)}</b>
          </div>
        </div>
      </div>

      <div className="nx-market-layout">
        <div className="nx-market-table-wrap" data-tour="market-table">
          <div className="nx-market-toolbar" data-tour="market-search">
            <label className="nx-search">
              <Search size={16} aria-hidden="true" />
              <input
                type="search"
                aria-label="Buscar criptomonedas"
                placeholder="Buscar activo o símbolo"
                value={searchTerm}
                onChange={(event) => onSearchChange(event.target.value)}
              />
            </label>

            <div className="nx-toolbar-meta">
              <span className="nx-result-count">
                {filteredCoins.length} de {coins.length} activos
              </span>
              {isFallbackSource && (
                <span
                  className="nx-source-pill"
                  title="CoinGecko está limitando las consultas; mostramos la fuente de respaldo."
                >
                  Fuente de respaldo
                </span>
              )}
              <span className={`nx-live-pill is-${marketState}`}>
                <span className="nx-live-pill-dot" aria-hidden="true" />
                {liveLabel}
              </span>
            </div>
          </div>

          <div className="nx-market-head" aria-hidden="true">
            <span>ACTIVO</span>
            <span>PRECIO</span>
            <span>24 H</span>
            <span>7 DÍAS</span>
            <span>CAPITALIZACIÓN</span>
            <span>ACCIÓN</span>
          </div>

          <div className="nx-market-rows">
            {filteredCoins.map((coin, index) => (
              <MarketRow
                key={coin.id}
                coin={coin}
                isFirst={index === 0}
                isSelected={selectedId === coin.id}
                onSelectAsset={onSelectAsset}
                onStartTrade={onStartTrade}
              />
            ))}

            {!filteredCoins.length && !coins.length && marketState !== 'sin-conexion' && (
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

            {!filteredCoins.length && (coins.length > 0 || marketState === 'sin-conexion') && (
              <div className="nx-market-empty" role="status">
                <p>
                  {coins.length ? 'No encontramos ese activo en esta página.' : errorMessage}
                </p>

                {!coins.length && marketState === 'sin-conexion' && (
                  <div className="nx-market-empty-actions">
                    <TriangleAlert size={15} aria-hidden="true" />
                    <span>
                      {retryInSeconds > 0
                        ? `Reintentamos automáticamente en ${retryInSeconds} s`
                        : 'Reintentando…'}
                    </span>
                    <button type="button" className="nx-text-action" onClick={onRefresh}>
                      Reintentar ahora
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="nx-market-pagination" role="group" aria-label="Páginas del mercado">
            <button
              type="button"
              aria-label="Página anterior"
              disabled={marketPage === 1}
              onClick={() => onChangePage(Math.max(1, marketPage - 1))}
            >
              <ChevronLeft size={17} aria-hidden="true" />
            </button>
            <span>
              PÁGINA {marketPage} <i aria-hidden="true" /> {pageSize} ACTIVOS POR PÁGINA
            </span>
            <button
              type="button"
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
            <button type="button" className="nx-text-action" onClick={onRefresh}>
              {marketState === 'sin-conexion' ? 'Reintentar ahora' : 'Actualizar ahora'}
            </button>
            <span>Última: {updatedAtLabel}</span>
          </div>
        </div>

        <aside className="nx-market-aside" aria-label="Activo seleccionado">
          <span className="nx-section-index">ACTIVO SELECCIONADO</span>
          {selectedCoin ? (
            <>
              <CoinIcon coin={selectedCoin} size="large" />
              <h3>{selectedCoin.name}</h3>
              <p className="nx-aside-symbol">
                {selectedCoin.symbol} <span>#{selectedCoin.rank}</span>
              </p>
              <strong className="nx-aside-price">{formatCOP(selectedCoin.price)}</strong>
              <Change value={selectedCoin.change24h} />
              <div className="nx-aside-divider" aria-hidden="true" />
              <div className="nx-aside-stats">
                <div className="nx-aside-stat">
                  <span>Capitalización</span>
                  <b>{formatCOP(selectedCoin.marketCap)}</b>
                </div>
                <div className="nx-aside-stat">
                  <span>Volumen · 24 h</span>
                  <b>{formatCOP(selectedCoin.volume)}</b>
                </div>
              </div>
              <button
                className="nx-button nx-button-primary nx-aside-buy"
                type="button"
                onClick={() => onStartTrade(selectedCoin, 'buy')}
              >
                Explorar compra <ArrowRight size={15} aria-hidden="true" />
              </button>
            </>
          ) : (
            <p>Selecciona un activo para consultar sus datos.</p>
          )}
        </aside>
      </div>
    </section>
  );
}

/** Memoised: section props are stable, so heavy tables and charts only re-render when their data changes. */
export const MarketSection = memo(MarketSectionImpl);
