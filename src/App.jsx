import React, { useState, useEffect } from 'react';
import {
  Wallet,
  ArrowRightLeft,
  History,
  CheckCircle,
  AlertCircle,
  ShieldCheck,
  Search,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

const PAGE_SIZE = 250;
const REFRESH_INTERVAL = 30000;
const MARKET_CACHE_KEY = 'criptoexchange-market-cache';
const MAX_CACHED_PAGES = 4;
const prefetchedMarketPages = new Map();

const formatUsd = (value) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: Math.abs(value) < 1 ? 8 : 2,
  }).format(value);

const getCoinBalance = (coin, balances) => balances[coin.id] || 0;

const readMarketPages = () => {
  try {
    const cached = JSON.parse(localStorage.getItem(MARKET_CACHE_KEY));
    if (cached?.pages && typeof cached.pages === 'object') return cached.pages;
    if (cached?.page && Array.isArray(cached.coins)) return { [cached.page]: cached };
  } catch {
    return {};
  }
  return {};
};

const readMarketCache = (page) => {
  const cachedPage = readMarketPages()[page];
  return Array.isArray(cachedPage?.coins) ? cachedPage : null;
};

const saveMarketCache = (page, marketPage) => {
  try {
    const pages = { ...readMarketPages(), [page]: marketPage };
    const recentPages = Object.entries(pages)
      .sort(([, first], [, second]) => Date.parse(second.updatedAt) - Date.parse(first.updatedAt))
      .slice(0, MAX_CACHED_PAGES);
    localStorage.setItem(MARKET_CACHE_KEY, JSON.stringify({ pages: Object.fromEntries(recentPages) }));
  } catch {
    // The live market still works when browser storage is unavailable.
  }
};

const mapMarketCoins = (data, page) => data.map((coin, index) => ({
  id: coin.id,
  name: coin.name,
  symbol: coin.symbol.toUpperCase(),
  image: coin.image,
  marketRank: (page - 1) * PAGE_SIZE + index + 1,
  price: Number(coin.current_price) || 0,
  change24h: Number((Number(coin.price_change_percentage_24h) || 0).toFixed(2)),
  marketCap: Number(coin.market_cap) || 0,
}));

const fetchMarketPage = async (page, signal) => {
  const marketUrl = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${PAGE_SIZE}&page=${page}&sparkline=false&price_change_percentage=24h`;
  const response = await fetch(marketUrl, { signal });
  if (!response.ok) throw new Error(`CoinGecko respondió ${response.status}`);

  const data = await response.json();
  if (!Array.isArray(data) || data.length === 0) throw new Error('La API no devolvió datos');
  return mapMarketCoins(data, page);
};

export default function App() {
  const [cryptos, setCryptos] = useState([]);
  const [selectedCoinId, setSelectedCoinId] = useState('bitcoin');
  const [marketPage, setMarketPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [connectionStatus, setConnectionStatus] = useState('loading');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [activeTab, setActiveTab] = useState('trading');
  const [tradeType, setTradeType] = useState('buy');
  const [amount, setAmount] = useState('');
  const [usdBalance, setUsdBalance] = useState(10000.0);
  const [cryptoBalances, setCryptoBalances] = useState({
    bitcoin: 0.125,
    ethereum: 1.5,
    solana: 10.0,
    cardano: 500.0,
    ripple: 1000.0,
  });
  const [transactions, setTransactions] = useState([
    {
      id: 'tx-1001',
      date: new Date(Date.now() - 3600000 * 2).toLocaleString('es-ES'),
      type: 'COMPRA',
      symbol: 'BTC',
      amountCrypto: 0.05,
      priceUnit: 63800.0,
      totalUsd: 3190.0,
      status: 'Completada',
    },
  ]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [notification, setNotification] = useState(null);

  useEffect(() => {
    let isMounted = true;
    let requestController;
    let prefetchTimer;
    let prefetchStarted = false;
    const cachedMarket = readMarketCache(marketPage);

    setCryptos(cachedMarket?.coins || []);
    setLastUpdated(cachedMarket?.updatedAt ? new Date(cachedMarket.updatedAt) : null);
    setConnectionStatus(cachedMarket ? 'updating' : 'loading');

    const fetchMarket = async () => {
      requestController?.abort();
      requestController = new AbortController();

      try {
        const prefetchRequest = prefetchedMarketPages.get(marketPage);
        const marketCoins = prefetchRequest
          ? await prefetchRequest
          : await fetchMarketPage(marketPage, requestController.signal);

        if (!isMounted) return;
        const updatedAt = new Date();

        setCryptos(marketCoins);
        setConnectionStatus('live');
        setLastUpdated(updatedAt);
        saveMarketCache(marketPage, { coins: marketCoins, updatedAt: updatedAt.toISOString() });

        if (!prefetchStarted && marketCoins.length === PAGE_SIZE) {
          prefetchStarted = true;
          prefetchTimer = window.setTimeout(async () => {
            const nextPage = marketPage + 1;
            const cachedNextPage = readMarketCache(nextPage);
            const cacheAge = cachedNextPage ? Date.now() - Date.parse(cachedNextPage.updatedAt) : Infinity;
            if (!isMounted || cacheAge < REFRESH_INTERVAL) return;

            const prefetchController = new AbortController();
            try {
              let prefetchRequest;
              prefetchRequest = fetchMarketPage(nextPage, prefetchController.signal)
                .then((nextCoins) => {
                  saveMarketCache(nextPage, { coins: nextCoins, updatedAt: new Date().toISOString() });
                  return nextCoins;
                })
                .finally(() => {
                  if (prefetchedMarketPages.get(nextPage) === prefetchRequest) {
                    prefetchedMarketPages.delete(nextPage);
                  }
                });
              prefetchedMarketPages.set(nextPage, prefetchRequest);
              await prefetchRequest;
            } catch (error) {
              if (isMounted && error.name !== 'AbortError') {
                console.warn('No se pudo precargar la página siguiente del mercado:', error);
              }
            }
          }, 1500);
        }
      } catch (error) {
        if (!isMounted || error.name === 'AbortError') return;
        console.error('Error cargando el mercado de CoinGecko:', error);
        setConnectionStatus('error');
      }
    };

    fetchMarket();
    const interval = setInterval(fetchMarket, REFRESH_INTERVAL);
    return () => {
      isMounted = false;
      clearInterval(interval);
      window.clearTimeout(prefetchTimer);
      requestController?.abort();
    };
  }, [marketPage]);

  const selectedCoin = cryptos.find((coin) => coin.id === selectedCoinId) || cryptos[0];
  const filteredCryptos = cryptos.filter((coin) =>
    `${coin.name} ${coin.symbol}`.toLowerCase().includes(searchTerm.trim().toLowerCase())
  );

  const numAmount = Number.parseFloat(amount) || 0;
  const estimatedCrypto = tradeType === 'buy' ? numAmount / (selectedCoin?.price || 1) : numAmount;
  const estimatedUsd = tradeType === 'buy' ? numAmount : numAmount * (selectedCoin?.price || 0);
  const feeUsd = estimatedUsd * 0.001;

  const handleInitiateTrade = (event) => {
    event.preventDefault();
    setNotification(null);

    if (numAmount <= 0) {
      setNotification({ type: 'error', message: 'Ingresa un monto válido mayor a 0.' });
      return;
    }

    if (tradeType === 'buy' && numAmount + feeUsd > usdBalance) {
      setNotification({ type: 'error', message: 'Saldo en USD insuficiente.' });
      return;
    }

    if (tradeType === 'sell' && numAmount > getCoinBalance(selectedCoin, cryptoBalances)) {
      setNotification({ type: 'error', message: `Saldo en ${selectedCoin.symbol} insuficiente.` });
      return;
    }

    setIsModalOpen(true);
  };

  const handleConfirmTrade = () => {
    if (tradeType === 'buy') {
      setUsdBalance((prevBalance) => prevBalance - (estimatedUsd + feeUsd));
      setCryptoBalances((prevBalances) => ({
        ...prevBalances,
        [selectedCoin.id]: getCoinBalance(selectedCoin, prevBalances) + estimatedCrypto,
      }));
    } else {
      setUsdBalance((prevBalance) => prevBalance + (estimatedUsd - feeUsd));
      setCryptoBalances((prevBalances) => ({
        ...prevBalances,
        [selectedCoin.id]: Math.max(0, getCoinBalance(selectedCoin, prevBalances) - numAmount),
      }));
    }

    const newTx = {
      id: `tx-${Date.now().toString().slice(-4)}`,
      date: new Date().toLocaleString('es-ES'),
      type: tradeType === 'buy' ? 'COMPRA' : 'VENTA',
      symbol: selectedCoin.symbol,
      amountCrypto: Number(estimatedCrypto.toFixed(6)),
      priceUnit: selectedCoin.price,
      totalUsd: Number(estimatedUsd.toFixed(2)),
      status: 'Completada',
    };

    setTransactions((prevTx) => [newTx, ...prevTx]);
    setIsModalOpen(false);
    setAmount('');
    setNotification({
      type: 'success',
      message: `¡Operación exitosa! Has ${tradeType === 'buy' ? 'comprado' : 'vendido'} ${newTx.amountCrypto} ${selectedCoin.symbol}.`,
    });
  };

  const tabItems = [
    { key: 'trading', label: 'Trading', icon: <ArrowRightLeft size={16} /> },
    { key: 'wallet', label: 'Billetera', icon: <Wallet size={16} /> },
    { key: 'history', label: 'Historial', icon: <History size={16} /> },
  ];

  const portfolioValue = cryptos.reduce(
    (sum, coin) => sum + getCoinBalance(coin, cryptoBalances) * coin.price,
    0
  );
  const positiveCoins = cryptos.filter((coin) => coin.change24h >= 0).length;
  const averageChange = cryptos.length
    ? cryptos.reduce((sum, coin) => sum + coin.change24h, 0) / cryptos.length
    : 0;

  const formattedUpdate = lastUpdated
    ? lastUpdated.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : 'Esperando datos';

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-wrap">
          <div className="brand-icon">₿</div>
          <span className="brand-name">CriptoExchange</span>
        </div>

        <nav className="tab-nav" aria-label="Navegación principal">
          {tabItems.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={activeTab === tab.key ? 'tab-btn active' : 'tab-btn'}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>

        <div className="wallet-balance">
          <span>Saldo Fiat:</span>
          <strong>{formatUsd(usdBalance)} USD</strong>
        </div>
      </header>

      {notification && (
        <div className={`alert ${notification.type}`}>
          <div className="alert-icon">
            {notification.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          </div>
          <span>{notification.message}</span>
        </div>
      )}

      <div className="market-summary">
        <div className="summary-card">
          <span>Portfolio total</span>
          <strong>{formatUsd(portfolioValue)}</strong>
          <small>En activos actuales</small>
        </div>
        <div className="summary-card">
          <span>24h promedio</span>
          <strong className={averageChange >= 0 ? 'up-text' : 'down-text'}>
            {averageChange >= 0 ? '+' : ''}
            {averageChange.toFixed(2)}%
          </strong>
          <small>Movimientos del mercado</small>
        </div>
        <div className="summary-card">
          <span>Monedas verdes</span>
          <strong>{positiveCoins}</strong>
          <small>De {cryptos.length} activos</small>
        </div>
      </div>

      {activeTab === 'trading' && (
        <div className="content-grid">
          <section className="panel market-panel">
            <div className="panel-header">
              <div>
                <span className="eyebrow">Mercado en vivo</span>
                <h2>Criptomonedas</h2>
              </div>
              <div className={`live-pill ${connectionStatus}`}>
                <span className="dot" />
                {connectionStatus === 'error' ? 'Sin conexión' : connectionStatus === 'loading' ? 'Conectando' : connectionStatus === 'updating' ? 'Actualizando' : 'En vivo'}
              </div>
            </div>

            <div className="market-tools">
              <label className="search-field">
                <Search size={17} aria-hidden="true" />
                <input
                  type="search"
                  aria-label="Buscar criptomoneda"
                  placeholder="Buscar por nombre o símbolo"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                />
              </label>
              <span className="market-count">{cryptos.length} activos</span>
            </div>

            <div className="coin-list">
              {filteredCryptos.map((coin) => (
                <button
                  key={coin.id}
                  type="button"
                  className={selectedCoin?.id === coin.id ? 'coin-card active' : 'coin-card'}
                  onClick={() => setSelectedCoinId(coin.id)}
                >
                  <div className="coin-main">
                    <span className="coin-rank">{coin.marketRank}</span>
                    <img className="coin-icon" src={coin.image} alt="" loading="lazy" />
                    <div>
                      <strong>{coin.symbol}</strong>
                      <small>{coin.name}</small>
                    </div>
                  </div>

                  <div className="coin-price">{formatUsd(coin.price)}</div>

                  <div className={coin.change24h >= 0 ? 'coin-change up' : 'coin-change down'}>
                    {coin.change24h >= 0 ? '+' : ''}
                    {coin.change24h}%
                  </div>
                </button>
                ))}
              {filteredCryptos.length === 0 && (
                <p className="empty-market">{cryptos.length ? 'No se encontraron monedas.' : 'Cargando precios del mercado...'}</p>
              )}
            </div>
            <div className="market-pagination" aria-label="Páginas del mercado">
              <button
                type="button"
                aria-label="Página anterior"
                disabled={marketPage === 1}
                onClick={() => setMarketPage((page) => Math.max(1, page - 1))}
              >
                <ChevronLeft size={16} />
              </button>
              <span>Página {marketPage} · hasta {PAGE_SIZE} activos</span>
              <button
                type="button"
                aria-label="Página siguiente"
                disabled={cryptos.length < PAGE_SIZE}
                onClick={() => setMarketPage((page) => page + 1)}
              >
                <ChevronRight size={16} />
              </button>
            </div>
            <div className="market-footer">
              <span><RefreshCw size={13} /> Página actualizada cada 30 segundos</span>
              <span>Última: {formattedUpdate}</span>
            </div>
          </section>

          <section className="panel trade-panel">
            {selectedCoin ? <>
            <div className="trade-header">
              <div>
                <span className="eyebrow">Operar</span>
                <h2>{selectedCoin.symbol}</h2>
              </div>
              <div className="trade-type-toggle">
                <button
                  type="button"
                  className={tradeType === 'buy' ? 'toggle-btn active' : 'toggle-btn'}
                  onClick={() => setTradeType('buy')}
                >
                  Comprar
                </button>
                <button
                  type="button"
                  className={tradeType === 'sell' ? 'toggle-btn active' : 'toggle-btn'}
                  onClick={() => setTradeType('sell')}
                >
                  Vender
                </button>
              </div>
            </div>

            <form onSubmit={handleInitiateTrade} className="trade-form">
              <label htmlFor="amount">Monto</label>
              <input
                id="amount"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />

              <div className="trade-summary">
                <div>
                  <span>Precio unitario</span>
                  <strong>{formatUsd(selectedCoin.price)}</strong>
                </div>
                <div>
                  <span>{tradeType === 'buy' ? 'Recibirás' : 'Venderás'}</span>
                  <strong>
                    {estimatedCrypto.toFixed(6)} {selectedCoin.symbol}
                  </strong>
                </div>
                <div>
                  <span>Comisión</span>
                  <strong>{formatUsd(feeUsd)}</strong>
                </div>
              </div>

              <button type="submit" className="primary-btn">
                {tradeType === 'buy' ? 'Comprar ahora' : 'Vender ahora'}
              </button>
            </form>
            </> : <div className="trade-empty">Los precios aparecerán aquí cuando conecte el mercado.</div>}
          </section>
        </div>
      )}

      {activeTab === 'wallet' && (
        <section className="panel wallet-panel">
          <div className="panel-header">
            <div>
              <span className="eyebrow">Resumen</span>
              <h2>Billetera</h2>
            </div>
            <div className="shield-badge">
              <ShieldCheck size={16} />
              Protegida
            </div>
          </div>

          <div className="wallet-grid">
            <div className="wallet-card fiat-card">
              <span>Saldo Fiat (USD)</span>
              <strong>{formatUsd(usdBalance)}</strong>
            </div>

            {cryptos.filter((coin) => getCoinBalance(coin, cryptoBalances) > 0).map((coin) => {
              const balance = getCoinBalance(coin, cryptoBalances);

              return (
                <div key={coin.id} className="wallet-card crypto-card">
                  <div className="wallet-coin-header">
                    <span>{coin.name}</span>
                    <img className="wallet-icon" src={coin.image} alt="" loading="lazy" />
                  </div>
                  <strong>
                    {balance.toFixed(4)} {coin.symbol}
                  </strong>
                  <small>{formatUsd(balance * coin.price)} USD</small>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {activeTab === 'history' && (
        <section className="panel history-panel">
          <div className="panel-header">
            <div>
              <span className="eyebrow">Operaciones</span>
              <h2>Historial</h2>
            </div>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Fecha</th>
                  <th>Tipo</th>
                  <th>Activo</th>
                  <th>Cripto</th>
                  <th>Total USD</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr key={tx.id}>
                    <td>{tx.id}</td>
                    <td>{tx.date}</td>
                    <td>{tx.type}</td>
                    <td>{tx.symbol}</td>
                    <td>
                      {tx.amountCrypto} {tx.symbol}
                    </td>
                    <td>{formatUsd(tx.totalUsd)}</td>
                    <td>
                      <span className="status-badge">{tx.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-card">
            <h3>Confirmar {tradeType === 'buy' ? 'Compra' : 'Venta'}</h3>
            <p>Revisa los detalles antes de ejecutar la transacción.</p>

            <div className="modal-details">
              <div>
                <span>Operación</span>
                <strong>
                  {tradeType === 'buy' ? 'COMPRAR' : 'VENDER'} {selectedCoin.name}
                </strong>
              </div>
              <div>
                <span>Monto cripto</span>
                <strong>
                  {estimatedCrypto.toFixed(6)} {selectedCoin.symbol}
                </strong>
              </div>
              <div>
                <span>Comisión</span>
                <strong>{formatUsd(feeUsd)}</strong>
              </div>
            </div>

            <div className="modal-actions">
              <button type="button" className="secondary-btn" onClick={() => setIsModalOpen(false)}>
                Cancelar
              </button>
              <button type="button" className="primary-btn" onClick={handleConfirmTrade}>
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
