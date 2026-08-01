(function(){
'use strict';
function addCategoryToReport(){
  if(window.__categoryTransactionReportFixed)return;
  window.__categoryTransactionReportFixed=true;

  var originalValues=window._transactionReportValues;
  if(typeof originalValues==='function'){
    window._transactionReportValues=function(row){
      var values=originalValues(row);
      if(values.length===14){
        values.splice(6,0,row.kategori||'-');
      }
      return values;
    };
  }

  var originalHeaders=window._transactionReportHeaders;
  if(typeof originalHeaders==='function'){
    window._transactionReportHeaders=function(){
      var headers=originalHeaders();
      if(headers.indexOf('Kategori')<0){
        headers.splice(6,0,'Kategori');
      }
      return headers;
    };
  }
}

function patchPrintTemplate(){
  if(window.__categoryTransactionPrintFixed)return;
  var fn=window.buildPrintAllTable;
  if(typeof fn!=='function')return;
  window.__categoryTransactionPrintFixed=true;
  window.buildPrintAllTable=function(){
    var html=fn.apply(this,arguments);
    if(window.currentPage==='transaksi'){
      html=html.replace('<th>Item</th>','<th>Kategori</th><th>Item</th>');
      html=html.replace(/<td>(.*?)<\/td><td><strong style="color:var\(--slate-700\);">/g,function(all,a){
        return all;
      });
    }
    return html;
  };
}

setTimeout(function(){
  addCategoryToReport();
  patchPrintTemplate();
},1200);
})();
