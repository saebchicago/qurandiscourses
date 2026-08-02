// static-server.mjs — the ONE local static server the browser-driving
// scripts point Chromium at. Serving the repo over http:// rather than
// file:// matters: fetch(), the service worker registration, and
// same-origin CSP all behave differently on file://, so a page checked
// there would not be the page that ships.
//
// Zero dependencies (node:http only), and deliberately minimal: no
// directory listing, no range requests, no caching headers. Shared by
// scripts/verify-site.mjs and scripts/build-og-images.mjs.

import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { join, normalize, extname } from "node:path";

export const MIME = {
  ".html": "text/html", ".css": "text/css", ".js": "text/javascript",
  ".mjs": "text/javascript", ".json": "application/json",
  ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg",
  ".xml": "application/xml", ".txt": "text/plain", ".woff2": "font/woff2",
  ".mp3": "audio/mpeg", ".mp4": "video/mp4", ".vtt": "text/vtt",
  ".ico": "image/x-icon", ".webmanifest": "application/manifest+json",
};

// Resolves to { server, base } with the server already listening on a
// free loopback port. Paths that escape `root` are refused (404), not
// merely normalized.
export async function startStaticServer(root) {
  const server = createServer((req, res) => {
    try {
      let path = decodeURIComponent(new URL(req.url, "http://x").pathname);
      if (path.endsWith("/")) path += "index.html";
      const file = normalize(join(root, path));
      if (!file.startsWith(root)) throw new Error("traversal");
      const body = readFileSync(file);
      res.writeHead(200, {
        "Content-Type": MIME[extname(file)] || "application/octet-stream",
      });
      res.end(body);
    } catch (e) {
      res.writeHead(404);
      res.end("not found");
    }
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  return { server, base: `http://127.0.0.1:${server.address().port}` };
}
