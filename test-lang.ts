/* Which voice reads the answer out loud.
 *
 * Read aloud never set `utter.lang`, so the browser used whichever voice it
 * booted with and applied English letter-to-sound rules to every answer. For an
 * Arabic or Japanese one that is not an accent — it is not speech.
 *
 * Both directions, as everywhere: the text that must switch the voice, and the
 * English paragraph with one foreign word in it that must not.
 *
 *   npx jiti test-lang.ts */
import { guessLang } from "./lib/lang";

let failed = 0;
const check = (p: boolean, l: string, d = "") => { if (!p) failed++; console.log(`${p ? "  \u2713" : "  \u2717"} ${l}${d ? " \u2014 " + d : ""}`); };

console.log("\nA text in one script is read in that language");
{
  const cases: [string, string][] = [
    ["\u0645\u0631\u062d\u0628\u0627 \u0628\u0643 \u0641\u064a \u0647\u0630\u0627 \u0627\u0644\u062a\u0637\u0628\u064a\u0642 \u0648\u0647\u0630\u0627 \u0634\u0631\u062d", "ar"],
    ["\u05e9\u05dc\u05d5\u05dd \u05d5\u05d1\u05e8\u05d5\u05da \u05d4\u05d1\u05d0 \u05dc\u05d0\u05e4\u05dc\u05d9\u05e7\u05e6\u05d9\u05d4 \u05d4\u05d6\u05d0\u05ea", "he"],
    ["\u3053\u308c\u306f\u30c7\u30d0\u30a6\u30f3\u30b9\u306e\u8aac\u660e\u3067\u3059\u3002\u3088\u304f\u8aad\u3093\u3067", "ja"],
    ["\u8fd9\u662f\u4e00\u4e2a\u5173\u4e8e\u9632\u6296\u7684\u89e3\u91ca\u8bf7\u4ed4\u7ec6\u9605\u8bfb\u8fd9\u6bb5", "zh"],
    ["\uc774\uac83\uc740 \ub514\ubc14\uc6b4\uc2a4\uc5d0 \ub300\ud55c \uc124\uba85\uc785\ub2c8\ub2e4", "ko"],
    ["\u042d\u0442\u043e \u043e\u0431\u044a\u044f\u0441\u043d\u0435\u043d\u0438\u0435 \u0442\u043e\u0433\u043e \u043a\u0430\u043a \u044d\u0442\u043e \u0440\u0430\u0431\u043e\u0442\u0430\u0435\u0442", "ru"],
    ["\u03b1\u03c5\u03c4\u03ae \u03b5\u03af\u03bd\u03b1\u03b9 \u03bc\u03b9\u03b1 \u03b5\u03be\u03ae\u03b3\u03b7\u03c3\u03b7 \u03c4\u03bf\u03c5 \u03c0\u03ce\u03c2 \u03bb\u03b5\u03b9\u03c4\u03bf\u03c5\u03c1\u03b3\u03b5\u03af", "el"],
    ["\u092f\u0939 \u0921\u093f\u092c\u093e\u0909\u0902\u0938 \u0915\u0947 \u0915\u093e\u092e \u0915\u0930\u0928\u0947 \u0915\u093e \u0935\u093f\u0935\u0930\u0923 \u0939\u0948", "hi"],
    ["\u0e19\u0e35\u0e48\u0e04\u0e37\u0e2d\u0e04\u0e33\u0e2d\u0e18\u0e34\u0e1a\u0e32\u0e22\u0e27\u0e48\u0e32\u0e21\u0e31\u0e19\u0e17\u0e33\u0e07\u0e32\u0e19\u0e2d\u0e22\u0e48\u0e32\u0e07\u0e44\u0e23", "th"],
  ];
  const NAME: Record<string, string> = { ar: "Arabic", he: "Hebrew", ja: "Japanese", zh: "Chinese", ko: "Korean", ru: "Russian", el: "Greek", hi: "Hindi", th: "Thai" };
  for (const [text, want] of cases) check(guessLang(text) === want, NAME[want], String(guessLang(text)));
}

console.log("\nAnd English stays English, however it is spelled");
{
  check(guessLang("A debounce waits for silence before it fires the call.") === undefined,
    "plain English gets no language, so the reader's own voice is kept");
  check(guessLang("Use the na\u00efve r\u00e9sum\u00e9 of the G\u00f6del\u2013L\u00f6b theorem.") === undefined,
    "and diacritics are still Latin script");
  const mixed = "The Russian word is \u0434\u043e\u043c, meaning house, and nothing more than that.";
  check(guessLang(mixed) === undefined, "one quoted foreign word does not switch the whole voice", String(guessLang(mixed)));
  check(guessLang("See the \u03c0 in the formula, and the \u0394 beside it, in this sentence.") === undefined,
    "and neither do a couple of maths symbols");
}

console.log("\nHan is shared, and kana is what settles it");
{
  const jp = "\u65e5\u672c\u8a9e\u306e\u8aac\u660e\u3067\u3059\u3002\u6f22\u5b57\u3068\u3072\u3089\u304c\u306a\u304c\u6df7\u3056\u3063\u3066";
  check(guessLang(jp) === "ja", "a text with kana in it is Japanese though most of it is Han", String(guessLang(jp)));
  const cn = "\u8fd9\u6bb5\u6587\u5b57\u5b8c\u5168\u7531\u6c49\u5b57\u7ec4\u6210\u6ca1\u6709\u5047\u540d\u5728\u91cc\u9762";
  check(guessLang(cn) === "zh", "and one with none is Chinese");
}

console.log("\nAnd it declines rather than guessing");
{
  check(guessLang("") === undefined, "nothing has no language");
  check(guessLang("\u0645\u0631\u062d\u0628\u0627") === undefined, "and neither does a fragment too short to tell");
  check(guessLang("42 + 7 = 49") === undefined, "and neither does arithmetic");
  for (const s of ["   ", "```\n```", "\ud83d\ude42".repeat(8), " ".repeat(20), "a".repeat(50000)]) {
    let ok = true;
    try { guessLang(s); } catch { ok = false; }
    check(ok, `survives ${JSON.stringify(s.slice(0, 12))}`);
  }
}

console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
process.exit(failed ? 1 : 0);
