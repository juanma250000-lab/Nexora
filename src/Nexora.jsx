import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Clock3,
  Eye,
  EyeOff,
  Globe2,
  LockKeyhole,
  Search,
  ShieldCheck,
  Sparkles,
  Wallet,
  X,
} from 'lucide-react';

const PAGE_SIZE = 250;
const REFRESH_MS = 30000;
const FX_REFRESH_MS = 60 * 60 * 1000;
const CACHE_KEY = 'nexora-live-market-cop-v1';
const FX_CACHE_KEY = 'nexora-usd-cop-rate-v1';
const PORTFOLIO_KEY = 'nexora-demo-portfolio-v1';
const PREFETCHES = new Map();
const INITIAL_BALANCES = {
  bitcoin: 0.125,
  ethereum: 1.5,
  solana: 10,
  cardano: 500,
  ripple: 1000,
};
const NAV_ITEMS = [
  { id: 'inicio', label: 'Inicio', icon: Sparkles },
  { id: 'mercado', label: 'Mercado', icon: Activity },
  { id: 'comprar', label: 'Comprar', icon: ArrowDownLeft },
  { id: 'vender', label: 'Vender', icon: ArrowUpRight },
  { id: 'portafolio', label: 'Portafolio', icon: Wallet },
  { id: 'actividad', label: 'Actividad', icon: Clock3 },
];

const formatCOP = (value) => new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  minimumFractionDigits: Math.abs(value) < 1 ? 2 : 0,
  maximumFractionDigits: Math.abs(value) < 1 ? 8 : 0,
}).format(Number.isFinite(value) ? value : 0);

const formatCrypto = (value, maximumFractionDigits = 6) => new Intl.NumberFormat('es-CO', {
  maximumFractionDigits,
  minimumFractionDigits: 0,
}).format(Number.isFinite(value) ? value : 0);

function readMarketPages() {
  try {
    const value = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
    return value.pages && typeof value.pages === 'object' ? value.pages : {};
  } catch {
    return {};
  }
}

function readFxCache() {
  try {
    const value = JSON.parse(localStorage.getItem(FX_CACHE_KEY) || 'null');
    return Number.isFinite(value?.rate) && value.rate > 0 ? value : null;
  } catch {
    return null;
  }
}

async function requestUsdCopRate(signal) {
  const response = await fetch('https://open.er-api.com/v6/latest/USD', { signal });
  if (!response.ok) throw new Error(`La fuente de cambio respondió ${response.status}`);
  const data = await response.json();
  if (data.result !== 'success' || !Number.isFinite(data.rates?.COP)) throw new Error('No se recibió una tasa USD/COP válida');
  return Number(data.rates.COP);
}

function readDemoPortfolio() {
  try {
    const value = JSON.parse(localStorage.getItem(PORTFOLIO_KEY) || '{}');
    return {
      balances: { ...INITIAL_BALANCES, ...(value.balances || {}) },
      cash: Number.isFinite(value.cash) ? value.cash : 25000000,
      activity: Array.isArray(value.activity) ? value.activity : [],
    };
  } catch {
    return { balances: INITIAL_BALANCES, cash: 25000000, activity: [] };
  }
}

function saveMarketPage(page, coins, updatedAt) {
  try {
    const pages = { ...readMarketPages(), [page]: { coins, updatedAt } };
    const recent = Object.entries(pages)
      .sort(([, first], [, second]) => Date.parse(second.updatedAt) - Date.parse(first.updatedAt))
      .slice(0, 4);
    localStorage.setItem(CACHE_KEY, JSON.stringify({ pages: Object.fromEntries(recent) }));
  } catch {
    // La navegación sigue disponible aunque el navegador no permita guardar caché.
  }
}

function mapMarketData(data, page, usdCopRate) {
  return data.map((coin, index) => ({
    id: coin.id,
    name: coin.name,
    symbol: String(coin.symbol || '').toUpperCase(),
    image: coin.image,
    rank: (page - 1) * PAGE_SIZE + index + 1,
    price: (Number(coin.current_price) || 0) * usdCopRate,
    change24h: Number(coin.price_change_percentage_24h) || 0,
    change7d: Number(coin.price_change_percentage_7d_in_currency) || 0,
    marketCap: (Number(coin.market_cap) || 0) * usdCopRate,
    volume: (Number(coin.total_volume) || 0) * usdCopRate,
    history: Array.isArray(coin.sparkline_in_7d?.price) ? coin.sparkline_in_7d.price.map((price) => price * usdCopRate) : [],
  }));
}

async function requestMarketPage(page, signal, usdCopRate) {
  const params = new URLSearchParams({
    vs_currency: 'usd',
    order: 'market_cap_desc',
    per_page: String(PAGE_SIZE),
    page: String(page),
    sparkline: 'true',
    price_change_percentage: '24h,7d',
  });
  const response = await fetch(`https://api.coingecko.com/api/v3/coins/markets?${params}`, { signal });
  if (!response.ok) throw new Error(`La fuente de mercado respondió ${response.status}`);
  const data = await response.json();
  if (!Array.isArray(data) || data.length === 0) throw new Error('La fuente no devolvió cotizaciones');
  return mapMarketData(data, page, usdCopRate);
}

function pricePath(values, width = 220, height = 70, padding = 4) {
  if (!Array.isArray(values) || values.length < 2) return '';
  const sample = values.length > 96
    ? values.filter((_, index) => index % Math.ceil(values.length / 96) === 0 || index === values.length - 1)
    : values;
  const minimum = Math.min(...sample);
  const maximum = Math.max(...sample);
  const span = maximum - minimum || 1;
  return sample.map((value, index) => {
    const x = (index / (sample.length - 1)) * width;
    const y = height - padding - ((value - minimum) / span) * (height - padding * 2);
    return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
}

function Sparkline({ coin, large = false, tone }) {
  const width = large ? 720 : 150;
  const height = large ? 230 : 44;
  const path = pricePath(coin?.history, width, height, large ? 10 : 4);
  if (!path) return <div className={large ? 'nx-chart-empty' : 'nx-spark-empty'}>Gráfico en preparación</div>;
  const fill = `${path} L${width},${height} L0,${height} Z`;
  const color = tone || (coin.change24h >= 0 ? '#83e6c2' : '#ff7b81');

  return (
    <svg className={large ? 'nx-chart-svg' : 'nx-spark-svg'} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img" aria-label={`Variación de ${coin.name} durante siete días`}>
      {large && <defs><linearGradient id="nexora-chart-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity="0.28" /><stop offset="100%" stopColor={color} stopOpacity="0" /></linearGradient></defs>}
      {large && <path d={fill} fill="url(#nexora-chart-fill)" />}
      <path d={path} fill="none" stroke={color} strokeWidth={large ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function Change({ value }) {
  const rising = value >= 0;
  return <span className={`nx-change ${rising ? 'is-up' : 'is-down'}`}>{rising ? '+' : ''}{value.toFixed(2)}%</span>;
}

function CoinIcon({ coin, size = 'normal' }) {
  return coin.image
    ? <img className={`nx-coin-icon ${size === 'large' ? 'is-large' : ''}`} src={coin.image} alt="" loading="lazy" />
    : <span className={`nx-coin-icon nx-coin-fallback ${size === 'large' ? 'is-large' : ''}`} aria-hidden="true">{coin.symbol.slice(0, 1)}</span>;
}

export default function Nexora() {
  const cachedAtStart = readMarketPages();
  const cachedFxAtStart = readFxCache();
  const demoAtStart = readDemoPortfolio();
  const [usdCopRate, setUsdCopRate] = useState(cachedFxAtStart?.rate || 0);
  const [marketPage, setMarketPage] = useState(1);
  const [coins, setCoins] = useState(cachedAtStart[1]?.coins || []);
  const [coinUniverse, setCoinUniverse] = useState(() => Object.values(cachedAtStart).flatMap((page) => page.coins || []));
  const [marketState, setMarketState] = useState(cachedAtStart[1] ? 'actualizando' : 'cargando');
  const [updatedAt, setUpdatedAt] = useState(cachedAtStart[1]?.updatedAt ? new Date(cachedAtStart[1].updatedAt) : null);
  const [selectedId, setSelectedId] = useState('bitcoin');
  const [activeSection, setActiveSection] = useState('inicio');
  const [searchTerm, setSearchTerm] = useState('');
  const [tradeType, setTradeType] = useState('buy');
  const [amount, setAmount] = useState('');
  const [balances, setBalances] = useState(demoAtStart.balances);
  const [cash, setCash] = useState(demoAtStart.cash);
  const [activity, setActivity] = useState(demoAtStart.activity);
  const [tradeReviewOpen, setTradeReviewOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState('signup');
  const [isDemoConnected, setIsDemoConnected] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [notification, setNotification] = useState(null);

  const selectedCoin = useMemo(
    () => coinUniverse.find((coin) => coin.id === selectedId) || coins[0],
    [coinUniverse, coins, selectedId]
  );
  const filteredCoins = useMemo(() => coins.filter((coin) =>
    `${coin.name} ${coin.symbol}`.toLocaleLowerCase('es-CO').includes(searchTerm.trim().toLocaleLowerCase('es-CO'))
  ), [coins, searchTerm]);
  const topCoins = coins.slice(0, 4);
  const currentAmount = Number.parseFloat(amount) || 0;
  const feeRate = 0.001;
  const receivedCrypto = tradeType === 'buy' && selectedCoin ? currentAmount / (selectedCoin.price || 1) : currentAmount;
  const tradeValueCOP = tradeType === 'buy' ? currentAmount : currentAmount * (selectedCoin?.price || 0);
  const feeCOP = tradeValueCOP * feeRate;
  const availableBalance = selectedCoin ? balances[selectedCoin.id] || 0 : 0;
  const portfolioValue = useMemo(() => coinUniverse.reduce((total, coin) => total + (balances[coin.id] || 0) * coin.price, 0), [coinUniverse, balances]);
  const dayChangeCOP = useMemo(() => coinUniverse.reduce((total, coin) => total + (balances[coin.id] || 0) * coin.price * coin.change24h / 100, 0), [coinUniverse, balances]);
  const portfolioChange = portfolioValue > 0 ? dayChangeCOP / Math.max(portfolioValue - dayChangeCOP, 1) * 100 : 0;
  const formattedUpdatedAt = updatedAt
    ? updatedAt.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
    : 'Esperando cotizaciones';

  useEffect(() => {
    let mounted = true;
    let controller;
    const cachedRate = readFxCache();

    if (cachedRate && cachedRate.rate !== usdCopRate) setUsdCopRate(cachedRate.rate);

    const loadRate = async () => {
      const latestCachedRate = readFxCache();
      const rateIsFresh = latestCachedRate && Date.now() - Date.parse(latestCachedRate.updatedAt) < FX_REFRESH_MS;
      if (rateIsFresh) return;
      controller?.abort();
      controller = new AbortController();
      try {
        const rate = await requestUsdCopRate(controller.signal);
        if (!mounted) return;
        const updatedAt = new Date().toISOString();
        setUsdCopRate(rate);
        try {
          localStorage.setItem(FX_CACHE_KEY, JSON.stringify({ rate, updatedAt }));
        } catch {
          // La conversión queda en memoria si el almacenamiento está deshabilitado.
        }
      } catch (error) {
        if (mounted && error.name !== 'AbortError') console.warn('No se pudo actualizar la tasa USD/COP:', error);
      }
    };

    loadRate();
    const timer = window.setInterval(loadRate, FX_REFRESH_MS);
    return () => {
      mounted = false;
      window.clearInterval(timer);
      controller?.abort();
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    let activeController;
    let prefetchTimer;
    let didPrefetch = false;
    const cachedPage = readMarketPages()[marketPage];

    if (!usdCopRate) {
      setMarketState('cargando');
      return () => { mounted = false; };
    }

    if (cachedPage?.coins?.length) {
      setCoins(cachedPage.coins);
      setCoinUniverse((previous) => mergeCoins(previous, cachedPage.coins));
      setUpdatedAt(new Date(cachedPage.updatedAt));
      setMarketState('actualizando');
    } else {
      setCoins([]);
      setMarketState('cargando');
    }

    const loadPage = async () => {
      const existingPrefetch = PREFETCHES.get(marketPage);
      activeController = new AbortController();
      try {
        const nextCoins = existingPrefetch
          ? await existingPrefetch
          : await requestMarketPage(marketPage, activeController.signal, usdCopRate);
        if (!mounted) return;
        const timestamp = new Date();
        setCoins(nextCoins);
        setCoinUniverse((previous) => mergeCoins(previous, nextCoins));
        setMarketState('en-vivo');
        setUpdatedAt(timestamp);
        saveMarketPage(marketPage, nextCoins, timestamp.toISOString());

        if (!didPrefetch && nextCoins.length === PAGE_SIZE) {
          didPrefetch = true;
          prefetchTimer = window.setTimeout(() => {
            const nextPage = marketPage + 1;
            const freshCache = readMarketPages()[nextPage];
            if (!mounted || (freshCache && Date.now() - Date.parse(freshCache.updatedAt) < REFRESH_MS)) return;
            if (PREFETCHES.has(nextPage)) return;
            const controller = new AbortController();
            const request = requestMarketPage(nextPage, controller.signal, usdCopRate)
              .then((prefetchedCoins) => {
                saveMarketPage(nextPage, prefetchedCoins, new Date().toISOString());
                if (mounted) setCoinUniverse((previous) => mergeCoins(previous, prefetchedCoins));
                return prefetchedCoins;
              })
              .finally(() => PREFETCHES.delete(nextPage));
            PREFETCHES.set(nextPage, request);
          }, 1200);
        }
      } catch (error) {
        if (!mounted || error.name === 'AbortError') return;
        console.error('No se pudo actualizar el mercado:', error);
        setMarketState('sin-conexion');
      }
    };

    loadPage();
    const timer = window.setInterval(loadPage, REFRESH_MS);
    return () => {
      mounted = false;
      window.clearInterval(timer);
      window.clearTimeout(prefetchTimer);
      activeController?.abort();
    };
  }, [marketPage, usdCopRate]);

  useEffect(() => {
    try {
      localStorage.setItem(PORTFOLIO_KEY, JSON.stringify({ balances, cash, activity }));
    } catch {
      // El portafolio de prueba permanece disponible durante esta sesión.
    }
  }, [balances, cash, activity]);

  useEffect(() => {
    if (!notification) return undefined;
    const timer = window.setTimeout(() => setNotification(null), 4200);
    return () => window.clearTimeout(timer);
  }, [notification]);

  useEffect(() => {
    const sections = NAV_ITEMS.map((item) => document.getElementById(item.id)).filter(Boolean);
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((first, second) => second.intersectionRatio - first.intersectionRatio)[0];
      if (visible) setActiveSection(visible.target.id);
    }, { rootMargin: '-25% 0px -55% 0px', threshold: [0, 0.2, 0.5] });
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  function mergeCoins(existing, incoming) {
    const merged = new Map(existing.map((coin) => [coin.id, coin]));
    incoming.forEach((coin) => merged.set(coin.id, coin));
    return Array.from(merged.values());
  }

  function goTo(section, nextTradeType) {
    if (nextTradeType) setTradeType(nextTradeType);
    setActiveSection(section);
    document.getElementById(section)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function startTrade(coin, type = 'buy') {
    if (coin) setSelectedId(coin.id);
    setTradeType(type);
    setAmount('');
    goTo(type === 'buy' ? 'comprar' : 'vender', type);
  }

  function reviewTrade(event) {
    event.preventDefault();
    if (!selectedCoin || currentAmount <= 0) {
      setNotification({ type: 'error', text: 'Ingresa un monto válido para continuar.' });
      return;
    }
    if (tradeType === 'buy' && currentAmount + feeCOP > cash) {
      setNotification({ type: 'error', text: 'El saldo de demostración no alcanza para esta compra.' });
      return;
    }
    if (tradeType === 'sell' && currentAmount > availableBalance) {
      setNotification({ type: 'error', text: `No tienes suficiente ${selectedCoin.symbol} en el portafolio de prueba.` });
      return;
    }
    setTradeReviewOpen(true);
  }

  function confirmTrade() {
    if (!selectedCoin) return;
    const quantity = tradeType === 'buy' ? currentAmount / (selectedCoin.price || 1) : currentAmount;
    const total = tradeType === 'buy' ? currentAmount : currentAmount * selectedCoin.price;
    const record = {
      id: `NX-${Date.now().toString().slice(-7)}`,
      coinId: selectedCoin.id,
      name: selectedCoin.name,
      symbol: selectedCoin.symbol,
      type: tradeType,
      quantity,
      price: selectedCoin.price,
      total: total,
      date: new Date().toISOString(),
      simulated: true,
    };
    setBalances((previous) => ({
      ...previous,
      [selectedCoin.id]: Math.max(0, (previous[selectedCoin.id] || 0) + (tradeType === 'buy' ? quantity : -quantity)),
    }));
    setCash((previous) => previous + (tradeType === 'buy' ? -(total + feeCOP) : total - feeCOP));
    setActivity((previous) => [record, ...previous]);
    setTradeReviewOpen(false);
    setAmount('');
    setNotification({ type: 'success', text: `Movimiento simulado: ${tradeType === 'buy' ? 'compra' : 'venta'} de ${formatCrypto(quantity)} ${selectedCoin.symbol}.` });
  }

  function handleDemoAccess(event) {
    event.preventDefault();
    setIsDemoConnected(true);
    setAuthOpen(false);
    setNotification({ type: 'success', text: 'Sesión de demostración iniciada en este dispositivo.' });
  }

  const distribution = useMemo(() => {
    const holdings = coinUniverse.filter((coin) => (balances[coin.id] || 0) > 0)
      .map((coin) => ({ ...coin, quantity: balances[coin.id], value: balances[coin.id] * coin.price }))
      .filter((coin) => coin.value > 0)
      .sort((first, second) => second.value - first.value);
    const total = holdings.reduce((sum, coin) => sum + coin.value, 0);
    let stop = 0;
    const colors = ['#80e8c3', '#62a9ff', '#efba75', '#d091ff', '#ff7e86', '#b8c8df'];
    const slices = holdings.map((coin, index) => {
      const start = stop;
      stop += total ? coin.value / total * 100 : 0;
      return { ...coin, share: total ? coin.value / total * 100 : 0, color: colors[index % colors.length], start, stop };
    });
    return { holdings: slices, total, gradient: slices.length ? `conic-gradient(${slices.map((slice) => `${slice.color} ${slice.start}% ${slice.stop}%`).join(', ')})` : 'conic-gradient(#273244 0% 100%)' };
  }, [coinUniverse, balances]);

  const marketCapTotal = coins.slice(0, 100).reduce((sum, coin) => sum + coin.marketCap, 0);
  const volumeTotal = coins.slice(0, 100).reduce((sum, coin) => sum + coin.volume, 0);
  const selectedHistory = selectedCoin?.history || [];
  const heroCoin = coins.find((coin) => coin.id === 'bitcoin') || topCoins[0];
  const latestActivity = activity.slice(0, 4);
  const liveLabel = marketState === 'en-vivo' ? 'Mercado en vivo' : marketState === 'sin-conexion' ? 'Mostrando último dato' : marketState === 'actualizando' ? 'Actualizando mercado' : 'Conectando al mercado';

  return (
    <div className="nx-app">
      <div className="nx-ambient" aria-hidden="true" />
      <header className="nx-header">
        <a className="nx-brand" href="#inicio" onClick={(event) => { event.preventDefault(); goTo('inicio'); }} aria-label="NEXORA, inicio">
          <span className="nx-brand-mark" aria-hidden="true"><i /><i /><i /></span>
          <span>NEXORA</span>
        </a>
        <nav className="nx-desktop-nav" aria-label="Navegación principal">
          {NAV_ITEMS.map(({ id, label }) => (
            <button key={id} type="button" className={activeSection === id ? 'nx-nav-link is-active' : 'nx-nav-link'} onClick={() => goTo(id)}>{label}</button>
          ))}
        </nav>
        <button className="nx-account-button" type="button" onClick={() => { setAuthMode('signin'); setAuthOpen(true); }}>
          {isDemoConnected ? <><BadgeCheck size={16} /> Sesión de prueba</> : <><LockKeyhole size={15} /> Conectar cuenta</>}
        </button>
      </header>

      <main>
        <section className="nx-hero nx-section" id="inicio">
          <div className="nx-hero-copy">
            <div className="nx-kicker"><span className={`nx-live-dot ${marketState === 'sin-conexion' ? 'is-offline' : ''}`} /> {liveLabel}<span className="nx-kicker-divider" /> COP · {formattedUpdatedAt}</div>
            <h1>Una nueva forma<br />de ver <span>tu futuro.</span></h1>
            <p className="nx-hero-description">Explora activos digitales, sigue el pulso del mercado y prueba nuevas estrategias desde un solo lugar.</p>
            <div className="nx-hero-actions">
              <button className="nx-button nx-button-primary" type="button" onClick={() => goTo('mercado')}>Explorar mercado <ArrowRight size={17} /></button>
              <button className="nx-button nx-button-quiet" type="button" onClick={() => { setAuthMode('signup'); setAuthOpen(true); }}>Crear cuenta de prueba <ArrowUpRight size={16} /></button>
            </div>
            <div className="nx-proof-line"><ShieldCheck size={15} /> Solo simulación · Sin movimientos de dinero real</div>
          </div>

          <div className="nx-market-orbit" aria-label="Vista previa del mercado">
            <div className="nx-hero-market-glass">
              <div className="nx-preview-topline"><span>Vista del mercado</span><span className="nx-preview-live"><i /> EN VIVO</span></div>
              <div className="nx-preview-total-label">Tu portafolio de prueba</div>
              <div className="nx-preview-total">{formatCOP(portfolioValue)}</div>
              <div className="nx-preview-performance"><span className={dayChangeCOP >= 0 ? 'nx-up' : 'nx-down'}>{dayChangeCOP >= 0 ? '+' : ''}{formatCOP(dayChangeCOP)}</span><span className="nx-caption"> hoy · {portfolioChange.toFixed(2)}%</span></div>
              <div className="nx-hero-chart">{heroCoin ? <Sparkline coin={heroCoin} large tone="#82e8c0" /> : <div className="nx-chart-loading"><span /><span /><span /><span /><span /><span /><span /><span /></div>}</div>
              <div className="nx-preview-chart-labels"><span>HACE 7 DÍAS</span><span>AHORA</span></div>
              <div className="nx-preview-coins">
                {topCoins.slice(0, 3).map((coin) => (
                  <button className="nx-preview-coin" type="button" key={coin.id} onClick={() => { setSelectedId(coin.id); goTo('detalle'); }}>
                    <CoinIcon coin={coin} /><span className="nx-preview-coin-name"><b>{coin.symbol}</b><small>{formatCOP(coin.price)}</small></span><Change value={coin.change24h} />
                  </button>
                ))}
              </div>
            </div>
            <div className="nx-floating-note"><span className="nx-note-icon"><Activity size={15} /></span><span><b>Mercado activo</b><small>{coins.length || 0} activos visibles</small></span></div>
            <div className="nx-orbit-caption">DATOS ACTUALIZADOS CADA 30 S</div>
          </div>
        </section>

        <section className="nx-ticker-strip" aria-label="Cotizaciones destacadas">
          <div className="nx-ticker-label"><span className="nx-ticker-pulse" /> PULSO DEL MERCADO</div>
          {topCoins.slice(0, 4).map((coin) => <button key={coin.id} className="nx-ticker-item" type="button" onClick={() => { setSelectedId(coin.id); goTo('detalle'); }}><span>{coin.symbol}</span><b>{formatCOP(coin.price)}</b><Change value={coin.change24h} /></button>)}
          <span className="nx-ticker-source"><Globe2 size={13} /> CoinGecko</span>
        </section>

        <section className="nx-section nx-market-section" id="mercado">
          <div className="nx-section-heading">
            <div><span className="nx-section-index">01 / DESCUBRIR</span><h2>El mercado,<br className="nx-mobile-break" /> en movimiento.</h2><p>Precios y variaciones en pesos colombianos, actualizados desde el mercado global.</p></div>
            <div className="nx-market-stats"><div><span>CAPITALIZACIÓN · TOP 100</span><b>{formatCOP(marketCapTotal)}</b></div><div><span>VOLUMEN · 24 H</span><b>{formatCOP(volumeTotal)}</b></div></div>
          </div>
          <div className="nx-market-layout">
            <div className="nx-market-table-wrap">
              <div className="nx-market-toolbar"><label className="nx-search"><Search size={16} /><input type="search" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Buscar activo o símbolo" aria-label="Buscar criptomonedas" /></label><span className="nx-result-count">{filteredCoins.length} de {coins.length} activos</span></div>
              <div className="nx-market-head"><span>ACTIVO</span><span>PRECIO</span><span>24 H</span><span>7 DÍAS</span><span>CAPITALIZACIÓN</span><span>ACCIÓN</span></div>
              <div className="nx-market-rows">
                {filteredCoins.map((coin) => (
                  <article className={`nx-market-row ${selectedId === coin.id ? 'is-selected' : ''}`} key={coin.id}>
                    <button className="nx-market-asset" type="button" onClick={() => { setSelectedId(coin.id); goTo('detalle'); }} aria-label={`Ver detalles de ${coin.name}`}>
                      <span className="nx-rank">{coin.rank}</span><CoinIcon coin={coin} /><span className="nx-asset-copy"><b>{coin.name}</b><small>{coin.symbol}</small></span>
                    </button>
                    <button className="nx-market-price" type="button" onClick={() => { setSelectedId(coin.id); goTo('detalle'); }}>{formatCOP(coin.price)}</button>
                    <Change value={coin.change24h} />
                    <div className="nx-row-spark"><Sparkline coin={coin} /></div>
                    <span className="nx-market-cap">{formatCOP(coin.marketCap)}</span>
                    <button className="nx-row-action" type="button" aria-label={`Comprar ${coin.name}`} onClick={() => startTrade(coin, 'buy')}><ArrowUpRight size={17} /></button>
                  </article>
                ))}
                {!filteredCoins.length && <div className="nx-market-empty">{coins.length ? 'No encontramos ese activo en esta página.' : 'Cargando cotizaciones…'}</div>}
              </div>
              <div className="nx-market-pagination"><button type="button" aria-label="Página anterior" disabled={marketPage === 1} onClick={() => setMarketPage((page) => Math.max(1, page - 1))}><ChevronLeft size={17} /></button><span>PÁGINA {marketPage} <i /> {PAGE_SIZE} ACTIVOS POR PÁGINA</span><button type="button" aria-label="Página siguiente" disabled={coins.length < PAGE_SIZE} onClick={() => setMarketPage((page) => page + 1)}><ChevronRight size={17} /></button></div>
            </div>
            <aside className="nx-market-aside"><span className="nx-section-index">ACTIVO SELECCIONADO</span>{selectedCoin ? <><CoinIcon coin={selectedCoin} size="large" /><h3>{selectedCoin.name}</h3><div className="nx-aside-symbol">{selectedCoin.symbol} <span>#{selectedCoin.rank}</span></div><strong className="nx-aside-price">{formatCOP(selectedCoin.price)}</strong><Change value={selectedCoin.change24h} /><div className="nx-aside-divider" /><div className="nx-aside-stat"><span>Capitalización</span><b>{formatCOP(selectedCoin.marketCap)}</b></div><div className="nx-aside-stat"><span>Volumen · 24 h</span><b>{formatCOP(selectedCoin.volume)}</b></div><button className="nx-button nx-button-primary nx-aside-buy" type="button" onClick={() => startTrade(selectedCoin, 'buy')}>Explorar compra <ArrowRight size={15} /></button></> : <p>Selecciona un activo para consultar sus datos.</p>}</aside>
          </div>
        </section>

        <section className="nx-section nx-detail-section" id="detalle">
          <div className="nx-detail-heading"><div><span className="nx-section-index">02 / ANALIZAR</span><h2>Conoce cada movimiento.</h2><p>Historial real de precios disponible para los últimos siete días.</p></div>{selectedCoin && <div className="nx-detail-current"><CoinIcon coin={selectedCoin} /><span><b>{selectedCoin.name}</b><small>{selectedCoin.symbol}</small></span><strong>{formatCOP(selectedCoin.price)}</strong><Change value={selectedCoin.change24h} /></div>}</div>
          <div className="nx-detail-layout">
            <div className="nx-chart-panel"><div className="nx-chart-panel-head"><div><span>EVOLUCIÓN DEL PRECIO</span><h3>{selectedCoin?.name || 'Mercado'} <small>/ COP</small></h3></div><span className="nx-chart-period">7 DÍAS</span></div><div className="nx-history-chart">{selectedCoin ? <Sparkline coin={selectedCoin} large /> : <div className="nx-chart-empty">Esperando el primer dato de mercado</div>}</div><div className="nx-chart-axis"><span>HACE 7 DÍAS</span><span>HACE 5 DÍAS</span><span>HACE 3 DÍAS</span><span>AHORA</span></div></div>
            <div className="nx-data-rail"><div className="nx-data-rail-head"><span>DATOS DEL ACTIVO</span><span className="nx-data-indicator"><i /> EN VIVO</span></div><div className="nx-data-cell"><span>Variación · 24 h</span><Change value={selectedCoin?.change24h || 0} /></div><div className="nx-data-cell"><span>Variación · 7 días</span><Change value={selectedCoin?.change7d || 0} /></div><div className="nx-data-cell"><span>Precio máximo visible</span><b>{formatCOP(selectedHistory.length ? Math.max(...selectedHistory) : selectedCoin?.price || 0)}</b></div><div className="nx-data-cell"><span>Precio mínimo visible</span><b>{formatCOP(selectedHistory.length ? Math.min(...selectedHistory) : selectedCoin?.price || 0)}</b></div><div className="nx-data-note"><CircleHelp size={15} /> Datos de mercado; no constituyen asesoría financiera.</div></div>
          </div>
        </section>

        <section className="nx-section nx-trade-section" id="comprar">
          <div className="nx-trade-intro"><span className="nx-section-index">03 / SIMULAR</span><h2>Prueba una estrategia.</h2><p>Calcula una compra o venta con precios reales. Los movimientos solo modifican este portafolio de prueba.</p><div className="nx-demo-stamp"><ShieldCheck size={16} /> OPERACIÓN SIMULADA · SIN DINERO REAL</div></div>
          <div className="nx-trade-card">
            <div className="nx-trade-card-top"><span>ORDEN DE PRUEBA</span><span className="nx-cop-badge">COP</span></div>
            <div className="nx-trade-switch" aria-label="Tipo de operación"><button id="comprar" type="button" className={tradeType === 'buy' ? 'is-active' : ''} onClick={() => setTradeType('buy')}><ArrowDownLeft size={16} /> Comprar</button><button id="vender" type="button" className={tradeType === 'sell' ? 'is-active' : ''} onClick={() => setTradeType('sell')}><ArrowUpRight size={16} /> Vender</button></div>
            <label className="nx-field-label" htmlFor="nx-asset-select">Activo digital</label>
            <div className="nx-select-wrap"><select id="nx-asset-select" value={selectedCoin?.id || ''} onChange={(event) => setSelectedId(event.target.value)}>{(coinUniverse.length ? coinUniverse : coins).map((coin) => <option key={coin.id} value={coin.id}>{coin.name} · {coin.symbol}</option>)}</select><ChevronDown size={16} /></div>
            <label className="nx-field-label" htmlFor="nx-amount">{tradeType === 'buy' ? 'Monto en pesos colombianos' : `Cantidad en ${selectedCoin?.symbol || 'cripto'}`}</label>
            <div className="nx-amount-field"><span>{tradeType === 'buy' ? '$' : selectedCoin?.symbol}</span><input id="nx-amount" type="number" min="0" step={tradeType === 'buy' ? '1000' : 'any'} inputMode="decimal" placeholder={tradeType === 'buy' ? '500000' : '0,00'} value={amount} onChange={(event) => setAmount(event.target.value)} /><small>{tradeType === 'buy' ? 'COP' : 'UNIDADES'}</small></div>
            <div className="nx-estimate"><span>{tradeType === 'buy' ? 'Recibirás aproximadamente' : 'Recibirás aproximadamente'}</span><b>{tradeType === 'buy' ? `${formatCrypto(receivedCrypto)} ${selectedCoin?.symbol || ''}` : formatCOP(tradeValueCOP)}</b></div>
            <div className="nx-trade-lines"><div><span>Precio de referencia</span><b>{formatCOP(selectedCoin?.price || 0)} / {selectedCoin?.symbol || 'activo'}</b></div><div><span>Comisión estimada · 0,1 %</span><b>{formatCOP(feeCOP)}</b></div><div className="nx-trade-total"><span>{tradeType === 'buy' ? 'Total estimado' : 'Saldo disponible'}</span><b>{tradeType === 'buy' ? formatCOP(tradeValueCOP + feeCOP) : `${formatCrypto(availableBalance)} ${selectedCoin?.symbol || ''}`}</b></div></div>
            <button className="nx-button nx-button-primary nx-trade-submit" type="button" onClick={reviewTrade} disabled={!selectedCoin || currentAmount <= 0}>{tradeType === 'buy' ? 'Revisar compra' : 'Revisar venta'} <ArrowRight size={16} /></button>
            <div className="nx-trade-foot"><LockKeyhole size={13} /> Vista previa; nada se ejecuta en una plataforma de intercambio.</div>
          </div>
        </section>

        <section className="nx-section nx-portfolio-section" id="portafolio">
          <div className="nx-section-heading"><div><span className="nx-section-index">04 / TU ESPACIO</span><h2>Tu portafolio,<br className="nx-mobile-break" /> a tu manera.</h2><p>Una vista clara de los activos en tu cuenta de demostración.</p></div><div className="nx-portfolio-total"><span>VALOR DE DEMOSTRACIÓN</span><b>{formatCOP(portfolioValue)}</b><Change value={portfolioChange} /></div></div>
          <div className="nx-portfolio-layout"><div className="nx-allocation-panel"><div className="nx-allocation-head"><span>DISTRIBUCIÓN DE ACTIVOS</span><span>{distribution.holdings.length} posiciones</span></div>{distribution.holdings.length ? <div className="nx-allocation-content"><div className="nx-donut" style={{ '--nx-donut': distribution.gradient }}><div><span>VALOR TOTAL</span><b>{formatCOP(distribution.total)}</b></div></div><div className="nx-allocation-legend">{distribution.holdings.slice(0, 6).map((coin) => <div className="nx-legend-row" key={coin.id}><i style={{ background: coin.color }} /><span>{coin.name}<small>{coin.symbol}</small></span><b>{coin.share.toFixed(1)}%</b></div>)}</div></div> : <div className="nx-empty-state"><span className="nx-empty-mark"><Wallet size={22} /></span><h3>Tu portafolio espera su primer movimiento.</h3><p>Explora el mercado y simula una compra para verlo crecer.</p><button className="nx-text-action" type="button" onClick={() => goTo('mercado')}>Explorar mercado <ArrowRight size={15} /></button></div>}</div>
            <div className="nx-holdings-panel"><div className="nx-allocation-head"><span>TUS ACTIVOS</span><span>PRECIO EN COP</span></div>{distribution.holdings.length ? distribution.holdings.map((coin) => <button key={coin.id} className="nx-holding-row" type="button" onClick={() => { setSelectedId(coin.id); goTo('detalle'); }}><CoinIcon coin={coin} /><span className="nx-holding-name"><b>{coin.name}</b><small>{formatCrypto(coin.quantity)} {coin.symbol}</small></span><span className="nx-holding-value"><b>{formatCOP(coin.value)}</b><small><Change value={coin.change24h} /></small></span><ChevronRight size={16} /></button>) : <div className="nx-holdings-empty">Las posiciones aparecerán aquí.</div>}<div className="nx-cash-row"><span><Wallet size={16} /> Saldo disponible de prueba</span><b>{formatCOP(cash)}</b></div></div>
          </div>
        </section>

        <section className="nx-section nx-activity-section" id="actividad">
          <div className="nx-section-heading"><div><span className="nx-section-index">05 / REGISTRO</span><h2>Cada movimiento,<br className="nx-mobile-break" /> en perspectiva.</h2><p>Historial local de las operaciones simuladas en este dispositivo.</p></div><button className="nx-button nx-button-quiet" type="button" onClick={() => setNotification({ type: 'success', text: 'Este historial solo existe en tu sesión de demostración.' })}>Solo demostración <ShieldCheck size={15} /></button></div>
          <div className="nx-activity-list">{latestActivity.length ? latestActivity.map((item, index) => <article className="nx-activity-row" key={item.id}><span className={`nx-activity-icon ${item.type === 'buy' ? 'is-buy' : 'is-sell'}`}>{item.type === 'buy' ? <ArrowDownLeft size={17} /> : <ArrowUpRight size={17} />}</span><span className="nx-activity-copy"><b>{item.type === 'buy' ? 'Compra simulada' : 'Venta simulada'} de {item.name}</b><small>{new Date(item.date).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })} · {item.id}</small></span><span className="nx-activity-quantity">{item.type === 'buy' ? '+' : '−'}{formatCrypto(item.quantity)} {item.symbol}</span><span className="nx-activity-value">{formatCOP(item.total)}<small>Valor de referencia</small></span></article>) : <div className="nx-empty-state nx-activity-empty"><span className="nx-empty-mark"><Clock3 size={22} /></span><h3>Aún no hay movimientos.</h3><p>Las compras y ventas de prueba aparecerán aquí.</p><button className="nx-text-action" type="button" onClick={() => goTo('mercado')}>Descubrir activos <ArrowRight size={15} /></button></div>}</div>
        </section>
      </main>

      <footer className="nx-footer"><a className="nx-brand" href="#inicio" onClick={(event) => { event.preventDefault(); goTo('inicio'); }}><span className="nx-brand-mark" aria-hidden="true"><i /><i /><i /></span><span>NEXORA</span></a><p>El mercado cambia. Tu perspectiva también.</p><div className="nx-footer-links"><a href="#mercado" onClick={(event) => { event.preventDefault(); goTo('mercado'); }}>Mercado</a><a href="#portafolio" onClick={(event) => { event.preventDefault(); goTo('portafolio'); }}>Portafolio</a><a href="mailto:hola@nexora.example">Contacto</a><a href="#legal" onClick={(event) => { event.preventDefault(); document.getElementById('legal')?.scrollIntoView({ behavior: 'smooth' }); }}>Privacidad</a></div><div className="nx-footer-legal" id="legal">NEXORA es una plataforma demostrativa. Los precios vienen de datos públicos de mercado; las operaciones y saldos son simulados y no representan transacciones financieras reales.</div><span className="nx-copyright">© 2026 NEXORA · INFORMACIÓN PARA FINES EDUCATIVOS</span></footer>

      <nav className="nx-mobile-nav" aria-label="Navegación móvil">{NAV_ITEMS.filter((item) => ['inicio', 'mercado', 'comprar', 'portafolio', 'actividad'].includes(item.id)).map(({ id, label, icon: Icon }) => <button key={id} type="button" className={activeSection === id ? 'is-active' : ''} onClick={() => goTo(id)}><Icon size={18} /><span>{label}</span></button>)}</nav>

      {notification && <div className={`nx-toast ${notification.type}`} role="status"><span className="nx-toast-icon">{notification.type === 'success' ? <Check size={17} /> : <CircleHelp size={17} />}</span><span>{notification.text}</span><button type="button" aria-label="Cerrar aviso" onClick={() => setNotification(null)}><X size={16} /></button></div>}

      {(tradeReviewOpen || authOpen) && <div className="nx-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) { setTradeReviewOpen(false); setAuthOpen(false); } }}>
        {tradeReviewOpen && selectedCoin && <section className="nx-modal" role="dialog" aria-modal="true" aria-labelledby="nx-review-title"><button className="nx-modal-close" type="button" aria-label="Cerrar" onClick={() => setTradeReviewOpen(false)}><X size={18} /></button><div className="nx-modal-mark"><ArrowLeftRight size={21} /></div><span className="nx-section-index">REVISIÓN DE PRUEBA</span><h2 id="nx-review-title">Confirma el movimiento.</h2><p>Esta operación solo actualizará el portafolio de demostración de este dispositivo.</p><div className="nx-review-asset"><CoinIcon coin={selectedCoin} /><span><b>{selectedCoin.name}</b><small>{selectedCoin.symbol} · {formatCOP(selectedCoin.price)}</small></span><span className="nx-review-type">{tradeType === 'buy' ? 'COMPRA' : 'VENTA'}</span></div><div className="nx-review-lines"><div><span>{tradeType === 'buy' ? 'Monto invertido' : 'Cantidad vendida'}</span><b>{tradeType === 'buy' ? formatCOP(currentAmount) : `${formatCrypto(currentAmount)} ${selectedCoin.symbol}`}</b></div><div><span>Activo estimado</span><b>{tradeType === 'buy' ? `${formatCrypto(receivedCrypto)} ${selectedCoin.symbol}` : formatCOP(tradeValueCOP)}</b></div><div><span>Comisión · 0,1 %</span><b>{formatCOP(feeCOP)}</b></div><div className="nx-review-total"><span>{tradeType === 'buy' ? 'Total estimado' : 'Recibirás'}</span><b>{formatCOP(tradeType === 'buy' ? tradeValueCOP + feeCOP : tradeValueCOP - feeCOP)}</b></div></div><button className="nx-button nx-button-primary nx-modal-confirm" type="button" onClick={confirmTrade}>Confirmar operación simulada <ArrowRight size={16} /></button><span className="nx-modal-note"><ShieldCheck size={14} /> No se transferirá dinero ni criptoactivos reales.</span></section>}
        {authOpen && <section className="nx-modal nx-auth-modal" role="dialog" aria-modal="true" aria-labelledby="nx-auth-title"><button className="nx-modal-close" type="button" aria-label="Cerrar" onClick={() => setAuthOpen(false)}><X size={18} /></button><div className="nx-modal-mark"><span className="nx-brand-mark" aria-hidden="true"><i /><i /><i /></span></div><span className="nx-section-index">TU ESPACIO DIGITAL</span><h2 id="nx-auth-title">{authMode === 'signup' ? 'Crea tu acceso de prueba.' : 'Entra a NEXORA.'}</h2><p>{authMode === 'signup' ? 'Explora las herramientas de demostración. No se crea una cuenta ni se guardan tus credenciales.' : 'Ingresa al modo de prueba en este dispositivo. No hay una cuenta real conectada.'}</p><form className="nx-auth-form" onSubmit={handleDemoAccess}><label htmlFor="nx-email">Correo electrónico</label><input id="nx-email" type="email" autoComplete="email" required placeholder="tu@correo.com" /><label htmlFor="nx-password">Contraseña temporal</label><div className="nx-password-wrap"><input id="nx-password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" required minLength="4" placeholder="Al menos 4 caracteres" /><button type="button" aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'} onClick={() => setShowPassword((value) => !value)}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div><button className="nx-button nx-button-primary nx-auth-submit" type="submit">{authMode === 'signup' ? 'Continuar en modo de prueba' : 'Entrar al modo de prueba'} <ArrowRight size={16} /></button></form><button className="nx-auth-switch" type="button" onClick={() => setAuthMode((mode) => mode === 'signup' ? 'signin' : 'signup')}>{authMode === 'signup' ? '¿Ya tienes un acceso de prueba? Entrar' : '¿Primera vez aquí? Crear acceso de prueba'}</button><span className="nx-modal-note"><LockKeyhole size={14} /> La contraseña no se envía ni se almacena.</span></section>}
      </div>}
    </div>
  );
}
