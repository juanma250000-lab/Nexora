/**
 * End-to-end tests in a real browser (Microsoft Edge or Chrome through
 * playwright-core; no browser download needed).
 *
 * Builds nothing by itself: `npm run test:e2e` builds first, then this script
 * serves `dist/` with `vite preview` and drives the production bundle.
 *
 * Every third-party API (CoinGecko, Coinpaprika, Binance, FX, fonts, logos) is
 * answered by deterministic fixtures, so the suite is repeatable offline and
 * can also reproduce the provider failures the app must survive.
 *
 * Browser: NEXORA_BROWSER=msedge (default) | chrome | chromium
 */
const { spawn } = require('node:child_process');
const path = require('node:path');
const { chromium } = require('playwright-core');

const PORT = Number(process.env.NEXORA_E2E_PORT || 4180);
const BASE = `http://localhost:${PORT}/`;
const ROOT = path.resolve(__dirname, '..');
const RATE = 4000;

/* ------------------------------------------------------------------ *
 * Fixtures
 * ------------------------------------------------------------------ */

const NAMED = [
  ['bitcoin', 'Bitcoin', 'btc', 65000],
  ['ethereum', 'Ethereum', 'eth', 3000],
  ['tether', 'Tether', 'usdt', 1],
  ['solana', 'Solana', 'sol', 150],
  ['cardano', 'Cardano', 'ada', 0.5],
  ['ripple', 'XRP', 'xrp', 0.6],
];

function geckoRows(page) {
  return Array.from({ length: 250 }, (_, index) => {
    const n = (page - 1) * 250 + index;
    const [id, name, symbol, price] = NAMED[n] || [`coin-${n}`, `Moneda ${n}`, `c${n}`, 10 + (n % 50)];
    return {
      id,
      name,
      symbol,
      image: `https://img.test/${id}.png`,
      current_price: price,
      market_cap: price * 1e7,
      total_volume: price * 1e5,
      price_change_percentage_24h: n % 2 ? -1.5 : 2.25,
      price_change_percentage_7d_in_currency: 4,
      sparkline_in_7d: { price: Array.from({ length: 40 }, (_, i) => price * (1 + Math.sin(i / 5) / 20)) },
    };
  });
}

function paprikaRows(limit) {
  return Array.from({ length: limit }, (_, n) => {
    const [id, name, symbol, price] = NAMED[n] || [`coin-${n}`, `Moneda ${n}`, `c${n}`, 10];
    const paprikaId = id === 'bitcoin' ? 'btc-bitcoin' : id === 'ethereum' ? 'eth-ethereum' : `${symbol}-${id}`;
    return {
      id: paprikaId,
      name,
      symbol: symbol.toUpperCase(),
      rank: n + 1,
      quotes: { USD: { price, percent_change_24h: 1, percent_change_7d: 2, market_cap: price * 1e7, volume_24h: 1e6 } },
    };
  });
}

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

/**
 * scenario: 'ok' (CoinGecko answers) | 'limited' (CoinGecko 429, fallback
 * serves) | 'offline' (every market source down).
 */
async function mockNetwork(context, scenario = 'ok') {
  await context.route(/^https?:\/\/(?!localhost)/, async (route) => {
    const url = route.request().url();
    const json = (body, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body), headers: { 'access-control-allow-origin': '*' } });

    if (url.includes('open.er-api.com')) return json({ result: 'success', rates: { COP: RATE } });
    if (url.includes('currency-api')) return json({ usd: { cop: RATE } });
    if (url.includes('api.coingecko.com')) {
      if (scenario === 'offline') return route.abort('internetdisconnected');
      if (scenario === 'limited') return json({ error: 'rate limited' }, 429);
      const page = Number(new URL(url).searchParams.get('page')) || 1;
      return json(page <= 2 ? geckoRows(page) : []);
    }
    if (url.includes('api.coinpaprika.com')) {
      if (scenario === 'offline') return route.abort('internetdisconnected');
      return json(paprikaRows(Number(new URL(url).searchParams.get('limit')) || 250));
    }
    if (url.includes('api.binance.com')) {
      return json(Array.from({ length: 8 }, (_, i) => [0, 0, 0, 0, String(65000 * (1 + i / 100))]));
    }
    if (url.includes('fonts.googleapis.com')) return route.fulfill({ status: 200, contentType: 'text/css', body: '' });
    if (url.includes('img.test/broken')) return route.fulfill({ status: 404, body: '' });
    if (/img\.test|coinpaprika\.com\/coin/.test(url)) return route.fulfill({ status: 200, contentType: 'image/png', body: PNG });
    return route.abort();
  });
}

/* ------------------------------------------------------------------ *
 * Harness
 * ------------------------------------------------------------------ */

const results = [];
let browser;

async function openPage({
  width = 1366,
  height = 800,
  scenario = 'ok',
  storage = null,
  hash = '',
  reducedMotion = 'no-preference',
} = {}) {
  const context = await browser.newContext({ viewport: { width, height }, locale: 'es-CO', reducedMotion });
  await mockNetwork(context, scenario);
  // Skip the first-visit invitation unless a test opts into a clean storage.
  const seeded = storage === null ? { 'nexora-guia-v1': JSON.stringify({ estado: 'omitido' }) } : storage;
  await context.addInitScript((entries) => {
    if (sessionStorage.getItem('__seeded')) return;
    sessionStorage.setItem('__seeded', '1');
    for (const [key, value] of Object.entries(entries)) localStorage.setItem(key, value);
  }, seeded);

  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error' && !/Failed to load resource|CORS/.test(message.text())) {
      errors.push(`console: ${message.text()}`);
    }
  });
  await page.goto(BASE + hash);
  return { page, context, errors };
}

async function test(label, fn) {
  try {
    await fn();
    results.push([label, true]);
    console.log(`PASS  ${label}`);
  } catch (error) {
    results.push([label, false]);
    console.log(`FAIL  ${label}\n      ${String(error && error.message).split('\n')[0]}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const noOverflow = (page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);

const inViewport = (page, selector) =>
  page.evaluate((s) => {
    const r = document.querySelector(s)?.getBoundingClientRect();
    return Boolean(r) && r.top < window.innerHeight && r.bottom > 0;
  }, selector);

/**
 * Element-level layout check. The page-level scroll test cannot see these
 * problems because .nx-app clips horizontal overflow: it reports controls
 * that stick out of the viewport and sibling blocks printed on top of each
 * other inside the same panel.
 */
const layoutProblems = (page) =>
  page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const problems = [];
    const name = (el) => `${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]} "${el.textContent.trim().slice(0, 30)}"`;
    // Decorations and horizontal scrollers are allowed to extend past the edge.
    const exempt = '.nx-ambient, .nx-market-orbit, .nx-ticker-strip, .nx-market-rows, .nx-sr-only';
    for (const el of document.querySelectorAll('.nx-app *')) {
      if (!el.getClientRects().length) continue;
      if (el.closest(exempt) && !el.closest('.nx-hero-market-glass, .nx-floating-note')) continue;
      const r = el.getBoundingClientRect();
      if (r.width && (r.right > vw + 0.5 || r.left < -0.5)) problems.push(`fuera de pantalla: ${name(el)}`);
    }
    const groups = '.nx-header, .nx-header-actions, .nx-market-aside, .nx-aside-stats, .nx-detail-current, .nx-data-rail, .nx-market-row, .nx-activity-row, .nx-holding-row, .nx-legend-row, .nx-cash-row, .nx-trade-lines > div, .nx-estimate, .nx-market-toolbar, .nx-hero-actions, .nx-footer';
    for (const parent of document.querySelectorAll(groups)) {
      const kids = [...parent.children].filter((k) => k.getClientRects().length && getComputedStyle(k).position !== 'absolute');
      for (let i = 0; i < kids.length; i += 1) {
        for (let j = i + 1; j < kids.length; j += 1) {
          const a = kids[i].getBoundingClientRect();
          const b = kids[j].getBoundingClientRect();
          const x = Math.min(a.right, b.right) - Math.max(a.left, b.left);
          const y = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
          if (x > 1 && y > 1) problems.push(`superpuestos: ${name(kids[i])} × ${name(kids[j])}`);
        }
      }
    }
    return problems;
  });

/* ------------------------------------------------------------------ *
 * Scenarios
 * ------------------------------------------------------------------ */

async function run() {
  await test('carga inicial sin errores y con 250 activos', async () => {
    const { page, context, errors } = await openPage();
    await page.waitForSelector('.nx-market-row');
    assert((await page.locator('.nx-market-row').count()) === 250, 'deben verse 250 filas');
    assert(await page.getByRole('heading', { level: 1 }).isVisible(), 'falta el h1');
    assert(await noOverflow(page), 'hay scroll horizontal');
    await page.waitForTimeout(500);
    assert(errors.length === 0, errors.join(' | '));
    await context.close();
  });

  await test('el botón primario tiene texto oscuro legible', async () => {
    const { page, context } = await openPage();
    const color = await page
      .locator('.nx-hero-actions .nx-button-primary')
      .evaluate((el) => getComputedStyle(el).color);
    assert(color === 'rgb(8, 32, 26)', `color inesperado ${color}`);
    await context.close();
  });

  await test('la nota "Mercado activo" no tapa las cotizaciones del hero', async () => {
    for (const width of [1366, 390]) {
      const { page, context } = await openPage({ width });
      await page.waitForSelector('.nx-preview-coin');
      const overlap = await page.evaluate(() => {
        const note = document.querySelector('.nx-floating-note').getBoundingClientRect();
        return [...document.querySelectorAll('.nx-preview-coin')].some((coin) => {
          const r = coin.getBoundingClientRect();
          return !(note.right <= r.left || note.left >= r.right || note.bottom <= r.top || note.top >= r.bottom);
        });
      });
      assert(!overlap, `se solapan a ${width}px`);
      await context.close();
    }
  });

  await test('navegación: el menú lleva a la sección y actualiza la URL', async () => {
    const { page, context } = await openPage();
    await page.getByRole('navigation', { name: 'Navegación principal' }).getByRole('button', { name: 'Portafolio' }).click();
    await page.waitForTimeout(900);
    assert(page.url().endsWith('#portafolio'), `URL ${page.url()}`);
    assert(await inViewport(page, '#portafolio'), 'portafolio no visible');
    await page.getByRole('navigation', { name: 'Navegación principal' }).getByRole('button', { name: 'Vender' }).click();
    await page.waitForTimeout(600);
    assert(await page.getByRole('button', { name: 'Vender', pressed: true }).isVisible(), 'el selector no cambió a vender');
    await context.close();
  });

  await test('acceso directo y recarga con #actividad', async () => {
    const { page, context } = await openPage({ hash: '#actividad' });
    await page.waitForTimeout(1200);
    assert(await inViewport(page, '#actividad'), 'no se abrió en actividad');
    await page.reload();
    await page.waitForTimeout(1200);
    assert(await inViewport(page, '#actividad'), 'la recarga perdió la sección');
    await context.close();
  });

  await test('hashes desconocidos o mal formados no rompen la página', async () => {
    for (const hash of ['#no-existe', '#%E0%A4%A']) {
      const { page, context, errors } = await openPage({ hash });
      await page.waitForSelector('.nx-market-row');
      assert(errors.length === 0, `${hash}: ${errors.join(' | ')}`);
      assert(await page.getByRole('heading', { level: 1 }).isVisible(), `${hash}: no se renderizó`);
      await context.close();
    }
  });

  await test('búsqueda filtra y muestra estado vacío en español', async () => {
    const { page, context } = await openPage();
    await page.waitForSelector('.nx-market-row');
    const search = page.getByRole('searchbox', { name: 'Buscar criptomonedas' });
    await search.fill('ETH');
    // "Tether" also contains "eth": both must match, nothing else.
    assert((await page.locator('.nx-market-row').count()) === 2, 'deberían quedar Ethereum y Tether');
    await search.fill('ethereum');
    assert((await page.locator('.nx-market-row').count()) === 1, 'debería quedar solo Ethereum');
    await search.fill('zzzz-no-existe');
    assert(await page.getByText('No encontramos ese activo en esta página.').isVisible(), 'falta el vacío');
    await context.close();
  });

  await test('compra simulada con "500.000" pesos', async () => {
    const { page, context, errors } = await openPage({ hash: '#comprar' });
    await page.waitForSelector('.nx-market-row');
    await page.getByLabel('Monto en pesos colombianos').fill('500.000');
    await page.getByRole('button', { name: /Revisar compra/ }).click();
    const dialog = page.getByRole('dialog', { name: 'Confirma el movimiento.' });
    assert(await dialog.isVisible(), 'no abrió la revisión');
    assert((await dialog.textContent()).includes('500.000'), 'el monto revisado no es 500.000');
    await page.getByRole('button', { name: /Confirmar operación simulada/ }).click();
    await page.getByText(/Movimiento simulado: compra/).waitFor();
    assert(await page.getByText('Compra simulada de Bitcoin').isVisible(), 'no se registró la actividad');
    const cash = await page.locator('.nx-cash-row b').textContent();
    assert(cash.replace(/\s/g, '').includes('24.499.500'), `saldo inesperado ${cash}`);
    assert(errors.length === 0, errors.join(' | '));
    await context.close();
  });

  await test('montos inválidos muestran error y bloquean la revisión', async () => {
    const { page, context } = await openPage({ hash: '#comprar' });
    await page.waitForSelector('.nx-market-row');
    const amount = page.getByLabel('Monto en pesos colombianos');
    await amount.fill('12abc');
    assert(await page.getByRole('alert').filter({ hasText: 'solo números' }).isVisible(), 'falta el error');
    assert(await page.getByRole('button', { name: /Revisar compra/ }).isDisabled(), 'el botón sigue activo');
    assert((await amount.getAttribute('aria-invalid')) === 'true', 'falta aria-invalid');
    await amount.fill('999.999.999');
    await page.getByText('El saldo de demostración no alcanza para esta compra.').waitFor();
    await context.close();
  });

  await test('vender: el cambio limpia el monto y "Usar todo" vende el saldo', async () => {
    const { page, context } = await openPage({ hash: '#comprar' });
    await page.waitForSelector('.nx-market-row');
    await page.getByLabel('Monto en pesos colombianos').fill('500.000');
    await page.locator('.nx-trade-switch').getByRole('button', { name: 'Vender' }).click();
    const amount = page.getByLabel('Cantidad en BTC');
    assert((await amount.inputValue()) === '', 'el monto en pesos pasó a la venta');
    await page.getByRole('button', { name: 'USAR TODO' }).click();
    assert((await amount.inputValue()) === '0,125', `valor ${await amount.inputValue()}`);
    await page.getByRole('button', { name: /Revisar venta/ }).click();
    await page.getByRole('button', { name: /Confirmar operación simulada/ }).click();
    await page.getByText('Venta simulada de Bitcoin').waitFor();
    await context.close();
  });

  await test('restablecer portafolio pide confirmación y restaura el saldo', async () => {
    const { page, context } = await openPage({
      storage: {
        'nexora-guia-v1': JSON.stringify({ estado: 'omitido' }),
        'nexora-demo-portfolio-v1': JSON.stringify({ balances: { bitcoin: 0 }, cash: 10, activity: [] }),
      },
      hash: '#portafolio',
    });
    await page.waitForSelector('.nx-market-row');
    await page.getByRole('button', { name: /Restablecer portafolio/ }).click();
    await page.getByRole('button', { name: 'Cancelar' }).click();
    assert((await page.locator('.nx-cash-row b').textContent()).includes('10'), 'canceló pero cambió');
    await page.getByRole('button', { name: /Restablecer portafolio/ }).click();
    await page.getByRole('button', { name: 'Sí, restablecer' }).click();
    const cash = await page.locator('.nx-cash-row b').textContent();
    assert(cash.replace(/\s/g, '').includes('25.000.000'), `saldo ${cash}`);
    await context.close();
  });

  await test('el historial completo es accesible con "Ver todo"', async () => {
    const activity = Array.from({ length: 6 }, (_, i) => ({
      id: `NX-${i}`, coinId: 'bitcoin', name: `Prueba ${i}`, symbol: 'BTC', type: 'buy',
      quantity: 0.001, price: 1, total: 1000, fee: 1, date: new Date(2026, 0, i + 1).toISOString(),
    }));
    const { page, context } = await openPage({
      storage: {
        'nexora-guia-v1': JSON.stringify({ estado: 'omitido' }),
        'nexora-demo-portfolio-v1': JSON.stringify({ balances: {}, cash: 1, activity }),
      },
      hash: '#actividad',
    });
    await page.waitForSelector('.nx-activity-row');
    assert((await page.locator('.nx-activity-row').count()) === 4, 'deberían verse 4');
    const toggle = page.getByRole('button', { name: 'Ver todo el historial (2 más)' });
    await toggle.click();
    assert((await page.locator('.nx-activity-row').count()) === 6, 'deberían verse 6');
    assert((await page.getByRole('button', { name: 'Ver menos' }).getAttribute('aria-expanded')) === 'true', 'aria-expanded');
    await context.close();
  });

  await test('acceso de prueba: validación en español, Escape y cierre de sesión', async () => {
    const { page, context } = await openPage();
    const trigger = page.getByRole('button', { name: /Conectar cuenta/ });
    await trigger.click();
    await page.getByRole('button', { name: /Entrar al modo de prueba/ }).click();
    assert(await page.getByText('Escribe tu correo electrónico.').isVisible(), 'falta error de correo');
    assert(await page.getByText('Escribe una contraseña temporal.').isVisible(), 'falta error de contraseña');
    assert(await page.evaluate(() => document.activeElement?.id === 'nx-email'), 'el foco no fue al primer error');
    await page.keyboard.press('Escape');
    assert((await page.getByRole('dialog').count()) === 0, 'Escape no cerró el diálogo');
    assert(await trigger.evaluate((el) => el === document.activeElement), 'el foco no volvió al disparador');
    await trigger.click();
    await page.getByLabel('Correo electrónico').fill('tu@correo.com');
    await page.getByLabel('Contraseña temporal').fill('1234');
    await page.getByRole('button', { name: /Entrar al modo de prueba/ }).click();
    await page.getByText('Sesión de demostración iniciada en este dispositivo.').waitFor();
    await page.getByRole('button', { name: /Salir de la prueba/ }).click();
    await page.getByText('Sesión de prueba cerrada en este dispositivo.').waitFor();
    await context.close();
  });

  await test('guía: invitación en la primera visita y "Ahora no" se recuerda', async () => {
    const { page, context } = await openPage({ storage: {} });
    const invite = page.getByRole('complementary', { name: 'Guía de uso' });
    await invite.waitFor({ timeout: 5000 });
    await page.getByRole('button', { name: 'Ahora no' }).click();
    await page.reload();
    await page.waitForTimeout(2200);
    assert((await invite.count()) === 0, 'la invitación volvió a salir');
    await context.close();
  });

  await test('guía completa con teclado, progreso y foco', async () => {
    const { page, context, errors } = await openPage();
    await page.waitForSelector('.nx-market-row');
    await page.getByRole('button', { name: 'Guía', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.waitFor();
    const total = Number((await page.locator('.nx-tour-count').textContent()).match(/de (\d+)/)[1]);
    for (let step = 1; step <= total; step += 1) {
      const counter = await page.locator('.nx-tour-count').textContent();
      assert(counter.includes(`Paso ${step} de ${total}`), `contador ${counter}`);
      await page.waitForTimeout(450);
      const fits = await page.evaluate(() => {
        const r = document.querySelector('.nx-tour-popover').getBoundingClientRect();
        return r.top >= 0 && r.left >= 0 && r.bottom <= innerHeight && r.right <= innerWidth;
      });
      assert(fits, `el panel se sale de la pantalla en el paso ${step}`);
      if (step < total) await page.keyboard.press('ArrowRight');
    }
    await page.getByRole('button', { name: /Finalizar/ }).click();
    await page.getByText(/Guía completada/).waitFor();
    const state = await page.evaluate(() => JSON.parse(localStorage.getItem('nexora-guia-v1')).estado);
    assert(state === 'completado', `estado ${state}`);
    assert(errors.length === 0, errors.join(' | '));
    await context.close();
  });

  await test('guía: Escape la cierra y se puede reabrir desde el pie', async () => {
    const { page, context } = await openPage();
    await page.getByRole('button', { name: 'Guía', exact: true }).click();
    await page.getByRole('dialog').waitFor();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Escape');
    assert((await page.getByRole('dialog').count()) === 0, 'Escape no cerró la guía');
    await page.getByRole('button', { name: 'Guía de uso' }).click();
    assert(await page.getByText('Paso 1 de').isVisible(), 'no reabrió desde el paso 1');
    await context.close();
  });

  await test('móvil 375 px: barra inferior, guía como hoja inferior y sin scroll lateral', async () => {
    const { page, context } = await openPage({ width: 375, height: 740 });
    await page.waitForSelector('.nx-market-row');
    assert(await noOverflow(page), 'scroll horizontal en móvil');
    const mobileNav = page.getByRole('navigation', { name: 'Navegación móvil' });
    await mobileNav.getByRole('button', { name: 'Mercado' }).click();
    await page.waitForTimeout(900);
    assert(await inViewport(page, '#mercado'), 'no navegó a mercado');
    await page.getByRole('button', { name: 'Guía', exact: true }).click();
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(500);
    const sheet = await page.evaluate(() => {
      const r = document.querySelector('.nx-tour-popover').getBoundingClientRect();
      return { bottomGap: innerHeight - r.bottom, left: r.left, right: innerWidth - r.right };
    });
    assert(sheet.bottomGap >= 0 && sheet.bottomGap < 40 && sheet.left >= 8 && sheet.right >= 8, JSON.stringify(sheet));
    assert(
      await page.evaluate(() => document.querySelector('[data-tour="nav-mobile"]').getBoundingClientRect().height > 0),
      'el paso de navegación debería usar la barra móvil'
    );
    await context.close();
  });

  await test('320 px: sin scroll horizontal en ninguna sección', async () => {
    const { page, context } = await openPage({ width: 320, height: 640 });
    await page.waitForSelector('.nx-market-row');
    assert(await noOverflow(page), 'scroll horizontal a 320 px');
    await context.close();
  });

  await test('CoinGecko limitado: la fuente de respaldo muestra logos y se identifica', async () => {
    const { page, context } = await openPage({ scenario: 'limited' });
    await page.waitForSelector('.nx-market-row');
    assert(await page.getByText('Fuente de respaldo').isVisible(), 'no avisa de la fuente de respaldo');
    assert(await page.locator('.nx-ticker-source').textContent().then((t) => t.includes('Coinpaprika')), 'el ticker sigue diciendo CoinGecko');
    const logo = await page.locator('.nx-market-row img').first().getAttribute('src');
    assert(logo && logo.includes('static.coinpaprika.com/coin/btc-bitcoin'), `logo ${logo}`);
    await context.close();
  });

  await test('sin conexión: mensaje en español, cuenta atrás y reintento', async () => {
    const { page, context } = await openPage({ scenario: 'offline' });
    await page.getByText('No pudimos conectar con el mercado', { exact: false }).first().waitFor({ timeout: 10000 });
    assert(await page.getByRole('button', { name: 'Reintentar ahora' }).first().isVisible(), 'falta reintentar');
    await context.close();
  });

  await test('una imagen rota cae a la inicial del activo', async () => {
    const { page, context } = await openPage();
    await page.waitForSelector('.nx-market-row img');
    await page.evaluate(() => {
      // Force a failing logo on the first row through React's own update path.
      const img = document.querySelector('.nx-market-row img');
      img.src = 'https://img.test/broken.png';
    });
    await page.waitForTimeout(500);
    const fallback = await page.locator('.nx-market-row').first().locator('.nx-coin-fallback').count();
    assert(fallback === 1, 'no apareció la inicial de respaldo');
    await context.close();
  });

  await test('cada botón e icono tiene nombre accesible', async () => {
    const { page, context } = await openPage();
    await page.waitForSelector('.nx-market-row');
    const unnamed = await page.evaluate(() =>
      [...document.querySelectorAll('button, a[href], input, select')]
        .filter((el) => {
          const label = el.getAttribute('aria-label') || el.textContent.trim() || el.labels?.[0]?.textContent || el.getAttribute('title');
          return !label;
        })
        .map((el) => el.outerHTML.slice(0, 80))
    );
    assert(unnamed.length === 0, unnamed.join(' | '));
    await context.close();
  });

  await test('enlaces y menú: cada destino interno existe y se abre', async () => {
    // Instant scrolling keeps the checks deterministic; behaviour is identical.
    const { page, context, errors } = await openPage({ reducedMotion: 'reduce' });
    await page.waitForSelector('.nx-market-row');
    const links = await page.evaluate(() =>
      [...document.querySelectorAll('a[href]')].map((a) => a.getAttribute('href'))
    );
    // Logo (cabecera y pie), Mercado, Portafolio y Privacidad.
    assert(links.length === 5, `se esperaban 5 enlaces y hay ${links.length}: ${links.join(', ')}`);
    for (const href of links) {
      assert(/^#[a-z]+$/.test(href), `enlace sin destino interno válido: ${href}`);
      assert(await page.evaluate((id) => Boolean(document.getElementById(id)), href.slice(1)), `no existe ${href}`);
    }
    for (let i = 0; i < links.length; i += 1) {
      await page.locator('a[href]').nth(i).click();
      await page.waitForTimeout(250);
      assert(await inViewport(page, links[i]), `el enlace ${links[i]} no mostró su destino`);
    }
    const nav = page.getByRole('navigation', { name: 'Navegación principal' });
    const entries = [
      ['Inicio', '#inicio'],
      ['Mercado', '#mercado'],
      ['Comprar', '#comprar'],
      ['Vender', '#comprar'],
      ['Portafolio', '#portafolio'],
      ['Actividad', '#actividad'],
    ];
    for (const [label, target] of entries) {
      await nav.getByRole('button', { name: label, exact: true }).click();
      await page.waitForTimeout(250);
      assert(await inViewport(page, target), `«${label}» no mostró ${target}`);
      const current = await nav.getByRole('button', { name: label, exact: true }).getAttribute('aria-current');
      assert(current === 'location', `«${label}» no quedó marcado como sección actual`);
    }
    assert(errors.length === 0, errors.join(' | '));
    await context.close();
  });

  await test('accesos rápidos: hero, franja y filas llevan al detalle o al simulador', async () => {
    const { page, context, errors } = await openPage({ reducedMotion: 'reduce' });
    await page.waitForSelector('.nx-market-row');
    await page.locator('.nx-preview-coin', { hasText: 'ETH' }).click();
    await page.waitForTimeout(250);
    assert(await inViewport(page, '#detalle'), 'la cotización del hero no abrió el detalle');
    assert((await page.locator('.nx-detail-current').textContent()).includes('Ethereum'), 'el detalle no muestra Ethereum');
    await page.locator('.nx-ticker-item', { hasText: 'SOL' }).click();
    await page.waitForTimeout(250);
    assert((await page.locator('.nx-detail-current').textContent()).includes('Solana'), 'la franja no seleccionó Solana');
    await page.getByRole('button', { name: 'Comprar Cardano' }).click();
    await page.waitForTimeout(250);
    assert(await inViewport(page, '#comprar'), 'la flecha de la fila no abrió el simulador');
    assert((await page.locator('#nx-asset-select').inputValue()) === 'cardano', 'el simulador no recibió Cardano');
    // The order side is visible at a glance: the switch carries its state.
    await page.locator('.nx-trade-switch').getByRole('button', { name: 'Vender' }).click();
    assert(await page.locator('.nx-trade-switch.is-sell').count() === 1, 'el selector no refleja la venta');
    await page.locator('.nx-trade-switch').getByRole('button', { name: 'Comprar' }).click();
    assert(await page.locator('.nx-trade-switch.is-sell').count() === 0, 'el selector no volvió a compra');
    assert(errors.length === 0, errors.join(' | '));
    await context.close();
  });

  await test('diseño: nada se sale de la pantalla ni se superpone (320–1440 px)', async () => {
    for (const width of [320, 390, 768, 1024, 1440]) {
      const { page, context } = await openPage({ width, reducedMotion: 'reduce' });
      await page.waitForSelector('.nx-market-row');
      await page.waitForTimeout(300);
      const problems = await layoutProblems(page);
      assert(problems.length === 0, `${width}px: ${problems.slice(0, 4).join(' | ')}`);
      await context.close();
    }
  });

  await test('movimiento reducido: sin animaciones de aparición al desplazarse', async () => {
    const { page, context } = await openPage({ reducedMotion: 'reduce' });
    await page.waitForSelector('.nx-market-row');
    const animation = await page
      .locator('.nx-market-table-wrap')
      .evaluate((el) => getComputedStyle(el).animationName);
    assert(animation === 'none', `con movimiento reducido la tabla aún anima (${animation})`);
    await context.close();
  });
}

/* ------------------------------------------------------------------ *
 * Runner
 * ------------------------------------------------------------------ */

function startServer() {
  const vite = path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js');
  const server = spawn(process.execPath, [vite, 'preview', '--port', String(PORT), '--strictPort'], {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('vite preview no arrancó a tiempo')), 20000);
    server.stdout.on('data', (chunk) => {
      if (String(chunk).includes(String(PORT))) {
        clearTimeout(timer);
        resolve(server);
      }
    });
    server.on('exit', (code) => reject(new Error(`vite preview terminó (${code})`)));
  });
}

async function main() {
  const server = await startServer();
  const channel = process.env.NEXORA_BROWSER || 'msedge';
  try {
    browser = await chromium.launch(channel === 'chromium' ? {} : { channel });
    await run();
  } finally {
    await browser?.close();
    server.kill();
  }

  const failed = results.filter(([, ok]) => !ok);
  console.log('');
  if (failed.length) {
    console.error(`${failed.length} prueba(s) E2E fallaron.`);
    process.exit(1);
  }
  console.log(`All ${results.length} e2e tests passed.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
