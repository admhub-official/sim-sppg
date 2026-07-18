from pathlib import Path
p=Path('app.js')
s=p.read_text()
old="""function populateSPPGFilter() {
  var sel = $('txFilterSPPG');
  if (!sel) return;
  var sppgSet = {};
  allTransactions.forEach(function(t) { if (t.sppg) sppgSet[t.sppg] = true; });
  var html = '<option value=\"ALL\">Semua SPPG</option>';
  Object.keys(sppgSet).sort().forEach(function(s) { html += '<option value=\"' + esc(s) + '\">' + esc(s) + '</option>'; });
  sel.innerHTML = html;
}"""
new="""function populateSPPGFilter() {
  var sel = $('txFilterSPPG');
  if (!sel) return;
  var selected = sel.value || 'ALL';
  var sppgSet = {};
  allTransactions.forEach(function(t) { if (t.sppg) sppgSet[t.sppg] = true; });
  var html = '<option value=\"ALL\">Semua SPPG</option>';
  Object.keys(sppgSet).sort().forEach(function(s) { html += '<option value=\"' + esc(s) + '\">' + esc(s) + '</option>'; });
  sel.innerHTML = html;
  if (selected !== 'ALL' && !sppgSet[selected]) {
    sel.insertAdjacentHTML('beforeend', '<option value=\"' + esc(selected) + '\">' + esc(selected) + '</option>');
  }
  sel.value = selected;
}"""
if old not in s: raise SystemExit('populateSPPGFilter block not found')
p.write_text(s.replace(old,new,1))
print('transaction SPPG filter preserved')
