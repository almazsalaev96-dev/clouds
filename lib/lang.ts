/**
 * Which language a run of text is in, to the precision a script can tell you.
 *
 * Read aloud never set `utter.lang`, so the browser used whichever voice it
 * booted with and pronounced every answer as English. For an Arabic or
 * Japanese or Greek answer that is not an accent, it is noise — the voice is
 * applying English letter-to-sound rules to characters that have none.
 *
 * ## Why the script and not the language
 *
 * Telling Persian from Urdu from Arabic needs vocabulary; telling any of them
 * from English needs one character. This returns the script's most common
 * language, and where a script is shared it returns the one whose voice is
 * closest for the others — a Persian sentence read by an Arabic voice is
 * imperfect and comprehensible, where the same sentence read by an English
 * voice is not speech at all. The right precision is the one you can actually
 * reach.
 *
 * Undefined rather than "en" when nothing is found: an unset `lang` lets the
 * browser use the voice the person chose, which is a better default than this
 * file guessing on their behalf.
 */
const SCRIPTS: [RegExp, string][] = [
  [/\p{Script=Han}/u, "zh"],
  [/\p{Script=Hiragana}|\p{Script=Katakana}/u, "ja"],
  [/\p{Script=Hangul}/u, "ko"],
  [/\p{Script=Arabic}/u, "ar"],
  [/\p{Script=Hebrew}/u, "he"],
  [/\p{Script=Devanagari}/u, "hi"],
  [/\p{Script=Thai}/u, "th"],
  [/\p{Script=Greek}/u, "el"],
  [/\p{Script=Cyrillic}/u, "ru"],
];

/**
 * The share of non-space characters a script has to hold before it is the
 * language of the text.
 *
 * One Cyrillic character in an English paragraph is a name, a citation or a
 * quoted word, and switching the whole voice for it is worse than not
 * switching at all. Japanese is the reason it is not higher: a Japanese
 * sentence is routinely half Han characters and half kana, so either alone
 * clears a fifth and neither clears a half.
 */
const ENOUGH = 0.2;

export function guessLang(text: string): string | undefined {
  const body = text.replace(/\s+/g, "");
  if (body.length < 8) return undefined;
  let best: { lang: string; share: number } | undefined;
  for (const [re, lang] of SCRIPTS) {
    const all = new RegExp(re.source, "gu");
    const n = (body.match(all) ?? []).length;
    const share = n / body.length;
    if (share >= ENOUGH && (!best || share > best.share)) best = { lang, share };
  }
  // Japanese and Chinese share Han. Any kana at all settles it, because
  // Chinese has none — so a text that reached here as `zh` with kana in it was
  // always Japanese.
  if (best?.lang === "zh" && /\p{Script=Hiragana}|\p{Script=Katakana}/u.test(body)) return "ja";
  return best?.lang;
}
