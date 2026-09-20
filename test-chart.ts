/* The chart fence: what is accepted, where things land, and the two rules
 * that keep a bar chart honest — it starts at zero, and past four series the
 * rest become one rather than a fifth colour.
 *
 *   npx jiti test-chart.ts */
import { parseChart, niceTicks, layout, fold, fmt, barPath, BAR_MAX, MAX_SERIES } from "./lib/chart";

let failed = 0;
const check = (p: boolean, l: string, d = "") => { if (!p) failed++; console.log(`${p ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };

console.log("\nThe fence is read strictly, because a half-understood chart is worse than a code block");
{
  const ok = parseChart('{"type":"bar","x":["Q1","Q2"],"series":[{"name":"A","values":[1,2]}],"unit":"ms"}');
  check(ok?.type === "bar" && ok.x.length === 2 && ok.series[0].values[1] === 2, "the full shape is read");
  const short = parseChart('{"labels":["a","b","c"],"values":[3,"4",null]}');
  check(short?.series.length === 1 && short.series[0].values[1] === 4 && short.series[0].values[2] === null,
    "the short shape is one series, a numeric string is a number, and null is a gap");
  check(parseChart('{"x":["a"],"series":[{"name":"A","values":["lots"]}]}') === null, "a word where a number should be is refused");
  check(parseChart('{"x":["a","b"],"series":[{"name":"A","values":[1]}]}') === null, "a row of the wrong length is refused");
  check(parseChart('{"x":["a"],"series":[{"name":"A","values":[1]}],"type":"pie"}') === null, "and a shape this does not draw is refused rather than guessed at");
  check(parseChart("not json") === null && parseChart("[]") === null, "as is anything that is not an object");
}

console.log("\nPast four series, the rest become one");
{
  const s = Array.from({ length: 6 }, (_, i) => ({ name: `S${i}`, values: [i, i] }));
  const f = fold(s);
  check(f.length === MAX_SERIES, "four in all", String(f.length));
  check(f[3].name === "Other" && f[3].values[0] === 3 + 4 + 5, "the tail is summed into Other so the totals stay honest", String(f[3].values[0]));
  check(fold(s.slice(0, 4)).length === 4 && fold(s.slice(0, 4))[3].name === "S3", "and exactly four is left alone");
}

console.log("\nGridlines land where a person would have put them");
{
  check(niceTicks(0, 97).join(",") === "0,20,40,60,80,100", "0–97 gets 0,20,…,100", niceTicks(0, 97).join(","));
  check(niceTicks(0, 0.7).join(",") === "0,0.2,0.4,0.6,0.8", "and fractions are not rounded to nothing", niceTicks(0, 0.7).join(","));
  check(niceTicks(12, 97)[0] === 0, "a bar chart's ticks always include zero — a bar that does not start there is a lie about its own length");
  /* 12–97 on a step of 20 floors to 0 whatever the flag says — that is the
     ladder working, not the flag failing. The flag shows when the data sits
     well clear of zero. */
  check(niceTicks(112, 197, 4, false)[0] === 100, "a line chart may start where the data does — 112–197 opens at 100, not 0", String(niceTicks(112, 197, 4, false)[0]));
  check(niceTicks(-30, 50).includes(0), "and a range that crosses zero keeps it as a tick");
}

console.log("\nBars are marks, not stripes");
{
  const spec = parseChart('{"x":["a","b"],"series":[{"name":"A","values":[10,20]},{"name":"B","values":[5,25]}]}')!;
  const L = layout(spec, 600, 200);
  check(L.bars.every((b) => b.w <= BAR_MAX), "no bar is wider than the cap, however wide the slot", `max ${Math.max(...L.bars.map((b) => b.w)).toFixed(1)}px`);
  const a = L.bars.filter((b) => b.label === "a");
  check(a.length === 2 && a[1].x - (a[0].x + a[0].w) === 2, "with a two-pixel gap of surface between neighbours", `${(a[1].x - (a[0].x + a[0].w)).toFixed(1)}px`);
  check(L.bars.every((b) => Math.abs(b.y + b.h - L.baseline) < 1e-6), "every bar grows from the one baseline");
  const tallest = L.bars.reduce((m, b) => (b.value > m.value ? b : m));
  check(tallest.h > L.bars.filter((b) => b !== tallest).reduce((m, b) => Math.max(m, b.h), 0), "and the biggest value is the tallest bar");
  check(L.plot.y + L.plot.h < L.height, "the plot leaves room for the axis band, so the chart never scrolls to reach its own labels",
    `plot ends at ${L.plot.y + L.plot.h} of ${L.height}`);
  check(/^M.*Q.*Q.*Z$/.test(barPath(L.bars[0])) && barPath({ ...L.bars[0], h: 0 }) === "", "the outline rounds the data end and a zero-height bar draws nothing");
}

console.log("\nThe axis band fits its own labels");
{
  const narrow = layout(parseChart('{"x":["a","b"],"series":[{"name":"A","values":[1,4]}]}')!, 600, 200);
  const wide = layout(parseChart('{"x":["a","b"],"unit":"req","series":[{"name":"A","values":[1200,2600]}]}')!, 600, 200);
  check(wide.plot.x > narrow.plot.x, "a chart whose ticks read “2,500 req” leaves more room on the left than one whose ticks read “4”",
    `${narrow.plot.x}px vs ${wide.plot.x}px`);
  check(wide.plot.x >= "2,500 req".length * 6, "enough for the widest label at the tick font", `${wide.plot.x}px for 9 characters`);
  check(narrow.plot.x >= 28 && wide.plot.x <= 120, "and bounded either way, so a huge unit cannot eat the plot");
}

console.log("\nLines carry their gaps");
{
  const spec = parseChart('{"type":"line","x":["a","b","c"],"series":[{"name":"A","values":[1,null,3]}]}')!;
  const L = layout(spec, 600, 200);
  check(L.lines[0].length === 3 && Number.isNaN(L.lines[0][1].y), "a null is a point with no y, so the line breaks there instead of bridging it");
  check(L.bars.length === 0, "and a line chart has no bars");
}

console.log("\nValues read the way a person says them");
{
  check(fmt(1234567) === "1,234,567", "thousands grouped, the same in every locale", fmt(1234567));
  check(fmt(12.345) === "12.3" && fmt(0.456) === "0.46", "decimals kept where they matter", `${fmt(12.345)} · ${fmt(0.456)}`);
  check(fmt(300, "ms") === "300 ms" && fmt(12, "%") === "12%" && fmt(5, "£") === "£5", "units go where the unit goes", `${fmt(300, "ms")} · ${fmt(12, "%")} · ${fmt(5, "£")}`);
  check(fmt(null) === "—", "and a gap is a dash, not “null”");
}

console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
process.exit(failed ? 1 : 0);
