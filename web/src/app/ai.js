/**
 * The AI layer.
 *
 * The design rule this file exists to satisfy: the interface should understand
 * what the student is doing, rather than offer a button that opens a chatbot. So
 * everything here is contextual — the composer's own placeholder changes with what
 * is selected, the actions offered over a selection depend on what kind of thing
 * it is, and an answer arrives laid out editorially rather than as a chat bubble.
 *
 * There are two engines behind the same surface, and the difference is stated in
 * the interface rather than hidden:
 *
 *   · A tutor, when a gateway is configured. Credentials live on that gateway and
 *     never in this page, which is the whole reason the gateway exists.
 *   · Written help otherwise — a deterministic router over the question's authored
 *     explanation, the marker's actual finding about the student's last answer, and
 *     what the learning model knows about them. It is not a language model and does
 *     not pretend to be one, but everything it says is true of this student.
 */
import { el, add, icon, aiMark, pretty, plural } from "./ui.js";
import * as store from "./store.js";
import { questionById, conceptById } from "./bank.js";

// ------------------------------------------------------------------ context

/**
 * What the AI is currently looking at. The workspace keeps this up to date, and
 * every surface below reads from it — which is what makes "explain this" work with
 * nothing typed.
 */
export function describe(ctx) {
  if (!ctx) return { label: "this document", placeholder: "Ask about this document…" };
  switch (ctx.kind) {
    case "question":
      return { label: `question ${ctx.question.label}`, placeholder: "Ask about this question…" };
    case "working":
      return { label: `your working (${plural(ctx.strokeCount, "stroke")})`, placeholder: "Ask about your working…" };
    case "selection":
      return { label: "your selection", placeholder: "Ask about what you selected…" };
    case "page":
      return { label: `page ${ctx.pageIndex + 1}`, placeholder: "Ask about this page…" };
    default:
      return { label: "this document", placeholder: "Ask about this document…" };
  }
}

/** The actions worth offering for what is selected, most useful first. */
export function actionsFor(ctx) {
  if (!ctx) return [["explain", "Explain"], ["summarise", "Summarise"]];
  switch (ctx.kind) {
    case "question":
      return [["hint", "Hint"], ["explain", "Explain"], ["steps", "Show steps"],
              ["example", "Example"], ["quiz", "Quiz me"], ["answer", "Full answer"]];
    case "working":
      return [["check", "Check my work"], ["mistake", "Find my mistake"], ["explain", "Explain"]];
    case "selection":
      return [["explain", "Explain"], ["simplify", "Simplify"], ["quiz", "Quiz me"]];
    default:
      return [["explain", "Explain"], ["summarise", "Summarise"], ["quiz", "Quiz me"]];
  }
}

/** Chips shown once and then gone, so they never become permanent furniture. */
export function suggestionsFor(ctx, lastResult) {
  const out = [];
  if (lastResult && lastResult.verdict !== "correct") out.push(["mistake", "Why is this wrong?"]);
  if (ctx && ctx.kind === "question") {
    out.push(["hint", "Give me a hint"]);
    if (!lastResult) out.push(["explain", "Explain this"]);
  }
  if (ctx && ctx.kind === "working") out.push(["check", "Check my work"]);
  return out.slice(0, 3);
}

// ------------------------------------------------------------- the composer

export class Composer {
  constructor({ onAsk, getContext }) {
    this.onAsk = onAsk;
    this.getContext = getContext;
    this.input = el("input", {
      type: "text", autocomplete: "off", autocapitalize: "sentences",
      "aria-label": "Ask the tutor",
      onkeydown: (e) => { if (e.key === "Enter") this.submit(); },
      oninput: () => this.refresh(),
    });
    this.send = el("button", {
      class: "composer-send", "aria-label": "Send", disabled: true,
      onclick: () => this.submit(),
    }, [el("span", { html: icon("send", 18) })]);
    this.mic = el("button", {
      class: "composer-icon", "aria-label": "Ask by voice", onclick: () => this.voice(),
    }, [el("span", { html: icon("mic", 18) })]);
    this.mark = aiMark("idle");
    this.node = el("div", { class: "composer" }, [this.mark, this.input, this.mic, this.send]);
    this.refresh();
  }

  refresh() {
    this.input.placeholder = describe(this.getContext()).placeholder;
    this.send.disabled = this.input.value.trim().length === 0;
  }

  submit() {
    const text = this.input.value.trim();
    if (!text) return;
    this.input.value = "";
    this.refresh();
    this.onAsk({ intent: "ask", text });
  }

  thinking(on) { this.mark.className = `ai-mark ${on ? "thinking" : "idle"}`; }

  /**
   * Speech recognition is the browser's, and the spoken reply would be the
   * gateway's. Neither is invented here: where the browser has no recogniser the
   * control says so instead of miming a listening state.
   */
  voice() {
    const Recogniser = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recogniser) {
      this.onAsk({ intent: "voiceUnavailable" });
      return;
    }
    if (this.listening) { this.listening.stop(); return; }
    const rec = new Recogniser();
    rec.lang = navigator.language || "en-GB";
    rec.interimResults = true;
    rec.onresult = (e) => {
      this.input.value = [...e.results].map((r) => r[0].transcript).join("");
      this.refresh();
      if (e.results[e.results.length - 1].isFinal) this.submit();
    };
    rec.onend = () => { this.listening = null; this.mic.classList.remove("on"); };
    rec.onerror = () => { this.listening = null; this.mic.classList.remove("on"); };
    rec.start();
    this.listening = rec;
    this.mic.classList.add("on");
  }
}

// --------------------------------------------------------- context bubble

let openBubble = null;

/** A small floating menu over a selection, sized like a native context menu. */
export function bubble(container, at, actions, onPick) {
  dismissBubble();
  const node = el("div", { class: "bubble", role: "menu" });
  actions.slice(0, 4).forEach(([intent, label], i) => {
    add(node, i === 0 ? null : el("span", { class: "sep" }),
      el("button", {
        class: i === 0 ? "lead" : "", role: "menuitem",
        onclick: (e) => { e.stopPropagation(); dismissBubble(); onPick(intent); },
      }, label));
  });
  container.appendChild(node);
  const box = node.getBoundingClientRect();
  const host = container.getBoundingClientRect();
  node.style.left = `${Math.max(8, Math.min(at.x - box.width / 2, host.width - box.width - 8))}px`;
  node.style.top = `${Math.max(8, at.y - box.height - 10)}px`;
  openBubble = node;
  setTimeout(() => document.addEventListener("pointerdown", dismissBubble, { once: true }), 0);
  return node;
}

export function dismissBubble() {
  if (openBubble) { openBubble.remove(); openBubble = null; }
}

// ------------------------------------------------------------- the answer

/** Editorial layout: short, titled sections, never one long bubble. */
export function renderAnswer(answer) {
  return el("div", { class: "answer" }, [
    ...answer.blocks.map((b) => {
      if (b.kind === "steps") {
        return el("div", { class: "answer-block" }, [
          b.title ? el("h4", { text: b.title }) : null,
          el("ol", {}, b.items.map((s) => el("li", { class: "t-math", text: pretty(s) }))),
        ]);
      }
      if (b.kind === "note") {
        return el("div", { class: "answer-block" }, [
          b.title ? el("h4", { text: b.title }) : null,
          el("p", { class: "answer-note", text: b.text }),
        ]);
      }
      if (b.kind === "math") {
        return el("div", { class: "answer-block" }, [
          b.title ? el("h4", { text: b.title }) : null,
          el("p", { class: "t-math", text: pretty(b.text) }),
        ]);
      }
      return el("div", { class: "answer-block" }, [
        b.title ? el("h4", { text: b.title }) : null,
        el("p", { text: b.text }),
      ]);
    }),
    answer.followUps && answer.followUps.length
      ? el("div", { class: "row wrap" }, answer.followUps.map(([intent, label]) =>
          el("button", { class: "chip ai", dataset: { intent } }, label)))
      : null,
    el("p", { class: "answer-source", text: answer.source }),
  ]);
}

// ------------------------------------------------------- the local engine

const INTENTS = [
  [/\b(hint|nudge|stuck|where.*start|how do i start)\b/i, "hint"],
  [/\b(step|working out|show me how|method)\b/i, "steps"],
  [/\b(answer|solution|just tell me|solve it)\b/i, "answer"],
  [/\b(wrong|mistake|why.*(wrong|not right)|what did i do)\b/i, "mistake"],
  [/\b(check|is (this|that) right|am i right|mark)\b/i, "check"],
  [/\b(example|another one|similar)\b/i, "example"],
  [/\b(quiz|test me|practice)\b/i, "quiz"],
  [/\b(simpler|simplify|plainly|eli5|easier)\b/i, "simplify"],
  [/\b(summar|overview|what.*about)\b/i, "summarise"],
];

export function intentOf(text) {
  for (const [pattern, intent] of INTENTS) if (pattern.test(text)) return intent;
  return "explain";
}

const WRITTEN = "Written help — no tutor server connected, so this is drawn from this worksheet's own explanation and from your record, not generated.";

/**
 * The honest local answer. Everything it states is either authored alongside the
 * question or read out of the student's own log; nothing is invented.
 */
export function localAnswer(intent, ctx, extra = {}) {
  const q = ctx && ctx.question;
  const view = q ? store.project().concepts.find((c) => c.conceptId === q.conceptId) : null;
  const memory = q ? similarMistake(q, extra.result) : null;

  if (!q) {
    return {
      blocks: [{
        title: "What I can see", kind: "text",
        text: ctx && ctx.kind === "page"
          ? "This is a page you imported. Slate can read its text and structure, but explaining a question it has never seen needs the tutor server."
          : "Pick a question and I can explain that one, check your answer, or set you a similar problem.",
      }],
      followUps: [], source: WRITTEN,
    };
  }

  const blocks = [];
  const followUps = [];

  switch (intent) {
    case "hint":
      blocks.push({ title: "Where to start", kind: "text", text: q.nudge });
      blocks.push({ title: "If that is not enough", kind: "note", text: q.hint });
      followUps.push(["explain", "Explain why"], ["steps", "Show the steps"]);
      break;

    case "steps":
      blocks.push({ title: "The key idea", kind: "text", text: q.explain });
      blocks.push({ title: "Working", kind: "steps", items: q.steps });
      followUps.push(["example", "Give me another"], ["quiz", "Quiz me"]);
      break;

    case "answer":
      blocks.push({ title: "The answer", kind: "math", text: q.solution });
      blocks.push({ title: "How it is reached", kind: "steps", items: q.steps });
      blocks.push({
        title: "Worth knowing", kind: "note",
        text: "You asked for the answer, so this attempt will not count towards what you can do unaided. Nothing else changes, and nothing is withheld.",
      });
      followUps.push(["example", "Try a similar one"]);
      break;

    case "mistake":
    case "check": {
      const r = extra.result;
      if (!r) {
        blocks.push({ title: "Nothing to check yet", kind: "text", text: "Type your answer in the panel and press Check — the marker reads it as an expression, so 5, x = 5 and 10/2 all count." });
        break;
      }
      if (r.verdict === "correct") {
        blocks.push({ title: "That is right", kind: "text", text: r.reason });
        blocks.push({ title: "The idea behind it", kind: "text", text: q.explain });
        followUps.push(["quiz", "Try a harder one"]);
        break;
      }
      blocks.push({ title: "What you wrote", kind: "math", text: extra.submitted || "" });
      blocks.push({
        title: "What went wrong", kind: "text",
        text: extra.diagnosis ? [extra.diagnosis.right, extra.diagnosis.fix].filter(Boolean).join(" ") : r.reason,
      });
      blocks.push({ title: "The concept", kind: "text", text: q.explain });
      blocks.push({ title: "Try again", kind: "note", text: q.hint });
      followUps.push(["steps", "Show the steps"], ["answer", "Full answer"]);
      break;
    }

    case "example":
    case "quiz": {
      const other = siblingQuestion(q);
      if (other) {
        blocks.push({ title: intent === "quiz" ? "Try this" : "A similar one", kind: "math", text: other.prompt });
        blocks.push({ title: "Why this one", kind: "text", text: `Same idea as ${q.label}, different numbers. Open it on the page and write your working there.` });
      } else {
        blocks.push({ title: "Nothing similar on this worksheet", kind: "text", text: "Every question here tests a different step. The Progress screen will point you at whichever topic is weakest." });
      }
      break;
    }

    case "simplify":
      blocks.push({ title: "The short version", kind: "text", text: q.nudge });
      blocks.push({ title: "In one line", kind: "math", text: q.solution });
      break;

    case "summarise":
      blocks.push({
        title: "This question", kind: "text",
        text: `${q.prompt} It tests ${conceptById[q.conceptId].name.toLowerCase()}.`,
      });
      break;

    default:
      blocks.push({ title: "The key idea", kind: "text", text: q.explain });
      blocks.push({ title: "Where to start", kind: "text", text: q.nudge });
      followUps.push(["steps", "Show the steps"], ["quiz", "Quiz me"]);
  }

  if (memory) blocks.push({ title: "I have seen this before", kind: "note", text: memory });
  if (view && intent !== "answer") {
    blocks.push({
      title: "Where you are", kind: "text",
      text: `${view.name}: ${Math.round(view.pUnaided * 100)}% unaided over ${plural(view.attempts, "attempt")}, currently ${view.state}.`,
    });
  }
  return { blocks, followUps, source: WRITTEN };
}

/** Real memory: the same error type, on this topic, in the student's own log. */
function similarMistake(question, result) {
  if (!result || result.verdict === "correct") return null;
  const kind = result.nearMiss ? result.nearMiss.kind : null;
  const past = store.allEvents().filter((e) =>
    e.type === "attempt" && e.conceptId === question.conceptId &&
    e.questionId !== question.id && e.outcome !== "correct" && (kind ? e.nearMiss === kind : true));
  if (past.length < 1) return null;
  const when = new Date(past[past.length - 1].at).toLocaleDateString(undefined, { day: "numeric", month: "long" });
  return `You made the same kind of slip on ${plural(past.length, "earlier question")} in this topic, most recently on ${when}. That is a pattern rather than bad luck.`;
}

function siblingQuestion(question) {
  const family = Object.values(questionById).filter((x) =>
    x.conceptId === question.conceptId && x.id !== question.id);
  if (!family.length) return null;
  const done = new Set(store.allEvents().filter((e) => e.type === "attempt" && e.outcome === "correct")
    .map((e) => e.questionId));
  return family.find((x) => !done.has(x.id)) || family[0];
}

// ------------------------------------------------------------- the gateway

export async function askGateway(baseUrl, payload, signal) {
  const response = await fetch(`${baseUrl.replace(/\/+$/, "")}/v1/tutor`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify(payload), signal,
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`the tutor server answered ${response.status}${text ? `: ${text.slice(0, 160)}` : ""}`);
  }
  const data = await response.json();
  if (!data || !data.reply || typeof data.reply.message !== "string") {
    throw new Error("the tutor server's reply did not match the expected shape");
  }
  const reply = data.reply;
  const blocks = [{ title: "", kind: "text", text: reply.message }];
  if (reply.steps && reply.steps.length) {
    blocks.push({ title: "Working", kind: "steps", items: reply.steps.filter((s) => !s.isHidden).map((s) => s.text) });
  }
  if (reply.uncertainty) blocks.push({ title: "What I am unsure about", kind: "note", text: reply.uncertainty });
  return {
    blocks, followUps: [],
    source: `Tutor · confidence ${reply.confidence.toFixed(2)}`,
    mode: reply.mode,
  };
}
