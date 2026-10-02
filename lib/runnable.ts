/**
 * Which code blocks can be run where they are, and the page that runs one.
 *
 * A fenced block of HTML, SVG, CSS or JavaScript in an answer is a thing
 * that can be seen working, and the other apps make the person copy it
 * out to see it. Here it runs under the block, in a frame with no origin
 * and no network — `sandbox="allow-scripts"` and a Content-Security-Policy
 * that lets nothing in — so a block the model wrote cannot read this app
 * or reach out of it. Python and the rest are not run: there is nothing
 * in a browser to run them with, and a Run that fails is worse than none.
 */
export type RunKind = "html" | "svg" | "css" | "js";

export function runKindOf(lang: string | undefined, code: string): RunKind | null {
  const l = (lang ?? "").toLowerCase();
  if (l === "html" || l === "htm" || l === "xhtml") return "html";
  if (l === "svg") return "svg";
  if (l === "css") return "css";
  if (l === "javascript" || l === "js" || l === "mjs") return "js";
  if (l === "xml" && /<svg[\s>]/i.test(code)) return "svg";
  /* Unlabelled, but plainly a page or a drawing. */
  if (!l && /^\s*(<!doctype html|<html[\s>])/i.test(code)) return "html";
  if (!l && /^\s*<svg[\s>]/i.test(code)) return "svg";
  return null;
}

/* Everything the frame may do, said once: no network, no frames of its
   own, no forms, scripts and styles only from the page itself. Images are
   allowed as data: so an SVG with an embedded picture still draws. */
const CSP = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:; media-src data:";

/**
 * The console bridge: `console.log`, `.warn`, `.error` and uncaught
 * errors are sent to the parent with the run's token, so output shows
 * under the block rather than in a devtools nobody has open.
 */
function bridge(token: string): string {
  return `<script>(function(){var T=${JSON.stringify(token)};function s(l,a){try{parent.postMessage({armiRun:T,level:l,text:Array.prototype.map.call(a,function(x){try{return typeof x==="string"?x:JSON.stringify(x)}catch(e){return String(x)}}).join(" ")},"*")}catch(e){}}
var c=window.console||{};["log","info","warn","error"].forEach(function(k){var o=c[k];c[k]=function(){s(k==="info"?"log":k,arguments);if(o)try{o.apply(c,arguments)}catch(e){}}});window.console=c;
window.onerror=function(m,u,l){s("error",[String(m)+(l?" (line "+l+")":"")]);};
window.addEventListener("unhandledrejection",function(e){s("error",[String(e.reason&&e.reason.message||e.reason)])});
window.addEventListener("load",function(){try{parent.postMessage({armiRun:T,level:"done",text:""},"*")}catch(e){}});
})();</script>`;
}

/** The whole page the frame shows, for one run. */
export function runDocument(kind: RunKind, code: string, token: string): string {
  const head = `<meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${CSP}">${bridge(token)}`;
  const base = `<style>html,body{margin:0;padding:12px;font:14px/1.5 system-ui,sans-serif;color:#111;background:#fff}</style>`;
  if (kind === "html") {
    /* A whole document keeps its own head; a fragment gets one. */
    if (/<html[\s>]/i.test(code)) return code.replace(/<head[^>]*>/i, (m) => `${m}${head}`).replace(/^(\s*<!doctype[^>]*>)?\s*<html/i, (m) => m) || code;
    return `<!doctype html><html><head>${head}${base}</head><body>${code}</body></html>`;
  }
  if (kind === "svg") return `<!doctype html><html><head>${head}<style>html,body{margin:0;background:#fff;display:grid;place-items:center;min-height:100vh}svg{max-width:100%;height:auto}</style></head><body>${code}</body></html>`;
  if (kind === "css") return `<!doctype html><html><head>${head}${base}<style>${code}</style></head><body><h1>Heading</h1><p>A paragraph with <a href="#">a link</a>, <strong>bold</strong> and <em>italic</em> text.</p><button>Button</button> <input placeholder="Input"><ul><li>One</li><li>Two</li></ul><div class="box card container">A div with class “box”, “card” and “container”.</div></body></html>`;
  /* JavaScript: the output is what it prints; a page that prints nothing
     says so rather than staying blank. */
  return `<!doctype html><html><head>${head}${base}<style>#out{white-space:pre-wrap;font:13px/1.5 ui-monospace,monospace}</style></head><body><div id="out"></div><script>
(function(){var out=document.getElementById("out");var any=false;["log","warn","error"].forEach(function(k){var o=console[k];console[k]=function(){any=true;var d=document.createElement("div");d.textContent=Array.prototype.map.call(arguments,function(x){try{return typeof x==="string"?x:JSON.stringify(x)}catch(e){return String(x)}}).join(" ");if(k!=="log")d.style.color=k==="error"?"#b91c1c":"#92400e";out.appendChild(d);o.apply(console,arguments)}});
window.addEventListener("load",function(){setTimeout(function(){if(!any&&!document.body.children.length>1&&!out.children.length){var d=document.createElement("div");d.style.color="#6b7280";d.textContent="Ran — it printed nothing. Use console.log to see values.";out.appendChild(d)}},50)});})();
</script><script>${code.replace(/<\/script/gi, "<\\/script")}</script></body></html>`;
}
