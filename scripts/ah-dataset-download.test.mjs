import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";

const source = readFileSync(new URL("../assets/ah-init.js", import.meta.url), "utf8");

function load() {
  const listeners = [];
  const calls = [];
  const sandbox = {
    URL,
    navigator: {},
    location: { href: "https://divinediscourses.org/datasets", origin: "https://divinediscourses.org" },
    localStorage: { getItem: () => null },
    window: { ah: { track: (n, o) => calls.push([n, o]) } },
    document: {
      head: { appendChild() {} },
      createElement: () => ({ setAttribute() {} }),
      addEventListener: (type, fn) => listeners.push([type, fn]),
    },
  };
  sandbox.window.window = sandbox.window;
  vm.runInNewContext(source, sandbox);
  const click = listeners.find(([t]) => t === "click")[1];
  const press = (href) => click({ target: { closest: () => ({ getAttribute: () => href }) } });
  return { calls, press };
}

test("dataset links send dataset_download with a <table>_<format> tag", () => {
  const { calls, press } = load();
  press("data/exports/association-pairs.csv");
  press("/data/exports/centrality.json");
  press("data/roots-summary.json");
  press("data/morphology/1.json");
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [
    ["dataset_download", { tag: "association_pairs_csv" }],
    ["dataset_download", { tag: "centrality_json" }],
    ["dataset_download", { tag: "roots_summary_json" }],
    ["dataset_download", { tag: "morphology_json" }],
  ]);
});

test("other links, other origins and over-long names send nothing", () => {
  const { calls, press } = load();
  press("about.html");
  press("https://example.org/data/exports/x.csv");
  press("data/exports/" + "a".repeat(50) + ".csv");
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), []);
});
