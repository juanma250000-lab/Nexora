/**
 * Formatting helpers shared across the UI.
 * Locale is fixed to Colombian Spanish so every screen renders
 * money and dates the same way.
 */

export function formatCOP(value) {
  const safe = Number.isFinite(value) ? value : 0;
  const small = Math.abs(safe) < 1;
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: small ? 2 : 0,
    maximumFractionDigits: small ? 8 : 0,
  }).format(safe);
}

export function formatCrypto(value, maximumFractionDigits = 6) {
  const safe = Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat('es-CO', {
    maximumFractionDigits,
    minimumFractionDigits: 0,
  }).format(safe);
}

export function formatClock(date) {
  if (!date) return 'Esperando cotizaciones';
  return date.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
}

export function formatTimestamp(isoValue) {
  return new Date(isoValue).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' });
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
