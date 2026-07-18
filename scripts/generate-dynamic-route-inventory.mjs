import fs from 'node:fs';
import path from 'node:path';

const sourcePath = path.resolve('app.js');
const outputPath = path.resolve('docs/dynamic-route-inventory.md');
const source = fs.readFileSync(sourcePath, 'utf8');

function objectBody(name) {
  const match = source.match(new RegExp(`var\\s+${name}\\s*=\\s*\\{([\\s\\S]*?)\\};`));
  return match ? match[1] : '';
}

function objectKeys(name) {
  const body = objectBody(name);
  const keys = new Set();
  const regex = /(?:^|[,\n])\s*([A-Za-z_$][\w$]*)\s*:/g;
  let match;
  while ((match = regex.exec(body))) keys.add(match[1]);
  return keys;
}

const routeGroups = {
  transaction: objectKeys('TRANSACTION_FN'),
  operations: objectKeys('OPERATIONS_FN'),
  reporting: objectKeys('REPORTING_FN'),
  master: objectKeys('MASTER_FN'),
  fileAccess: objectKeys('FILE_ACCESS_FN'),
  push: objectKeys('PUSH_FN'),
  pushPublic: objectKeys('PUSH_PUBLIC_FN'),
  public: objectKeys('PUBLIC_FN'),
};

// Routes handled outside the main maps.
const explicitRoutes = new Map([
  ['updateUserProfile', 'secureUser'],
  ['uploadFotoProfil', 'secureUser'],
  ['geocodeAlamat', 'geocodeRuntime'],
]);

const calls = new Set();
for (const regex of [
  /\bcallApi\s*\(\s*['"]([^'"]+)['"]/g,
  /\bapi\s*\(\s*['"]([^'"]+)['"]/g,
]) {
  let match;
  while ((match = regex.exec(source))) calls.add(match[1]);
}

const routed = new Map();
for (const [group, names] of Object.entries(routeGroups)) {
  for (const name of names) routed.set(name, group);
}
for (const [name, group] of explicitRoutes) routed.set(name, group);

const dynamic = [...calls].filter((name) => !routed.has(name)).sort();
const known = [...calls].filter((name) => routed.has(name)).sort();

function rows(names, resolver) {
  if (!names.length) return '| — | — |\n';
  return names.map((name) => `| \`${name}\` | ${resolver(name)} |`).join('\n') + '\n';
}

const now = new Date().toISOString();
const report = `# Dynamic Action Route Inventory

Generated automatically from \`app.js\` at ${now}.

## Summary

- Literal API calls found: **${calls.size}**
- Routed to modular/public functions: **${known.length}**
- Still falling back to \`dynamic-action\`: **${dynamic.length}**

## Remaining Dynamic Routes

| Function | Current destination |
|---|---|
${rows(dynamic, () => '`dynamic-action` fallback')}
## Routed Functions

| Function | Route group |
|---|---|
${rows(known, (name) => `\`${routed.get(name)}\``)}
## Guardrail

Any new literal \`callApi('...')\` invocation that is not included in a modular route map will appear in the remaining dynamic routes table on the next run.
`;

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, report, 'utf8');
console.log(`Wrote ${outputPath}`);
console.log(`Dynamic fallback routes: ${dynamic.length}`);
for (const name of dynamic) console.log(`- ${name}`);
