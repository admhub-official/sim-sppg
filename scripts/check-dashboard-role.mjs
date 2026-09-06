import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const extract = name => { const start = source.indexOf('function ' + name + '('); return source.slice(start, source.indexOf('\n}', start) + 2); };
const nodes = new Map();
const node = id => {
  if (!nodes.has(id)) { const classes = new Set(); nodes.set(id, { textContent: '', style: {}, classList: {
    add: value => classes.add(value), remove: value => classes.delete(value),
    contains: value => classes.has(value), toggle: (value, on) => on ? classes.add(value) : classes.delete(value)
  } }); }
  return nodes.get(id);
};
let allowed = ['transaksi', 'approval'];
const requests = [];
const context = vm.createContext({ currentUser: { role: 'USER' }, dashboardRequestSequence: 0,
  $: node, isPageAllowedForCurrentUser: page => allowed.includes(page),
  formatRupiah: value => 'Rp ' + value, syncApprovalBadgeToBottomNav() {},
  callApi: (route, params, success, failure) => requests.push({ success, failure })
});
vm.runInContext(extract('configureDashboardRole') + '\n' + extract('loadDashboardData'), context);
context.configureDashboardRole();
assert.match(node('dashboardRoleTitle').textContent, /saya/);
context.currentUser = { role: 'ADMIN' }; context.configureDashboardRole();
assert.match(node('dashboardScopeCaption').textContent, /penugasan/);
allowed = []; context.configureDashboardRole();
assert.ok(node('dashboardApprovalAction').disabled);
context.currentUser = { role: 'SUPER_ADMIN' }; context.configureDashboardRole();
assert.match(node('dashboardRoleTitle').textContent, /organisasi/);
const a = context.loadDashboardData();
const b = context.loadDashboardData();
requests[1].success({ success: true, saldoBerjalan: 25, totalPemasukan: 30, totalPengeluaran: 5 }); await b;
requests[0].success({ success: true, saldoBerjalan: 999 }); await a;
assert.equal(node('statSaldo').textContent, 'Rp 25', 'old response cannot overwrite newer KPI');
const failing = context.loadDashboardData(); requests[2].failure(new Error('offline')); await failing;
assert.ok(node('skeletonDashboard').classList.contains('hidden'));
assert.ok(!node('dashboardStats').classList.contains('hidden'));
assert.match(node('dashboardLoadStatus').textContent, /coba lagi/);
assert.equal(node('statSaldo').textContent, '—', 'failure is not presented as a zero balance');
const oldAccount = context.loadDashboardData();
context.currentUser = { role: 'USER' }; context.dashboardRequestSequence++;
requests[3].success({ success: true, saldoBerjalan: 777 }); await oldAccount;
assert.equal(node('statSaldo').textContent, '—', 'previous account response is ignored');
console.log('Dashboard passed: role captions, disabled actions, stale requests, session changes and retry state.');
