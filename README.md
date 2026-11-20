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

## The model (radar-3)

Implied value follows only from the snapshot's own figures. A token that already trades tells
the market what a protocol of its kind is worth relative to its TVL, so the model prices a
pre-token protocol against its own category's live comparables instead of one flat multiple:

- **Category multiple**: the median market-cap-to-TVL of the live-token protocols in the same
  category, shrunk toward the whole market's median when the category holds few live tokens,
  clamped to x0.02..x2.50.
- **Implied range**: the same row priced at the category's lower and upper quartile multiples,
  shrunk the same way — the spread of what its kind actually trades at, carried on every row.
- **Growth**: `1 + clamp(change_7d, -60, 120) / 100 x 0.5`.
- **Momentum**: `1 + clamp(change_7d - the category's median change_7d, -40, 40) / 100 x 0.25`,
  so a fall inside a falling category is not read as weakness.
- **Maturity**: `0.6 + min(age_days, 1095) / 1095 x 0.4` (unknown age: 365 days).
- **Launch likelihood**: `(0.6 + 0.8 x token rate of the category) x an age tilt of x0.90..x1.10`.
- **Chains**: `1 + 0.02 x min(chains - 1, 5)`.

`implied = round(tvl_usd x category_multiple x growth x momentum x maturity x likelihood x chains)`.

The board covers the whole watchlist (40 protocols at or above $50M TVL with no token, tagged
as the watchlist set) plus 160 early pre-token protocols below that floor, and sets the 24
largest live-token protocols aside with their market caps shown. Each row's farm plan is built
from the protocol's own record: its category gives two distinct protocol actions, its cheapest
chain gives the gas, a young protocol starts at a test size, and the plan totals its own gas
and weeks. No protocol name is special-cased: the same function scores every row and writes
every plan. Implied values are model estimates, not prices, and no token is promised.

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
