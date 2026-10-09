import { MOBILE_NAV_IDS, NAV_ITEMS, SECTION_NAV } from '../lib/constants';

/** Floating bottom bar shown on small screens. */
export function MobileNav({ activeSection, onNavigate }) {
  const activeNav = NAV_ITEMS.find((item) => item.id === activeSection);
  const activeTarget = activeNav?.target || SECTION_NAV[activeSection] || activeSection;

  const items = NAV_ITEMS.filter((item) => MOBILE_NAV_IDS.includes(item.id));

  return (
    <nav className="nx-mobile-nav" aria-label="Navegación móvil" data-tour="nav-mobile">
      {items.map(({ id, label, icon: Icon, target }) => (
        <button
          key={id}
          type="button"
          className={activeTarget === target ? 'is-active' : ''}
          aria-current={activeTarget === target ? 'location' : undefined}
          onClick={() => onNavigate(id)}
        >
          <Icon size={18} aria-hidden="true" />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}
