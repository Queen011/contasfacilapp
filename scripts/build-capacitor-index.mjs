// Gera um <outDir>/index.html standalone para o Capacitor (APK/SPA),
// já que o TanStack Start é SSR e não emite um index.html bootável.
// Lê <outDir>/.vite/manifest.json e injeta o entry + CSS + preloads.

import { copyFileSync, readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";

// O stack atual (nitro + cloudflare) emite os assets em .output/public.
// Mantemos suporte ao layout antigo dist/client para compatibilidade.
const candidates = [".output/public", "dist/client"];
const clientDir = candidates
  .map((p) => resolve(process.cwd(), p))
  .find((p) => existsSync(p));

if (!clientDir) {
  console.error(
    "[capacitor-index] Não encontrei .output/public nem dist/client. Rode `npm run build` primeiro.",
  );
  process.exit(1);
}

const manifestPath = join(clientDir, ".vite/manifest.json");
const assetHref = (file) => file.replace(/^\//, "");

let entryJs = null;
const entryCss = new Set();
const preloadJs = new Set();

if (existsSync(manifestPath)) {
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const entryKey = Object.keys(manifest).find((k) => manifest[k].isEntry);
  if (entryKey) {
    const entry = manifest[entryKey];
    entryJs = assetHref(entry.file);
    (entry.css || []).forEach((c) => entryCss.add(assetHref(c)));
    (entry.imports || []).forEach((imp) => {
      const dep = manifest[imp];
      if (dep) {
        preloadJs.add(assetHref(dep.file));
        (dep.css || []).forEach((c) => entryCss.add(assetHref(c)));
      }
    });
  }
}

// Fallback: varre <outDir>/assets procurando o maior index-*.js (entry principal)
if (!entryJs) {
  const assetsDir = join(clientDir, "assets");
  if (!existsSync(assetsDir)) {
    console.error("[capacitor-index] Não achei a pasta assets em", clientDir);
    process.exit(1);
  }
  const files = readdirSync(assetsDir);
  const indexJs = files
    .filter((f) => /^(index|client|entry)-.*\.js$/.test(f))
    .map((f) => ({ f, size: readFileSync(join(assetsDir, f)).length }))
    .sort((a, b) => b.size - a.size);
  if (indexJs.length === 0) {
    console.error("[capacitor-index] Não achei nenhum entry JS em", assetsDir);
    process.exit(1);
  }
  entryJs = "assets/" + indexJs[0].f;
  files
    .filter((f) => /^(index|styles|client|entry)-.*\.css$/.test(f))
    .forEach((f) => entryCss.add("assets/" + f));
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
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover, interactive-widget=resizes-content">
    <meta name="theme-color" content="#10b981">
    <title>Contas Fácil</title>
    <link rel="icon" href="favicon.ico">
    <link rel="manifest" href="manifest.json">
${cssLinks}
${preloadLinks}
    <script type="module" crossorigin src="${entryJs}"></script>
  </head>
  <body>
    <div id="root" style="min-height:100vh;display:grid;place-items:center;font-family:system-ui,-apple-system,sans-serif;color:#0f172a;background:#f8fafc">Carregando Contas Fácil…</div>
  </body>
</html>
`;

writeFileSync(join(clientDir, "index.html"), html, "utf8");
if (existsSync(resolve(process.cwd(), "public/diagnostico.html"))) {
  copyFileSync(
    resolve(process.cwd(), "public/diagnostico.html"),
    join(clientDir, "diagnostico.html"),
  );
  console.log("[capacitor-index] diagnostico.html direto copiado para o APK.");
}
console.log("[capacitor-index] index.html gerado em", clientDir);
console.log("  entry:", entryJs);
console.log("  css:", [...entryCss].join(", ") || "(nenhum)");
