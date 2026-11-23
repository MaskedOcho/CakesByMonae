// Turns the site's menu.js (a plain browser script) into a module the worker can import,
// so prices live in exactly one place. Run automatically by `wrangler deploy` / `wrangler dev`.
import { readFileSync, writeFileSync } from "node:fs";

const src = readFileSync(new URL("../menu.js", import.meta.url), "utf8");
writeFileSync(
  new URL("./menu.gen.mjs", import.meta.url),
  `// GENERATED from ../menu.js by build.mjs. Do not edit.\n${src}\nexport { CONFIG, PRODUCTS, CUSTOM, HOLIDAY, cartTotal, lineText, decodeOrder, encodeOrder };\n`
);
