// Token radar: a make.fun token-radar-01 entry, written for Node 22 with only
// the standard library.
//
// It scores the sealed DefiLlama snapshot (758 protocols, 2026-11-14) with the
// radar-4 model in lib/model.ts, writes the ranked board to board.json, copies
// the static dashboard and the three screenshots beside it, and finishes with
// dossier.json, the summary the judge reads. The dashboard never touches the
// network: index.html, app.css and app.js render from data.js, which this
// program writes from the same board.
//
// Radar-4 prices every protocol on a log-log fit of market cap on TVL over the
// live-token comparables, and scores every protocol the watchlist rule allows:
// the whole watchlist, the rankable protocols above the floor it leaves out, and
// every rankable protocol below it. No wrapped, staked or bridged product of a
// token that already trades is ever ranked as a protocol still to come.
//
// Run it outside the grader with MAKEFUN_OUTPUT_DIR standing in for /output:
//   MAKEFUN_OUTPUT_DIR=out node main.ts --input ../token-radar-01-kit/input/snapshot.json

import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { boardIssue, buildRadar, dataScript, parseSnapshot } from './lib/model.ts';
import { buildDossier } from './vendor/makefun-board.ts';

const root = fileURLToPath(new URL('.', import.meta.url));

/** The scorer's own caps (reference/gate.json): the text cap shapes the bytes, the rest refuse. */
const TEXT_MAX_BYTES = 65_536;
const SCREENSHOT_CAPS = { max: 4, max_bytes: 524_288 };
const IMAGE_NAME = /^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$/;

const USAGE = `token radar: score a DefiLlama snapshot and hand in the board, dashboard and dossier
usage: node main.ts [--input <snapshot.json|directory>] [--output <dir>] [--help]
  --input   snapshot file or the directory holding snapshot.json (default /input)
  --output  where the board, dashboard, screenshots and dossier go (default $MAKEFUN_OUTPUT_DIR or /output)
`;

/** Print a message to stderr and stop with the given code. */
function die(message: string, code: number): never {
  process.stderr.write(message);
  process.exit(code);
}

/** The value of --name <value> or --name=<value>, or the fallback when absent. */
function flag(name: string, fallback: string): string {
  const at = process.argv.indexOf(`--${name}`);
  if (at >= 0 && at + 1 < process.argv.length) return process.argv[at + 1]!;
  const joined = process.argv.find((a) => a.startsWith(`--${name}=`));
  return joined === undefined ? fallback : joined.slice(name.length + 3);
}

/** Copy a directory's regular files into `to`, skipping dotfiles, and name what landed. */
function copyDir(from: string, to: string): string[] {
  if (!existsSync(from)) return [];
  mkdirSync(to, { recursive: true });
  const landed: string[] = [];
  for (const name of readdirSync(from)) {
    if (name.startsWith('.')) continue;
    const path = join(from, name);
    if (!statSync(path).isFile()) continue;
    copyFileSync(path, join(to, name));
    landed.push(name);
  }
  return landed;
}

function main(): void {
  if (process.argv.includes('--help')) {
    process.stdout.write(USAGE);
    return;
  }

  const inputValue = flag('input', '/input');
  const snapshotPath = inputValue.endsWith('.json') ? inputValue : join(inputValue, 'snapshot.json');
  if (!existsSync(snapshotPath)) {
    die(`token radar: no snapshot at ${snapshotPath}: pass --input <snapshot.json|directory> or mount the sealed /input\n`, 2);
  }
  const outDir = flag('output', process.env.MAKEFUN_OUTPUT_DIR ?? '/output');

  const snapshot = parseSnapshot(readFileSync(snapshotPath, 'utf8'));
  const { board, radar } = buildRadar(snapshot);
  const problem = boardIssue(board, snapshot);
  if (problem !== null) {
    die(`token radar: the model wrote a board the gate refuses: ${problem}\n`, 1);
  }

  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'board.json'), `${JSON.stringify({ rows: board })}\n`);
  writeFileSync(join(outDir, 'data.js'), dataScript(radar));

  copyDir(join(root, 'dashboard'), join(outDir, 'dashboard'));
  const images = copyDir(join(root, 'screenshots'), join(outDir, 'screenshots'));
  if (images.length < 3) {
    die(`token radar: screenshots/ holds ${images.length} image${images.length === 1 ? '' : 's'}: hand in 3, the board, a detail view and a filtered view\n`, 1);
  }
  for (const name of images) {
    if (!IMAGE_NAME.test(name)) {
      die(`token radar: screenshots/${name}: a name is letters, digits and . _ -, 1 to 128 characters\n`, 1);
    }
  }

  // The dossier is written last: the scorer rebuilds it from this /output and compares bytes.
  writeFileSync(join(outDir, 'dossier.json'), buildDossier(outDir, { text_max_bytes: TEXT_MAX_BYTES, screenshots: SCREENSHOT_CAPS, dashboard: { max_files: 400, max_bytes: 4_194_304 } }));

  process.stdout.write(
    `token radar: ${snapshot.protocols.length} protocols, ${snapshot.watchlist.length} on the watchlist, ${board.length} rows scored (${radar.early_size} early, ${radar.above_size} above the floor, ${radar.live_size} live set aside)\n` +
      `token radar: fit log(mcap) = ${radar.fit.intercept.toFixed(2)} + ${radar.fit.slope.toFixed(2)} x log(tvl) over ${radar.fit.comparables} live tokens (R² ${radar.fit.r2.toFixed(2)}, range x${radar.fit.low_mult.toFixed(2)}-x${radar.fit.high_mult.toFixed(2)})\n` +
      `token radar: wrote ${join(outDir, 'board.json')}, ${join(outDir, 'data.js')}, ${join(outDir, 'dashboard')} (3 files), ${join(outDir, 'screenshots')} (${images.length} images) and ${join(outDir, 'dossier.json')}\n`,
  );
}

main();
