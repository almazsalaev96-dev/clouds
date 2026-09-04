#!/usr/bin/env node
/* Run the docket engine outside the browser.
   Usage: node run.js profile.json
   The engine is read straight out of index.html so there is one source of truth. */
const fs = require("fs");
const path = require("path");

function loadEngine(){
  const html = fs.readFileSync(path.join(__dirname,"index.html"),"utf8");
  const body = html.slice(html.indexOf("<script>")+8, html.lastIndexOf("</script>"));
  const pure = body.slice(0, body.indexOf("/* ---------------- example file"));
  return new Function(pure + "\nreturn {evaluate,verdictOf,analyseEssay,ratingOf,SCHOOLS,TIERS,NEXT,RVERD};")();
}
const E = loadEngine();

const DEFAULTS = {
  school:"harvard", round:"rd", major:"undecided", citizen:"dom",
  gpa:0, rank:null, testtype:"sat", score:0, rigor:3, advanced:0,
  research:false, olympiad:false, isef:false,
  acts:[], spike:1, depth:1, essay:"", supps:0, interview:0,
  rec1:2, rec2:2, counselor:2, schooltype:1, geo:2, aid:0,
  athlete:false, legacy:false, dean:false, faculty:false, firstgen:false, qb:false
};

const bar = (n,w=28) => "█".repeat(Math.round(n/100*w)).padEnd(w,"·");
const pad = (s,n) => String(s).padEnd(n);

function report(profile){
  const o = Object.assign({}, DEFAULTS, profile);
  const R = E.evaluate(o);
  const V = E.verdictOf(R.p);
  const S = R.S;
  const L = [];

  L.push("");
  L.push("  READER'S DOCKET — " + S.n + "  ·  " + {rd:"Regular Decision",ed:"Early Decision",rea:"Early Action"}[o.round]);
  L.push("  " + "─".repeat(68));
  L.push("");

  const rows = [["Academic",R.rAcad,R.acad,"acad"],["Extracurricular",R.rEc,R.ec,"ec"],
                ["Personal",R.rPers,R.personal,"personal"],["School support",R.rSup,R.support,"support"]];
  for(const [name,r,sc,key] of rows){
    L.push("  " + pad(name,16) + pad(r.r + (r.mod||""), 4) + bar(sc) + "  " + E.RVERD[key][r.r]);
  }
  L.push("  " + pad("Athletic",16) + pad(R.rAth.r + (R.rAth.mod||""),4) + bar(R.athletic) +
        (o.athlete ? "  Recruited — decisive" : "  Not recruited — not a factor"));
  L.push("");
  L.push("  " + "─".repeat(68));
  L.push("  OVERALL RATING   " + R.rOverall.r + (R.rOverall.mod||"") +
        "        docket score " + R.docket.toFixed(1) + " / 100");
  const lo = Math.max(0.1,R.p*100*0.72), hi = Math.min(97,R.p*100*1.34);
  L.push("  VERDICT          " + V.t.toUpperCase());
  L.push("  PROBABILITY      " + (lo<1?lo.toFixed(1):Math.round(lo)) + "–" + (hi<1?hi.toFixed(1):Math.round(hi)) +
        "%     (this school's overall admit rate: " + S.rate.toFixed(1) + "%)");
  L.push("  " + "─".repeat(68));
  L.push("");
  L.push("  " + V.note);
  L.push("");

  if(R.hooks.length){
    L.push("  INSTITUTIONAL FACTORS");
    R.hooks.forEach(([lab,m]) => L.push("    · " + lab + (m && m!==1 ? "  ×"+m.toFixed(2) : (m===1?"  (no effect)":"  (decisive)"))));
    L.push("");
  }

  /* leverage: re-run with one thing changed */
  const cands = [];
  const t = (mod,label) => { const p2 = E.evaluate(Object.assign({},o,mod)).p; if(p2>R.p*1.02) cands.push([p2-R.p,label,p2]); };
  const bestTier = o.acts.length?Math.min(...o.acts.map(a=>a.tier)):4;
  if(bestTier>1 && o.acts.length) t({ecBump:true},"Push your strongest activity up one tier");
  if(R.eScore<82) t({essayOverride:88},"Rewrite the personal statement");
  if(o.supps<3) t({supps:3},"Make the supplements school-specific");
  if(o.rigor<4) t({rigor:4},"Take the most demanding schedule available");
  if(o.testtype!=="none" && R.sat<S.sat[1]) t({score:o.testtype==="sat"?S.sat[1]:36},"Retest toward "+S.sat[1]+" SAT-equivalent");
  if(o.round==="rd" && S.early==="ed") t({round:"ed"},"Apply Early Decision instead");
  if(o.rec1<4) t({rec1:4},"Cultivate one superlative teacher letter");
  if(o.spike<3) t({spike:3},"Make the profile point one direction");
  cands.sort((a,b)=>b[0]-a[0]);
  if(cands.length){
    L.push("  HIGHEST-LEVERAGE CHANGES        (modelled effect on admit probability)");
    cands.slice(0,5).forEach(([d,lab,p2],i)=>
      L.push("    " + (i+1) + ". " + pad(lab,44) + (R.p*100).toFixed(1) + "% → " + (p2*100).toFixed(1) + "%"));
    L.push("");
  }

  if(!R.E.empty){
    const e = R.E;
    L.push("  ESSAY DIAGNOSTIC     " + e.score + "/100     " + e.words + " words");
    L.push("    concrete markers  " + e.concrete.toFixed(1) + "/100w" + (e.concrete<2.4?"   ← thin, reads abstract":"   ok"));
    L.push("    abstract words    " + e.abstract.toFixed(1) + "/100w" + (e.abstract>3.2?"   ← telling, not showing":"   ok"));
    L.push("    sentence variance " + e.sd.toFixed(1) + (e.sd<3.2?"        ← monotonous rhythm":"        ok"));
    L.push("    sentences on 'I'  " + Math.round(e.iRatio*100) + "%" + (e.iRatio>0.55?"        ← plodding":"        ok"));
    L.push("    opening           " + e.open.v);
    if(e.cliche.length) L.push("    clichés           " + e.cliche.join(" | "));
    if(e.crowded.length) L.push("    crowded topic     " + e.crowded.join(", "));
    if(!e.reflects) L.push("    reflection        little visible turn in the final third");
    if(e.flatEnd) L.push("    ending            flattens into a stated lesson");
    L.push("");
  }
  return L.join("\n");
}

const arg = process.argv[2];
if(!arg){ console.error("usage: node run.js profile.json"); process.exit(1); }
console.log(report(JSON.parse(fs.readFileSync(arg,"utf8"))));
