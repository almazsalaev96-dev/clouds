/**
 * Elevation, measured on the running app rather than read off the tokens.
 *
 *   node depth.mjs              # with the app running on :3100
 *
 * Depth in this app is a claim made in two halves. A cast shadow says a thing
 * is above the page; a rim — a lit edge on the side facing the light, a darker
 * one on the side facing away — says which way is up. Everything below is
 * about whether both halves survive the trip from the token to the pixel, and
 * nothing here trusts the stylesheet: every figure is `getComputedStyle` on an
 * element the app really renders.
 *
 * ## What it exists to catch
 *
 * Two defects, both of which shipped and neither of which any other gate could
 * see.
 *
 * The first is a cascade accident. `.glass` was written outside any `@layer`
 * and Tailwind's `shadow-lg` lives inside `@layer utilities`, so the unlayered
 * rule won regardless of specificity and *deleted* the drop shadow. Thirteen of
 * the fourteen surfaces in this app that ask for the top of the elevation ramp
 * are `.glass`: every dropdown, both message menus, all three composer
 * popovers, the palette, the shortcut sheet, the settings dialog, the undo bar,
 * the model picker. (The fourteenth is the selection toolbar, which names the
 * token directly rather than reaching it through the utility, so it was never
 * caught by this at all.)
 * Measured, `.glass.shadow-lg` computed to two inset rims and nothing else.
 * The class whose entire job is "this floats" was removing the float. A
 * screenshot review cannot catch that — the panel still looks like a panel.
 *
 * The second is arithmetic. Composited against its own ground, the dark
 * theme's three-step shadow ramp spanned four hundredths of a contrast ratio
 * while the light theme's spanned half a point, and the rim that carried the
 * dark theme was one value at all three levels. So the dark theme had a
 * three-step ramp in the tokens and a one-step ramp on the screen. That is the
 * same defect `theme-parity.mjs` exists to prevent for type, one layer down,
 * and nothing was measuring it.
 *
 * ## Why a ratio and not an alpha
 *
 * An alpha is not a cue. `rgb(0 0 0 / 0.7)` is a strong shadow on cream and
 * nearly nothing on a warm near-black, and reading the number tells you which
 * only if you already know the ground. So each layer is composited over the
 * surface it actually sits on and the result is compared with that surface —
 * the same luminance ratio the contrast gate uses, asking a different
 * question. It is not a WCAG figure and is not read as one; it is a unit for
 * "can an eye tell these apart", which is the whole question an elevation ramp
 * asks.
 */
import { chromium } from "playwright";

let bad = 0;
const check = (p, l, d = "") => { if (!p) bad++; console.log(`${p ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });

/* Parsed in the page, because only the page knows what a token resolves to.
   Splitting on top-level commas: a shadow list is comma-separated and every
   colour in it contains commas of its own. */
const PARSE = `(() => {
  const split = (s) => {
    const out = []; let d = 0, cur = "";
    for (const ch of s) {
      if (ch === "(") d++;
      if (ch === ")") d--;
      if (ch === "," && d === 0) { out.push(cur.trim()); cur = ""; } else cur += ch;
    }
    if (cur.trim()) out.push(cur.trim());
    return out;
  };
  const layer = (raw) => {
    const inset = /\\binset\\b/.test(raw);
    const colour = (raw.match(/(rgba?\\([^)]*\\)|#[0-9a-f]{3,8})/i) ?? [""])[0];
    const nums = raw.replace(/(rgba?\\([^)]*\\)|#[0-9a-f]{3,8})/gi, "").match(/-?[\\d.]+px/g) ?? [];
    const [x = 0, y = 0, blur = 0, spread = 0] = nums.map(parseFloat);
    return { raw, inset, colour, x, y, blur, spread,
             empty: /rgba\\(0, 0, 0, 0\\)/.test(colour) && !blur && !x && !y && !spread };
  };
  return { split, layer };
})()`;

const HELPERS = `(() => {
  const px = (c) => { const d = document.createElement("div"); d.style.color = c; document.body.appendChild(d); const r = getComputedStyle(d).color; d.remove(); const m = (r.match(/[\\d.]+/g) ?? [0,0,0]).map(Number); return [m[0], m[1], m[2], m[3] ?? 1]; };
  const lum = (rgb) => { const [r,g,b] = rgb.slice(0,3).map((x) => { x /= 255; return x <= 0.03928 ? x/12.92 : ((x+0.055)/1.055)**2.4; }); return 0.2126*r + 0.7152*g + 0.0722*b; };
  const ratio = (a, b) => { const l1 = lum(a), l2 = lum(b); return (Math.max(l1,l2)+0.05)/(Math.min(l1,l2)+0.05); };
  /* One colour laid over another at its own alpha. A shadow is not a grey
     object on the page, it is the page with less light reaching it. */
  const over = (fg, bg) => { const a = fg[3]; return [0,1,2].map((i) => fg[i]*a + bg[i]*(1-a)); };
  return { px, lum, ratio, over };
})()`;

for (const theme of ["light", "dark"]) {
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  await page.goto("http://localhost:3100", { waitUntil: "networkidle" });
  await page.evaluate((t) => localStorage.setItem("store.settings.v1", JSON.stringify({ state: { theme: t, density: "comfortable", modelId: "claude-sonnet-4-5", styleId: "normal", mode: "chat", sidebarOpen: true, sendOnEnter: true, showLineNumbers: false, wrapCode: false, keys: {}, params: {}, favorites: [], recentModels: [], systemPrompt: "", name: "Almaz", nameAsked: true }, version: 1 })), theme);
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(700);

  console.log(`\n${theme}`);

  /* ---------------------------------------------------------------- ramp -- */
  const ramp = await page.evaluate(([P, H]) => {
    const { split, layer } = eval(P);
    const { px, ratio, over } = eval(H);
    const cs = getComputedStyle(document.documentElement);
    const canvas = px(cs.getPropertyValue("--bg-canvas").trim());
    const surface = px(cs.getPropertyValue("--bg-surface").trim());

    const read = (cls) => {
      const d = document.createElement("div");
      d.className = cls;
      d.style.cssText = "width:80px;height:80px;position:fixed;top:-300px";
      document.body.appendChild(d);
      const raw = getComputedStyle(d).boxShadow;
      d.remove();
      return split(raw).map(layer).filter((l) => !l.empty);
    };

    const level = (cls) => {
      const ls = read(cls);
      const cast = ls.filter((l) => !l.inset);
      const rim = ls.filter((l) => l.inset);
      /* The strongest thing an eye has to go on at this level.
         The cast layers are composited as a *stack*, because that is how they
         render: three shadows at 0.07, 0.10 and 0.14 all overlap close to the
         element, and the darkest point of the result is what says "above".
         Reading them one at a time reports the light theme's ramp as almost
         flat, which is exactly wrong — it is the one theme whose ramp the
         shadow carries. The rims are taken individually, because they are
         different edges of the box and never overlap at all. */
      const stacked = cast.reduce((bg, l) => over(px(l.colour), bg), canvas);
      const cues = [
        cast.length ? ratio(stacked, canvas) : 1,
        ...rim.map((l) => ratio(over(px(l.colour), surface), surface)),
      ];
      return { layers: ls, cast, rim, cue: cues.length ? Math.max(...cues) : 1 };
    };
    return { sm: level("shadow-sm"), md: level("shadow-md"), lg: level("shadow-lg") };
  }, [PARSE, HELPERS]);

  const cue = (k) => ramp[k].cue;
  check(cue("sm") < cue("md") && cue("md") < cue("lg"),
    "the ramp ramps", ["sm", "md", "lg"].map((k) => cue(k).toFixed(3)).join(" < "));
  check(cue("md") - cue("sm") >= 0.15 && cue("lg") - cue("md") >= 0.15,
    "and every step is one an eye can see",
    `+${(cue("md") - cue("sm")).toFixed(3)}, +${(cue("lg") - cue("md")).toFixed(3)}`);

  for (const k of ["sm", "md", "lg"]) {
    check(ramp[k].cast.length > 0 && ramp[k].rim.length > 0,
      `${k} is a pair — a cast shadow and a rim`,
      `${ramp[k].cast.length} cast, ${ramp[k].rim.length} rim`);
  }

  /* --------------------------------------------------------- one source -- */
  const xs = ["sm", "md", "lg"].map((k) => Math.max(0, ...ramp[k].cast.map((l) => l.x)));
  check(xs[0] <= xs[1] && xs[1] <= xs[2] && xs[2] > 0,
    "the shadow slides further as the thing gets higher, which is what says how high it is",
    xs.join(" ≤ "));
  const wrongWay = await page.evaluate(([P, H, R]) => {
    const { px, lum } = eval(H);
    const cs = getComputedStyle(document.documentElement);
    const surface = lum(px(cs.getPropertyValue("--bg-surface").trim()));
    const out = [];
    for (const [k, lvl] of Object.entries(R)) {
      for (const l of lvl.rim) {
        const lighter = lum(px(l.colour)) > surface;
        // Lit edges face the source, up and to the left; shaded edges face away.
        if (lighter && (l.x < 0 || l.y < 0)) out.push(`${k}: a lit edge on the dark side`);
        if (!lighter && (l.x > 0 || l.y > 0)) out.push(`${k}: a shaded edge on the lit side`);
      }
      for (const l of lvl.cast) if (l.x < 0) out.push(`${k}: a shadow cast toward the light`);
    }
    return out;
  }, [PARSE, HELPERS, ramp]);
  check(wrongWay.length === 0, "and every edge agrees about where the light is", wrongWay.join("; "));

  /* ------------------------------------------- nothing eats the utility -- */
  /* The regression guard. Open every floating surface the app has and assert
     that anything asking for a level of the ramp actually renders one — the
     exact defect `.glass` shipped, where a panel said `shadow-lg` and drew no
     shadow at all. */
  /* Three of these live on a finished answer or on a conversation that exists,
     so there has to be one. An empty chat is where the first draft of this
     scan looked, which is why it reached three surfaces out of thirteen. */
  await page.getByRole("textbox", { name: "Message" }).fill("what is a debounce");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(3000);

  const openers = [
    { name: "the model picker", go: async () => { await page.getByRole("button", { name: /Sonnet|model/i }).first().click(); } },
    { name: "the command palette", go: async () => { await page.keyboard.press("Control+k"); } },
    { name: "the shortcuts sheet", go: async () => { await page.keyboard.press("?"); } },
    { name: "the conversation menu", go: async () => { await page.getByRole("button", { name: /Conversation options/i }).first().click(); } },
    { name: "the composer's own menu", go: async () => { await page.getByRole("button", { name: /Attach|Add a file|More/i }).first().click(); } },
    { name: "settings", go: async () => { await page.getByRole("button", { name: /Settings/i }).first().click(); } },
    { name: "a message's own menu", go: async () => { await page.getByRole("button", { name: /More actions/i }).first().click(); } },
  ];
  for (const o of openers) {
    let opened = true;
    await o.go().catch(() => { opened = false; });
    await page.waitForTimeout(420);
    /* A selector that has rotted leaves nothing on the screen, and a scan over
       nothing passes. That is the shape of a gate that goes green when it
       breaks, so the panel has to prove it is there before anything is read
       off it. */
    const panels = await page.evaluate(() =>
      [...document.querySelectorAll('[class*="shadow-lg"], [class*="shadow-md"]')]
        .filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; }).length);
    check(opened && panels > 0, `${o.name}: opened, with something floating on it`, `${panels} panels`);
    const flat = await page.evaluate(([P]) => {
      const { split, layer } = eval(P);
      const out = [];
      for (const el of document.querySelectorAll('[class*="shadow-sm"], [class*="shadow-md"], [class*="shadow-lg"]')) {
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) continue;
        const ls = split(getComputedStyle(el).boxShadow).map(layer).filter((l) => !l.empty);
        if (!ls.some((l) => !l.inset)) {
          const cls = (typeof el.className === "string" ? el.className : "").split(" ")[0];
          out.push(`${el.tagName.toLowerCase()}.${cls || "·"}`);
        }
      }
      return [...new Set(out)];
    }, [PARSE]);
    check(flat.length === 0, `${o.name}: everything that says it floats, floats`, flat.slice(0, 4).join(", "));
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
  }

  /* ------------------------------------------------------ no double rim -- */
  const doubled = await page.evaluate(([P]) => {
    const { split, layer } = eval(P);
    const out = [];
    for (const el of document.querySelectorAll("*")) {
      const raw = getComputedStyle(el).boxShadow;
      if (raw === "none" || !raw.includes("inset")) continue;
      const rims = split(raw).map(layer).filter((l) => l.inset && !l.empty);
      const at = rims.map((l) => `${l.x},${l.y},${l.blur},${l.spread}`);
      if (new Set(at).size !== at.length) {
        const cls = (typeof el.className === "string" ? el.className : "").split(" ")[0];
        out.push(`${el.tagName.toLowerCase()}.${cls || "·"}`);
      }
    }
    return [...new Set(out)];
  }, [PARSE]);
  /* Two rims at the same offset is the signature of a site that still pairs a
     rim by hand next to an elevation token that now carries its own. */
  check(doubled.length === 0, "and nothing paints the same edge twice", doubled.slice(0, 4).join(", "));

  /* ------------------------------------------------------- the escapes --- */
  const deleted = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--rim-top").trim());
  check(deleted === "", "the one-direction rim is deleted rather than left as a token controlling nothing", deleted);

  await page.emulateMedia({ forcedColors: "active" });
  await page.waitForTimeout(200);
  const forced = await page.evaluate(() => {
    const d = document.createElement("div"); d.className = "glass shadow-lg";
    d.style.cssText = "width:60px;height:60px;position:fixed;top:-300px";
    document.body.appendChild(d); const s = getComputedStyle(d).boxShadow; d.remove(); return s;
  });
  check(forced === "none", "under forced colours the OS owns the palette and the depth goes away", forced.slice(0, 40));
  await page.emulateMedia({ forcedColors: "none" });

  await page.emulateMedia({ contrast: "more" });
  await page.waitForTimeout(200);
  const strong = await page.evaluate(() => {
    const cs = getComputedStyle(document.documentElement);
    return { sm: cs.getPropertyValue("--rim-sm").trim(), lg: cs.getPropertyValue("--rim-lg").trim(), border: cs.getPropertyValue("--border-strong").trim() };
  });
  check(/inset 0(px)? 0(px)? 0(px)? 1px/.test(strong.sm) && strong.sm === strong.lg,
    "asked for more contrast, the rim gets stronger rather than disappearing", strong.lg.slice(0, 48));
  await page.emulateMedia({ contrast: "no-preference" });

  /* Through CDP, not `emulateMedia`. Playwright 1.63 accepts
     `{ reducedTransparency: "reduce" }` without throwing and does not apply it
     — `matchMedia` still reports no-preference — so a check written the
     obvious way measures the default state and cannot fail. Which is how the
     first draft of this file shipped a tautology here. */
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setEmulatedMedia", { media: "screen", features: [{ name: "prefers-reduced-transparency", value: "reduce" }] });
  await page.waitForTimeout(200);
  const seeThrough = await page.evaluate(() => {
    const d = document.createElement("div"); d.className = "glass";
    d.style.cssText = "width:60px;height:60px;position:fixed;top:-300px";
    document.body.appendChild(d); const s = getComputedStyle(d); const r = { shadow: s.boxShadow, blur: s.backdropFilter, asked: matchMedia("(prefers-reduced-transparency: reduce)").matches }; d.remove(); return r;
  });
  /* The emulation is asserted before the thing it enables. An earlier draft of
     this file emulated reduced *motion* here and labelled the check reduced
     transparency, which made it a tautology: `.glass` has a box-shadow in the
     default state, so it could not fail, and the regression the rule below
     exists to forbid would have sailed through green. */
  check(seeThrough.asked === true, "the preference is actually on before anything is read off it");
  check(seeThrough.blur === "none", "asked for less transparency the blur goes");
  check(seeThrough.shadow !== "none",
    "and the edge stays — that preference is about opacity, not about flatness");
  await cdp.send("Emulation.setEmulatedMedia", { media: "screen", features: [] });

  /* ------------------------------------------------------------ paper --- */
  await page.emulateMedia({ media: "print" });
  await page.waitForTimeout(250);
  const inked = await page.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll("*")) {
      const s = getComputedStyle(el).boxShadow;
      if (s && s !== "none") out.push((typeof el.className === "string" ? el.className : "").split(" ")[0] || el.tagName.toLowerCase());
    }
    return [...new Set(out)];
  });
  check(inked.length === 0, "on paper nothing floats, because there is nothing to float above", inked.slice(0, 4).join(", "));
  await page.emulateMedia({ media: "screen" });

  await page.close();
}

/* ------------------------------------------------- the two rooms agree -- */
console.log("\nboth themes");
{
  const span = {};
  for (const theme of ["light", "dark"]) {
    const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
    await page.goto("http://localhost:3100", { waitUntil: "networkidle" });
    await page.evaluate((t) => localStorage.setItem("store.settings.v1", JSON.stringify({ state: { theme: t, density: "comfortable", modelId: "claude-sonnet-4-5", sidebarOpen: false, sendOnEnter: true, showLineNumbers: false, wrapCode: false, keys: {}, params: {}, favorites: [], recentModels: [], systemPrompt: "", name: "Almaz", nameAsked: true }, version: 1 })), theme);
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(600);
    span[theme] = await page.evaluate(([P, H]) => {
      const { split, layer } = eval(P);
      const { px, ratio, over } = eval(H);
      const cs = getComputedStyle(document.documentElement);
      const canvas = px(cs.getPropertyValue("--bg-canvas").trim());
      const surface = px(cs.getPropertyValue("--bg-surface").trim());
      const cue = (cls) => {
        const d = document.createElement("div"); d.className = cls;
        d.style.cssText = "width:80px;height:80px;position:fixed;top:-300px";
        document.body.appendChild(d); const raw = getComputedStyle(d).boxShadow; d.remove();
        const ls = split(raw).map(layer).filter((l) => !l.empty);
        const stacked = ls.filter((l) => !l.inset).reduce((bg, l) => over(px(l.colour), bg), canvas);
        return Math.max(1, ratio(stacked, canvas),
          ...ls.filter((l) => l.inset).map((l) => ratio(over(px(l.colour), surface), surface)));
      };
      return cue("shadow-lg") - cue("shadow-sm");
    }, [PARSE, HELPERS]);
    await page.close();
  }
  const hi = Math.max(span.light, span.dark), lo = Math.min(span.light, span.dark);
  /* The doctrine `theme-parity.mjs` holds for type, one layer down. The two
     rooms are lit differently and may carry the ramp with different halves of
     the light — but one of them having twelve times the range of the other is
     not a choice, it is a theme nobody looked at. */
  check(hi / lo <= 2.5, "neither room has a flat ramp while the other has a deep one",
    `light ${span.light.toFixed(3)}, dark ${span.dark.toFixed(3)} — ${(hi / lo).toFixed(2)}×`);
}

await browser.close();
console.log(bad ? `\n  ${bad} failed` : "\n  depth PASS");
process.exit(bad ? 1 : 0);
