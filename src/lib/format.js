/**
 * Formatting helpers shared across the UI.
 * Locale is fixed to Colombian Spanish so every screen renders
 * money and dates the same way.
 */

/*
 * Intl.NumberFormat construction is expensive and these helpers run for every
 * market row on every refresh, so the formatters are built once and reused.
 */
const COP_FORMATTER = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});
const COP_SMALL_FORMATTER = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  minimumFractionDigits: 2,
  maximumFractionDigits: 8,
});
const CRYPTO_FORMATTERS = new Map();

export function formatCOP(value) {
  const safe = Number.isFinite(value) ? value : 0;
  // Sub-peso prices (many small-cap tokens) keep their decimals; zero does not.
  const isFraction = safe !== 0 && Math.abs(safe) < 1;
  return (isFraction ? COP_SMALL_FORMATTER : COP_FORMATTER).format(safe);
}

export function formatCrypto(value, maximumFractionDigits = 6) {
  const safe = Number.isFinite(value) ? value : 0;
  let formatter = CRYPTO_FORMATTERS.get(maximumFractionDigits);
  if (!formatter) {
    formatter = new Intl.NumberFormat('es-CO', { maximumFractionDigits, minimumFractionDigits: 0 });
    CRYPTO_FORMATTERS.set(maximumFractionDigits, formatter);
  }
  return formatter.format(safe);
}

const PERCENT_FORMATTERS = new Map();

/**
 * Unsigned percentage with the Colombian decimal comma ("1,40 %").
 * Formatters are cached per precision: this runs for every market row.
 */
export function formatPercent(value, fractionDigits = 2) {
  const safe = Number.isFinite(value) ? Math.abs(value) : 0;
  let formatter = PERCENT_FORMATTERS.get(fractionDigits);
  if (!formatter) {
    formatter = new Intl.NumberFormat('es-CO', {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    });
    PERCENT_FORMATTERS.set(fractionDigits, formatter);
  }
  return `${formatter.format(safe)} %`;
}

export function formatClock(date) {
  if (!date) return 'Esperando cotizaciones';
  return date.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
}

export function formatTimestamp(isoValue) {
  const date = new Date(isoValue);
  // A corrupted local record must not print "Invalid Date" in the UI.
  if (Number.isNaN(date.getTime())) return 'Fecha no disponible';
  return date.toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' });
}

export function toLowerCaseLocale(value) {
  return String(value || '').toLocaleLowerCase('es-CO');
}

/**
 * Scripted scrolling must honour the user's motion preference: the CSS
 * `prefers-reduced-motion` override cannot cancel an explicit
 * `scrollIntoView({ behavior: 'smooth' })`.
 */
export function scrollBehavior() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'auto';
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
}

/**
 * Builds an SVG polyline for a price series.
 *
 * Non finite samples coming from a provider are dropped (they would otherwise
 * poison the whole path with `NaN`) and long series are downsampled so the DOM
 * stays light while the shape of the curve is preserved.
 *
 * Returns an empty string when there is nothing drawable, which every caller
 * already treats as "no chart".
 */
export function pricePath(values, width = 220, height = 70, padding = 4) {
  if (!Array.isArray(values)) return '';

  const clean = values.filter((value) => Number.isFinite(value));
  if (clean.length < 2) return '';

  const sample =
    clean.length > 96
      ? clean.filter(
          (_, index) =>
            index % Math.ceil(clean.length / 96) === 0 || index === clean.length - 1
        )
      : clean;

  const minimum = Math.min(...sample);
  const maximum = Math.max(...sample);
  const span = maximum - minimum || 1;

  return sample
    .map((value, index) => {
      const x = (index / (sample.length - 1)) * width;
      const y = height - padding - ((value - minimum) / span) * (height - padding * 2);
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}
