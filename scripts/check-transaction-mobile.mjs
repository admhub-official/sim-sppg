import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const extract = name => { const start = source.indexOf('function '+name+'('); assert.ok(start>=0); return source.slice(start, source.indexOf('\n}',start)+2); };
const nodes = new Map();
const $ = id => { if(!nodes.has(id)) nodes.set(id,{innerHTML:''}); return nodes.get(id); };
const esc = value => String(value??'').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
let pages;
const context = vm.createContext({$,esc,formatRupiah:n=>'Rp '+n,getMetodeBadge:()=>'<span>Belum lunas</span>',
  filteredTransactions:[],txServerPaged:false,txServerTotal:0,txPage:2,ITEMS_PER_PAGE:25,currentUser:{role:'USER'},
  renderPagination:(id,page,total)=>{pages={page,total};}
});
vm.runInContext(extract('renderTransactionMobileCards')+'\n'+extract('renderTransaksiTable')+'\n'+extract('syncFilterBarAccessibility'),context);
context.filteredTransactions = Array.from({length:26},(_,i)=>({id:'id-'+i,item:'Item '+i,nominal:i}));
context.renderTransaksiTable();
assert.match($('transactionMobileList').innerHTML,/#26/);
assert.match($('transactionMobileList').innerHTML,/Item 25/);
assert.doesNotMatch($('transactionMobileList').innerHTML,/Item 24/);
assert.equal(pages.total,2);
context.txServerPaged=true;context.txServerTotal=60;context.txPage=2;
context.filteredTransactions=[{id:'x" onclick="evil()',item:'<img src=x onerror=evil()>',nominal:987654321,catatan:"O'Brien"}];
context.renderTransaksiTable();
assert.match($('transactionMobileList').innerHTML,/#26/);
assert.equal(pages.total,3);
assert.doesNotMatch($('transactionMobileList').innerHTML,/<img/);
assert.match($('transactionMobileList').innerHTML,/&quot;/);
assert.match($('transactionMobileList').innerHTML,/O&#39;Brien/);
assert.match($('transactionMobileList').innerHTML,/openDetailTransaksi\(this.dataset.id\)/);
context.filteredTransactions=[];context.renderTransaksiTable();
assert.match($('transactionMobileList').innerHTML,/Tidak ada transaksi/);
assert.doesNotMatch($('transactionMobileList').innerHTML,/987654321/);
const attributes={};const content={id:''};let collapsed=true;
const bar={id:'txFilterBar',classList:{contains:()=>collapsed},querySelector:selector=>selector==='.filter-toggle-btn'?{setAttribute:(key,value)=>attributes[key]=value}:content};
context.syncFilterBarAccessibility(bar);
assert.equal(attributes['aria-expanded'],'false');assert.equal(attributes['aria-controls'],'txFilterBarControls');
collapsed=false;context.syncFilterBarAccessibility(bar);assert.equal(attributes['aria-expanded'],'true');
console.log('Transaction mobile passed: local/server pagination, escaping, detail target, empty state and filter accessibility.');
