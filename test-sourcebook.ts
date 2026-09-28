/**
 * A notebook of sources (lib/sourcebook.ts): the guide, the grounded chat's
 * instruction, the audio overview's script and voices, and reading a web page.
 *
 *   npx jiti test-sourcebook.ts
 */
import {
  audioPrompt, chatInstruction, guidePrompt, guideStale, htmlToText, isPrivateAddress, joinPrompt, material, minutesOf,
  pickVoices, readGuide, readScript, readSourceGuide, scriptText, speakChunks, suggestions,
} from "./lib/sourcebook";
import type { NotebookTurn } from "./lib/types";

let failed = 0;
const check = (c: boolean, l: string, d = "") => { if (!c) failed++; console.log(`${c ? "  ✓" : "  ✗"} ${l}${d ? " — " + d : ""}`); };

const src = [
  { id: "a", name: "Osmosis \"chapter\"", text: "Osmosis is the movement of water across a partially permeable membrane. ".repeat(40) },
  { id: "b", name: "Lecture", text: "Water potential of pure water is zero. ".repeat(40) },
];

console.log("\nThe material is fenced, named and cut to fit");
{
  const m = material(src, 8_000);
  check(/<source name="Osmosis 'chapter'">/.test(m) && /<source name="Lecture">/.test(m), "each source fenced by its name, quotes made safe");
  check(m.length < 9_000, "and the whole kept within the budget", String(m.length));
  check(/quoted as data/.test(guidePrompt(src)), "the guide prompt says the sources are data, not instructions");
}

console.log("\nThe guide is read, checked, and known to be out of date");
{
  const g = readGuide({ title: "Osmosis", summary: "About **osmosis**.", topics: ["A", "B", 3], questions: ["Q1?", "Q2?", "Q3?", "Q4?"] }, ["a", "b"], 1);
  check(g?.title === "Osmosis" && g.topics.length === 2 && g.questions.length === 3, "its parts, bounded", JSON.stringify(g));
  check(readGuide({ title: "", summary: "x" }, []) === null && readGuide("nope", []) === null, "a guide with no title or no summary is none");
  check(!guideStale(g!, ["b", "a"]), "the same sources in another order are the same sources");
  check(guideStale(g!, ["a"]) && guideStale(undefined, ["a"]), "a source removed, or no guide at all, is stale");
  check(readSourceGuide({ summary: "A book.", topics: ["x", "", 5] })?.topics.length === 1, "a source's guide keeps only real topics");
}

console.log("\nThe chat is grounded, remembers, and answers the way it was asked");
{
  const turn: NotebookTurn = { id: "1", q: "What is osmosis?", body: "The movement of water [1](#armi-cite-1).", citations: [], at: 0 };
  const plain = chatInstruction("And why?", {}, [turn]);
  check(/sources only: And why\?/.test(plain) && /Q: What is osmosis\?/.test(plain), "the question, with the conversation before it");
  check(!/armi-cite/.test(plain), "without the citation markers in the history");
  check(/tutor/.test(chatInstruction("x", { style: "guide" })), "a learning guide answers as a tutor");
  check(/like my teacher/.test(chatInstruction("x", { style: "custom", custom: "like my teacher" })), "a custom style is passed on");
  check(/three or four sentences/.test(chatInstruction("x", { length: "shorter" })) && /thorough/.test(chatInstruction("x", { length: "longer" })), "and the length");
  check(/say so in one line/.test(plain), "a question the sources do not answer is said to be one");
  const g = readGuide({ title: "T", summary: "S", questions: ["What is osmosis?", "Why zero?", "Turgid?"] }, [])!;
  check(suggestions(g, [turn]).join("|") === "Why zero?|Turgid?", "suggested questions leave out the ones already asked");
}

console.log("\nThe audio overview: two hosts, a script that reads, voices that differ");
{
  const p = audioPrompt(src, { format: "debate", length: "short", focus: "exam essentials" });
  check(/about 450 words/.test(p) && /argues one side/.test(p) && /exam essentials/.test(p), "format, length and focus reach the writer");
  check(/"Maya:" or "Theo:"/.test(p) && /no Markdown/.test(p), "and it is told to write for the ear, one host a line");
  const brief = audioPrompt(src, { format: "brief", length: "long" });
  check(/one host speaking, about 280 words/.test(brief) && /Only Maya speaks/.test(brief), "a brief is one voice, under two minutes, whatever the length");
  const lines = readScript("Intro music\nMaya: Hello and welcome.\n**Theo:** So what is it?\nIt is a good question.\nMAYA: Water moves.\nNarrator: ignored name\n");
  check(lines.length === 3 && lines[0].who === 0 && lines[1].who === 1 && lines[2].who === 0, "each line to its host", JSON.stringify(lines.map((l) => l.who)));
  check(/So what is it\? It is a good question\. Narrator: ignored name/.test(lines[1].text) === false && /good question/.test(lines[1].text), "a line with no host joins the turn before");
  check(!/\*/.test(lines[1].text), "and Markdown is taken out");
  check(minutesOf([{ who: 0, text: "word ".repeat(300) }]) === 2, "about 150 words a minute");
  check(speakChunks("One. Two. Three.", 8).length === 3 && speakChunks("One. Two.").length === 1, "long lines are spoken a sentence at a time, short ones whole");
  const two = pickVoices([{ name: "Basic en", lang: "en-US" }, { name: "Google UK English", lang: "en-GB" }, { name: "Fr", lang: "fr-FR" }], "en");
  check(two[0].voice?.name === "Google UK English" && two[1].voice?.name === "Basic en", "two different voices in the language, the natural one first");
  const one = pickVoices([{ name: "Only", lang: "en-US" }], "en");
  check(one[0].voice === one[1].voice && one[0].pitch !== one[1].pitch, "with one voice, two pitches");
  check(pickVoices([], "en")[0].voice === null, "and with none, no voice rather than a crash");
  const j = joinPrompt(src, [{ who: 0, text: "Hi." }, { who: 1, text: "So." }], 1, "What about plant cells?");
  check(/THE LISTENER ASKED\nWhat about plant cells\?/.test(j) && /Maya: Hi\./.test(j), "a listener's question goes with where the hosts were");
  check(/\*\*You:\*\* Q/.test(scriptText([{ who: 2, text: "Q" }])), "and in the transcript the listener is “You”");
}

console.log("\nA web page, read");
{
  const html = `<html><head><title>Osmosis &amp; you</title><script>evil()</script></head><body><nav>Menu Home</nav><article><h1>Osmosis</h1><p>Water moves&nbsp;across a membrane.</p><ul><li>One</li><li>Two</li></ul><!-- hidden --></article><footer>© site</footer></body></html>`;
  const r = htmlToText(html);
  check(r.title === "Osmosis & you", "the title, entities decoded", r.title);
  check(/# Osmosis/.test(r.text) && /Water moves across a membrane\./.test(r.text) && /- One/.test(r.text), "the article, with its headings and lists", JSON.stringify(r.text));
  check(!/evil|Menu|hidden|© site/.test(r.text), "without scripts, navigation, comments or the footer");
  check(htmlToText("<p>&#8212; &#x2014; &bogus;</p>").text === "— — &bogus;", "numeric entities decoded, unknown ones left");
}

console.log("\nA server is not sent to private addresses");
{
  for (const ip of ["127.0.0.1", "10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.169.254", "0.0.0.0", "100.64.0.1", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1", "224.0.0.1"]) {
    check(isPrivateAddress(ip), `${ip} is refused`);
  }
  for (const ip of ["8.8.8.8", "172.32.0.1", "142.250.72.14", "2606:4700::1111"]) {
    check(!isPrivateAddress(ip), `${ip} is public`);
  }
}

console.log(failed ? `\n  ${failed} failed` : "\n  all passed");
process.exit(failed ? 1 : 0);
