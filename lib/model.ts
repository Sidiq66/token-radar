// The token radar's model, radar-3: one snapshot of the protocol universe in, one ranked board out.
//
// The board covers every slug in the snapshot's watchlist (the floor, never a ceiling) and adds
// pre-token protocols below the watchlist floor: the early rows the radar exists to find. A protocol
// is pre-token when its index entry records no token (no market cap, no CoinGecko id, no symbol);
// the snapshot's live-token protocols are kept apart and shown as the market's own values, never
// mixed into the ranked board.
//
// Implied value follows only from the snapshot's own figures, and the market's own multiples are
// part of them: a token that already trades tells the market what a protocol of its kind is worth
// relative to its TVL, so the model prices a pre-token protocol against its own category's live
// comparables instead of one flat multiple for every kind of protocol:
//
//   multiple   = shrunk median mcap/tvl of the live-token protocols in the protocol's category
//                (shrunk toward the whole market's median when the category holds few live
//                protocols, clamped to [0.02, 2.5]; a category with no live protocol takes the
//                market median). The category's shrunk quartiles ride along as multiple_low and
//                multiple_high, and price the row's implied range the same way.
//   base       = tvl_usd x multiple
//   growth     = clamp(change_7d, -60, 120) per cent
//   growthMult = 1 + (growth / 100) x GROWTH_WEIGHT
//   momentum   = clamp(growth - the category's median change_7d, -40, 40): how the protocol's week
//                compares with its own kind's week, so a protocol shrinking slower than a falling
//                category is not read the same as one shrinking in a rising category
//   momentumMult = 1 + (momentum / 100) x MOMENTUM_WEIGHT
//   maturity   = 0.6 + min(age_days, 1095) / 1095 x 0.4   (age_days unknown: 365)
//   likelihood = (0.6 + 0.8 x token_rate) x (0.9 + 0.2 x min(age_days, 1095) / 1095)
//                (token_rate: the share of the protocol's category that already has a token,
//                shrunk toward the market's own rate when the category is small)
//   chains     = 1 + 0.02 x min(chains - 1, 5)
//   implied    = max(1, round(base x growthMult x momentumMult x maturity x likelihood x chains))
//   range      = the same product with multiple_low and multiple_high in place of the median
//
// The constants are the model's, stated in the dashboard and changeable in the model sandbox. No
// protocol name is ever special-cased: the same function scores every row.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's constants, as the dashboard states them and the sandbox may change them. */
export interface ModelConstants {
  growth_weight: number;
  growth_floor: number;
  growth_cap: number;
  momentum_weight: number;
  momentum_span: number;
  maturity_floor: number;
  maturity_range: number;
  maturity_days: number;
  unknown_age_days: number;
  shrink_k: number;
  multiple_floor: number;
  multiple_cap: number;
  likelihood_base: number;
  likelihood_rate_weight: number;
  chain_step: number;
  chain_max_steps: number;
}

export const MODEL: ModelConstants = {
  growth_weight: 0.5,
  growth_floor: -60,
  growth_cap: 120,
  momentum_weight: 0.25,
  momentum_span: 40,
  maturity_floor: 0.6,
  maturity_range: 0.4,
  maturity_days: 1095,
  unknown_age_days: 365,
  shrink_k: 5,
  multiple_floor: 0.02,
  multiple_cap: 2.5,
  likelihood_base: 0.6,
  likelihood_rate_weight: 0.8,
  chain_step: 0.02,
  chain_max_steps: 5,
};

/** The model's version label: the dashboard names it and the rules quote it. */
export const MODEL_VERSION = 'radar-3';

/** How many pre-token protocols below the watchlist floor the early radar carries, by TVL. */
export const EARLY_ROWS = 160;

/** How many live-token protocols the Live token view carries, by market cap. */
export const LIVE_ROWS = 24;

/** One category's comparables: what its live tokens trade at, and how many of it have tokens. */
export interface CategoryStat {
  category: string;
  protocols: number;
  live: number;
  token_rate: number;
  multiple: number;
  multiple_low: number;
  multiple_high: number;
  median_change_7d: number;
}

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  set: 'watchlist' | 'early';
  age_days: number | null;
  implied_value_usd: number;
  implied_low_usd: number;
  implied_high_usd: number;
  model: {
    growth_pct: number;
    growth_multiplier: number;
    momentum_multiplier: number;
    relative_growth_pct: number;
    maturity_multiplier: number;
    age_days: number | null;
    category_multiple: number;
    category_median_change_7d: number;
    launch_likelihood: number;
    chain_factor: number;
  };
  category_multiple: number;
  launch_likelihood: number;
  chain_factor: number;
  comparables: number;
  plan_chain: string;
  plan_capital_usd: number;
  plan_gas_usd: number;
  plan_weeks: number;
  farm_steps: string[];
}

/** The dashboard's compact view of one row, with the farm plan main.ts scored. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  age_days: number | null;
  set: 'watchlist' | 'early';
  implied_value_usd: number;
  implied_low_usd: number;
  implied_high_usd: number;
  growth_multiplier: number;
  momentum_multiplier: number;
  maturity_multiplier: number;
  category_multiple: number;
  launch_likelihood: number;
  chain_factor: number;
  comparables: number;
  plan_chain: string;
  plan_capital_usd: number;
  plan_gas_usd: number;
  plan_weeks: number;
  farm_steps: string[];
}

/** A live-token protocol: it already trades, so the board shows the market's own value, not a model's. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
  mcap_tvl_multiple: number | null;
}

/** Everything the dashboard needs: the board, the live set, and the model it runs. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  categories: CategoryStat[];
  rows: RadarRow[];
  live: LiveRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** The median of a list of numbers, or null when it holds none. */
function median(values: number[]): number | null {
  return quantile(values, 0.5);
}

/** A quantile of a list of numbers (linear interpolation over the sorted list), or null when empty. */
function quantile(values: number[], q: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 1) return sorted[0]!;
  const at = (sorted.length - 1) * q;
  const lo = Math.floor(at);
  const hi = Math.ceil(at);
  if (lo === hi) return sorted[lo]!;
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (at - lo);
}

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/** The display key of a protocol's category: null reads as Other. */
export function categoryKey(p: SnapshotProtocol): string {
  return p.category ?? 'Other';
}

/** The market's own multiples, one per category, from the protocols whose token already trades. */
export function categoryStats(snapshot: Snapshot, model: ModelConstants = MODEL): { byCategory: Map<string, CategoryStat>; globalMultiple: number; globalRate: number } {
  const live = snapshot.protocols.filter((p) => !isPreToken(p));
  const allMultiples = live.filter((p) => p.mcap_usd !== null && p.tvl_usd > 0).map((p) => p.mcap_usd! / p.tvl_usd);
  const globalMultiple = median(allMultiples) ?? 0.25;
  const globalLow = quantile(allMultiples, 0.25) ?? globalMultiple;
  const globalHigh = quantile(allMultiples, 0.75) ?? globalMultiple;
  const globalRate = snapshot.protocols.length === 0 ? 0 : live.length / snapshot.protocols.length;
  const clampMultiple = (n: number): number => Math.min(model.multiple_cap, Math.max(model.multiple_floor, n));
  const shrink = (value: number | null, global: number, n: number): number =>
    value === null ? clampMultiple(global) : clampMultiple((n * value + model.shrink_k * global) / (n + model.shrink_k));
  const byCategory = new Map<string, CategoryStat>();
  const groups = new Map<string, SnapshotProtocol[]>();
  for (const p of snapshot.protocols) {
    const key = categoryKey(p);
    const list = groups.get(key);
    if (list === undefined) groups.set(key, [p]);
    else list.push(p);
  }
  for (const [key, members] of [...groups.entries()].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))) {
    const liveMembers = members.filter((p) => !isPreToken(p));
    const multiples = liveMembers.filter((p) => p.mcap_usd !== null && p.tvl_usd > 0).map((p) => p.mcap_usd! / p.tvl_usd);
    const n = multiples.length;
    const changes = members.filter((p) => p.change_7d !== null).map((p) => p.change_7d!);
    const tokenRate = (liveMembers.length + 3 * globalRate) / (members.length + 3);
    byCategory.set(key, {
      category: key,
      protocols: members.length,
      live: liveMembers.length,
      token_rate: tokenRate,
      multiple: n === 0 ? clampMultiple(globalMultiple) : shrink(median(multiples), globalMultiple, n),
      multiple_low: n === 0 ? clampMultiple(globalLow) : shrink(quantile(multiples, 0.25), globalLow, n),
      multiple_high: n === 0 ? clampMultiple(globalHigh) : shrink(quantile(multiples, 0.75), globalHigh, n),
      median_change_7d: median(changes) ?? 0,
    });
  }
  return { byCategory, globalMultiple, globalRate };
}

/** The multipliers, the implied value and its range for one protocol under `model`. */
export function impliedValue(
  protocol: SnapshotProtocol,
  asOf: string,
  model: ModelConstants,
  stats: { byCategory: Map<string, CategoryStat>; globalMultiple: number },
): { implied: number; low: number; high: number; growthPct: number; growthMult: number; momentumMult: number; relativeGrowth: number; maturityMult: number; age: number | null; multiple: number; likelihood: number; chainFactor: number; comparables: number; categoryMedianChange: number } {
  const age = ageDays(asOf, protocol.listed_at);
  const rawGrowth = finite(protocol.change_7d, 0);
  const growthPct = Math.min(model.growth_cap, Math.max(model.growth_floor, rawGrowth));
  const growthMult = 1 + (growthPct / 100) * model.growth_weight;
  const ageForModel = age ?? model.unknown_age_days;
  const maturityMult = model.maturity_floor + (Math.min(Math.max(ageForModel, 0), model.maturity_days) / model.maturity_days) * model.maturity_range;
  const stat = stats.byCategory.get(categoryKey(protocol));
  const multiple = stat === undefined ? stats.globalMultiple : stat.multiple;
  const multipleLow = stat === undefined ? stats.globalMultiple : stat.multiple_low;
  const multipleHigh = stat === undefined ? stats.globalMultiple : stat.multiple_high;
  const comparables = stat === undefined ? 0 : stat.live;
  const rate = stat === undefined ? 0.5 : stat.token_rate;
  const categoryMedianChange = stat === undefined ? 0 : stat.median_change_7d;
  const relativeGrowth = Math.min(model.momentum_span, Math.max(-model.momentum_span, growthPct - categoryMedianChange));
  const momentumMult = 1 + (relativeGrowth / 100) * model.momentum_weight;
  const ageTilt = 0.9 + 0.2 * (Math.min(Math.max(ageForModel, 0), model.maturity_days) / model.maturity_days);
  const likelihood = (model.likelihood_base + model.likelihood_rate_weight * rate) * ageTilt;
  const chainFactor = 1 + model.chain_step * Math.min(Math.max(protocol.chains.length - 1, 0), model.chain_max_steps);
  const rest = growthMult * momentumMult * maturityMult * likelihood * chainFactor;
  const implied = Math.max(1, Math.round(protocol.tvl_usd * multiple * rest));
  const low = Math.max(1, Math.round(protocol.tvl_usd * multipleLow * rest));
  const high = Math.max(1, Math.round(protocol.tvl_usd * multipleHigh * rest));
  return { implied, low, high, growthPct, growthMult, momentumMult, relativeGrowth, maturityMult, age, multiple, likelihood, chainFactor, comparables, categoryMedianChange };
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** Whether a protocol is one the board may rank: pre-token, not an exchange, not a versioned pool. */
export function isRankable(p: SnapshotProtocol): boolean {
  return isPreToken(p) && p.category !== 'CEX' && !VERSIONED.test(p.name);
}

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

/** The headline sentence's figures: how many watchlist slugs, how many rows, how many live protocols. */
export interface BoardSummary {
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
}

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): BoardRow[] {
  const stats = categoryStats(snapshot, model);
  const index = bySlug(snapshot.protocols);
  const watchlist = new Set(snapshot.watchlist);
  const chosen = new Map<string, SnapshotProtocol>();
  // The watchlist is the floor: every slug, even one the snapshot no longer carries (it cannot, but the
  // board's coverage is the gate's row and is never gambled on a missing record).
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  // The early radar: pre-token protocols below the watchlist floor, by TVL, capped. Never a replacement
  // for a watchlist row: a chosen protocol stays chosen.
  const early = snapshot.protocols
    .filter((p) => !chosen.has(p.slug) && isRankable(p) && p.tvl_usd < snapshot.floor_usd)
    .sort((a, b) => b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0))
    .slice(0, EARLY_ROWS);
  for (const p of early) chosen.set(p.slug, p);

  const scored = [...chosen.values()].map((p) => {
    const v = impliedValue(p, snapshot.as_of, model, stats);
    return { p, ...v };
  });
  scored.sort((a, b) => b.implied - a.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  return scored.map((s, i) => {
    const plan = buildPlan(s.p, s.age);
    return {
      rank: i + 1,
      slug: s.p.slug,
      name: s.p.name,
      category: s.p.category,
      chains: s.p.chains,
      tvl_usd: s.p.tvl_usd,
      change_7d: s.p.change_7d,
      mcap_usd: s.p.mcap_usd,
      listed_at: s.p.listed_at,
      gecko_id: s.p.gecko_id,
      symbol: s.p.symbol,
      token_status: 'pre-token' as const,
      set: watchlist.has(s.p.slug) ? ('watchlist' as const) : ('early' as const),
      age_days: s.age,
      implied_value_usd: s.implied,
      implied_low_usd: s.low,
      implied_high_usd: s.high,
      model: {
        growth_pct: s.growthPct,
        growth_multiplier: round4(s.growthMult),
        momentum_multiplier: round4(s.momentumMult),
        relative_growth_pct: round4(s.relativeGrowth),
        maturity_multiplier: round4(s.maturityMult),
        age_days: s.age,
        category_multiple: round4(s.multiple),
        category_median_change_7d: round4(s.categoryMedianChange),
        launch_likelihood: round4(s.likelihood),
        chain_factor: round4(s.chainFactor),
      },
      category_multiple: s.multiple,
      launch_likelihood: s.likelihood,
      chain_factor: s.chainFactor,
      comparables: s.comparables,
      plan_chain: plan.chain,
      plan_capital_usd: plan.capital,
      plan_gas_usd: plan.gasUsd,
      plan_weeks: plan.weeks,
      farm_steps: plan.steps.map(stepText),
    };
  });
}

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/**
 * What one on-chain action costs in gas, by the chain it lands on: the plan's planning constants,
 * stated here and in the dashboard. Ethereum mainnet is the expensive tier; Tron, Avalanche and
 * the BNB chain sit in the middle; rollups, sidechains and the fast L1s are the cheap tier.
 */
const CHAIN_GAS_USD: { test: RegExp; gas: number }[] = [
  { test: /^ethereum$/i, gas: 12 },
  { test: /^(tron|avax|avalanche|binance|bsc|bnb chain)$/i, gas: 1.5 },
];
const GAS_DEFAULT_USD = 0.25;

/** One action's gas on a named chain. */
export function gasForChain(chain: string): number {
  for (const tier of CHAIN_GAS_USD) if (tier.test.test(chain)) return tier.gas;
  return GAS_DEFAULT_USD;
}

/** The cheapest of a protocol's own chains to farm on: the plan works there, where gas is lowest. */
export function cheapestChain(p: SnapshotProtocol): string {
  let best: string | null = null;
  let bestGas = Infinity;
  for (const chain of p.chains) {
    const gas = gasForChain(chain);
    if (gas < bestGas) {
      bestGas = gas;
      best = chain;
    }
  }
  return best ?? 'its main chain';
}

/** A gas figure as the plan states it: cents under a dollar, else whole dollars. */
function gasText(usd: number): string {
  return usd < 1 ? `about $${usd.toFixed(2)}` : `about $${Math.round(usd)}`;
}

/** How much capital one farm position needs, from the protocol's own TVL. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 5_000_000_000) return 250;
  if (p.tvl_usd >= 1_000_000_000) return 150;
  if (p.tvl_usd >= 100_000_000) return 100;
  return 50;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/** The category family's two protocol actions and its light weekly action, in a farmer's words. */
function actionsFor(p: SnapshotProtocol, capital: number, chain: string): { first: string; second: string; weekly: string } {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) {
    return {
      first: `Supply $${capital} of USDC to ${name} on ${chain} and leave the deposit earning.`,
      second: `Borrow a small amount, about a fifth of the deposit, against it on ${name}, hold it two days, then repay: a borrower's history is what most lending points programs count first.`,
      weekly: 'repay and re-borrow a small slice of the position',
    };
  }
  if (c.includes('dex') || c.includes('leveraged farm')) {
    return {
      first: `Provide $${capital} of liquidity to ${name}'s main USDC pool on ${chain} and keep the LP position open.`,
      second: `Route three swaps of about $25 each through ${name} on ${chain} across the first week, so the wallet shows trading volume as well as liquidity.`,
      weekly: 'route one small swap through the exchange',
    };
  }
  if (c.includes('yield') || c.includes('curator') || c.includes('allocator')) {
    return {
      first: `Deposit $${capital} into a ${name} vault on ${chain} and keep the vault shares in the wallet.`,
      second: `Move about a quarter of the position into a second ${name} vault on ${chain}: breadth across a curator's vaults is the activity its points pages describe.`,
      weekly: 'harvest the vault yield and compound it back in',
    };
  }
  if (c.includes('bridge')) {
    return {
      first: `Bridge $${capital} of USDC to ${chain} through ${name} and use the bridged funds in one app there.`,
      second: `Bridge about $25 back on a different day, so the wallet holds completed crossings in both directions.`,
      weekly: 'bridge one small amount across',
    };
  }
  if (c.includes('staking') || c.includes('restak')) {
    return {
      first: `Stake $${capital} of the chain's staking asset through ${name} on ${chain} and keep the receipt token.`,
      second: `Put the receipt token to work in one place ${name} itself points to, or hold it untouched if none is named: an unused receipt still proves the stake.`,
      weekly: 'claim the staking rewards and restake them',
    };
  }
  if (c.includes('perpetual') || c.includes('derivative')) {
    return {
      first: `Deposit $${capital} of USDC as margin on ${name} and open one small hedged trade, then close it the same day.`,
      second: `Park about half the margin in ${name}'s own liquidity or earn vault if it offers one; if it does not, leave the margin idle rather than forcing a trade.`,
      weekly: 'open and close one small hedged trade',
    };
  }
  if (c.includes('prediction')) {
    return {
      first: `Fund $${capital} on ${name} and take one position in its most liquid market.`,
      second: `Take a second, smaller position in a market on a different topic, so the account is not a single bet.`,
      weekly: 'take one small position in a new market',
    };
  }
  if (c.includes('stable')) {
    return {
      first: `Mint or deposit $${capital} of the stable asset through ${name} on ${chain}.`,
      second: `Supply about half of it to a lending market ${name} names as a partner, so the holding earns while it waits.`,
      weekly: 'mint or redeem a small amount of the stable asset',
    };
  }
  if (c.includes('rwa')) {
    return {
      first: `Mint $${capital} of ${name}'s yield asset on ${chain} and hold it in the wallet.`,
      second: `Register the holding where ${name} asks holders to register, and check the first distribution date.`,
      weekly: 'check the distribution record and hold',
    };
  }
  if (c.includes('insurance')) {
    return {
      first: `Buy $${capital} of cover from ${name} on ${chain} for the longest term it sells.`,
      second: `Stake a smaller amount, about $25, into ${name}'s risk pool if it offers one, so the wallet appears on both sides of the market.`,
      weekly: 'extend the cover by a week',
    };
  }
  return {
    first: `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open.`,
    second: `Use ${name}'s second core feature once, a vote, a claim or a check-in, whichever its own app puts first, so the wallet is more than a deposit.`,
    weekly: 'make one small deposit',
  };
}

/** A protocol's whole farm plan: the steps, and the totals the dashboard states beside them. */
export interface FarmPlan {
  steps: FarmStep[];
  chain: string;
  capital: number;
  gasUsd: number;
  weeks: number;
}

/**
 * A protocol's farm plan: eight steps built from its own record (category, chains, TVL, age),
 * never from a hand-written list of names. The plan works on the cheapest of the protocol's
 * chains, starts a young protocol at a test size, gives every category family two distinct
 * protocol actions, and totals its own gas and weeks. It says plainly that a protocol with no
 * rewards program may never issue a token.
 */
export function buildPlan(p: SnapshotProtocol, age: number | null): FarmPlan {
  const chain = cheapestChain(p);
  const gas = gasForChain(chain);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const weeks = Math.max(4, Math.round(hold / 7) + 2);
  const actions = actionsFor(p, capital, chain);
  const young = age !== null && age < 90;
  const testCapital = Math.max(25, Math.round(capital / 2));
  const first = young
    ? { ...actions, first: actions.first.replace(`$${capital}`, `$${testCapital}`) }
    : actions;
  const secondChain = p.chains.find((c) => c !== chain);
  const fundText =
    p.chains.length > 1
      ? `fund it on ${chain}, the cheapest of ${p.name}'s chains to work on`
      : p.chains.length === 1
        ? `fund it on ${chain}, the only chain ${p.name} runs on`
        : 'fund it on its main chain';
  const steps: FarmStep[] = [
    {
      text: `Use a fresh wallet that holds only the funds you plan to farm, keep its seed phrase offline, and ${fundText}.`,
      cost: `${gasText(gas * 2)} of gas to fund it and make the first transactions`,
      time: '10 minutes',
    },
    {
      text: first.first,
      cost: `$${young ? testCapital : capital} of capital and ${gasText(gas)} of gas`,
      time: '15 minutes to set up',
    },
    {
      text: first.second,
      cost: `${gasText(gas)} of gas`,
      time: '20 minutes',
    },
    {
      text: `Open ${p.name}'s own rewards or points page and check both actions count before you spend more gas; keep a dated log of each transaction hash.`,
      cost: 'no fee to check',
      time: '10 minutes',
    },
    {
      text: `Once a week for ${weeks} weeks, ${first.weekly}, so the wallet's activity spans the whole qualifying window instead of one day.`,
      cost: `${gasText(gas)} of gas a week`,
      time: '10 minutes a week',
    },
  ];
  let stepSixGas = gas;
  if (young) {
    steps.push({
      text: `${p.name} has run ${age} days with no token: only after two clean weeks of counted activity, top the position up from $${testCapital} to the full $${capital}.`,
      cost: `$${capital - testCapital} more capital and ${gasText(gas)} of gas`,
      time: '10 minutes, in week 3',
    });
  } else if (secondChain !== undefined) {
    stepSixGas = gasForChain(secondChain);
    steps.push({
      text: `${p.name} also runs on ${secondChain}: repeat the main action there with $${testCapital}, so the wallet shows the protocol on more than one chain.`,
      cost: `$${testCapital} of capital and ${gasText(stepSixGas)} of gas`,
      time: '15 minutes',
    });
  } else {
    steps.push({
      text: `Halfway through the hold, top the position up once by about a quarter rather than opening a second protocol: depth in one position counts for more than breadth at this size.`,
      cost: `about $${Math.round(capital / 4)} more capital and ${gasText(gas)} of gas`,
      time: '10 minutes',
    });
  }
  steps.push(
    {
      text: `Hold the position for at least ${hold} days so the activity is counted in more than one snapshot of the protocol's books.`,
      cost: `the $${capital} stays in the position`,
      time: `${hold} days`,
    },
    {
      text:
        age !== null && age >= 1095
          ? `Before you withdraw, claim only from the link ${p.name} itself publishes, and never pay anyone to claim for you: even a protocol that has run ${Math.floor(age / 365)} years with no token may never issue one.`
          : `Before you withdraw, claim only from the link ${p.name} itself publishes, and never pay anyone to claim for you: a protocol with no rewards program may never issue a token, so only farm money you can afford to leave in the position.`,
      cost: 'no fee to check, and never pay to claim',
      time: '10 minutes',
    },
  );
  // The total the dashboard states: funding and both opening actions, the weekly action for
  // every week of the window, and the sixth step's own gas, each at its own chain's price.
  const gasUsd = Math.round((gas * (weeks + 4) + stepSixGas) * 100) / 100;
  return { steps, chain, capital, gasUsd, weeks };
}

/** A protocol's farm steps alone, as board.json carries them. */
export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  return buildPlan(p, age).steps;
}

/** The live-token protocols, by market cap, for the dashboard's Live token view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
      mcap_tvl_multiple: p.mcap_usd !== null && p.tvl_usd > 0 ? Math.round((p.mcap_usd / p.tvl_usd) * 100) / 100 : null,
    }));
}

/** A board row's compact form for data.js: the same figures and the same farm plan board.json carries. */
export function radarRow(row: BoardRow): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    mcap_usd: row.mcap_usd,
    listed_at: row.listed_at,
    age_days: row.age_days,
    set: row.set,
    implied_value_usd: row.implied_value_usd,
    implied_low_usd: row.implied_low_usd,
    implied_high_usd: row.implied_high_usd,
    growth_multiplier: row.model.growth_multiplier,
    momentum_multiplier: row.model.momentum_multiplier,
    maturity_multiplier: row.model.maturity_multiplier,
    category_multiple: row.category_multiple,
    launch_likelihood: row.launch_likelihood,
    chain_factor: row.chain_factor,
    comparables: row.comparables,
    plan_chain: row.plan_chain,
    plan_capital_usd: row.plan_capital_usd,
    plan_gas_usd: row.plan_gas_usd,
    plan_weeks: row.plan_weeks,
    farm_steps: row.farm_steps,
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snapshot, model);
  const live = liveRows(snapshot);
  const stats = categoryStats(snapshot, model);
  const early = board.filter((r) => r.set === 'early').length;
  const categories = [...stats.byCategory.values()].sort((a, b) => b.live - a.live || b.protocols - a.protocols || (a.category < b.category ? -1 : a.category > b.category ? 1 : 0));
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    categories,
    rows: board.map(radarRow),
    live,
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
    if (!(r.implied_low_usd <= r.implied_value_usd && r.implied_value_usd <= r.implied_high_usd)) return `${r.slug} has an implied range that does not hold its value`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
