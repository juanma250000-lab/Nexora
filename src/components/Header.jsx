import { BadgeCheck, LockKeyhole } from 'lucide-react';
import { NAV_ITEMS } from '../lib/constants';

export function Header({ activeSection, onNavigate, isDemoConnected, onOpenAuth }) {
  return (
    <header className="nx-header">
      <a
        className="nx-brand"
        href="#inicio"
        onClick={(event) => {
          event.preventDefault();
          onNavigate('inicio');
        }}
        aria-label="NEXORA, ir al inicio"
      >
        <span className="nx-brand-mark" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <span>NEXORA</span>
      </a>

      <nav className="nx-desktop-nav" aria-label="Navegación principal">
        {NAV_ITEMS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            className={`nx-nav-link ${activeSection === id ? 'is-active' : ''}`.trim()}
            aria-current={activeSection === id ? 'true' : undefined}
            onClick={() => onNavigate(id)}
          >
            {label}
          </button>
        ))}
      </nav>

      <button className="nx-account-button" type="button" onClick={onOpenAuth}>
        {isDemoConnected ? (
          <>
            <BadgeCheck size={16} aria-hidden="true" /> Sesión de prueba
          </>
        ) : (
          <>
            <LockKeyhole size={15} aria-hidden="true" /> Conectar cuenta
          </>
        )}
      </button>
    </header>
  );
}
