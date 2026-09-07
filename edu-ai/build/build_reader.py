#!/usr/bin/env python3
"""Build final/margin-reader.html — the master prompt rendered at build time (no CDN, no client parsing)."""
import os, re, sys, html, datetime
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import mdrender

WS = os.path.dirname(os.path.abspath(__file__))
md = open(os.path.join(WS, 'final', 'MASTER-PROMPT.md'), encoding='utf-8').read()

# strip the markdown TOC block (the reader has a live one) between "## Table of contents" and the following "---"
md = re.sub(r'\n## Table of contents\n.*?\n---\n', '\n', md, flags=re.S)

words = len(md.split())
ids = sorted(set(re.findall(r'\b\d\d-[A-Z]{2,5}-\d{3}\b', md)))
version = os.environ.get('MP_VERSION', 'v1')

toc = []          # [{id,n,title,subs:[{id,n,title}]}]
state = {'cur': None}

def heading(level, text):
    raw = re.sub(r'<[^>]+>', '', text)
    if level == 1:
        m = re.match(r'^§(\d\d)\s+(.*)$', raw)
        if m:
            sid = 's' + m.group(1)
            state['cur'] = {'id': sid, 'n': '§' + m.group(1), 'title': m.group(2), 'subs': []}
            toc.append(state['cur'])
            return ('<h1 class="sec" id="%s"><span class="n">§%s</span><span>%s</span></h1>'
                    % (sid, m.group(1), mdrender.inline(m.group(2), rid=False)))
        return '<h1 class="doc-title">%s</h1>' % mdrender.inline(raw, rid=False)
    if level == 2:
        m = re.match(r'^(\d\d\.[0-9A-Z]+)\s+(.*)$', raw)
        if m and state['cur']:
            hid = 's' + m.group(1).replace('.', '-')
            state['cur']['subs'].append({'id': hid, 'n': m.group(1), 'title': m.group(2)})
            return ('<h2 id="%s"><span class="n">%s</span>%s</h2>'
                    % (hid, m.group(1), mdrender.inline(m.group(2), rid=False)))
        slug = re.sub(r'[^a-z0-9]+', '-', raw.lower()).strip('-')[:60]
        return '<h2 id="%s" class="plain">%s</h2>' % (slug, mdrender.inline(raw, rid=False))
    return '<h%d>%s</h%d>' % (level, mdrender.inline(raw), level)

body = mdrender.render(md, heading_hook=heading)

nav = []
for ix, s in enumerate(toc):
    subs = ''.join(
        '<li><a href="#%s" data-n="%s" data-t="%s"><span class="n">%s</span><span>%s</span></a></li>'
        % (x['id'], x['n'], html.escape(x['title'].lower(), quote=True), x['n'], mdrender.inline(x['title'], rid=False))
        for x in s['subs'])
    nav.append('<details%s data-sec="%s"><summary><span class="n">%s</span><span>%s</span></summary><ul>%s</ul></details>'
               % (' open' if ix == 0 else '', s['id'], s['n'], mdrender.inline(s['title'], rid=False), subs))
nav_html = ''.join(nav)

CSS = r'''
:root{
  --paper:#FBFBF8; --paper-2:#F2F2EC; --ink:#1A1A1D; --ink-2:#4C4C54; --ink-3:#7C7C85;
  --rule:#E4E3DC; --rule-2:#CFCEC5; --red:#A93226; --red-soft:#F6E7E4; --red-ink:#8C2A20;
  --code-bg:#F1F0EA; --sel:#EAE3D2; --shadow:0 1px 0 rgba(26,26,29,.03), 0 10px 26px -20px rgba(26,26,29,.35);
  color-scheme:light;
}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){
  --paper:#141518; --paper-2:#1B1C20; --ink:#E9E8E2; --ink-2:#B5B4AE; --ink-3:#83838B;
  --rule:#282930; --rule-2:#393A41; --red:#E4695A; --red-soft:#38211D; --red-ink:#F08375;
  --code-bg:#1E1F23; --sel:#2C2A22; --shadow:0 1px 0 rgba(0,0,0,.3), 0 10px 26px -20px rgba(0,0,0,.8);
  color-scheme:dark;
}}
:root[data-theme="dark"]{
  --paper:#141518; --paper-2:#1B1C20; --ink:#E9E8E2; --ink-2:#B5B4AE; --ink-3:#83838B;
  --rule:#282930; --rule-2:#393A41; --red:#E4695A; --red-soft:#38211D; --red-ink:#F08375;
  --code-bg:#1E1F23; --sel:#2C2A22; --shadow:0 1px 0 rgba(0,0,0,.3), 0 10px 26px -20px rgba(0,0,0,.8);
  color-scheme:dark;
}
*{box-sizing:border-box}
html{scroll-behavior:smooth}
@media (prefers-reduced-motion:reduce){html{scroll-behavior:auto}}
body{margin:0;background:var(--paper);color:var(--ink);
  font:16px/1.62 "IBM Plex Sans",ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;
  -webkit-font-smoothing:antialiased}
::selection{background:var(--sel)}
a{color:var(--red-ink)}
.top{position:sticky;top:0;z-index:6;display:flex;align-items:center;gap:14px;padding:9px 20px;
  background:var(--paper);border-bottom:1px solid var(--rule)}
.top .name{font-family:"Source Serif 4",Georgia,"Times New Roman",serif;font-weight:600;font-size:18px;white-space:nowrap}
.top .name b{font-weight:700;color:var(--red)}
.top .meta{font-family:"IBM Plex Mono",ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
  font-size:11.5px;color:var(--ink-3);letter-spacing:.02em;white-space:nowrap;font-variant-numeric:tabular-nums}
.top .grow{flex:1}
.top input{font:inherit;font-size:13.5px;padding:6px 10px;border:1px solid var(--rule-2);border-radius:6px;
  background:var(--paper-2);color:var(--ink);width:240px;min-width:0}
.top input::placeholder{color:var(--ink-3)}
.top button{font:inherit;font-size:13px;padding:6px 11px;border:1px solid var(--rule-2);border-radius:6px;
  background:transparent;color:var(--ink-2);cursor:pointer}
.top button:hover{background:var(--paper-2);color:var(--ink)}
:focus-visible{outline:2px solid var(--red);outline-offset:2px}
.wrap{display:grid;grid-template-columns:288px minmax(0,1fr)}
.toc{position:sticky;top:47px;height:calc(100vh - 47px);overflow-y:auto;overscroll-behavior:contain;
  border-right:1px solid var(--rule);padding:14px 10px 60px 16px;font-size:13px;line-height:1.45}
.toc h2{font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:10.5px;font-weight:500;letter-spacing:.09em;
  text-transform:uppercase;color:var(--ink-3);margin:6px 0 10px 8px}
.toc summary{list-style:none;cursor:pointer;display:grid;grid-template-columns:32px 1fr;gap:6px;
  padding:5px 8px;border-radius:5px;font-weight:500;color:var(--ink)}
.toc summary::-webkit-details-marker{display:none}
.toc summary:hover{background:var(--paper-2)}
.toc summary .n{font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:11.5px;color:var(--red)}
.toc ul{list-style:none;margin:2px 0 8px;padding:0 0 0 12px;border-left:1px solid var(--rule)}
.toc li a{display:grid;grid-template-columns:40px 1fr;gap:6px;padding:3px 8px;text-decoration:none;
  color:var(--ink-2);border-radius:4px}
.toc li a .n{font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:11px;color:var(--ink-3);font-variant-numeric:tabular-nums}
.toc li a:hover{background:var(--paper-2);color:var(--ink)}
.toc li a.on{background:var(--red-soft);color:var(--ink)}
.toc li a.on .n{color:var(--red)}
.toc .none{color:var(--ink-3);padding:10px 8px}
main{padding:28px 52px 140px}
.doc{max-width:74ch}
.doc-title{font-family:"Source Serif 4",Georgia,serif;font-weight:700;font-size:clamp(30px,3.6vw,44px);
  line-height:1.08;letter-spacing:-.014em;margin:8px 0 14px;text-wrap:balance}
.doc h1.sec{font-family:"Source Serif 4",Georgia,serif;font-weight:700;font-size:clamp(25px,2.8vw,33px);
  line-height:1.14;letter-spacing:-.01em;margin:104px 0 6px;padding-top:26px;border-top:2px solid var(--ink);
  display:grid;grid-template-columns:auto 1fr;gap:16px;align-items:baseline;text-wrap:balance;scroll-margin-top:58px}
.doc h1.sec .n{font-family:"IBM Plex Mono",ui-monospace,monospace;font-weight:500;font-size:.48em;
  letter-spacing:.04em;color:var(--red)}
.doc h2{font-family:"Source Serif 4",Georgia,serif;font-weight:600;font-size:22px;line-height:1.26;
  margin:52px 0 12px;letter-spacing:-.005em;text-wrap:balance;scroll-margin-top:70px}
.doc h2 .n{display:block;font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:11.5px;font-weight:500;
  color:var(--red);letter-spacing:.05em;margin-bottom:3px;font-variant-numeric:tabular-nums}
.doc h3{font-weight:600;font-size:16px;margin:30px 0 7px;letter-spacing:-.002em}
.doc h4{font-weight:600;font-size:14.5px;margin:22px 0 5px;color:var(--ink-2)}
.doc p{margin:0 0 13px}
.doc p.note{color:var(--ink-2);font-size:15px}
.doc h1.sec + p.note,.doc-title + p.note{font-size:17px;line-height:1.58;margin-bottom:20px}
.doc ul,.doc ol{margin:0 0 14px;padding-left:1.35em}
.doc li{margin:4px 0}
.doc li::marker{color:var(--ink-3)}
.doc blockquote{margin:16px 0;padding:1px 0 1px 16px;border-left:3px solid var(--red);color:var(--ink-2)}
.doc hr{border:0;border-top:1px solid var(--rule);margin:36px 0}
.doc code{font-family:"IBM Plex Mono",ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:.86em;
  background:var(--code-bg);padding:.1em .34em;border-radius:4px}
.doc pre{background:var(--code-bg);border:1px solid var(--rule);border-radius:8px;padding:13px 15px;
  overflow-x:auto;font-size:12.5px;line-height:1.52;margin:14px 0 18px}
.doc pre code{background:transparent;padding:0;font-size:inherit}
.doc .tbl{overflow-x:auto;margin:14px 0 22px;border:1px solid var(--rule);border-radius:8px;box-shadow:var(--shadow)}
.doc table{border-collapse:collapse;width:100%;font-size:13.5px;line-height:1.45;min-width:min(560px,100%)}
.doc th{font-family:"IBM Plex Mono",ui-monospace,monospace;font-weight:500;font-size:10.5px;letter-spacing:.07em;
  text-transform:uppercase;color:var(--ink-3);text-align:left;padding:9px 12px;background:var(--paper-2);
  border-bottom:1px solid var(--rule);white-space:nowrap}
.doc td{padding:9px 12px;border-bottom:1px solid var(--rule);vertical-align:top}
.doc tr:last-child td{border-bottom:0}
.doc td:first-child{white-space:nowrap}
.rid{font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:.84em;font-weight:500;color:var(--red-ink);
  background:var(--red-soft);padding:.08em .38em;border-radius:4px;white-space:nowrap}
.doc td:first-child .rid{background:transparent;padding:0;color:var(--red)}
.doc .tbl{max-width:min(100%,calc(100vw - 288px - 104px))}
.here{position:fixed;right:20px;bottom:16px;z-index:3;font-family:"IBM Plex Mono",ui-monospace,monospace;
  font-size:11px;color:var(--ink-3);letter-spacing:.03em;background:var(--paper);border:1px solid var(--rule);
  padding:6px 11px;border-radius:6px;box-shadow:var(--shadow);max-width:300px;overflow:hidden;
  text-overflow:ellipsis;white-space:nowrap}
.here b{color:var(--red);font-weight:500}
.menu{display:none}
@media (max-width:900px){
  .wrap{grid-template-columns:1fr}
  .toc{position:fixed;inset:47px 0 0 0;height:calc(100vh - 47px);background:var(--paper);
    transform:translateX(-100%);transition:transform .18s ease;z-index:5;border-right:0}
  @media (prefers-reduced-motion:reduce){.toc{transition:none}}
  .toc.open{transform:none}
  main{padding:18px 16px 100px}
  .doc .tbl{max-width:100%}
  .menu{display:inline-block}
  .top .meta{display:none}
  .top input{width:100%}
  .here{display:none}
}
@media print{
  .top,.toc,.here{display:none}
  .wrap{display:block}
  main{padding:0;max-width:none}
  .doc{max-width:none}
  .doc h1.sec{break-before:page}
  .doc .tbl{box-shadow:none;break-inside:avoid}
}
'''

JS = r'''
(function(){
  var nav=document.getElementById('toc'), links=[].slice.call(nav.querySelectorAll('a'));
  var heads=[].slice.call(document.querySelectorAll('#doc h2[id], #doc h1.sec[id]'));
  var here=document.getElementById('here'), active=null;
  function setActive(id){
    if(active===id) return; active=id;
    links.forEach(function(a){ a.classList.toggle('on', a.getAttribute('href')==='#'+id); });
    var a=nav.querySelector('a[href="#'+id+'"]');
    if(!a) return;
    var d=a.closest('details'); if(d && !d.open) d.open=true;
    here.hidden=false; here.innerHTML='<b>'+a.getAttribute('data-n')+'</b> '+a.children[1].textContent;
    var r=a.getBoundingClientRect(), nr=nav.getBoundingClientRect();
    if(r.top<nr.top+48 || r.bottom>nr.bottom-48) a.scrollIntoView({block:'center'});
  }
  var ticking=false;
  function onScroll(){
    if(ticking) return; ticking=true;
    requestAnimationFrame(function(){
      ticking=false;
      var last=null;
      for(var i=0;i<heads.length;i++){ if(heads[i].getBoundingClientRect().top<130) last=heads[i]; else break; }
      if(last) setActive(last.id);
    });
  }
  window.addEventListener('scroll', onScroll, {passive:true});
  onScroll();
  var q=document.getElementById('q');
  q.addEventListener('input', function(){
    var v=q.value.trim().toLowerCase(), any=false;
    [].forEach.call(nav.querySelectorAll('details'), function(d){
      var sec=d.querySelector('summary').textContent.toLowerCase(), shown=0;
      [].forEach.call(d.querySelectorAll('li'), function(li){
        var a=li.firstElementChild;
        var hit=!v || a.getAttribute('data-n').toLowerCase().indexOf(v)>-1
                   || a.getAttribute('data-t').indexOf(v)>-1 || sec.indexOf(v)>-1;
        li.hidden=!hit; if(hit) shown++;
      });
      d.hidden = !!v && shown===0; if(v && shown) d.open=true; any=any||shown>0;
    });
    var none=nav.querySelector('.none'); if(none) none.remove();
    if(v && !any){ var p=document.createElement('div'); p.className='none';
      p.textContent='No section matches “'+q.value+'”.'; nav.appendChild(p); }
  });
  document.getElementById('menu').addEventListener('click', function(){ nav.classList.toggle('open'); });
  nav.addEventListener('click', function(e){ if(e.target.closest('a')) nav.classList.remove('open'); });
  var root=document.documentElement, tb=document.getElementById('theme');
  function cur(){ var t=root.getAttribute('data-theme'); if(t) return t;
    return (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches)?'dark':'light'; }
  try{ var s=localStorage.getItem('mp-theme'); if(s) root.setAttribute('data-theme', s); }catch(e){}
  tb.addEventListener('click', function(){ var nx=cur()==='dark'?'light':'dark';
    root.setAttribute('data-theme', nx); try{localStorage.setItem('mp-theme', nx);}catch(e){} });
  document.addEventListener('keydown', function(e){
    if(e.key==='/' && document.activeElement!==q){ e.preventDefault(); q.focus(); q.select(); }
    if(e.key==='Escape' && document.activeElement===q){ q.value=''; q.dispatchEvent(new Event('input')); q.blur(); }
  });
})();
'''

page = """<title>Margin Master Build Prompt</title>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Source+Serif+4:opsz,wght@8..60,600;8..60,700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>%s</style>
<header class="top">
  <button class="menu" id="menu" aria-label="Show contents">Contents</button>
  <div class="name"><b>Margin</b> · Master Build Prompt</div>
  <div class="meta">%s · %s words · %s requirement IDs · %s</div>
  <div class="grow"></div>
  <input id="q" type="search" placeholder="Filter sections  ( / )" aria-label="Filter sections">
  <button id="theme" aria-label="Switch between light and dark">Theme</button>
</header>
<div class="wrap">
  <nav class="toc" id="toc" aria-label="Contents"><h2>Contents</h2>%s</nav>
  <main><article class="doc" id="doc">%s</article></main>
</div>
<div class="here" id="here" hidden></div>
<script>%s</script>
""" % (CSS, version, format(words, ','), format(len(ids), ','), datetime.date.today().isoformat(),
       nav_html, body, JS)

out = os.path.join(WS, 'final', 'margin-reader.html')
open(out, 'w', encoding='utf-8').write(page)
print('wrote %s: %.0f KB · %s words · %d sections · %d subsections · %d requirement IDs'
      % (out, len(page.encode()) / 1024, format(words, ','), len(toc), sum(len(s['subs']) for s in toc), len(ids)))
