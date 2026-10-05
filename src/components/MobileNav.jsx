import { MOBILE_NAV_IDS, NAV_ITEMS, SECTION_NAV } from '../lib/constants';
import { NavAnchor } from './NavAnchor';

const MOBILE_ITEMS = NAV_ITEMS.filter((item) => MOBILE_NAV_IDS.includes(item.id));

/** Bottom tab bar shown on small screens, where the header has no room for links. */
export function MobileNav({ activeSection, onNavigate }) {
  const activeNav = NAV_ITEMS.find((item) => item.id === activeSection);
  const activeTarget = activeNav?.target || SECTION_NAV[activeSection] || activeSection;

  return (
    <nav className="nx-mobile-nav" aria-label="Navegación móvil">
      <ul>
        {MOBILE_ITEMS.map(({ id, label, icon: Icon, target }) => {
          const isActive = activeTarget === target;
          return (
            <li key={id}>
              <NavAnchor
                target={id}
                onNavigate={onNavigate}
                className={isActive ? 'is-active' : undefined}
                aria-current={isActive ? 'location' : undefined}
              >
                <Icon size={19} aria-hidden="true" />
                <span>{label}</span>
              </NavAnchor>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
