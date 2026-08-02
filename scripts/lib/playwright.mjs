// playwright.mjs — the ONE way this repo resolves Playwright.
//
// Playwright is a dev-machine tool, NOT a site or data-pipeline
// dependency: there is no package.json, nothing it needs ever ships,
// and any script that imports it must degrade with a clear message
// rather than a module-not-found stack trace. Shared by
// scripts/verify-site.mjs and scripts/build-og-images.mjs.
//
// Resolution order: QD_PLAYWRIGHT (explicit override, used by CI where
// setup-node's global path varies across runner images) → a normal
// "playwright" resolution → the sandbox's known global install.

import { existsSync } from "node:fs";

export async function resolveChromium(caller = "this script") {
  if (!process.env.PLAYWRIGHT_BROWSERS_PATH && existsSync("/opt/pw-browsers")) {
    process.env.PLAYWRIGHT_BROWSERS_PATH = "/opt/pw-browsers";
  }
  let chromium;
  for (const spec of [
    process.env.QD_PLAYWRIGHT,
    "playwright",
    "/opt/node22/lib/node_modules/playwright/index.mjs",
  ].filter(Boolean)) {
    try {
      ({ chromium } = await import(spec));
      break;
    } catch (e) {}
  }
  if (!chromium) {
    console.error(
      `${caller}: cannot import playwright. Install it globally ` +
        "(npm i -g playwright && npx playwright install chromium) or point " +
        "QD_PLAYWRIGHT at its index.mjs.",
    );
    process.exit(2);
  }
  return chromium;
}

// Launch options that prefer the sandbox's prebuilt Chromium when it is
// there and let Playwright pick otherwise.
export function launchOptions() {
  return existsSync("/opt/pw-browsers/chromium")
    ? { executablePath: "/opt/pw-browsers/chromium" }
    : {};
}
