#!/usr/bin/env node

import { execFileSync } from 'node:child_process';

// Netlify's ignore command uses inverted build semantics:
//   exit 0 => cancel this build
//   exit 1 => proceed with this build
// Be fail-open: if Netlify does not provide both refs, build normally.
const from = process.env.CACHED_COMMIT_REF;
const to = process.env.COMMIT_REF;

if (!from || !to) process.exit(1);

let changed;
try {
  changed = execFileSync('git', ['diff', '--name-only', from, to], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  })
    .split('\n')
    .map((path) => path.trim())
    .filter(Boolean);
} catch {
  process.exit(1);
}

// A GitHub Actions-only change cannot alter the deployed static site.
// Everything else is treated as production-relevant by default.
const githubMetadataOnly =
  changed.length > 0 && changed.every((path) => path.startsWith('.github/'));

process.exit(githubMetadataOnly ? 0 : 1);
