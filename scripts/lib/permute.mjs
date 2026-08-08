// permute.mjs — seeded pseudorandom source for permutation tests.
//
// The repo's build scripts run in Node, which forbids Math.random() (see
// the CLAUDE.md determinism contract: two runs of a generator must
// produce byte-identical output, and any script that shuffles data for a
// significance test needs a reproducible shuffle to do that honestly).
// mulberry32 is a small, public-domain, deterministic 32-bit PRNG; it is
// not cryptographic and must never be used for anything but reordering
// test data.
//
// Usage: const rng = mulberry32(SEED); rng() returns a float in [0, 1).
// Pick SEED once per script, as a literal, and never derive it from
// Date.now() or any other run-time value.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Fisher-Yates shuffle, in place, driven by the given rng() (e.g. from
// mulberry32). Returns the same array for convenience.
export function shuffle(arr, rng) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
