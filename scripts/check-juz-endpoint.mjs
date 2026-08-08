// check-juz-endpoint.mjs — the third-party contract whole-juz reading rests on.
//
// Reading a juz is the one thing the site cannot assemble from a surah
// call: 28 of the 30 juz cross a surah boundary. alquran.cloud has no
// MULTI-edition juz endpoint (verified: /v1/juz/N/editions/a,b returns
// 404), so assets/app.js fans out one request PER EDITION against
// /v1/juz/{n}/{edition} and stitches the results. That costs one request
// per edition no matter how many surahs the juz spans, which is why juz
// 30 (37 surahs) is as cheap as juz 2 (one surah).
//
// Two things must stay true or whole-juz reading breaks silently, showing
// a short passage instead of a wrong one:
//   1. the single-edition juz endpoint answers 200 with an ayahs array;
//   2. every ayah carries surah.number and numberInSurah, which is how
//      the reader's verses get grouped under the right surah heading.
//
// Run: node scripts/check-juz-endpoint.mjs   (exit 1 on failure)
// Lives in the external-evidence CI job with the other live checks.

const BASE = "https://api.alquran.cloud/v1";
const EDITION = "quran-uthmani";
// Juz 1 spans two surahs and juz 30 spans thirty-seven: between them they
// prove the endpoint returns cross-surah verses, not just a first slice.
const CASES = [
  { juz: 1, wantFirst: "1:1", wantLast: "2:141", minSurahs: 2 },
  { juz: 30, wantFirst: "78:1", wantLast: "114:6", minSurahs: 30 },
];

const failures = [];

for (const c of CASES) {
  const url = `${BASE}/juz/${c.juz}/${EDITION}`;
  let payload = null;
  try {
    const r = await fetch(url, { headers: { "user-agent": "divinediscourses-check" } });
    if (!r.ok) {
      failures.push(`juz ${c.juz}: HTTP ${r.status} from ${url}`);
      continue;
    }
    payload = (await r.json()).data;
  } catch (e) {
    failures.push(`juz ${c.juz}: network failure on ${url} (${e.message})`);
    continue;
  }

  const ayahs = payload && payload.ayahs;
  if (!Array.isArray(ayahs) || !ayahs.length) {
    failures.push(`juz ${c.juz}: no ayahs array in the response`);
    continue;
  }
  const ref = (a) => `${a.surah && a.surah.number}:${a.numberInSurah}`;
  const first = ref(ayahs[0]);
  const last = ref(ayahs[ayahs.length - 1]);
  const surahs = new Set(ayahs.map((a) => a.surah && a.surah.number)).size;

  if (ayahs.some((a) => !a.surah || !a.surah.number || !a.numberInSurah))
    failures.push(`juz ${c.juz}: an ayah is missing surah.number or numberInSurah`);
  if (first !== c.wantFirst) failures.push(`juz ${c.juz}: starts at ${first}, want ${c.wantFirst}`);
  if (last !== c.wantLast) failures.push(`juz ${c.juz}: ends at ${last}, want ${c.wantLast}`);
  if (surahs < c.minSurahs)
    failures.push(`juz ${c.juz}: spans ${surahs} surahs, want at least ${c.minSurahs}`);

  console.log(
    `${failures.length ? "    " : "OK  "} juz ${c.juz}: ${ayahs.length} ayahs, ${first} to ${last}, ${surahs} surahs`,
  );
}

if (failures.length) {
  console.error("check-juz-endpoint: FAIL");
  for (const f of failures) console.error("  - " + f);
  process.exit(1);
}
console.log(`check-juz-endpoint: OK (${CASES.length} juz fetched cross-surah from ${BASE}).`);
