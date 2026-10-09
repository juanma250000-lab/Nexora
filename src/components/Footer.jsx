import { scrollBehavior } from '../lib/format';

export function Footer({ onNavigate, onOpenGuide }) {
  return (
    <footer className="nx-footer">
      <a
        className="nx-brand"
        href="#inicio"
        onClick={(event) => {
          event.preventDefault();
          onNavigate('inicio');
        }}
      >
        <span className="nx-brand-mark" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <span>NEXORA</span>
      </a>

      <p>El mercado cambia. Tu perspectiva también.</p>

      <nav className="nx-footer-links" aria-label="Enlaces del pie de página">
        <a
          href="#mercado"
          onClick={(event) => {
            event.preventDefault();
            onNavigate('mercado');
          }}
        >
          Mercado
        </a>
        <a
          href="#portafolio"
          onClick={(event) => {
            event.preventDefault();
            onNavigate('portafolio');
          }}
        >
          Portafolio
        </a>
        {/* The old "Contacto" entry pointed at a placeholder address on the
            reserved .example domain, so it could never reach anyone. */}
        <button type="button" className="nx-footer-link-button" onClick={onOpenGuide} data-tour="guide-footer">
          Guía de uso
        </button>
        <a
          href="#legal"
          onClick={(event) => {
            event.preventDefault();
            document.getElementById('legal')?.scrollIntoView({ behavior: scrollBehavior() });
          }}
        >
          Privacidad
        </a>
      </nav>

      <p className="nx-footer-legal" id="legal">
        NEXORA es una plataforma demostrativa. Los precios vienen de datos públicos de mercado; las
        operaciones y saldos son simulados y no representan transacciones financieras reales.
        Privacidad: el portafolio de prueba, el historial y las preferencias se guardan solo en este
        navegador. El acceso de prueba no envía ni almacena tu correo ni tu contraseña.
      </p>

      <p className="nx-copyright">© 2026 NEXORA · INFORMACIÓN PARA FINES EDUCATIVOS</p>
    </footer>
  );
}
