/**
 * Generates src/lib/coinAliases.js
 *
 * The two market sources use different coin ids (CoinGecko: `bitcoin`,
 * Coinpaprika: `btc-bitcoin`). Every balance/selection lookup in the app is
 * keyed by `coin.id`, so the fallback source must be translated back into the
 * canonical CoinGecko id at the boundary - otherwise the demo portfolio would
 * show $0 and a trade made during a fallback session would be orphaned as soon
 * as the primary source recovered.
 *
 * Matching is conservative: an alias is only emitted when two independent
 * signals agree. In order: exact name (unique on both sides), name against the
 * slugified CoinGecko id, exact ticker (unique on both sides) and finally the
 * `${symbol}-${slug}` shape of Coinpaprika ids. Conflicting claimants are
 * dropped rather than guessed, and unresolved ids keep their own value.
 */
const fs = require('node:fs');
const path = require('node:path');

const OUT = path.resolve(__dirname, '..', 'src', 'lib', 'coinAliases.js');
const TOP_N = 300;

const norm = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

async function getJson(url) {
  const response = await fetch(url, { headers: { 'User-Agent': 'nexora-build/1.0' } });
  if (!response.ok) throw new Error(`${response.status} on ${url}`);
  return response.json();
}

function indexBy(rows, keyFn) {
  const map = new Map();
  for (const row of rows) {
    const key = keyFn(row);
    if (!key) continue;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(row);
  }
  return map;
}

async function main() {
  const [gecko, paprika] = await Promise.all([
    getJson('https://api.coingecko.com/api/v3/coins/list'),
    getJson('https://api.coinpaprika.com/v1/tickers?limit=1000'),
  ]);

  const geckoName = indexBy(gecko, (c) => norm(c.name));
  const geckoSymbol = indexBy(gecko, (c) => String(c.symbol || '').toUpperCase());
  const geckoById = new Map(gecko.map((c) => [c.id, c]));
  const papName = indexBy(paprika, (c) => norm(c.name));
  const papSymbol = indexBy(paprika, (c) => String(c.symbol || '').toUpperCase());

  const top = paprika.slice(0, TOP_N);
  const aliases = {};
  let byName = 0;
  let bySlug = 0;
  let bySlugId = 0;
  let bySymbol = 0;
  const slugFixes = [];
  const skipped = [];

  for (const coin of top) {
    if (aliases[coin.id]) continue;

    const nameKey = norm(coin.name);
    const nameHits = geckoName.get(nameKey) || [];

    // 1) exact name, unique on both sides
    if (nameHits.length === 1 && (papName.get(nameKey) || []).length === 1) {
      aliases[coin.id] = nameHits[0].id;
      byName += 1;
      continue;
    }

    // 2) name is ambiguous (CoinGecko hosts junk clones such as `bitcoin-5`)
    //    but exactly one candidate is the slugified name -> that is the real one.
    if (nameHits.length > 1 && (papName.get(nameKey) || []).length === 1) {
      const slugHits = nameHits.filter((candidate) => candidate.id === nameKey);
      if (slugHits.length === 1) {
        aliases[coin.id] = slugHits[0].id;
        bySlug += 1;
        continue;
      }
    }

    // 3) symbol, unique on both sides
    const symbolKey = String(coin.symbol || '').toUpperCase();
    const symbolHits = geckoSymbol.get(symbolKey) || [];
    if (symbolHits.length === 1 && (papSymbol.get(symbolKey) || []).length === 1) {
      aliases[coin.id] = symbolHits[0].id;
      bySymbol += 1;
      continue;
    }

    // 4) Coinpaprika ids are `${symbol}-${slug}`: when that slug is literally a
    //    CoinGecko id and the ticker agrees, two independent signals line up
    //    and there is nothing left to guess. (The descriptive names do differ
    //    between catalogs, so they are not compared here.)
    const slug = coin.id.includes('-') ? coin.id.slice(coin.id.indexOf('-') + 1) : '';
    const slugHit = slug ? geckoById.get(slug) : null;
    if (slugHit && String(slugHit.symbol || '').toUpperCase() === symbolKey) {
      aliases[coin.id] = slugHit.id;
      bySlugId += 1;
      slugFixes.push(`${coin.id} -> ${slugHit.id}`);
      continue;
    }

    skipped.push(`${coin.id} (${coin.symbol})`);
  }

  // A canonical id must belong to exactly one source id. If two candidates
  // claim it, drop every claimant rather than guessing.
  const claimCount = new Map();
  for (const to of Object.values(aliases)) claimCount.set(to, (claimCount.get(to) || 0) + 1);

  const final = {};
  const dropped = [];
  for (const [from, to] of Object.entries(aliases)) {
    if (from === to) continue;
    if (claimCount.get(to) > 1) {
      dropped.push(`${from} -> ${to}`);
      continue;
    }
    final[from] = to;
  }

  const seeded = ['bitcoin', 'ethereum', 'solana', 'cardano', 'ripple'];
  const papByGecko = new Map(Object.entries(final).map(([from, to]) => [to, from]));
  const missingSeed = seeded.filter((id) => !papByGecko.has(id));

  const entries = Object.entries(final).sort(([a], [b]) => a.localeCompare(b));
  const body = entries
    .map(([from, to]) => `  '${from}': '${to}',`)
    .join('\n');
  const contents = `/**
 * Canonical CoinGecko id for every Coinpaprika id the fallback source can
 * return. Generated from the live catalog (top ${TOP_N} by rank) by
 * \`npm run gen:aliases\`. Only unambiguous matches are emitted and conflicting
 * claimants are dropped, so every mapping here is 1:1.
 *
 * The app only ever exposes canonical ids: a balance written while the
 * fallback source is active stays valid once the primary source recovers.
 * Ids missing from this table keep their own value, which is still a unique
 * and stable key.
 */
export const COIN_ID_ALIASES = {
${body}
};

/** Translates a source specific id into the canonical one used everywhere else. */
export function canonicalCoinId(id) {
  return COIN_ID_ALIASES[id] || id;
}
`;
  fs.writeFileSync(OUT, contents, 'utf8');

  console.log(`gecko list   : ${gecko.length}`);
  console.log(`paprika top  : ${top.length}`);
  console.log(
    `aliases      : ${entries.length}  (name ${byName}, slug ${bySlug}+${bySlugId}, symbol ${bySymbol})`
  );
  if (slugFixes.length) console.log(`slug fixes   : ${slugFixes.join(', ')}`);
  console.log(`dropped (amb): ${dropped.length}${dropped.length ? '  ' + dropped.slice(0, 8).join(' | ') : ''}`);
  console.log(`skipped      : ${skipped.length}${skipped.length ? '  ' + skipped.slice(0, 12).join(', ') : ''}`);
  console.log(`file         : ${OUT} (${contents.length} bytes)`);
  console.log(`missing seed : ${missingSeed.length ? missingSeed.join(', ') : 'none'}`);

  // Report the seeded coins explicitly: these must always resolve.
  const reverse = new Map(Object.entries(final).map(([from, to]) => [to, from]));
  for (const id of seeded) console.log(`  ${id} <- ${reverse.get(id) || 'SIN MAPEO'}`);

  if (missingSeed.length) {
    console.error('\nFALTAN MONEDAS SEMILLADAS - revisar a mano.');
    process.exit(1);
  }
  console.log('\nAll seeded coins resolve 1:1.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
