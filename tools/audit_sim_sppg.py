#!/usr/bin/env python3
import json, re, shutil, subprocess
from collections import Counter, defaultdict
from pathlib import Path
from html.parser import HTMLParser

ROOT = Path.cwd()
HTML_PATH = ROOT / 'index.html'
JS_PATH = ROOT / 'app.js'
OUT = ROOT / 'audit-artifact'
OUT.mkdir(exist_ok=True)
html = HTML_PATH.read_text(encoding='utf-8')
js = JS_PATH.read_text(encoding='utf-8')
html_lines = html.splitlines()
js_lines = js.splitlines()
for p in (HTML_PATH, JS_PATH): shutil.copy2(p, OUT / p.name)

def line_no(text, pos): return text.count('\n', 0, max(0, pos)) + 1
def snippet(lines, line, radius=1):
    a=max(1,line-radius); b=min(len(lines),line+radius)
    return '\n'.join(f'{i}: {lines[i-1]}' for i in range(a,b+1))
def add(items, category, title, file, line, evidence, root, impact, severity, code=None):
    items.append(dict(category=category,title=title,file=file,line=line,evidence=evidence,rootCause=root,impact=impact,severity=severity,code=code))

report = {'meta':{}, 'checks':{}, 'findings':[], 'raw':{}}
findings = report['findings']
report['meta'] = {'commit': subprocess.run(['git','rev-parse','HEAD'],capture_output=True,text=True).stdout.strip(), 'htmlLines':len(html_lines), 'jsLines':len(js_lines)}
node = subprocess.run(['node','--check',str(JS_PATH)],capture_output=True,text=True)
report['checks']['nodeCheck']={'ok':node.returncode==0,'stdout':node.stdout,'stderr':node.stderr}

pairs = {'style':(r'<style\b',r'</style\s*>'),'script':(r'<script\b',r'</script\s*>'),'div':(r'<div\b',r'</div\s*>'),'head':(r'<head\b',r'</head\s*>'),'body':(r'<body\b',r'</body\s*>'),'html':(r'<html\b',r'</html\s*>')}
tag_counts={}
for tag,(op,cl) in pairs.items():
    o=len(re.findall(op,html,re.I)); c=len(re.findall(cl,html,re.I)); tag_counts[tag]={'open':o,'close':c,'balanced':o==c}
    if o!=c: add(findings,'A',f'Tag <{tag}> tidak seimbang','index.html',1,f'Jumlah pembuka={o}, penutup={c}','Ada pembuka/penutup tertinggal atau blok salah tempel.','DOM dapat dipulihkan berbeda oleh browser.','Kritikal')
for tag in ('head','body','html'):
    x=tag_counts[tag]
    if x['open']!=1 or x['close']!=1: add(findings,'A',f'<{tag}> harus tepat satu pasang','index.html',1,str(x),'Duplikasi/kehilangan elemen dokumen utama.','Parsing halaman tidak deterministik.','Kritikal')
report['checks']['tagCounts']=tag_counts

class Strict(HTMLParser):
    void={'area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr'}
    tracked={'html','head','body','style','script','div'}
    def __init__(self): super().__init__(convert_charrefs=False); self.stack=[]; self.errors=[]
    def handle_starttag(self,tag,attrs):
        tag=tag.lower()
        if tag in self.tracked and tag not in self.void: self.stack.append((tag,self.getpos()[0]))
    def handle_endtag(self,tag):
        tag=tag.lower()
        if tag not in self.tracked: return
        if not self.stack: self.errors.append({'type':'orphan-close','tag':tag,'line':self.getpos()[0]}); return
        if self.stack[-1][0]==tag: self.stack.pop(); return
        idx=next((i for i in range(len(self.stack)-1,-1,-1) if self.stack[i][0]==tag),None)
        if idx is None: self.errors.append({'type':'orphan-close','tag':tag,'line':self.getpos()[0],'top':self.stack[-1]})
        else:
            self.errors.append({'type':'misnested-close','tag':tag,'line':self.getpos()[0],'intervening':self.stack[idx+1:]})
            del self.stack[idx:]
p=Strict(); p.feed(html); p.close()
for tag,line in p.stack: p.errors.append({'type':'unclosed-open','tag':tag,'line':line})
report['checks']['strictParserErrors']=p.errors
for e in p.errors: add(findings,'A',f"Struktur HTML {e['type']}: {e['tag']}",'index.html',e['line'],snippet(html_lines,e['line']),'Urutan tag pembungkus tidak valid menurut parser stack.','Browser melakukan auto-repair DOM.','Kritikal')
try:
    from bs4 import BeautifulSoup
    soup=BeautifulSoup(html,'html5lib')
    report['checks']['domParser']={'ok':bool(soup.html and soup.head and soup.body),'parser':'html5lib'}
except Exception as e: report['checks']['domParser']={'ok':False,'error':str(e)}

id_matches=list(re.finditer(r'\bid\s*=\s*(["\'])([^"\']+)\1',html,re.I))
ids=[m.group(2) for m in id_matches]; id_counter=Counter(ids); html_ids=set(ids)
dup_ids={k:v for k,v in id_counter.items() if v>1}
report['checks']['ids']={'total':len(ids),'unique':len(html_ids),'duplicates':dup_ids}
for id_,count in dup_ids.items():
    lines=[line_no(html,m.start()) for m in id_matches if m.group(2)==id_]
    add(findings,'B',f'ID HTML duplikat: {id_}','index.html',lines[0],f'ID muncul {count}x pada baris {lines}','Copy-paste menghasilkan ID tidak unik.','getElementById dapat salah sasaran.','Sedang')

ref_patterns=[('getElementById',r'getElementById\(\s*["\']([^"\']+)["\']\s*\)'),('dollar',r'(?<![\w$])\$\(\s*["\']([^"\']+)["\']\s*\)'),('byId',r'\bbyId\(\s*["\']([^"\']+)["\']\s*\)'),('querySelector',r'querySelector(?:All)?\(\s*["\']#([A-Za-z_][\w:.-]*)["\']\s*\)')]
refs=[]
for kind,pat in ref_patterns:
    for m in re.finditer(pat,js): refs.append((m.group(1),line_no(js,m.start()),kind,m.group(0)))
dynamic_ids=set(m.group(2) for m in re.finditer(r'\bid\s*=\s*(["\'])([^"\']+)\1',js,re.I))
missing=defaultdict(list)
for id_,ln,kind,code in refs:
    if id_ not in html_ids and id_ not in dynamic_ids: missing[id_].append((ln,kind,code))
report['checks']['jsIdReferences']={'total':len(refs),'missing':dict(missing),'dynamicIds':sorted(dynamic_ids)}
for id_,uses in missing.items():
    ln=uses[0][0]; code=uses[0][2]
    sev='Sedang' if re.search(rf'(?:\$|getElementById|byId)\(\s*["\']{re.escape(id_)}["\']\s*\)\s*\.(?:value|classList|innerHTML|textContent|style|files)',js) else 'Minor'
    add(findings,'B',f'Referensi JS ke ID tidak ditemukan: {id_}','app.js',ln,snippet(js_lines,ln),'ID diubah/dihapus pada HTML atau elemen dinamis tidak dibuat.','Fitur dapat no-op atau melempar TypeError.',sev,code)

handler_re=re.compile(r'\bon(?:click|change|input|submit|focus|blur|keyup|keydown)\s*=\s*(["\'])(.*?)\1',re.I|re.S)
handlers=[]
for file,text in [('index.html',html),('app.js',js)]:
    for m in handler_re.finditer(text):
        body=m.group(2); ln=line_no(text,m.start())
        for fm in re.finditer(r'(?<![.\w$])([A-Za-z_$][\w$]*)\s*\(',body):
            name=fm.group(1)
            if name not in {'if','for','while','switch','function','return','confirm','alert','parseInt','Number','String'}: handlers.append((name,file,ln,body[:240]))
def_names=set(m.group(1) for m in re.finditer(r'(?m)^\s*function\s+([A-Za-z_$][\w$]*)\s*\(',js))
def_names.update(m.group(1) for m in re.finditer(r'\bwindow\.([A-Za-z_$][\w$]*)\s*=\s*(?:function\b|\([^)]*\)\s*=>|[A-Za-z_$][\w$]*)',js))
missing_handlers=defaultdict(list)
for name,file,ln,body in handlers:
    if name not in def_names: missing_handlers[name].append((file,ln,body))
report['checks']['inlineHandlers']={'total':len(handlers),'missing':dict(missing_handlers)}
for name,uses in missing_handlers.items():
    file,ln,body=uses[0]
    add(findings,'B',f'Handler inline tidak terdefinisi: {name}()',file,ln,body,'Atribut event memanggil fungsi yang tidak tersedia global.','Interaksi menghasilkan ReferenceError.','Sedang')

combined=html+'\n'+js
modal_targets=[]
for m in re.finditer(r'\b(openModal|closeModal)\(\s*["\']([^"\']+)["\']',combined): modal_targets.append((m.group(1),m.group(2),line_no(combined,m.start())))
modal_missing=defaultdict(list)
for fn,id_,ln in modal_targets:
    if id_ not in html_ids and id_ not in dynamic_ids: modal_missing[id_].append((fn,ln))
report['checks']['modals']={'targets':len(modal_targets),'missing':dict(modal_missing)}
for id_,uses in modal_missing.items(): add(findings,'B',f'Modal target tidak ada: {id_}','app.js',max(1,uses[0][1]-len(html_lines)),str(uses),'Nama modal tidak cocok dengan ID DOM.','Modal gagal buka/tutup.','Sedang')

ast_proc=subprocess.run(['node','tools/audit_ast.mjs','app.js'],capture_output=True,text=True)
try: ast=json.loads(ast_proc.stdout)
except Exception: ast={'parseError':{'message':ast_proc.stderr or ast_proc.stdout}}
report['checks']['ast']=ast
if ast.get('parseError'):
    e=ast['parseError']; add(findings,'A','JavaScript gagal diparse AST','app.js',e.get('line') or 1,e.get('message',''),'Sintaks JavaScript tidak valid.','Bundle gagal dieksekusi.','Kritikal')
for d in ast.get('duplicateGlobalFunctions',[]): add(findings,'C',f"Deklarasi fungsi global duplikat: {d['name']}",'app.js',d['definitions'][0]['line'],json.dumps(d['definitions']),'Nama sama dideklarasikan berulang di scope global.','Deklarasi terakhir menimpa versi awal.','Sedang')
for group in ast.get('duplicateListeners',[]): add(findings,'C','Event listener identik terpasang lebih dari sekali','app.js',group[0]['line'],json.dumps(group,ensure_ascii=False),'Target/event/handler identik didaftarkan berulang.','Satu interaksi menjalankan aksi berkali-kali.','Sedang')

style_blocks=[m.group(1) for m in re.finditer(r'<style\b[^>]*>(.*?)</style\s*>',html,re.I|re.S)]
css='\n'.join(style_blocks)
selector_defs=defaultdict(list)
for m in re.finditer(r'([^{}@][^{}]*?)\{([^{}]*)\}',css,re.S):
    selectors=[s.strip() for s in m.group(1).split(',') if s.strip()]
    props={p.group(1).strip().lower():p.group(2).strip() for p in re.finditer(r'([\w-]+)\s*:\s*([^;{}]+)',m.group(2))}
    for s in selectors: selector_defs[s].append({'props':props})
conflicts=[]
for sel,defs in selector_defs.items():
    if len(defs)<2: continue
    propvals=defaultdict(set)
    for d in defs:
        for k,v in d['props'].items(): propvals[k].add(v)
    changed={k:sorted(v) for k,v in propvals.items() if len(v)>1}
    if changed and not sel.startswith('@'): conflicts.append({'selector':sel,'conflictingProperties':changed})
report['checks']['css']={'styleBlocks':len(style_blocks),'duplicateConflictCandidates':conflicts[:300]}
for c in conflicts:
    if c['selector'] in {'body','.hidden','.show','.active','#authOverlay','.modal-overlay','.sidebar','.toast-container'}: add(findings,'C',f"Override CSS berpotensi konflik: {c['selector']}",'index.html',1,json.dumps(c['conflictingProperties'],ensure_ascii=False),'Selector inti berulang dengan nilai berbeda; perlu cek konteks media query.','Class toggle dapat berbeda menurut urutan source.','Minor')
for m in re.finditer(r'font-size\s*:\s*([0-9.]+)px',css,re.I):
    size=float(m.group(1))
    if size<10: add(findings,'E',f'Font sangat kecil: {size}px','index.html',1,m.group(0),'Ukuran teks eksplisit di bawah 10px.','Sulit dibaca di perangkat lapangan.','Minor')
trans_all=len(re.findall(r'transition\s*:\s*all\b',css,re.I))
report['checks']['performance']={'transitionAllCount':trans_all,'mutationObservers':len(re.findall(r'new\s+MutationObserver\b',js)),'setIntervals':len(re.findall(r'\bsetInterval\s*\(',js))}
if trans_all>10: add(findings,'G','Penggunaan transition: all berlebihan','index.html',1,f'Ditemukan {trans_all} deklarasi.','Semua properti dipaksa dianimasikan.','Menambah layout/paint perangkat rendah.','Minor')
public_match=re.search(r'var\s+PUBLIC_FN\s*=\s*\{(.*?)\};',js,re.S)
report['checks']['security']={'publicFnBlock':public_match.group(0)[:2000] if public_match else None,'localStorageTokenOccurrences':len(re.findall(r'localStorage[^\n]{0,120}(?:jwt|token|session)',js,re.I)),'serviceRoleLiteral':bool(re.search(r'service[_-]?role',js,re.I)),'anonJwtLiteral':bool(re.search(r'eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+',js))}
for pat,label in [(r'\bTODO\b','TODO tersisa'),(r'FIXME','FIXME tersisa'),(r'temporary|sementara|hotfix|patch lama','Kode sementara/hotfix tersisa')]:
    for m in re.finditer(pat,js,re.I):
        ln=line_no(js,m.start()); add(findings,'H',label,'app.js',ln,snippet(js_lines,ln),'Penanda refactor sementara masih ada.','Menyulitkan pemeliharaan.','Minor'); break
order={'Kritikal':0,'Sedang':1,'Minor':2}
findings.sort(key=lambda x:(order.get(x['severity'],9),x['file'],x['line'],x['title']))
report['summary']=dict(Counter(x['severity'] for x in findings))
(OUT/'audit-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
(OUT/'audit-summary.txt').write_text('\n'.join([f"commit={report['meta']['commit']}",f"lines index={len(html_lines)} app={len(js_lines)}",f"node_check={node.returncode==0}",f"tag_counts={tag_counts}",f"findings={report['summary']}" ]),encoding='utf-8')
print(json.dumps({'meta':report['meta'],'summary':report['summary'],'tagCounts':tag_counts,'nodeCheck':node.returncode==0,'strictErrors':len(p.errors),'missingIds':len(missing),'missingHandlers':len(missing_handlers),'duplicateFunctions':len(ast.get('duplicateGlobalFunctions',[]))},ensure_ascii=False,indent=2))
