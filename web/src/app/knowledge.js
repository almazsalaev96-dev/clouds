/**
 * The knowledge map, and the progress table behind it.
 *
 * Both are projections. Nothing on either screen is stored: the states are
 * recomputed from the event log every time the screen opens, which is what lets a
 * topic move backwards when it is forgotten and what makes deleting the evidence
 * delete the conclusion with it.
 */
import { el, add, icon, plural, relativeTime } from "./ui.js";
import * as store from "./store.js";
import { CONCEPTS, WORKSHEETS, conceptById } from "./bank.js";

const STATE_LABEL = {
  unseen: "Unknown", introduced: "Introduced", practicing: "Weak",
  developing: "Developing", reliable: "Strong", transferable: "Strong", mastered: "Mastered",
};
const STATE_TAG = {
  unseen: "unknown", introduced: "unknown", practicing: "weak",
  developing: "developing", reliable: "strong", transferable: "strong", mastered: "mastered",
};
const NODE_FILL = {
  mastered: ["var(--success-soft)", "var(--success)"],
  strong: ["var(--primary-soft)", "var(--primary)"],
  developing: ["var(--warning-soft)", "var(--warning)"],
  weak: ["var(--error-soft)", "var(--error)"],
  unknown: ["var(--sunken)", "var(--text-3)"],
};

/** Depth in the prerequisite graph, so foundations sit above what rests on them. */
function layers() {
  const depth = new Map();
  const resolve = (id, seen = new Set()) => {
    if (depth.has(id)) return depth.get(id);
    if (seen.has(id)) return 0;
    seen.add(id);
    const concept = conceptById[id];
    const d = !concept || !concept.prerequisites.length
      ? 0 : 1 + Math.max(...concept.prerequisites.map((p) => resolve(p, seen)));
    depth.set(id, d);
    return d;
  };
  for (const c of CONCEPTS) resolve(c.id);
  const rows = [];
  for (const c of CONCEPTS) {
    const d = depth.get(c.id);
    (rows[d] = rows[d] || []).push(c);
  }
  return rows;
}

export function subjects(app) {
  const view = store.project();
  const node = el("div", { class: "page stack g7" });
  const byId = Object.fromEntries(view.concepts.map((c) => [c.conceptId, c]));

  const covered = view.concepts.filter((c) => c.attempts > 0);
  const overall = covered.length
    ? covered.reduce((s, c) => s + c.pUnaided, 0) / covered.length : 0;

  add(node,
    el("header", { class: "stack g2" }, [
      el("h1", { class: "t-title", text: "Mathematics" }),
      el("p", { class: "t-2", style: { margin: 0 },
        text: covered.length
          ? `${Math.round(overall * 100)}% mastery across ${plural(covered.length, "topic")} with evidence.`
          : "No evidence yet. Answer a few questions and this map fills in." }),
    ]),
    el("section", { class: "card stack g4" }, [
      el("h2", { class: "t-section", text: "Knowledge map" }),
      el("p", { class: "t-2", style: { margin: 0 },
        text: "An arrow means the topic below rests on the one above it. A weak foundation is worth more of your time than the topic that failed." }),
      map(app, byId),
      el("div", { class: "row wrap" }, Object.entries(NODE_FILL).map(([state, [bg, fg]]) =>
        el("span", { class: "chip static", style: { background: bg, color: fg, borderColor: "transparent" } },
          state[0].toUpperCase() + state.slice(1)))),
    ]),
    el("section", { class: "stack g3" }, [
      el("h2", { class: "t-section", text: "Topics" }),
      el("div", { class: "card flat focus-list", style: { padding: "4px 12px" } },
        CONCEPTS.map((c) => {
          const v = byId[c.id];
          const state = v ? v.state : "unseen";
          const worksheet = WORKSHEETS.find((w) => w.conceptIds.includes(c.id));
          return el("button", {
            class: "focus", onclick: () => worksheet && app.openWorksheet(worksheet.id),
          }, [
            el("div", { class: "grow stack" }, [
              el("span", { style: { fontWeight: 600 }, text: c.name }),
              el("span", { class: "focus-why", text: v
                ? `${Math.round(v.pUnaided * 100)}% unaided · recall ${Math.round(v.retrievability * 100)}% · ${plural(v.attempts, "attempt")}`
                : "Not started" }),
            ]),
            el("span", { class: `tag ${STATE_TAG[state]}`, text: STATE_LABEL[state] }),
            el("span", { class: "dim-3", html: icon("chevron", 18) }),
          ]);
        })),
    ]),
  );
  return node;
}

function map(app, byId) {
  const rows = layers();
  const W = 640;
  const nodeW = 148;
  const nodeH = 54;
  const gapY = 92;
  const height = rows.length * gapY + 24;

  const place = new Map();
  rows.forEach((row, r) => {
    const step = W / (row.length + 1);
    row.forEach((c, i) => place.set(c.id, { x: step * (i + 1), y: 34 + r * gapY }));
  });

  const svg = [];
  for (const c of CONCEPTS) {
    for (const p of c.prerequisites) {
      const a = place.get(p);
      const b = place.get(c.id);
      if (!a || !b) continue;
      const mid = (a.y + nodeH / 2 + (b.y - nodeH / 2)) / 2;
      svg.push(`<path d="M${a.x} ${a.y + nodeH / 2} C ${a.x} ${mid}, ${b.x} ${mid}, ${b.x} ${b.y - nodeH / 2 - 4}" ` +
        `fill="none" stroke="var(--border-strong)" stroke-width="1.5"/>` +
        `<circle cx="${b.x}" cy="${b.y - nodeH / 2 - 3}" r="2.5" fill="var(--border-strong)"/>`);
    }
  }
  for (const c of CONCEPTS) {
    const at = place.get(c.id);
    const v = byId[c.id];
    const [bg, fg] = NODE_FILL[STATE_TAG[v ? v.state : "unseen"]];
    const label = c.name.length > 20 ? `${c.name.slice(0, 19)}…` : c.name;
    svg.push(
      `<g class="node-box" data-concept="${c.id}" role="button" tabindex="0">` +
      `<rect x="${at.x - nodeW / 2}" y="${at.y - nodeH / 2}" width="${nodeW}" height="${nodeH}" rx="12" ` +
      `fill="${bg}" stroke="${fg}" stroke-opacity=".35"/>` +
      `<text x="${at.x}" y="${at.y - 4}" text-anchor="middle" font-size="13" font-weight="600" fill="var(--text)">${label}</text>` +
      `<text x="${at.x}" y="${at.y + 14}" text-anchor="middle" font-size="11.5" fill="${fg}">` +
      `${v ? `${Math.round(v.pUnaided * 100)}% · ${STATE_LABEL[v.state]}` : "No evidence"}</text></g>`);
  }

  const node = el("div", { class: "map" });
  node.innerHTML = `<svg viewBox="0 0 ${W} ${height}" width="100%" height="${height}" role="img" ` +
    `aria-label="Knowledge map of mathematics topics">${svg.join("")}</svg>`;
  for (const g of node.querySelectorAll("[data-concept]")) {
    const open = () => {
      const w = WORKSHEETS.find((x) => x.conceptIds.includes(g.dataset.concept));
      if (w) app.openWorksheet(w.id);
    };
    g.addEventListener("click", open);
    g.addEventListener("keydown", (e) => { if (e.key === "Enter") open(); });
  }
  return node;
}

export function progress(app) {
  const view = store.project();
  const node = el("div", { class: "page stack g7" });

  add(node, el("header", { class: "stack g2" }, [
    el("h1", { class: "t-title", text: "Progress" }),
    el("p", { class: "t-2", style: { margin: 0 },
      text: "Evidence, not completion. Every number here is recomputed from your answers when this screen opens — none of it is stored." }),
  ]));

  if (!view.concepts.length) {
    add(node, el("div", { class: "card empty" }, [
      el("h2", { class: "t-section", text: "Nothing recorded yet" }),
      el("p", { text: "Answer a few questions and this becomes a picture of what you can do unaided, and what has started to fade." }),
    ]));
    return node;
  }

  add(node, el("section", { class: "card scroll-x" }, [
    el("table", { class: "table" }, [
      el("thead", {}, [el("tr", {}, ["Topic", "Unaided", "State", "Recall now", "Evidence", "Due"]
        .map((h) => el("th", { text: h })))]),
      el("tbody", {}, view.concepts.map((c) => el("tr", {}, [
        el("td", { text: c.name }),
        el("td", {}, [
          el("div", { class: "meter", style: { width: "72px" } }, [
            el("i", { style: { width: `${Math.round(c.pUnaided * 100)}%` } })]),
          el("span", { class: "t-2 num", text: `${Math.round(c.pUnaided * 100)}%` }),
        ]),
        el("td", {}, [
          el("span", { class: `tag ${STATE_TAG[c.state]}`, text: STATE_LABEL[c.state] }),
          c.needsReview ? el("span", { class: "t-2", text: ` was ${STATE_LABEL[c.freshState]}` }) : null,
        ]),
        el("td", { text: `${Math.round(c.retrievability * 100)}%` }),
        el("td", { text: `${plural(c.attempts, "attempt")}, ${c.independentCorrect} unaided` }),
        el("td", { text: c.overdueDays > 0 ? `${Math.floor(c.overdueDays)}d overdue` : relativeTime(c.dueAt) }),
      ]))),
    ]),
  ]));

  const runs = store.examRuns();
  if (runs.length) {
    add(node, el("section", { class: "stack g3" }, [
      el("h2", { class: "t-section", text: "Tests" }),
      el("div", { class: "card flat focus-list", style: { padding: "4px 12px" } },
        runs.slice(0, 5).map((r) => el("div", { class: "focus", style: { cursor: "default" } }, [
          el("div", { class: "grow stack" }, [
            el("span", { style: { fontWeight: 600 }, text: r.headline }),
            el("span", { class: "focus-why", text: `${r.correct} of ${r.total} correct · ${relativeTime(r.at)}` }),
          ]),
        ]))),
    ]));
  }

  add(node, el("section", { class: "card stack g3" }, [
    el("h2", { class: "t-section", text: "How these are worked out" }),
    el("ul", { class: "t-body dim", style: { margin: 0, paddingLeft: "20px" } }, [
      "Unaided is a Beta estimate over your attempts, weighted by how much help you took: an answer you were shown adds nothing to it.",
      "Recall is a forgetting curve fitted to your own review history, not a fixed schedule.",
      "A topic can go backwards. Mastery expires without review, because that is what memory does.",
      "Careless slips are separated from gaps, and do not count against ability.",
      "There are no streaks, no points and no daily target. Nothing here is designed to bring you back tomorrow.",
    ].map((t) => el("li", { text: t, style: { marginBottom: "6px" } }))),
  ]));

  return node;
}
