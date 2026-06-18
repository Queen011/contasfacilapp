// Gera um dist/client/index.html standalone para o Capacitor (APK/SPA),
// já que o TanStack Start é SSR e não emite um index.html bootável.
// Lê dist/client/.vite/manifest.json e injeta o entry + CSS + preloads.

import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";

const clientDir = resolve(process.cwd(), "dist/client");
const manifestPath = join(clientDir, ".vite/manifest.json");

if (!existsSync(clientDir)) {
  console.error("[capacitor-index] dist/client não existe. Rode `npm run build` primeiro.");
  process.exit(1);
}

let entryJs = null;
const entryCss = new Set();
const preloadJs = new Set();

if (existsSync(manifestPath)) {
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const entryKey = Object.keys(manifest).find((k) => manifest[k].isEntry);
  if (entryKey) {
    const entry = manifest[entryKey];
    entryJs = "/" + entry.file;
    (entry.css || []).forEach((c) => entryCss.add("/" + c));
    (entry.imports || []).forEach((imp) => {
      const dep = manifest[imp];
      if (dep) {
        preloadJs.add("/" + dep.file);
        (dep.css || []).forEach((c) => entryCss.add("/" + c));
      }
    });
  }
}

// Fallback: varre dist/client/assets procurando o maior index-*.js (entry principal)
if (!entryJs) {
  const assetsDir = join(clientDir, "assets");
  const files = readdirSync(assetsDir);
  const indexJs = files
    .filter((f) => /^index-.*\.js$/.test(f))
    .map((f) => ({ f, size: readFileSync(join(assetsDir, f)).length }))
    .sort((a, b) => b.size - a.size);
  if (indexJs.length === 0) {
    console.error("[capacitor-index] Não achei nenhum entry JS em dist/client/assets.");
    process.exit(1);
  }
  entryJs = "/assets/" + indexJs[0].f;
  files
    .filter((f) => /^(index|styles)-.*\.css$/.test(f))
    .forEach((f) => entryCss.add("/assets/" + f));
}

const cssLinks = [...entryCss]
  .map((href) => `    <link rel="stylesheet" href="${href}">`)
  .join("\n");
const preloadLinks = [...preloadJs]
  .map((href) => `    <link rel="modulepreload" href="${href}">`)
  .join("\n");

const html = `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1">
    <meta name="theme-color" content="#10b981">
    <title>Contas Fácil</title>
    <link rel="icon" href="/favicon.ico">
    <link rel="manifest" href="/manifest.json">
${cssLinks}
${preloadLinks}
    <script type="module" crossorigin src="${entryJs}"></script>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
`;

writeFileSync(join(clientDir, "index.html"), html, "utf8");
console.log("[capacitor-index] dist/client/index.html gerado.");
console.log("  entry:", entryJs);
console.log("  css:", [...entryCss].join(", ") || "(nenhum)");
