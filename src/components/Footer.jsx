import { ArrowUpRight } from 'lucide-react';
import { NAV_ITEMS } from '../lib/constants';
import { Brand } from './Brand';
import { NavAnchor } from './NavAnchor';

/** Public data providers the app actually reads from (see lib/marketApi and lib/priceSeries). */
const DATA_SOURCES = [
  { label: 'CoinGecko', href: 'https://www.coingecko.com/' },
  { label: 'Coinpaprika', href: 'https://coinpaprika.com/' },
  { label: 'Binance', href: 'https://www.binance.com/' },
  { label: 'ExchangeRate-API', href: 'https://www.exchangerate-api.com/' },
];

const FOOTER_NAV = NAV_ITEMS.filter((item) => item.id !== 'vender');

export function Footer({ onNavigate }) {
  return (
    <footer className="nx-footer">
      <div className="nx-footer-inner">
        <div className="nx-footer-brand">
          <Brand onNavigate={onNavigate} label="NEXORA, volver al inicio" />
          <p>El mercado cambia. Tu perspectiva también.</p>
        </div>

        <nav className="nx-footer-col" aria-labelledby="nx-footer-nav-title">
          <h2 id="nx-footer-nav-title">Explorar</h2>
          <ul>
            {FOOTER_NAV.map(({ id, label }) => (
              <li key={id}>
                <NavAnchor target={id} onNavigate={onNavigate}>
                  {label}
                </NavAnchor>
              </li>
            ))}
          </ul>
        </nav>

        <div className="nx-footer-col">
          <h2>NEXORA</h2>
          <ul>
            <li>
              <a href="mailto:hola@nexora.example">Contacto</a>
            </li>
            <li>
              <NavAnchor target="legal" onNavigate={onNavigate}>
                Privacidad
              </NavAnchor>
            </li>
          </ul>
        </div>

        <div className="nx-footer-col nx-footer-sources">
          <h2>Fuentes de datos</h2>
          <ul>
            {DATA_SOURCES.map(({ label, href }) => (
              <li key={label}>
                <a href={href} target="_blank" rel="noopener noreferrer">
                  {label}
                  <ArrowUpRight size={13} aria-hidden="true" />
                  <span className="nx-sr-only"> (se abre en una pestaña nueva)</span>
                </a>
              </li>
            ))}
          </ul>
        </div>

        <div className="nx-footer-bottom">
          <p className="nx-footer-legal" id="legal">
            <strong>Privacidad y aviso legal.</strong> NEXORA es una plataforma demostrativa. Los
            precios vienen de datos públicos de mercado; las operaciones y saldos son simulados, se
            guardan solo en este navegador y no representan transacciones financieras reales. No
            recopilamos ni enviamos tus datos personales.
          </p>

          <p className="nx-copyright">© 2026 NEXORA · Información con fines educativos</p>
        </div>
      </div>
    </footer>
  );
}
