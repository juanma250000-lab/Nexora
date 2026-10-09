/**
 * Steps of the "Guía de uso" tour.
 *
 * `target` is a list of CSS selectors tried in order; the first one that is
 * rendered and visible wins, so the same step can point at the desktop
 * navigation or at the mobile bar. A step whose targets are all missing is
 * shown centred without a highlight instead of leaving a broken overlay.
 */
export const TOUR_STEPS = [
  {
    id: 'bienvenida',
    title: 'Bienvenido a NEXORA',
    body:
      'NEXORA te muestra el mercado de criptomonedas con precios reales en pesos colombianos y te deja simular compras y ventas con un saldo de prueba. Nunca se mueve dinero real.',
  },
  {
    id: 'navegacion',
    target: ['[data-tour="nav"]', '[data-tour="nav-mobile"]'],
    title: 'Navega por secciones',
    body:
      'Usa este menú para saltar a Mercado, Comprar, Vender, Portafolio o Actividad. La sección en la que estás queda resaltada mientras te desplazas.',
  },
  {
    id: 'busqueda',
    target: ['[data-tour="market-search"]'],
    title: 'Busca un activo',
    body:
      'Escribe el nombre o el símbolo (por ejemplo «BTC») para filtrar la página actual del mercado. Los precios se actualizan solos cada 30 segundos; «Actualizar ahora» fuerza una consulta.',
    section: 'mercado',
  },
  {
    id: 'fila',
    target: ['[data-tour="market-row"]', '[data-tour="market-table"]'],
    title: 'Abre el detalle o compra',
    body:
      'Pulsa el nombre o el precio de un activo para ver su gráfico de siete días. La flecha de la derecha lo lleva directo al simulador de compra.',
    section: 'mercado',
  },
  {
    id: 'detalle',
    target: ['[data-tour="detail-chart"]'],
    title: 'Analiza su evolución',
    body:
      'Aquí ves la evolución del precio en los últimos siete días, junto con la variación de 24 h, la de 7 días y los precios máximo y mínimo del periodo.',
    section: 'detalle',
  },
  {
    id: 'simulador',
    target: ['[data-tour="trade-card"]'],
    title: 'Simula una operación',
    body:
      'Elige Comprar o Vender, selecciona el activo y escribe el monto. Puedes usar el formato colombiano, por ejemplo «500.000» pesos o «0,25» unidades. Luego revisa la orden y confírmala.',
    section: 'comprar',
  },
  {
    id: 'portafolio',
    target: ['[data-tour="portfolio"]'],
    title: 'Sigue tu portafolio',
    body:
      'Tus posiciones, su distribución y el saldo disponible de prueba. Si quieres empezar de cero, usa «Restablecer portafolio».',
    section: 'portafolio',
  },
  {
    id: 'actividad',
    target: ['[data-tour="activity"]'],
    title: 'Revisa tu actividad',
    body:
      'Cada operación simulada queda registrada aquí, solo en este navegador. Nada se envía a ningún servidor.',
    section: 'actividad',
  },
  {
    id: 'cuenta',
    target: ['[data-tour="account"]'],
    title: 'Acceso de prueba',
    body:
      'Este botón abre un acceso de demostración. No crea una cuenta real ni guarda tu contraseña; puedes cerrar la sesión de prueba cuando quieras.',
  },
  {
    id: 'final',
    target: ['[data-tour="guide"]', '[data-tour="guide-footer"]'],
    title: '¡Listo para empezar!',
    body:
      'Ya conoces lo esencial. Puedes volver a abrir esta guía cuando quieras desde el botón «Guía» de la parte superior o desde el enlace «Guía de uso» del pie de página.',
  },
];
