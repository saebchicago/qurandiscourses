// serve.mjs — the local dev server. Use this rather than
// `python3 -m http.server`: the site links to clean paths (/read, not
// /read.html), which Netlify resolves to the matching .html file and a
// plain static server does not. On a plain server every internal link
// 404s, so what you would be checking is not the site that ships.
//
// Zero dependencies; same handler scripts/verify-site.mjs drives.
//
//   node scripts/serve.mjs          # http://127.0.0.1:8000
//   node scripts/serve.mjs 3000     # a different port

import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { startStaticServer } from "./lib/static-server.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const port = Number(process.argv[2] || 8000);

const { base } = await startStaticServer(ROOT, port);
console.log(`Serving ${ROOT}\n  ${base}\nCtrl-C to stop.`);
