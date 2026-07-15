import fs from 'node:fs';
import * as acorn from 'acorn';

const file = process.argv[2] || 'app.js';
const src = fs.readFileSync(file, 'utf8');
let ast;
try {
  ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'script', locations: true, allowHashBang: true });
} catch (error) {
  console.log(JSON.stringify({ parseError: { message: error.message, line: error.loc?.line || null, column: error.loc?.column || null } }, null, 2));
  process.exit(0);
}

const globalDefs = new Map();
const listeners = [];
const domReady = [];
const calls = [];

function text(node) { return src.slice(node.start, node.end); }
function nameOfMember(node) {
  if (!node || node.type !== 'MemberExpression') return null;
  const prop = node.computed ? (node.property.type === 'Literal' ? String(node.property.value) : text(node.property)) : node.property.name;
  return prop || null;
}
function addDef(name, node, kind) {
  if (!name) return;
  const list = globalDefs.get(name) || [];
  list.push({ line: node.loc.start.line, kind });
  globalDefs.set(name, list);
}
function literalString(node) {
  if (!node) return null;
  if (node.type === 'Literal' && typeof node.value === 'string') return node.value;
  if (node.type === 'TemplateLiteral' && node.expressions.length === 0) return node.quasis[0].value.cooked;
  return null;
}

function visit(node, depth = 0) {
  if (!node || typeof node !== 'object') return;
  const isGlobal = depth === 0;

  if (isGlobal && node.type === 'FunctionDeclaration') addDef(node.id?.name, node, 'function');
  if (isGlobal && node.type === 'VariableDeclaration') {
    for (const d of node.declarations) {
      if (d.id?.type === 'Identifier' && ['FunctionExpression','ArrowFunctionExpression'].includes(d.init?.type)) addDef(d.id.name, d, 'variable-function');
    }
  }
  if (isGlobal && node.type === 'ExpressionStatement' && node.expression?.type === 'AssignmentExpression') {
    const a = node.expression;
    if (['FunctionExpression','ArrowFunctionExpression'].includes(a.right?.type)) {
      if (a.left.type === 'Identifier') addDef(a.left.name, a.left, 'assignment-function');
      if (a.left.type === 'MemberExpression' && a.left.object.type === 'Identifier' && a.left.object.name === 'window') addDef(nameOfMember(a.left), a.left, 'window-function');
    }
  }

  if (node.type === 'CallExpression') {
    let calleeName = null;
    if (node.callee.type === 'Identifier') calleeName = node.callee.name;
    else if (node.callee.type === 'MemberExpression') calleeName = nameOfMember(node.callee);
    if (calleeName) calls.push({ name: calleeName, line: node.loc.start.line });

    if (node.callee.type === 'MemberExpression' && nameOfMember(node.callee) === 'addEventListener') {
      const event = literalString(node.arguments[0]);
      const handler = node.arguments[1] ? text(node.arguments[1]).replace(/\s+/g, ' ').slice(0, 240) : '';
      const target = text(node.callee.object).replace(/\s+/g, ' ').slice(0, 180);
      const item = { target, event, handler, line: node.loc.start.line };
      listeners.push(item);
      if ((target === 'document' || target === 'window') && event === 'DOMContentLoaded') domReady.push(item);
    }
  }

  let childDepth = depth;
  if (node.type === 'FunctionDeclaration' || node.type === 'FunctionExpression' || node.type === 'ArrowFunctionExpression') childDepth = depth + 1;
  for (const [key, value] of Object.entries(node)) {
    if (['start','end','loc'].includes(key) || value == null) continue;
    if (Array.isArray(value)) {
      for (const child of value) if (child && typeof child.type === 'string') visit(child, childDepth);
    } else if (value && typeof value.type === 'string') visit(value, childDepth);
  }
}
for (const node of ast.body) visit(node, 0);

const duplicateGlobalFunctions = [];
for (const [name, defs] of globalDefs.entries()) if (defs.length > 1) duplicateGlobalFunctions.push({ name, definitions: defs });
const listenerGroups = new Map();
for (const item of listeners) {
  const key = `${item.target}||${item.event}||${item.handler}`;
  const arr = listenerGroups.get(key) || [];
  arr.push(item);
  listenerGroups.set(key, arr);
}
const duplicateListeners = [...listenerGroups.values()].filter(v => v.length > 1);

console.log(JSON.stringify({ parseError: null, duplicateGlobalFunctions, duplicateListeners, domContentLoadedListeners: domReady, globalDefinitionCount: globalDefs.size, callCount: calls.length }, null, 2));
