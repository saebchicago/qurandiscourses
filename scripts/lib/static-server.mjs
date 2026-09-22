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
import { readFileSync, existsSync } from "node:fs";
import { join, normalize, extname } from "node:path";

const PUBLIC_DIRECTORIES = new Set(["assets", "data", "js", "s", ".well-known"]);
const PUBLIC_ROOT_EXTENSIONS = new Set([
  ".html", ".xml", ".txt", ".webmanifest",
]);
const PUBLIC_ROOT_FILES = new Set(["sw.js"]);

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
//
// An extensionless path is served from the matching .html file, the way
// Netlify does it. The site links to /read rather than /read.html, so
// without this the pages under test would be a different site from the
// one that ships. The .html address stays readable too: production 301s
// it to the clean path, and reproducing a redirect here would only make
// every test assert on the wrong URL.
// `port` defaults to 0, meaning any free port: the browser-driving
// scripts want a port that is always free, scripts/serve.mjs wants a
// fixed one you can bookmark.
export async function startStaticServer(root, port = 0, host = "127.0.0.1") {
  const server = createServer((req, res) => {
    try {
      let path = decodeURIComponent(new URL(req.url, "http://x").pathname);
      if (path.endsWith("/")) path += "index.html";
      const segments = path.split("/").filter(Boolean);
      const isPublicRootFile = segments.length === 1
        && (PUBLIC_ROOT_EXTENSIONS.has(extname(segments[0]))
          || PUBLIC_ROOT_FILES.has(segments[0])
          || (!extname(segments[0]) && existsSync(join(root, path + ".html"))));
      const isPublicDirectory = segments.length > 1
        && PUBLIC_DIRECTORIES.has(segments[0])
        && !segments.slice(1).some((segment) => segment.startsWith("."));
      if (!isPublicRootFile && !isPublicDirectory) throw new Error("private path");
      let file = normalize(join(root, path));
      if (!file.startsWith(root)) throw new Error("traversal");
      if (!extname(file) && existsSync(file + ".html")) file += ".html";
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
  await new Promise((r) => server.listen(port, host, r));
  return { server, base: `http://${host}:${server.address().port}` };
}
