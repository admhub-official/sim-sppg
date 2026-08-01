(function(){
'use strict';
function patchTransactionReport(){
  if(window.__categoryTransactionReportFixed)return;
  window.__categoryTransactionReportFixed=true;

  if(typeof window._transactionReportHeaders==='function'){
    var oldHeaders=window._transactionReportHeaders;
    window._transactionReportHeaders=function(){
      var h=oldHeaders();
      if(h.indexOf('Kategori')<0){
        h.splice(6,0,'Kategori');
      }
      return h;
    };
  }

  if(typeof window._transactionReportValues==='function'){
    var oldValues=window._transactionReportValues;
    window._transactionReportValues=function(row){
      var v=oldValues(row);
      if(v.length===14){
        v.splice(6,0,row.kategori||'-');
      }
      return v;
    };
  }

  if(typeof window._transactionReportHTML==='function'){
    var oldHtml=window._transactionReportHTML;
    window._transactionReportHTML=function(report){
      return oldHtml(report).replace(
        '<th>Jenis Kategori</th>',
        '<th>Kategori</th><th>Jenis Kategori</th>'
      ).replace(
        '<td>' + esc(row.jenis) + '</td>',
        '<td>' + esc(row.kategori || '-') + '</td><td>' + esc(row.jenis) + '</td>'
      );
    };
  }
}

function patchPrintAll(){
  var old=window.buildPrintAllTable;
  if(typeof old!=='function'||window.__categoryPrintFixed)return;
  window.__categoryPrintFixed=true;
  window.buildPrintAllTable=function(){
    var html=old.apply(this,arguments);
    if(window.currentPage==='transaksi'){
      html=html.replace('<th>Item</th>','<th>Kategori</th><th>Item</th>')
        .replace(/<td>'+esc\(tx\.item\|\|'-'\)<\/td>/,'<td>'+esc(tx.kategori||'-')+'</td><td>'+esc(tx.item||'-')+'</td>');
    }
    return html;
  };
}

setTimeout(function(){
  patchTransactionReport();
  patchPrintAll();
},800);
})();
