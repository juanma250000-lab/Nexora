/**
 * Merges two coin lists without duplicates, keeping the newest data
 * for coins already present.
 */
export function mergeCoins(existing, incoming) {
  const merged = new Map(existing.map((coin) => [coin.id, coin]));
  incoming.forEach((coin) => merged.set(coin.id, coin));
  return Array.from(merged.values());
}
