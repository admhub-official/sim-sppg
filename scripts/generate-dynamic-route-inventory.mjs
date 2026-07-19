import fs from 'node:fs';
import path from 'node:path';

const sourcePath = path.resolve('app.js');
const outputPath = path.resolve('docs/dynamic-route-inventory.md');
const source = fs.readFileSync(sourcePath, 'utf8');

function extractApiRoutes() {
  const match = source.match(/var\s+API_ROUTES\s*=\s*\{([\s\S]*?)\n\};\s*var\s+PUBLIC_FN/);
  if (!match) throw new Error('API_ROUTES tidak ditemukan atau formatnya berubah.');

  const routes = new Map();
  const duplicates = new Map();
  const routeRegex = /['"]([^'"]+)['"]\s*:\s*\{([\s\S]*?)\}(?:\s*,|\s*$)/g;
  let routeMatch;

  while ((routeMatch = routeRegex.exec(match[1]))) {
    const slug = routeMatch[1];
    const body = routeMatch[2];
    const keyRegex = /(?:^|[,\n])\s*([A-Za-z_$][\w$]*)\s*:/g;
    let keyMatch;
    while ((keyMatch = keyRegex.exec(body))) {
      const functionName = keyMatch[1];
      if (routes.has(functionName)) {
        const values = duplicates.get(functionName) || [routes.get(functionName)];
        values.push(slug);
        duplicates.set(functionName, values);
      } else {
        routes.set(functionName, slug);
      }
    }
  }

  if (!routes.size) throw new Error('Tidak ada function route yang berhasil dibaca dari API_ROUTES.');
  if (duplicates.size) {
    const details = [...duplicates].map(([name, slugs]) => `${name}: ${slugs.join(', ')}`).join('; ');
    throw new Error(`Function API terdaftar di lebih dari satu route: ${details}`);
  }
  return routes;
}

const routed = extractApiRoutes();
const calls = new Set();
for (const regex of [
  /\b(?:window\.)?callApi\s*\(\s*['"]([^'"]+)['"]/g,
  /\bapi\s*\(\s*['"]([^'"]+)['"]/g,
]) {
  let match;
  while ((match = regex.exec(source))) calls.add(match[1]);
}

const unmapped = [...calls].filter((name) => !routed.has(name)).sort();
const known = [...calls].filter((name) => routed.has(name)).sort();
const unused = [...routed.keys()].filter((name) => !calls.has(name)).sort();

function rows(names, resolver) {
  if (!names.length) return '| — | — |\n';
  return names.map((name) => `| \`${name}\` | ${resolver(name)} |`).join('\n') + '\n';
}

const now = new Date().toISOString();
const report = `# Dynamic Action Route Inventory

Generated automatically from \`app.js\` at ${now}.

## Summary

- Literal API calls found: **${calls.size}**
- Functions declared in \`API_ROUTES\`: **${routed.size}**
- Routed literal API calls: **${known.length}**
- Unmapped literal API calls: **${unmapped.length}**
- Legacy \`dynamic-action\` fallback: **0**

## Remaining Dynamic Routes

| Function | Current destination |
|---|---|
${rows(unmapped, () => '`not registered — callApi rejects the request`')}
## Routed Functions

| Function | Route group |
|---|---|
${rows(known, (name) => `\`${routed.get(name)}\``)}
## Declared but Not Called Literally

| Function | Route group |
|---|---|
${rows(unused, (name) => `\`${routed.get(name)}\``)}
## Guardrail

Any new literal \`callApi('...')\` invocation that is not included in \`API_ROUTES\` will appear in the remaining routes table and must fail CI.
`;

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, report, 'utf8');
console.log(`Wrote ${outputPath}`);
console.log(`Declared routes: ${routed.size}`);
console.log(`Unmapped literal calls: ${unmapped.length}`);
for (const name of unmapped) console.log(`- ${name}`);
if (unmapped.length) process.exitCode = 1;
