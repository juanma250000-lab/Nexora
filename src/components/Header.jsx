import { useEffect, useRef, useState } from 'react';
import { BadgeCheck, ChevronDown, LockKeyhole, LogOut } from 'lucide-react';
import { NAV_ITEMS } from '../lib/constants';
import { Brand } from './Brand';
import { NavAnchor } from './NavAnchor';

/**
 * Demo-session control. Signed out it opens the access dialog; signed in it
 * becomes a small disclosure menu, so the button always has a useful action.
 */
function AccountControl({ isDemoConnected, onOpenAuth, onSignOut }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    const close = (event) => {
      if (event.type === 'keydown') {
        if (event.key !== 'Escape') return;
        rootRef.current?.querySelector('button')?.focus();
      } else if (rootRef.current?.contains(event.target)) {
        return;
      }
      setOpen(false);
    };

    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);

  // Signing out elsewhere must never leave an orphaned open menu.
  useEffect(() => {
    if (!isDemoConnected) setOpen(false);
  }, [isDemoConnected]);

  if (!isDemoConnected) {
    return (
      <button className="nx-account-button" type="button" onClick={onOpenAuth}>
        <LockKeyhole size={15} aria-hidden="true" />
        <span>Conectar cuenta</span>
      </button>
    );
  }

  return (
    <div className="nx-account" ref={rootRef}>
      <button
        className="nx-account-button is-connected"
        type="button"
        aria-expanded={open}
        aria-controls="nx-account-menu"
        onClick={() => setOpen((value) => !value)}
      >
        <BadgeCheck size={16} aria-hidden="true" />
        <span>Sesión de prueba</span>
        <ChevronDown size={14} aria-hidden="true" className="nx-account-chevron" />
      </button>

      {open && (
        <div className="nx-account-menu" id="nx-account-menu">
          <p>Estás usando el modo de demostración en este dispositivo.</p>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onSignOut();
            }}
          >
            <LogOut size={15} aria-hidden="true" /> Cerrar sesión de prueba
          </button>
        </div>
      )}
    </div>
  );
}

export function Header({ activeSection, onNavigate, isDemoConnected, onOpenAuth, onSignOut }) {
  return (
    <header className="nx-header">
      <div className="nx-header-inner">
        <Brand onNavigate={onNavigate} label="NEXORA, ir al inicio" />

        <nav className="nx-desktop-nav" aria-label="Navegación principal">
          <ul>
            {NAV_ITEMS.map(({ id, label }) => (
              <li key={id}>
                <NavAnchor
                  target={id}
                  onNavigate={onNavigate}
                  className={`nx-nav-link ${activeSection === id ? 'is-active' : ''}`.trim()}
                  aria-current={activeSection === id ? 'location' : undefined}
                >
                  {label}
                </NavAnchor>
              </li>
            ))}
          </ul>
        </nav>

        <AccountControl
          isDemoConnected={isDemoConnected}
          onOpenAuth={onOpenAuth}
          onSignOut={onSignOut}
        />
      </div>
    </header>
  );
}
