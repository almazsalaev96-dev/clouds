/* The assembler, on its own. What the preview shows is this function's output,
   and what the console says about an error is this function's map, so both are
   checked here rather than through a browser.

     npx jiti test-web.ts */
import { assembleWeb, locate, webTemplate, ENTRY } from "./lib/web";
import type { CanvasFile } from "./lib/types";

let failed = 0;
const check = (p: boolean, l: string, d = "") => { if (!p) failed++; console.log(`${p ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };

const mk = (fs: { name: string; lang: string; content: string }[]): CanvasFile[] =>
  fs.map((f, i) => ({ id: String(i), canvasId: "c", order: i, createdAt: 0, updatedAt: 0, ...f }));

console.log("\nA folder becomes one document");
{
  const { html } = assembleWeb(mk(webTemplate()), "dark", "r1");
  check(!/<link\b/i.test(html), "the stylesheet is inlined rather than linked to a file that is not there");
  check(!/<script[^>]*\bsrc=/i.test(html), "and so is the script");
  check(html.includes("__armiConsole"), "the bridge is in it, so an error has somewhere to go");
  check(html.indexOf("__armiConsole") < html.indexOf("<body"),
    "and it is first, so it catches an error thrown by the page's own opening line");
}

console.log("\nEvery line of every file can be found again");
{
  /* The property that matters. A runtime error arrives as a line number in the
     assembled document, and the console turns it back into a file and a line
     you can go to — so every line of every file has to survive the round trip.
     It used to be looked up by searching the finished string for each file's
     text, which found index.html never (the string had been rewritten by then)
     and found a file whose text occurred twice in the wrong place. */
  const files = mk(webTemplate());
  const { html, map } = assembleWeb(files, "dark", "r1");
  const docLines = html.split("\n");
  let checked = 0;
  let wrong: string | null = null;
  for (const f of files) {
    const own = f.content.split("\n");
    for (let i = 0; i < own.length; i++) {
      const text = own[i];
      // Blank and duplicated lines cannot be told apart by content; skip them.
      if (text.trim().length < 6) continue;
      if (own.filter((l) => l === text).length > 1) continue;
      const at = docLines.findIndex((l) => l === text);
      if (at === -1) continue;   // escaped, or not inlined
      const got = locate(map, at + 1);
      checked++;
      if (!got || got.name !== f.name || got.line !== i + 1) {
        wrong ??= `${f.name}:${i + 1} came back as ${got ? `${got.name}:${got.line}` : "nothing"} — ${JSON.stringify(text)}`;
      }
    }
  }
  check(!wrong, `${checked} lines across ${files.length} files each report their own file and line`, wrong ?? "");
  check(checked > 40, "and that is a real number of lines, not two", String(checked));
}

console.log("\nHTML as people actually write it");
{
  const files = mk([
    { name: ENTRY, lang: "html", content:
      "<!doctype html>\n<html>\n  <head>\n    <link rel=stylesheet href=style.css>\n    <script src=app.js defer></script>\n  </head>\n  <body>\n    <p id=\"t\">hi</p>\n  </body>\n</html>" },
    { name: "style.css", lang: "css", content: "p { color: red; }" },
    { name: "app.js", lang: "js", content: 'document.getElementById("t").textContent = "ran";' },
  ]);
  const { html } = assembleWeb(files, undefined, "r2");
  check(html.includes("color: red"), "an unquoted href is still an href — HTML has always allowed it");
  check(html.includes('getElementById("t")'), "and an unquoted src is still a src");
  const head = html.slice(0, html.toLowerCase().indexOf("<body"));
  check(!head.includes('getElementById("t")'),
    "a deferred script does not run in the head, where the element it wants does not exist yet");
  check(html.toLowerCase().indexOf('getelementbyid("t")') < html.toLowerCase().lastIndexOf("</body>"),
    "it runs at the end of the body, which is as close to `defer` as one document gets");
  check(!/<script[^>]*\bdefer/i.test(html), "and the attribute is gone, because it means nothing on an inline script");
}

console.log("\nNothing climbs out of the tag it was put in");
{
  const files = mk([
    { name: ENTRY, lang: "html", content: '<html><head><link rel=stylesheet href=style.css><script src=app.js></script></head><body>hi</body></html>' },
    { name: "style.css", lang: "css", content: "/* </style > */ p { color: red }" },
    { name: "app.js", lang: "js", content: 'var s = "</script >"; var t = "</SCRIPT\\n>";' },
  ]);
  const { html } = assembleWeb(files, undefined, "r3");
  /* A parser ends a script at `</script` followed by whitespace, a slash or a
     `>` — not at the literal `</script>`, which is all the old escape looked
     for. Counting the real terminators is the test: one per tag, no more. */
  const opens = (html.match(/<script\b/gi) ?? []).length;
  const closes = (html.match(/<\/script(?=[\s/>])/gi) ?? []).length;
  check(opens === closes, "every script tag has exactly one terminator", `${opens} open, ${closes} close`);
  const sOpens = (html.match(/<style\b/gi) ?? []).length;
  const sCloses = (html.match(/<\/style(?=[\s/>])/gi) ?? []).length;
  check(sOpens === sCloses, "and so does every style tag", `${sOpens} open, ${sCloses} close`);
  check(html.includes("color: red") && html.includes("var s ="), "with the text itself still there");
}

console.log("\nWhat is not in the folder is left alone");
{
  const files = mk([
    { name: ENTRY, lang: "html", content: '<html><head><script src="https://cdn.example.com/x.js"></script><link rel=stylesheet href="https://cdn.example.com/x.css"></head><body>hi</body></html>' },
  ]);
  const { html } = assembleWeb(files, undefined, "r4");
  check(html.includes('src="https://cdn.example.com/x.js"'), "a CDN script still reaches the CDN");
  check(html.includes('href="https://cdn.example.com/x.css"'), "and so does a CDN stylesheet");
}

console.log("\nAnd a line nobody wrote reports nothing");
{
  const { map } = assembleWeb(mk(webTemplate()), "dark", "r1");
  /* The bridge is a hundred and fifty lines of this app's code sitting inside
     the document. Saying "index.html line 40" about one of them would send
     somebody to a line of their own file that has nothing wrong with it. */
  const bridge = map.filter((m) => m.name === ENTRY && m.from > 3 && m.to < 150);
  check(bridge.length === 0, "the console bridge is claimed by no file of yours", JSON.stringify(bridge));
}

console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
process.exit(failed ? 1 : 0);
