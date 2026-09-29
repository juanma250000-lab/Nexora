import React, { useState, useEffect } from 'react';
import {
  Wallet,
  ArrowRightLeft,
  History,
  CheckCircle,
  AlertCircle,
  ShieldCheck,
} from 'lucide-react';

const INITIAL_CRYPTOS = [
  { id: 'btc', name: 'Bitcoin', symbol: 'BTC', price: 64250.0, change24h: 2.45, icon: '₿' },
  { id: 'eth', name: 'Ethereum', symbol: 'ETH', price: 3480.5, change24h: -1.12, icon: 'Ξ' },
  { id: 'sol', name: 'Solana', symbol: 'SOL', price: 145.2, change24h: 5.8, icon: '◎' },
  { id: 'ada', name: 'Cardano', symbol: 'ADA', price: 0.38, change24h: 0.85, icon: '₳' },
  { id: 'xrp', name: 'Ripple', symbol: 'XRP', price: 0.58, change24h: -0.42, icon: '✕' },
];

const formatUsd = (value) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(value);

export default function App() {
  const [cryptos, setCryptos] = useState(INITIAL_CRYPTOS);
  const [selectedCoin, setSelectedCoin] = useState(INITIAL_CRYPTOS[0]);
  const [activeTab, setActiveTab] = useState('trading');
  const [tradeType, setTradeType] = useState('buy');
  const [amount, setAmount] = useState('');
  const [usdBalance, setUsdBalance] = useState(10000.0);
  const [cryptoBalances, setCryptoBalances] = useState({
    BTC: 0.125,
    ETH: 1.5,
    SOL: 10.0,
    ADA: 500.0,
    XRP: 1000.0,
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
    const interval = setInterval(() => {
      setCryptos((prevCryptos) =>
        prevCryptos.map((coin) => {
          const deltaPercent = (Math.random() - 0.48) * 0.4;
          const newPrice = Math.max(0.01, coin.price * (1 + deltaPercent / 100));

          return {
            ...coin,
            price: Number(newPrice.toFixed(2)),
            change24h: Number((coin.change24h + deltaPercent * 0.1).toFixed(2)),
          };
        })
      );
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const updatedCoin = cryptos.find((coin) => coin.id === selectedCoin.id);

    if (updatedCoin) {
      setSelectedCoin(updatedCoin);
    }
  }, [cryptos, selectedCoin.id]);

  const numAmount = Number.parseFloat(amount) || 0;
  const estimatedCrypto = tradeType === 'buy' ? numAmount / selectedCoin.price : numAmount;
  const estimatedUsd = tradeType === 'buy' ? numAmount : numAmount * selectedCoin.price;
  const feeUsd = estimatedUsd * 0.001;

  const handleInitiateTrade = (event) => {
    event.preventDefault();
    setNotification(null);

    if (numAmount <= 0) {
      setNotification({
        type: 'error',
        message: 'Ingresa un monto válido mayor a 0.',
      });
      return;
    }

    if (tradeType === 'buy' && numAmount + feeUsd > usdBalance) {
      setNotification({
        type: 'error',
        message: 'Saldo en USD insuficiente.',
      });
      return;
    }

    if (tradeType === 'sell' && numAmount > (cryptoBalances[selectedCoin.symbol] || 0)) {
      setNotification({
        type: 'error',
        message: `Saldo en ${selectedCoin.symbol} insuficiente.`,
      });
      return;
    }

    setIsModalOpen(true);
  };

  const handleConfirmTrade = () => {
    if (tradeType === 'buy') {
      setUsdBalance((prevBalance) => prevBalance - (estimatedUsd + feeUsd));
      setCryptoBalances((prevBalances) => ({
        ...prevBalances,
        [selectedCoin.symbol]: (prevBalances[selectedCoin.symbol] || 0) + estimatedCrypto,
      }));
    } else {
      setUsdBalance((prevBalance) => prevBalance + (estimatedUsd - feeUsd));
      setCryptoBalances((prevBalances) => ({
        ...prevBalances,
        [selectedCoin.symbol]: Math.max(0, (prevBalances[selectedCoin.symbol] || 0) - numAmount),
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

      {activeTab === 'trading' && (
        <div className="content-grid">
          <section className="panel market-panel">
            <div className="panel-header">
              <div>
                <span className="eyebrow">Mercado en vivo</span>
                <h2>Criptomonedas</h2>
              </div>
              <div className="live-pill">
                <span className="dot" />
                En vivo
              </div>
            </div>

            <div className="coin-list">
              {cryptos.map((coin) => (
                <button
                  key={coin.id}
                  type="button"
                  className={selectedCoin.id === coin.id ? 'coin-card active' : 'coin-card'}
                  onClick={() => setSelectedCoin(coin)}
                >
                  <div className="coin-main">
                    <span className="coin-icon">{coin.icon}</span>
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
            </div>
          </section>

          <section className="panel trade-panel">
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

            {cryptos.map((coin) => {
              const balance = cryptoBalances[coin.symbol] || 0;

              return (
                <div key={coin.id} className="wallet-card crypto-card">
                  <div className="wallet-coin-header">
                    <span>{coin.name}</span>
                    <span className="wallet-icon">{coin.icon}</span>
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
