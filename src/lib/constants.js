import { Activity, ArrowDownLeft, ArrowUpRight, Clock3, Sparkles, Wallet } from 'lucide-react';

/* ------------------------------------------------------------------ *
 * Timing
 * ------------------------------------------------------------------ */

/** Assets requested per market page. */
export const PAGE_SIZE = 250;
/** Market page refresh interval. */
export const REFRESH_MS = 30000;
/** USD -> COP reference rate refresh interval. */
export const FX_REFRESH_MS = 60 * 60 * 1000;
/** Retry delay used while the FX provider is unreachable. */
export const FX_RETRY_MS = 20000;
/** Delay before prefetching the next market page. */
export const PREFETCH_DELAY_MS = 1200;
/** How long a toast stays on screen. */
export const TOAST_DURATION_MS = 4200;

/* ------------------------------------------------------------------ *
 * Storage keys
 * ------------------------------------------------------------------ */

export const CACHE_KEY = 'nexora-live-market-cop-v1';
export const FX_CACHE_KEY = 'nexora-usd-cop-rate-v1';
export const PORTFOLIO_KEY = 'nexora-demo-portfolio-v1';
export const TOUR_KEY = 'nexora-guia-v1';
export const MAX_CACHED_PAGES = 4;

/* ------------------------------------------------------------------ *
 * Demo portfolio
 * ------------------------------------------------------------------ */

export const FEE_RATE = 0.001;
export const INITIAL_CASH = 25000000;
export const INITIAL_BALANCES = {
  bitcoin: 0.125,
  ethereum: 1.5,
  solana: 10,
  cardano: 500,
  ripple: 1000,
};
export const ALLOCATION_COLORS = ['#80e8c3', '#62a9ff', '#efba75', '#d091ff', '#ff7e86', '#b8c8df'];

/* ------------------------------------------------------------------ *
 * Navigation
 *
 * "Comprar" and "Vender" share a single section: the trade panel holds
 * the buy/sell switch, so both entries point at the same anchor and the
 * switch state tells them apart.
 * ------------------------------------------------------------------ */

export const NAV_ITEMS = [
  { id: 'inicio', label: 'Inicio', icon: Sparkles, target: 'inicio' },
  { id: 'mercado', label: 'Mercado', icon: Activity, target: 'mercado' },
  { id: 'comprar', label: 'Comprar', icon: ArrowDownLeft, target: 'comprar' },
  { id: 'vender', label: 'Vender', icon: ArrowUpRight, target: 'comprar' },
  { id: 'portafolio', label: 'Portafolio', icon: Wallet, target: 'portafolio' },
  { id: 'actividad', label: 'Actividad', icon: Clock3, target: 'actividad' },
];

/** Section ids observed by the scroll spy. */
export const OBSERVED_SECTIONS = Array.from(
  new Set([...NAV_ITEMS.map((item) => item.target), 'detalle'])
);

/** Fallback mapping from a section id to its navigation entry. */
export const SECTION_NAV = {
  inicio: 'inicio',
  mercado: 'mercado',
  detalle: 'mercado',
  comprar: 'comprar',
  portafolio: 'portafolio',
  actividad: 'actividad',
};

/**
 * Resolves which navigation entry should be highlighted for a section.
 * The trade section highlights "Vender" while the sell switch is active.
 */
export function resolveNavFromSection(sectionId, tradeType) {
  if (sectionId === 'comprar' && tradeType === 'sell') return 'vender';
  return SECTION_NAV[sectionId] || null;
}

/** Sections rendered in the floating mobile bar. */
export const MOBILE_NAV_IDS = ['inicio', 'mercado', 'comprar', 'portafolio', 'actividad'];
