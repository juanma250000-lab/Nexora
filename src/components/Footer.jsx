import { scrollBehavior } from '../lib/format';

export function Footer({ onNavigate }) {
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
        <a href="mailto:hola@nexora.example">Contacto</a>
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
      </p>

      <p className="nx-copyright">© 2026 NEXORA · INFORMACIÓN PARA FINES EDUCATIVOS</p>
    </footer>
  );
}
