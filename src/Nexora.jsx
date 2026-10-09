import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ALLOCATION_COLORS, NAV_ITEMS, OBSERVED_SECTIONS, resolveNavFromSection } from './lib/constants';
import { readTourState, saveTourState } from './lib/storage';
import { formatClock, formatCrypto, scrollBehavior, toLowerCaseLocale } from './lib/format';
import { useCountdown } from './hooks/useCountdown';
import { useDemoPortfolio, useToast } from './hooks/useDemoPortfolio';
import { useFxRate } from './hooks/useFxRate';
import { useMarket } from './hooks/useMarket';
import { useScrollSpy } from './hooks/useScrollSpy';
import { useTrading } from './hooks/useTrading';

import { ActivitySection } from './components/ActivitySection';
import { AuthModal } from './components/AuthModal';
import { DetailSection } from './components/DetailSection';
import { Footer } from './components/Footer';
import { GuidedTour, TourInvite } from './components/GuidedTour';
import { Header } from './components/Header';
import { Hero } from './components/Hero';
import { MarketSection } from './components/MarketSection';
import { MobileNav } from './components/MobileNav';
import { PortfolioSection } from './components/PortfolioSection';
import { TickerStrip } from './components/TickerStrip';
import { Toast } from './components/Toast';
import { TradeReviewModal } from './components/TradeReviewModal';
import { TradeSection } from './components/TradeSection';

/** Section ids that can be opened directly with a URL hash (e.g. /#portafolio). */
const LINKABLE_IDS = new Set([...NAV_ITEMS.map((item) => item.id), ...OBSERVED_SECTIONS]);

/** Delay before inviting a first-time visitor to the tour. */
const TOUR_INVITE_DELAY_MS = 1500;

/** Largest sell amount that never exceeds the balance once printed as text. */
function balanceToInput(balance) {
  if (!(balance > 0)) return '';
  const floored = Math.floor(balance * 1e8) / 1e8;
  return floored.toFixed(8).replace(/\.?0+$/, '').replace('.', ',');
}

const MARKET_LABELS = {
  'en-vivo': 'Mercado en vivo',
  'sin-conexion': 'Mostrando último dato',
  actualizando: 'Actualizando mercado',
  cargando: 'Conectando al mercado',
};

export default function Nexora() {
  const { rate: usdCopRate, status: fxStatus } = useFxRate();
  const { toast, notify, dismissToast } = useToast();
  const {
    marketPage,
    setMarketPage,
    coins,
    coinUniverse,
    marketState,
    marketError,
    nextRetryAt,
    dataSource,
    hasMore,
    updatedAt,
    refresh,
    pageSize,
  } = useMarket(usdCopRate, notify);
  const { balances, cash, activity, executeTrade, resetPortfolio } = useDemoPortfolio();
  // Seconds left until the next automatic market retry (0 when not retrying).
  const retryInSeconds = useCountdown(nextRetryAt);

  const [selectedId, setSelectedId] = useState('bitcoin');
  const [activeSection, setActiveSection] = useState('inicio');
  const [searchTerm, setSearchTerm] = useState('');
  const [tradeType, setTradeType] = useState('buy');
  const [amount, setAmount] = useState('');
  const [tradeReviewOpen, setTradeReviewOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState('signup');
  const [isDemoConnected, setIsDemoConnected] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const [tourInvite, setTourInvite] = useState(false);

  /* ---------------------------------------------------------------- *
   * Derived state
   * ---------------------------------------------------------------- */

  const selectedCoin = useMemo(
    () => coinUniverse.find((coin) => coin.id === selectedId) || coins[0] || null,
    [coinUniverse, coins, selectedId]
  );

  const filteredCoins = useMemo(() => {
    const query = toLowerCaseLocale(searchTerm.trim());
    if (!query) return coins;
    return coins.filter((coin) => toLowerCaseLocale(`${coin.name} ${coin.symbol}`).includes(query));
  }, [coins, searchTerm]);

  const topCoins = useMemo(() => coins.slice(0, 4), [coins]);
  const heroCoin = useMemo(
    () => coins.find((coin) => coin.id === 'bitcoin') || topCoins[0] || null,
    [coins, topCoins]
  );

  const trading = useTrading({
    coin: selectedCoin,
    tradeType,
    amount,
    cash,
    balances,
  });

  const portfolioValue = useMemo(
    () => coinUniverse.reduce((total, coin) => total + (balances[coin.id] || 0) * coin.price, 0),
    [coinUniverse, balances]
  );

  const dayChangeCOP = useMemo(
    () =>
      coinUniverse.reduce(
        (total, coin) => total + ((balances[coin.id] || 0) * coin.price * coin.change24h) / 100,
        0
      ),
    [coinUniverse, balances]
  );

  const portfolioChange =
    portfolioValue > 0
      ? (dayChangeCOP / Math.max(portfolioValue - dayChangeCOP, 1)) * 100
      : 0;

  const distribution = useMemo(() => {
    const holdings = coinUniverse
      .filter((coin) => (balances[coin.id] || 0) > 0)
      .map((coin) => ({
        ...coin,
        quantity: balances[coin.id],
        value: balances[coin.id] * coin.price,
      }))
      .filter((coin) => coin.value > 0)
      .sort((first, second) => second.value - first.value);

    const total = holdings.reduce((sum, coin) => sum + coin.value, 0);
    let stop = 0;
    const slices = holdings.map((coin, index) => {
      const start = stop;
      stop += total ? (coin.value / total) * 100 : 0;
      return {
        ...coin,
        share: total ? (coin.value / total) * 100 : 0,
        color: ALLOCATION_COLORS[index % ALLOCATION_COLORS.length],
        start,
        stop,
      };
    });

    return {
      holdings: slices,
      total,
      gradient: slices.length
        ? `conic-gradient(${slices
            .map((slice) => `${slice.color} ${slice.start}% ${slice.stop}%`)
            .join(', ')})`
        : 'conic-gradient(#273244 0% 100%)',
    };
  }, [coinUniverse, balances]);

  const marketCapTotal = useMemo(
    () => coins.slice(0, 100).reduce((sum, coin) => sum + coin.marketCap, 0),
    [coins]
  );
  const volumeTotal = useMemo(
    () => coins.slice(0, 100).reduce((sum, coin) => sum + coin.volume, 0),
    [coins]
  );

  const liveLabel =
    marketState === 'sin-conexion'
      ? coins.length
        ? 'Mostrando último dato'
        : 'Sin conexión con el mercado'
      : MARKET_LABELS[marketState] || MARKET_LABELS.cargando;
  const marketStatusLabel =
    fxStatus === 'reintentando' && marketState !== 'en-vivo'
      ? 'Reintentando tasa de cambio'
      : liveLabel;
  const updatedAtLabel = formatClock(updatedAt);

  /* ---------------------------------------------------------------- *
   * Navigation
   * ---------------------------------------------------------------- */

  // Kept in a ref so the scroll spy resolves the highlighted entry with the
  // trade type that is actually on screen, without re-subscribing.
  const tradeTypeRef = useRef(tradeType);
  tradeTypeRef.current = tradeType;

  const handleSpySection = useCallback((sectionId) => {
    const navId = resolveNavFromSection(sectionId, tradeTypeRef.current);
    if (navId) setActiveSection(navId);
  }, []);

  useScrollSpy(OBSERVED_SECTIONS, handleSpySection);

  const goTo = useCallback((navId, nextTradeType) => {
    const nav = NAV_ITEMS.find((item) => item.id === navId);
    const target = nav?.target || navId;

    // "Comprar" and "Vender" share one section, so the navigation entry also
    // implies which side of the trade switch must be visible.
    const impliedType = navId === 'vender' ? 'sell' : navId === 'comprar' ? 'buy' : null;
    const type = nextTradeType || impliedType || tradeTypeRef.current;

    if (nextTradeType || impliedType) setTradeType(type);
    tradeTypeRef.current = type;

    const resolved = resolveNavFromSection(target, type);
    if (resolved) setActiveSection(resolved);

    // Reflect the section in the URL so it can be shared or reloaded. Replace,
    // not push: in-page jumps must not fill the back button history.
    try {
      if (window.location.hash !== `#${navId}`) window.history.replaceState(null, '', `#${navId}`);
    } catch {
      /* history can be unavailable in sandboxed frames; navigation still works */
    }

    document
      .getElementById(target)
      ?.scrollIntoView({ behavior: scrollBehavior(), block: 'start' });
  }, []);

  // Direct access: /#mercado, /#portafolio… The browser cannot do this alone
  // because the sections do not exist yet when it parses the URL.
  useEffect(() => {
    const openHash = () => {
      let id = '';
      try {
        id = decodeURIComponent(window.location.hash.slice(1));
      } catch {
        return; // malformed hash such as "#%E0": ignore it, never crash
      }
      if (LINKABLE_IDS.has(id)) goTo(id);
    };
    const frame = window.requestAnimationFrame(openHash);
    window.addEventListener('hashchange', openHash);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('hashchange', openHash);
    };
  }, [goTo]);

  const selectAsset = useCallback(
    (coinId) => {
      setSelectedId(coinId);
      goTo('detalle');
    },
    [goTo]
  );

  // A buy amount is pesos and a sell amount is units: carrying the text across
  // the switch would turn "500.000" pesos into 500.000 coins.
  const changeTradeType = useCallback((type) => {
    if (tradeTypeRef.current !== type) setAmount('');
    tradeTypeRef.current = type;
    setTradeType(type);
    setActiveSection((current) =>
      current === 'comprar' || current === 'vender' ? resolveNavFromSection('comprar', type) : current
    );
  }, []);

  const startTrade = useCallback(
    (coin, type = 'buy') => {
      if (coin) setSelectedId(coin.id);
      setTradeType(type);
      setAmount('');
      goTo(type === 'buy' ? 'comprar' : 'vender', type);
    },
    [goTo]
  );

  /* ---------------------------------------------------------------- *
   * Actions
   * ---------------------------------------------------------------- */

  const reviewTrade = useCallback(() => {
    if (trading.error) {
      notify('error', trading.error);
      return;
    }
    setTradeReviewOpen(true);
  }, [notify, trading.error]);

  const confirmTrade = useCallback(() => {
    if (!selectedCoin) return;

    const quantity = trading.receivedCrypto;
    const total = trading.tradeValueCOP;

    executeTrade({
      coin: selectedCoin,
      type: tradeType,
      quantity,
      total,
      fee: trading.feeCOP,
    });

    setTradeReviewOpen(false);
    setAmount('');
    notify(
      'success',
      `Movimiento simulado: ${tradeType === 'buy' ? 'compra' : 'venta'} de ${formatCrypto(
        quantity
      )} ${selectedCoin.symbol}.`
    );
  }, [executeTrade, notify, selectedCoin, tradeType, trading]);

  const fillWholeBalance = useCallback(() => {
    setAmount(balanceToInput(trading.availableBalance));
  }, [trading.availableBalance]);

  const handleResetPortfolio = useCallback(() => {
    resetPortfolio();
    setAmount('');
    notify('success', 'Portafolio de prueba restablecido a sus valores iniciales.');
  }, [notify, resetPortfolio]);

  const handleSignOut = useCallback(() => {
    setIsDemoConnected(false);
    notify('success', 'Sesión de prueba cerrada en este dispositivo.');
  }, [notify]);

  /* ---------------------------------------------------------------- *
   * Guided tour
   * ---------------------------------------------------------------- */

  useEffect(() => {
    if (readTourState()) return undefined;
    const timer = window.setTimeout(() => setTourInvite(true), TOUR_INVITE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, []);

  const openGuide = useCallback(() => {
    setTourInvite(false);
    setAuthOpen(false);
    setTradeReviewOpen(false);
    setTourOpen(true);
  }, []);

  const dismissInvite = useCallback(() => {
    setTourInvite(false);
    saveTourState('omitido');
  }, []);

  const finishGuide = useCallback(
    (estado) => {
      setTourOpen(false);
      saveTourState(estado);
      if (estado === 'completado') {
        notify('success', 'Guía completada. Puedes volver a abrirla desde el botón «Guía».');
      }
    },
    [notify]
  );

  const handleDemoAccess = useCallback(
    (event) => {
      event.preventDefault();
      setIsDemoConnected(true);
      setAuthOpen(false);
      notify('success', 'Sesión de demostración iniciada en este dispositivo.');
    },
    [notify]
  );

  const openAuth = useCallback((mode) => {
    setAuthMode(mode);
    setAuthOpen(true);
  }, []);

  // Stable handlers: they let every section be memoised, so typing in the
  // trade form does not re-render the 250-row market table.
  const openSignIn = useCallback(() => openAuth('signin'), [openAuth]);
  const openSignUp = useCallback(() => openAuth('signup'), [openAuth]);
  const closeTradeReview = useCallback(() => setTradeReviewOpen(false), []);
  const closeAuth = useCallback(() => setAuthOpen(false), []);

  return (
    <div className="nx-app">
      <div className="nx-ambient" aria-hidden="true" />

      <Header
        activeSection={activeSection}
        onNavigate={goTo}
        isDemoConnected={isDemoConnected}
        onOpenAuth={openSignIn}
        onSignOut={handleSignOut}
        onOpenGuide={openGuide}
      />

      <main>
        <Hero
          liveLabel={marketStatusLabel}
          updatedAtLabel={updatedAtLabel}
          portfolioValue={portfolioValue}
          dayChangeCOP={dayChangeCOP}
          portfolioChange={portfolioChange}
          heroCoin={heroCoin}
          topCoins={topCoins}
          visibleAssets={coins.length}
          marketState={marketState}
          onNavigate={goTo}
          onOpenAuth={openSignUp}
          onSelectAsset={selectAsset}
          usdCopRate={usdCopRate}
        />

        <TickerStrip coins={topCoins} onSelectAsset={selectAsset} dataSource={dataSource} />

        <MarketSection
          coins={coins}
          filteredCoins={filteredCoins}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          selectedId={selectedCoin?.id}
          onSelectAsset={selectAsset}
          marketState={marketState}
          marketError={marketError}
          retryInSeconds={retryInSeconds}
          dataSource={dataSource}
          hasMore={hasMore}
          liveLabel={marketStatusLabel}
          updatedAtLabel={updatedAtLabel}
          marketPage={marketPage}
          onChangePage={setMarketPage}
          pageSize={pageSize}
          selectedCoin={selectedCoin}
          marketCapTotal={marketCapTotal}
          volumeTotal={volumeTotal}
          onStartTrade={startTrade}
          onRefresh={refresh}
        />

        <DetailSection coin={selectedCoin} usdCopRate={usdCopRate} />

        <TradeSection
          coin={selectedCoin}
          options={coinUniverse.length ? coinUniverse : coins}
          tradeType={tradeType}
          onTradeTypeChange={changeTradeType}
          amount={amount}
          onAmountChange={setAmount}
          onAssetChange={setSelectedId}
          receivedCrypto={trading.receivedCrypto}
          tradeValueCOP={trading.tradeValueCOP}
          feeCOP={trading.feeCOP}
          availableBalance={trading.availableBalance}
          totalWithFee={trading.totalWithFee}
          error={trading.error}
          hasAmount={trading.hasInput}
          onUseAll={fillWholeBalance}
          onReview={reviewTrade}
          canSubmit={trading.canSubmit}
        />

        <PortfolioSection
          distribution={distribution}
          portfolioValue={portfolioValue}
          portfolioChange={portfolioChange}
          cash={cash}
          onSelectAsset={selectAsset}
          onNavigate={goTo}
          onReset={handleResetPortfolio}
        />

        <ActivitySection activity={activity} onNavigate={goTo} />
      </main>

      <Footer onNavigate={goTo} onOpenGuide={openGuide} />
      <MobileNav activeSection={activeSection} onNavigate={goTo} />

      <Toast toast={toast} onDismiss={dismissToast} />

      {tradeReviewOpen && (
        <TradeReviewModal
          coin={selectedCoin}
          tradeType={tradeType}
          amount={trading.currentAmount}
          receivedCrypto={trading.receivedCrypto}
          feeCOP={trading.feeCOP}
          totalWithFee={trading.totalWithFee}
          netProceeds={trading.netProceeds}
          onClose={closeTradeReview}
          onConfirm={confirmTrade}
        />
      )}

      {tourInvite && !tourOpen && <TourInvite onStart={openGuide} onDismiss={dismissInvite} />}

      {tourOpen && <GuidedTour onFinish={finishGuide} />}

      {authOpen && (
        <AuthModal
          mode={authMode}
          onModeChange={setAuthMode}
          onClose={closeAuth}
          onSubmit={handleDemoAccess}
        />
      )}
    </div>
  );
}
