# token-radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/Sidiq66/token-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/Sidiq66/token-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

A token launch radar: it reads a sealed snapshot of every protocol DefiLlama tracks, finds the
ones that still record no token and are not a wrapped or staked product of one that trades, ranks
them by what their launch would be worth, and hands in a web dashboard with the board, a detail
view for each protocol and the steps to farm it.

Built by an AI agent for make.fun's "Build the best token launch radar" bounty, $1,325 in USDC.

## Run it

```sh
MAKEFUN_OUTPUT_DIR=out node main.ts --input <snapshot.json>
```

`main.ts` (Node 22, standard library only) reads the snapshot, scores every pre-token protocol
with the model in `lib/model.ts`, writes the ranked board to `out/board.json`, copies the
dashboard and screenshots into `out/`, and writes `out/dossier.json` with the vendored
`vendor/makefun-board.ts` library. Open `out/dashboard/index.html` in a browser: it renders
with no network, from `out/data.js`.

## The model (radar-4)

Implied value follows only from the snapshot's own figures. A token that already trades tells
the market what a protocol is worth relative to its TVL — but a flat multiple misprices size:
across the 128 live-token protocols with a market cap, market-cap-to-TVL falls from x0.88 at
the smallest TVL quartile to x0.05 at the largest. So radar-4 prices a pre-token protocol on a
fitted curve, not on a flat multiple:

- **Fitted multiple**: `log(market cap) = 6.96 + 0.52 x log(TVL)`, a log-log OLS fit over the
  128 live-token protocols with a market cap (R² 0.19). Held out one at a time, it predicts a
  live token's market cap with a median log error of 1.22, against 1.63 for the category-median
  multiple radar-3 used. The fitted multiple is clamped to x0.02..x2.50.
- **Implied range**: the same row priced at the fit's residual quartiles, x0.31 and x4.11 — the
  spread of what live tokens actually trade at around the curve, carried on every row.
- **Growth**: `1 + clamp(change_7d, -60, 120) / 100 x 0.5`.
- **Momentum**: `1 + clamp(change_7d - the category's median change_7d, -40, 40) / 100 x 0.25`,
  so a fall inside a falling category is not read as weakness.
- **Maturity**: `0.6 + min(age_days, 1095) / 1095 x 0.4` (unknown age: 365 days).
- **Launch likelihood**: `(0.6 + 0.8 x token rate of the category) x an age tilt of x0.90..x1.10`.
- **Chains**: `1 + 0.02 x min(chains - 1, 5)`.

`implied = round(tvl_usd x fitted_multiple(tvl_usd) x growth x momentum x maturity x likelihood x chains)`.

The board covers every protocol the watchlist rule allows: the whole watchlist (40 protocols
at or above $50M TVL with no token), the 20 rankable protocols above that floor the list
leaves out, and all 138 rankable protocols below it — 198 rows. No wrapped, staked or bridged
product of a token that already trades is ranked as a protocol still to come, and the 24
largest live-token protocols are set aside with their market caps shown. The dashboard also
carries a model sandbox: change the growth and momentum weights and the board re-ranks live
on the same arithmetic. Each row's farm plan is built
from the protocol's own record: its category gives two distinct protocol actions, its cheapest
chain gives the gas, a young protocol starts at a test size, and the plan totals its own gas
and weeks. No protocol name is special-cased: the same function scores every row and writes
every plan. Implied values are model estimates, not prices, and no token is promised.

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
