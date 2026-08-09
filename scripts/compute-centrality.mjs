#!/usr/bin/env node
//
// compute-centrality.mjs: precompute network centrality metrics from the
// association graph shipped in PR 1 (data/association/*.json).
//
// Graph: nodes = all 1,642 roots (data/roots-summary.json). Edges = the
// union of every (root, partner) pair recorded in any root's
// data/association/{safeKey}.json "partners" list. Every recorded
// partner already satisfies PR 1's threshold (k11 >= 5 shared verses),
// so no fresh thresholding happens here. This is NOT the full set of
// all pairs meeting that threshold corpus-wide (PR 1 reports 8,556 such
// pairs); data/association/ ships only each root's top 25 partners by
// LLR, so the graph reconstructable from it is the union of those
// per-root top-25 lists (5,211 unique edges), a subset. This script
// reads only data/association/ and data/roots-summary.json; it does not
// modify either, and writes only new files under data/centrality/.
//
// Metrics:
//   - Degree centrality: raw neighbor count, and normalized (raw /
//     (N-1)).
//   - Weighted degree (strength): sum of incident edge weights (LLR).
//   - Betweenness centrality: Brandes' algorithm, O(V*E), on the
//     UNWEIGHTED graph (every edge counted as length 1 for shortest
//     paths, edge weight ignored).
//   - Eigenvector centrality: power iteration on the WEIGHTED adjacency
//     (edge weight = LLR), uniform initialization (every node starts at
//     1), L2-normalized each iteration, tolerance 1e-9, max 1000
//     iterations.
//   - Spearman rank correlation (tie-corrected: Pearson correlation of
//     average ranks) between each of the above and each root's raw
//     corpus frequency (data/roots-summary.json totalCount), across all
//     1,642 nodes.
//
// To reproduce: node scripts/compute-centrality.mjs

import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { safeKey } from "./lib/safe-key.mjs";
import { computedDate } from "./lib/computed-date.mjs";
import { pearson, spearman } from "./lib/stats.mjs";

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dir, "..");
const DATA = join(ROOT, "data");
const ASSOC = join(DATA, "association");
const OUT = join(DATA, "centrality");

const TOTAL_ROOTS = 1642;
const EDGE_THRESHOLD_SHARED_VERSES = 5;
const EIGEN_TOLERANCE = 1e-9;
const EIGEN_MAX_ITER = 1000;

mkdirSync(OUT, { recursive: true });

// ── Load nodes ──────────────────────────────────────────────────────

const rootsSummary = JSON.parse(readFileSync(join(DATA, "roots-summary.json"), "utf8"));
const nodeList = Object.keys(rootsSummary);
if (nodeList.length !== TOTAL_ROOTS) {
  throw new Error(`Baseline mismatch: ${nodeList.length} roots, expected ${TOTAL_ROOTS}. STOPPING.`);
}
const nodeIndex = new Map(nodeList.map((bw, i) => [bw, i]));
const N = nodeList.length;

console.log(`Loaded ${N} nodes.`);

// ── Load edges from data/association/*.json (read-only) ───────────────

let assocFiles;
try {
  assocFiles = readdirSync(ASSOC).filter(
    (f) => f.endsWith(".json") && f !== "keyness-top.json" && f !== "methods.json",
  );
} catch {
  throw new Error("data/association/ not found. Confirm PR 1 is merged. STOPPING.");
}
if (assocFiles.length !== TOTAL_ROOTS) {
  throw new Error(`Expected ${TOTAL_ROOTS} per-root association files, found ${assocFiles.length}. STOPPING.`);
}

const edgeMap = new Map(); // "a b" (a<b) -> weight (LLR)
for (const f of assocFiles) {
  const data = JSON.parse(readFileSync(join(ASSOC, f), "utf8"));
  const a = data.root;
  for (const p of data.partners || []) {
    const b = p.root;
    const key = a < b ? `${a} ${b}` : `${b} ${a}`;
    if (!edgeMap.has(key)) edgeMap.set(key, p.llr);
  }
}

const edges = [...edgeMap.entries()].map(([key, weight]) => {
  const [a, b] = key.split(" ");
  return { a, b, weight };
});
console.log(`Loaded ${edges.length} unique edges (union of per-root top-25 partner lists).`);

// ── Adjacency lists ─────────────────────────────────────────────────

const adj = Array.from({ length: N }, () => []); // adj[i] = [{ to, weight }]
for (const { a, b, weight } of edges) {
  const ia = nodeIndex.get(a);
  const ib = nodeIndex.get(b);
  adj[ia].push({ to: ib, weight });
  adj[ib].push({ to: ia, weight });
}

// ── Degree and weighted degree ─────────────────────────────────────

const degree = new Array(N).fill(0);
const weightedDegree = new Array(N).fill(0);
for (let i = 0; i < N; i++) {
  degree[i] = adj[i].length;
  weightedDegree[i] = adj[i].reduce((s, e) => s + e.weight, 0);
}
const degreeNormalized = degree.map((d) => d / (N - 1));

console.log("Computed degree and weighted degree.");

// ── Betweenness centrality: Brandes' algorithm, unweighted ────────────

function brandesBetweenness(adjList, n) {
  const betweenness = new Array(n).fill(0);
  for (let s = 0; s < n; s++) {
    const stack = [];
    const preds = Array.from({ length: n }, () => []);
    const sigma = new Array(n).fill(0);
    sigma[s] = 1;
    const dist = new Array(n).fill(-1);
    dist[s] = 0;
    const queue = [s];
    let qHead = 0;
    while (qHead < queue.length) {
      const v = queue[qHead++];
      stack.push(v);
      for (const { to: w } of adjList[v]) {
        if (dist[w] < 0) {
          dist[w] = dist[v] + 1;
          queue.push(w);
        }
        if (dist[w] === dist[v] + 1) {
          sigma[w] += sigma[v];
          preds[w].push(v);
        }
      }
    }
    const delta = new Array(n).fill(0);
    while (stack.length) {
      const w = stack.pop();
      for (const v of preds[w]) {
        delta[v] += (sigma[v] / sigma[w]) * (1 + delta[w]);
      }
      if (w !== s) betweenness[w] += delta[w];
    }
  }
  // Undirected graph: each shortest path counted from both endpoints' BFS.
  for (let i = 0; i < n; i++) betweenness[i] /= 2;
  return betweenness;
}

console.log("Computing betweenness (Brandes, unweighted)...");
const betweenness = brandesBetweenness(adj, N);
console.log("Betweenness done.");

// ── Eigenvector centrality: power iteration, weighted adjacency ───────

function powerIterationEigenvector(adjList, n, tolerance, maxIter) {
  let x = new Array(n).fill(1); // deterministic uniform initialization
  let iterations = 0;
  let converged = false;
  for (let iter = 1; iter <= maxIter; iter++) {
    const xNew = new Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      for (const { to, weight } of adjList[i]) {
        xNew[i] += weight * x[to];
      }
    }
    const norm = Math.sqrt(xNew.reduce((s, v) => s + v * v, 0));
    if (norm > 0) {
      for (let i = 0; i < n; i++) xNew[i] /= norm;
    }
    let diff = 0;
    for (let i = 0; i < n; i++) diff += Math.abs(xNew[i] - x[i]);
    x = xNew;
    iterations = iter;
    if (diff < tolerance) {
      converged = true;
      break;
    }
  }
  return { values: x, iterations, converged };
}

console.log("Computing eigenvector centrality (power iteration)...");
const eigen = powerIterationEigenvector(adj, N, EIGEN_TOLERANCE, EIGEN_MAX_ITER);
console.log(
  `Eigenvector: ${eigen.converged ? "converged" : "DID NOT CONVERGE"} after ${eigen.iterations} iterations.`,
);
if (!eigen.converged) {
  throw new Error(`Eigenvector centrality did not converge within ${EIGEN_MAX_ITER} iterations. STOPPING.`);
}

// ── Spearman rank correlation (tie-corrected via ranks + Pearson) ────
// pearson and spearman now live in scripts/lib/stats.mjs; imported above.

const rawFrequency = nodeList.map((bw) => rootsSummary[bw].totalCount);
const spearmanDegree = spearman(degree, rawFrequency);
const spearmanWeightedDegree = spearman(weightedDegree, rawFrequency);
const spearmanBetweenness = spearman(betweenness, rawFrequency);
const spearmanEigenvector = spearman(eigen.values, rawFrequency);

console.log("Spearman rank correlation vs. raw frequency:");
console.log(`  degree:          ${spearmanDegree.toFixed(4)}`);
console.log(`  weighted degree: ${spearmanWeightedDegree.toFixed(4)}`);
console.log(`  betweenness:     ${spearmanBetweenness.toFixed(4)}`);
console.log(`  eigenvector:     ${spearmanEigenvector.toFixed(4)}`);

// ── Ranks (1 = highest value) for each metric, per node ────────────────

function descendingRanks(values) {
  const n = values.length;
  const idx = values.map((v, i) => i).sort((a, b) => values[b] - values[a]);
  const ranks = new Array(n);
  let i = 0;
  while (i < n) {
    let j = i;
    while (j + 1 < n && values[idx[j + 1]] === values[idx[i]]) j++;
    const avgRank = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) ranks[idx[k]] = avgRank;
    i = j + 1;
  }
  return ranks;
}

const degreeRank = descendingRanks(degree);
const weightedDegreeRank = descendingRanks(weightedDegree);
const betweennessRank = descendingRanks(betweenness);
const eigenvectorRank = descendingRanks(eigen.values);

// ── Write output ────────────────────────────────────────────────────

const COMPUTED_DATE = computedDate();

const methodsDoc = {
  _script: "scripts/compute-centrality.mjs",
  _source:
    "data/association/*.json (PR 1; each root's top 25 partners by LLR, itself derived from " +
    "Leeds Quranic Arabic Corpus v0.4 via scripts/compute-association-stats.mjs) and " +
    "data/roots-summary.json (raw frequency).",
  _graph: {
    nodes: N,
    edges: edges.length,
    edgeThresholdSharedVerses: EDGE_THRESHOLD_SHARED_VERSES,
    note:
      "Edges are the union of every (root, partner) pair recorded in any root's data/association/ " +
      "top-25-by-LLR partner list, not the full set of all pairs meeting the 5-shared-verse " +
      "threshold corpus-wide (PR 1 reports 8,556 such pairs before the top-25-per-root cut). " +
      "This graph is a subset by construction, since data/association/ was never designed to " +
      "expose the full pair set and this script does not modify or extend it.",
  },
  _algorithms: {
    degree: "Count of distinct neighbors (raw); normalized = raw / (N-1).",
    weightedDegree: "Sum of incident edge weights (LLR); also called strength.",
    betweenness:
      "Brandes' algorithm (2001), O(V*E), on the unweighted graph (every edge length 1; edge " +
      "weight ignored for shortest-path computation).",
    eigenvector:
      "Power iteration on the weighted adjacency matrix (edge weight = LLR): x_0 = uniform " +
      `(every node = 1); x_{k+1} = A * x_k, L2-normalized; tolerance ${EIGEN_TOLERANCE}, ` +
      `max ${EIGEN_MAX_ITER} iterations.`,
    spearmanCorrelation:
      "Tie-corrected: Pearson correlation of average ranks (standard Spearman's rho with ties).",
  },
  _eigenvector: {
    converged: eigen.converged,
    iterations: eigen.iterations,
    tolerance: EIGEN_TOLERANCE,
    maxIterations: EIGEN_MAX_ITER,
  },
  _spearmanVsRawFrequency: {
    degree: Math.round(spearmanDegree * 10000) / 10000,
    weightedDegree: Math.round(spearmanWeightedDegree * 10000) / 10000,
    betweenness: Math.round(spearmanBetweenness * 10000) / 10000,
    eigenvector: Math.round(spearmanEigenvector * 10000) / 10000,
  },
  _computed: COMPUTED_DATE,
};
writeFileSync(join(OUT, "methods.json"), JSON.stringify(methodsDoc, null, 1) + "\n");

let written = 0;
for (const bw of nodeList) {
  const i = nodeIndex.get(bw);
  const meta = rootsSummary[bw];
  const output = {
    root: bw,
    safeKey: safeKey(bw),
    arabic: meta.rootArabic,
    rootLatin: meta.rootLatin,
    totalNodes: N,
    degree: degree[i],
    degreeNormalized: Math.round(degreeNormalized[i] * 100000) / 100000,
    degreeRank: degreeRank[i],
    weightedDegree: Math.round(weightedDegree[i] * 100) / 100,
    weightedDegreeRank: weightedDegreeRank[i],
    betweenness: Math.round(betweenness[i] * 100000) / 100000,
    betweennessRank: betweennessRank[i],
    eigenvector: Math.round(eigen.values[i] * 1e8) / 1e8,
    eigenvectorRank: eigenvectorRank[i],
    _computed: COMPUTED_DATE,
    _methodsFile: "data/centrality/methods.json",
  };
  writeFileSync(join(OUT, safeKey(bw) + ".json"), JSON.stringify(output));
  written++;
  if (written % 400 === 0) console.log(`  ${written} files written...`);
}

console.log(`\nDone. Wrote ${written} per-root centrality files.`);
if (written !== TOTAL_ROOTS) {
  throw new Error(`Expected ${TOTAL_ROOTS} files, wrote ${written}`);
}

let totalBytes = 0;
for (const f of readdirSync(OUT)) {
  totalBytes += readFileSync(join(OUT, f)).length;
}
console.log(`Total data/centrality size: ${(totalBytes / (1024 * 1024)).toFixed(2)} MB`);

// Spot-check
console.log("\nSpot-check (r-ḥ-m):");
const spot = JSON.parse(readFileSync(join(OUT, safeKey("rHm") + ".json"), "utf8"));
console.log(JSON.stringify(spot, null, 1));
