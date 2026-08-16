// computed-date.mjs — the one source of the `_computed`/`_generated`
// date stamp generators write into their output.
//
// The maintainer guide's determinism rule ("run it twice, `git diff`
// must be empty") only held when both runs landed on the same UTC day:
// a rerun on a later day produced a 1,600+ file diff of nothing but
// date stamps, drowning real changes. Setting SOURCE_DATE_EPOCH (the
// reproducible-builds.org convention, a Unix timestamp in seconds)
// pins the stamp, so a reviewer can rerun any generator on any day and
// diff only real changes:
//
//   SOURCE_DATE_EPOCH=$(date -u -d 2026-08-01 +%s) node scripts/<script>.mjs
//
// Use the date already stamped in the artifact you are diffing against,
// NOT the last commit's date. The committed tree carries stamps from
// several different days at once (data/root-analytics/ 2026-07-20,
// data/association/ 2026-08-01, and so on), so no single epoch
// reproduces all of it, and $(git log -1 --format=%ct) -- which an
// earlier version of this comment recommended -- reproduces none of it.
// Read the target's own stamp first:
//
//   grep -o '"_computed":"[^"]*"' data/association/brk.json
//
// Without the variable, behavior is unchanged: today's UTC date.
export function computedDate() {
  const epoch = process.env.SOURCE_DATE_EPOCH;
  const d = epoch ? new Date(Number(epoch) * 1000) : new Date();
  if (isNaN(d.getTime())) {
    throw new Error(`SOURCE_DATE_EPOCH is not a valid Unix timestamp: ${epoch}`);
  }
  return d.toISOString().slice(0, 10);
}
