import { BadgeCheck, CircleHelp, LockKeyhole } from 'lucide-react';
import { NAV_ITEMS } from '../lib/constants';

export function Header({ activeSection, onNavigate, isDemoConnected, onOpenAuth, onSignOut, onOpenGuide }) {
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

      <nav className="nx-desktop-nav" aria-label="Navegación principal" data-tour="nav">
        {NAV_ITEMS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            className={`nx-nav-link ${activeSection === id ? 'is-active' : ''}`.trim()}
            aria-current={activeSection === id ? 'location' : undefined}
            onClick={() => onNavigate(id)}
          >
            {label}
          </button>
        ))}
      </nav>

      <div className="nx-header-actions">
        <button
          className="nx-help-button"
          type="button"
          onClick={onOpenGuide}
          data-tour="guide"
          title="Abrir la guía de uso"
        >
          <CircleHelp size={16} aria-hidden="true" />
          <span>Guía</span>
        </button>

        {/* Once the demo session is open the same button closes it, so the
            visitor is never stuck in a state they cannot leave. */}
        <button
          className="nx-account-button"
          type="button"
          onClick={isDemoConnected ? onSignOut : onOpenAuth}
          data-tour="account"
          title={isDemoConnected ? 'Cerrar la sesión de prueba' : undefined}
        >
          {isDemoConnected ? (
            <>
              <BadgeCheck size={16} aria-hidden="true" /> Salir de la prueba
            </>
          ) : (
            <>
              <LockKeyhole size={15} aria-hidden="true" /> Conectar cuenta
            </>
          )}
        </button>
      </div>
    </header>
  );
}
