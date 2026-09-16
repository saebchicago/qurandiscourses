// coverage-bindings.mjs — the ONE statement of how coverage.html's
// static numbers resolve from data/coverage/report.json.
//
// Two scripts share it and must never disagree: build-static-fallbacks
// WRITES these values into the page, and check-data-nums VERIFIES them.
// They used to be hand-maintained beside a generated report, and drifted
// exactly the way that arrangement invites (#107 shipped three different
// figures for one number; the source-usage count went stale again the
// day a source was added). Now a stale number is a generator you did not
// run, which CI reports, rather than an edit somebody forgot.
//
// Ids whose rendered text is prose assembled at run time ("Reason: …")
// have no static value and are listed in COVERAGE_PROSE instead.

const n = (v) => Number(v).toLocaleString("en-US");

export function coverageBindings(report) {
  return {
    covTotalTokens: n(report.morphology.totalTokens),
    glossCount: String(report.rootGloss.withVerifiedGloss),
    glossTotal: n(report.rootGloss.totalRoots),
    glossPercent: report.rootGloss.percentWith + "%",
    perWordGlossCovered: String(report.perWordGloss.covered),
    perWordGlossTotal: String(report.perWordGloss.totalSurahs),
    perWordGlossPercent: report.perWordGloss.percentWith + "%",
    sourceUsageUsed: String(report.sourceUsage.used),
    sourceUsageTotal: String(report.sourceUsage.totalSources),
  };
}

export const COVERAGE_PROSE = new Set(["glossReason", "perWordGlossSurahs", "sourceUsageUnused"]);

// Rewrite the text of each bound element in coverage.html's markup.
export function applyCoverageBindings(html, report) {
  let out = html;
  for (const [id, value] of Object.entries(coverageBindings(report))) {
    const re = new RegExp(`(<[^>]+\\bid="${id}"[^>]*>)[^<]*(<)`);
    if (!re.test(out)) throw new Error(`coverage.html: no element carries id="${id}"`);
    out = out.replace(re, `$1${value}$2`);
  }
  return out;
}
