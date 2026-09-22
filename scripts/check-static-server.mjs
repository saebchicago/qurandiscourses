import { strict as assert } from "node:assert";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { startStaticServer } from "./lib/static-server.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const { server, base } = await startStaticServer(ROOT);

try {
  for (const path of ["/", "/read", "/assets/style.css", "/data/version.json"]) {
    const response = await fetch(base + path);
    assert.equal(response.status, 200, `${path} should be public`);
  }

  for (const path of [
    "/.git/HEAD",
    "/.agents/memory/MEMORY.md",
    "/scripts/serve.mjs",
    "/README.md",
  ]) {
    const response = await fetch(base + path);
    assert.equal(response.status, 404, `${path} should not be public`);
  }

  console.log("check-static-server: OK");
} finally {
  server.close();
}