// How much gas to allow for writing a sponsor's ad to Arkiv (Rabdi).
//
// Arkiv charges for every stored byte AND for how long the entity is kept. Measured with real writes at 1 gwei:
//
//     size    kept for   gas used
//     40 KB     1 day    1,724,784        100 KB    1 day     4,213,423
//     40 KB     9 days   1,938,989        100 KB    9 days    4,723,010
//     40 KB    37 days   2,684,329
//     40 KB    97 days   4,284,812
//
// which fits   gas ~= 70,000 + bytes x (41 + 0.65 x days kept).   The old limit ignored the days, so an ad kept for a month
// (30 days plus the week after it ends) ran out of gas even at 40 KB, and a 100 KB ad failed from about 2 weeks.
// A transaction that runs out of gas still spends its fee, so the limit carries a 15% margin. Only gas USED is paid.
export const BLOCK_GAS_LIMIT = 30_000_000n; // Rabdi: a transaction cannot ask for more than a block holds (and would never be mined)
const MAX_GAS = 25_000_000n;

export function gasForCreative(bytes, keptDays) {
  const b = BigInt(Math.max(0, Math.ceil(Number(bytes) || 0)));
  const days = BigInt(Math.max(1, Math.ceil(Number(keptDays) || 1)));
  const perByteMilli = 41_000n + 650n * days; // thousandths of a gas unit per byte
  const used = 80_000n + (b * perByteMilli) / 1000n;
  const withMargin = (used * 115n) / 100n;
  return withMargin > MAX_GAS ? MAX_GAS : withMargin;
}
