import { NavAnchor } from './NavAnchor';

/** The three-bar NEXORA mark. Purely decorative: the wordmark carries the name. */
export function BrandMark({ className = '' }) {
  return (
    <span className={`nx-brand-mark ${className}`.trim()} aria-hidden="true">
      <i />
      <i />
      <i />
    </span>
  );
}

/** Logo link back to the top of the page, shared by the header and the footer. */
export function Brand({ onNavigate, label }) {
  return (
    <NavAnchor className="nx-brand" target="inicio" onNavigate={onNavigate} aria-label={label}>
      <BrandMark />
      <span className="nx-brand-word">NEXORA</span>
    </NavAnchor>
  );
}
