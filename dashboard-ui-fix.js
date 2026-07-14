(function(){
'use strict';
var repairing=false;
function repair(){
  if(repairing)return;
  var cashWrap=document.querySelector('#dashPanels .dash-grid:first-child .dash-chart');
  var compWrap=document.querySelector('#dashPanels .dash-grid.equal .dash-chart');
  var changed=false;
  if(cashWrap&&!document.getElementById('dashCashflow')){cashWrap.innerHTML='<canvas id="dashCashflow"></canvas>';changed=true;}
  if(compWrap&&!document.getElementById('dashComposition')){compWrap.innerHTML='<canvas id="dashComposition"></canvas>';changed=true;}
  if(changed){
    repairing=true;
    setTimeout(function(){
      var period=document.getElementById('dashPeriod');
      if(period)period.dispatchEvent(new Event('change',{bubbles:true}));
      repairing=false;
    },120);
  }
}
new MutationObserver(function(){setTimeout(repair,30)}).observe(document.documentElement,{childList:true,subtree:true});
})();