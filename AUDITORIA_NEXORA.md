# Auditoría de NEXORA

Fecha: 8 de octubre de 2026 · Alcance: todo el proyecto (frontend sin backend).

## 1. Resumen ejecutivo

**Antes.** NEXORA es una aplicación de una sola página (React 18 + Vite 5) con mercado de criptomonedas en pesos colombianos, detalle con gráfico de 7 días, simulador de compra/venta, portafolio y registro de actividad de demostración. La base de código ya estaba bien organizada (hooks, componentes, capa de datos con fuente de respaldo y reintentos) y compilaba sin errores; sus 43 pruebas unitarias y 38 de render pasaban. Sin embargo, la revisión en navegador real mostró defectos visibles y de uso: el botón principal tenía un contraste de **1,23:1** (texto casi invisible), el campo de monto leía «500.000» como **500**, había elementos superpuestos en la portada, enlaces sin destino real, controles que parecían funcionar pero no hacían nada útil y funciones existentes sin acceso desde la interfaz.

**Después.** Se corrigieron 21 defectos (sección 2), se añadió una guía de uso interactiva en español, una batería E2E en navegador real (22 escenarios, Edge y Chromium) y 19 pruebas nuevas entre unitarias y de render. Arquitectura, rutas y funciones existentes se conservan; no se añadió backend ni dependencias de ejecución (solo `playwright-core` como dependencia de desarrollo).

## 2. Defectos encontrados y corregidos

| # | Problema | Causa raíz | Archivo(s) | Corrección | Verificación |
|---|---|---|---|---|---|
| 1 | Botón «Explorar mercado», «Revisar compra», etc.: texto claro sobre fondo verde claro (contraste 1,23:1). También se perdían tamaño y peso de letra de `.nx-button`. | El reinicio `.nx-app button { color: inherit; font: inherit }` tiene especificidad (0,1,1) y ganaba a toda regla de una sola clase. | `src/nexora.css` | Reinicios envueltos en `:where()` (especificidad 0). Contraste ahora 12,63:1. | E2E «el botón primario tiene texto oscuro legible» (color computado). |
| 2 | La nota «Mercado activo» tapaba el precio de USDT en la portada; el rótulo «DATOS ACTUALIZADOS CADA 30 S» quedaba encima de la tarjeta. | Posicionamiento absoluto sobre la tarjeta. | `src/nexora.css` | Rejilla de dos filas: tarjeta arriba, rótulo y nota debajo. | E2E de solapamiento a 1366 y 390 px + capturas. |
| 3 | La franja de cotizaciones decía «CoinGecko» aun cuando los datos venían de la fuente de respaldo. | Texto fijo. | `TickerStrip.jsx`, `Nexora.jsx` | Muestra la fuente real (CoinGecko o Coinpaprika). | Render + E2E con CoinGecko en 429. |
| 4 | Con la fuente de respaldo, las 250 filas mostraban una letra en un círculo en lugar del logo. | `mapFallbackData` fijaba `image: null`. | `src/lib/marketApi.js` | Logo de Coinpaprika por id, validando el id (`fallbackLogoUrl`). Se comprobó en navegador que las URL cargan. | Unitarias + E2E «fuente de respaldo muestra logos». |
| 5 | Una imagen rota quedaba como icono roto. | `CoinIcon` no gestionaba `onError`. | `primitives.jsx` | Si la imagen falla se muestra la inicial del activo. | E2E «una imagen rota cae a la inicial». |
| 6 | Escribir «500.000» (formato colombiano) compraba **$ 500**; «0,5» no se aceptaba. | `<input type="number">` + `parseFloat`. | `useTrading.js`, `TradeSection.jsx`, `format.js` | Campo de texto con `inputMode="decimal"` y `parseAmount` (miles con punto, decimales con coma; en cripto acepta coma o punto). Pista de formato bajo el campo. | 2 pruebas unitarias de `parseAmount` + E2E de compra con «500.000». |
| 7 | Cambiar de Comprar a Vender conservaba el número: 500.000 pesos pasaban a ser 500.000 BTC. | El cambio de tipo no limpiaba el monto. | `Nexora.jsx` | Al cambiar de tipo se vacía el monto. | E2E «vender: el cambio limpia el monto». |
| 8 | Comprar un activo con precio 0 descontaba saldo sin entregar nada. | Sin validación de precio. | `useTrading.js` | Error «Este activo no tiene un precio disponible». | Prueba unitaria. |
| 9 | «Contacto» apuntaba a `hola@nexora.example` (dominio reservado, nunca entrega correo). | Marcador de posición. | `Footer.jsx` | Se sustituye por «Guía de uso» (no se inventó un correo). | Render «no placeholder e-mail left». |
| 10 | «Privacidad» llevaba a un texto sin información de privacidad. | Contenido incompleto. | `Footer.jsx` | Se añade qué se guarda (solo en el navegador) y qué no se envía. | Render. |
| 11 | «Solo demostración» parecía un botón y solo lanzaba un aviso. | Control falsamente interactivo. | `ActivitySection.jsx` | Ahora es una etiqueta no interactiva. | Revisión visual. |
| 12 | El historial solo mostraba 4 movimientos; los anteriores eran inaccesibles. | `slice(0, 4)` sin alternativa. | `ActivitySection.jsx` | Botón «Ver todo el historial (n más)» / «Ver menos» con `aria-expanded`. | E2E «el historial completo es accesible». |
| 13 | Al agotar el saldo de prueba no había forma de recuperarlo, aunque `resetPortfolio` existía. | Función sin interfaz. | `PortfolioSection.jsx`, `Nexora.jsx` | «Restablecer portafolio» con confirmación en dos pasos. | E2E (cancelar y confirmar). |
| 14 | La sesión de prueba no se podía cerrar (el botón reabría el formulario). | Falta de estado de salida. | `Header.jsx`, `Nexora.jsx` | Con sesión activa el botón dice «Salir de la prueba». | E2E. |
| 15 | La validación del acceso usaba las burbujas nativas, en el idioma del navegador. | Validación HTML nativa. | `AuthModal.jsx` | `noValidate` + mensajes en español en línea, `aria-invalid`, `aria-describedby` y foco al primer error. | Unitaria `validateDemoAccess` + E2E. |
| 16 | Abrir `/#portafolio` o recargar no llevaba a la sección; la URL no reflejaba la sección. | Las secciones no existen cuando el navegador procesa el hash. | `Nexora.jsx` | Se lee el hash al cargar y en `hashchange`; la navegación actualiza el hash con `replaceState` (no ensucia el historial). Hashes desconocidos o mal formados se ignoran sin error. | E2E acceso directo, recarga y hashes inválidos. |
| 17 | El valor de capitalización se salía del panel «Activo seleccionado». | Cifra larga sin ajuste de línea. | `src/nexora.css` | `flex-wrap` y `overflow-wrap`. | Barrido automático de desbordamientos en 5 anchos. |
| 18 | Textos de 9–10 px en móvil (variaciones, rango, botón de cuenta). | Ajustes responsivos demasiado agresivos. | `src/nexora.css` | Mínimo 10 px; botón de cuenta a 12 px. | Barrido automático. |
| 19 | En pantallas ≤420 px los precios de la portada se cortaban («$ 264.503.6…»). | Tres columnas sin espacio. | `src/nexora.css` | Dos cotizaciones con el precio completo. | Capturas. |
| 20 | `aria-current` incoherente (`true` en escritorio, `page` en móvil) para anclas de una misma página. | — | `Header.jsx`, `MobileNav.jsx` | `aria-current="location"` en ambos. | Revisión de código. |
| 21 | Vulnerabilidad alta en `source-map-js` (solo desarrollo). | Dependencia transitiva. | `package-lock.json` | `npm audit fix` (sin `--force`). | `npm audit`. |

Además, nombres largos truncados en la tabla muestran ahora el nombre completo como `title`, y se añadió `public/404.html` en español para alojamientos estáticos que sirven una página 404 propia.

## 3. Pruebas realizadas

Comandos reales ejecutados (Windows 11, Node 24.19.0, npm 11.17.0):

| Comando | Resultado |
|---|---|
| `npm run build` | **Pasa.** Inicial y final sin errores ni advertencias. |
| `npm test` → `test:unit` | **Pasa: 51/51** (43 originales, una de ellas actualizada porque afirmaba el defecto 4, + 8 nuevas). |
| `npm test` → `test:render` | **Pasa: 49/49** (38 originales + 11 nuevas). |
| `npm run test:e2e` (Microsoft Edge 154) | **Pasa: 22/22.** |
| `NEXORA_BROWSER=chromium node scripts/e2e.cjs` (Chromium de Playwright) | **Pasa: 22/22.** |
| `npm audit` | Quedan 2 avisos solo de desarrollo (ver riesgos). 0 en dependencias de producción. |
| Lint / comprobación de tipos | **No disponible:** el proyecto no tiene ESLint ni TypeScript configurados; no se añadieron para no introducir infraestructura nueva. |

La batería E2E (`scripts/e2e.cjs`) compila, sirve `dist/` con `vite preview` y prueba el build de producción. Todas las API externas se simulan con datos fijos para que sea repetible sin red y para reproducir fallos: carga inicial sin errores de consola, contraste del botón, solapamientos, navegación y hash, acceso directo y recarga, hashes inválidos, búsqueda y estado vacío, compra con «500.000», montos inválidos, venta con «Usar todo», restablecer portafolio, acceso de prueba (validación, Escape, retorno del foco, cierre de sesión), invitación y guía completas, Escape en la guía, móvil a 375 px (barra inferior y hoja inferior), 320 px sin scroll horizontal, CoinGecko limitado (429), sin conexión, historial completo, imagen rota y nombres accesibles en todos los controles.

Además, con **datos reales** (sin simulación) se revisaron capturas y se hizo un barrido automático de desbordamientos y textos diminutos a 320, 390, 768, 1366 y 1920 px. Resultado final: sin scroll horizontal ni elementos fuera de su panel en ningún ancho.

**No probado:** dispositivos físicos, Safari/WebKit y Firefox (sus binarios no estaban disponibles), y lectores de pantalla reales.

## 4. Auditoría de navegación

NEXORA no tiene rutas: es una página con secciones ancladas (`#inicio`, `#mercado`, `#detalle`, `#comprar` —compartida por Comprar y Vender—, `#portafolio`, `#actividad` y `#legal`).

- Menú de escritorio, barra móvil, logotipo, pie de página, botones del hero, filas de la tabla, franja de cotizaciones, panel lateral y accesos de los estados vacíos llevan a su sección (E2E y revisión manual).
- Acceso directo y recarga con hash: funcionan (corregido). Atrás/adelante: la navegación interna usa `replaceState`, así que no añade entradas al historial.
- Rutas inexistentes: dependen del alojamiento. Con `vite preview`, `/foo` muestra la app; `/foo/bar` queda en blanco porque `base: './'` resuelve los recursos relativos a esa carpeta. En alojamientos estáticos se sirve el nuevo `404.html`.
- Enlaces externos: no hay enlaces `<a>` externos en la interfaz. Las API (CoinGecko, Coinpaprika, Binance, open.er-api.com, jsDelivr) respondieron durante las pruebas en vivo; su disponibilidad futura no depende de NEXORA.
- `href="#…"` existentes: todos tienen manejador y destino real; no se encontraron enlaces de relleno activos.

## 5. Mejoras visuales, de uso y accesibilidad

- Se conservó la identidad existente (tokens de color, vidrio translúcido, tipografías Manrope/DM Mono); la guía nueva reutiliza los mismos tokens.
- Botones con colores y tipografía correctos (defecto 1), portada sin solapes, cifras largas contenidas, textos legibles en móvil.
- Formularios: pistas de formato, errores en español anunciados con `role="alert"`, `aria-invalid` y foco al primer error.
- Contraste medido de los colores de texto sobre el fondo: principal 18,3:1, secundario 7,8:1, atenuado 5,5:1 (4,6:1 sobre superficies), subidas 12,5:1, bajadas 8,6:1.
- Movimiento: la guía respeta la regla global de `prefers-reduced-motion` y el desplazamiento programado usa `scrollBehavior()`.
- No se afirma conformidad formal con WCAG 2.2 AA: no se hizo una auditoría completa con tecnologías de apoyo.

## 6. Guía de uso

- **Abrirla:** botón **«Guía»** en la cabecera (icono «?» en pantallas estrechas) o enlace **«Guía de uso»** en el pie. En la primera visita aparece una invitación con «Empezar guía» y «Ahora no».
- **Recorrido (10 pasos):** bienvenida, navegación, búsqueda, filas del mercado, gráfico de detalle, simulador, portafolio, actividad, acceso de prueba y cierre.
- **Controles:** «Siguiente», «Anterior», «Saltar guía», botón de cierre y teclado (flechas ← →, Escape, Tab sin salir de la guía). Indicador «Paso n de 10» con barra de progreso.
- **Móvil:** el panel pasa a ser una hoja inferior y el paso de navegación señala la barra inferior.
- **Robustez:** si el elemento de un paso no está visible (otro tamaño de pantalla, mercado sin datos) el paso se muestra centrado, sin un resaltado vacío.
- **Persistencia:** se guarda solo en `localStorage` (`nexora-guia-v1`) si se completó o se omitió, para no repetir la invitación. Se puede reabrir siempre desde «Guía».

## 7. Rendimiento

Medido con Edge sin interfaz sobre `vite preview`, 1366×768, 5 cargas y mediana (FCP, LCP, CLS y TBT con `PerformanceObserver`). Lighthouse no está instalado y no se añadió.

| Métrica | Antes | Después |
|---|---|---|
| JS de la app (gzip) | 22,43 kB | 26,86 kB |
| JS de React (gzip) | 45,26 kB | 45,26 kB |
| CSS (gzip) | 10,77 kB | 11,65 kB |
| FCP (mediana) | 448 ms | 448 ms |
| LCP (mediana) | 760 ms | 700 ms |
| CLS | 0,036 | 0,037 |
| TBT | 0 ms | 0 ms |
| Nodos DOM | ~5.780 | ~5.800 |

El aumento de unos 5 kB gzip corresponde a la guía y la validación. Las demás diferencias están dentro del ruido de la red: algunas cargas atípicas (2–4 s) en ambas versiones vienen de la hoja de Google Fonts, que bloquea el renderizado. No se aplicaron más optimizaciones porque las mediciones no mostraron un cuello de botella que lo justificara.

## 8. Riesgos pendientes

- **Errores de consola en vivo cuando CoinGecko limita:** el servidor responde 429 sin cabeceras CORS y el navegador registra un error que la aplicación no puede suprimir. La app pasa a la fuente de respaldo correctamente.
- **`npm audit`:** quedan avisos de `esbuild ≤0.24.2` / `vite ≤6.4.2` (solo afectan al servidor de desarrollo). Corregirlo exige pasar a Vite 8 (cambio mayor), lo que no se hizo. Mientras tanto conviene no usar `npm run dev` (que escucha en `0.0.0.0`) en redes no confiables.
- **Monto en cripto «1.000»:** se interpreta como 1,0 (punto decimal), no como mil. Es la lectura más habitual para cantidades de criptomonedas y la pista del campo indica usar coma para decimales.
- **Google Fonts** bloquea el renderizado y añade variabilidad; alojar las fuentes localmente sería la mejora siguiente.
- **Verificación manual recomendada:** Safari/iOS, Firefox, lector de pantalla (NVDA/VoiceOver) y dispositivos táctiles reales.

## 9. Verificación final

En el estado final del código: build de producción correcto, 51/51 pruebas unitarias, 49/49 de render y 22/22 E2E en Edge y en Chromium, sin errores de consola de la aplicación con datos simulados y sin scroll horizontal de 320 a 1920 px con datos reales. No se afirma que no queden errores: la cobertura es la descrita en la sección 3, con los límites de la sección 8.

### Cómo ejecutar

```bash
npm install
npm run dev        # desarrollo en http://localhost:5173
npm test           # unitarias + render
npm run test:e2e   # build + pruebas en navegador (requiere Microsoft Edge o Chrome)
```
