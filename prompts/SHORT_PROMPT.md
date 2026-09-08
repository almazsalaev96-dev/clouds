# SHORT PROMPT — for pasting into a chat window with a length limit

Use this when you cannot paste the full `MASTER_PROMPT.md`. It keeps the spine and
drops the detail. Prefer the full version whenever possible.

---

You are a founding product engineer with the taste of Linear, Arc and Things 3.

Build a **multi-model AI chat app**. I supply API keys for OpenAI, Anthropic, Google
Gemini and DeepSeek. That is the entire scope — no vertical niche, no domain content.

**The thesis:** every chat app has the same features. Features are commodity. We
compete only on *how it feels* — latency perception, motion, typography, density,
error handling. Craft is the whole product.

**Table stakes (build all, brag about none):** streaming with stop/resume, regenerate
(including with a different model), edit-message-forks-the-conversation with sibling
branch navigation, attachments and image paste, full GFM markdown, syntax-highlighted
code, KaTeX math, mermaid, conversation search and grouping, model picker with
per-model params, token/cost counters, light/dark, keyboard shortcuts, command
palette, export.

**Principles, in priority order:**
1. The interface disappears — remove anything that isn't earning its place.
2. Never make the user wait without telling them something true. Live elapsed
   timer + model name, not a spinner.
3. Optimistic always — user message and composer clear render before the network call.
4. Motion explains causality, never decorates. 120/180/240ms, 320ms max, nothing
   bounces, `prefers-reduced-motion` honored.
5. Zero layout shift during streaming. Scroll pin releases the moment the user
   scrolls up; a "Jump to latest" pill appears instead.
6. Every error: one plain sentence + one action button. Never a raw API string.
7. Progressive disclosure — three controls visible, everything else one click deeper.
8. Typography is the product: 15px body, 1.65 line-height, 68–72ch measure, tabular
   numerals, `text-wrap: pretty`.
9. Density is a setting: Compact / Comfortable / Spacious off one token scale.
10. Warm off-white in light mode (never #FFF page), `#141413` in dark (never #000),
    ~92% white text, 4.5:1 minimum everywhere.
11. Trust is a design material — say where keys live, never log them, make delete
    actually delete.

**Design tokens:** one neutral warm-grey scale, one accent (accent means "you can act
here"), radii 6/10/14/20, spacing on a 4px grid, shadows only on popovers and modals.
In dark mode express elevation with lighter surfaces, not shadows. Every value is a
CSS custom property — no hardcoded colors or sizes anywhere.

**Layout:** 260px collapsible sidebar · 48px top bar · 46rem centered message column ·
sticky composer · optional 320px right panel for long-output artifacts.

**Composer** gets disproportionate care: auto-grows smoothly to 40vh, send button
becomes stop in place via crossfade, per-conversation draft persistence with cursor
position, `↑` edits last message, model pill and live cost estimate in a quiet strip
below, mobile-viewport-aware so the keyboard never covers it.

**Code blocks** get a full spec: header bar with language + optional filename + wrap
toggle + copy; copy works mid-stream, excludes line numbers, swaps to a check for
1.6s with no toast and no layout shift; horizontal scroll inside the block so the
page never scrolls sideways; line numbers auto-on past 12 lines; diff fences get a
gutter glyph, not color alone; highlighting runs in a Web Worker on a 60ms trailing
debounce so streaming never flickers or drops scroll position.

**Messages:** user messages are right-aligned bubbles at 80% max width; assistant
messages have no bubble and sit on the canvas like a document. Model name and
generation time above each assistant message. Reasoning traces collapse to
`▸ Thought for 12s`. Long outputs offer to open in the right-hand artifact panel.

**Streaming psychology:** container appears at ~50ms with non-zero height and a
pulsing caret; tokens are buffered into a 16ms rAF loop so text reveals at a smooth
readable cadence (this feels faster than raw bursts even when it finishes later);
past 5s show a live counter; past 20s offer a faster model; on error keep every
streamed token and offer inline retry. Never clear the screen. Never lose partial
output.

**Multi-model:** one provider-adapter layer normalizing streams, roles, images, tools,
usage and errors — adding a fifth provider is one new file. `⌘/` picker grouped by
provider with context window, price and capability chips. Mid-conversation switching
is first-class, with an inline warning naming exactly what will be dropped if content
is incompatible. Side-by-side compare mode for 2–3 models with "keep this one" to
continue from a branch. Keys are server-side only, with a per-provider Test button.

**Stack:** Next.js App Router + TypeScript strict, Tailwind wired to the token scale,
Radix primitives, Zustand, SSE streaming through Edge routes with keys server-side,
IndexedDB (Dexie) as the local-first source of truth, Shiki in a worker,
react-markdown with a hardened sanitizer (never `dangerouslySetInnerHTML`),
virtualization past ~80 messages.

**Data model:** messages carry a `parentId`. The conversation is a tree rendered as a
linear path with sibling navigation. Nothing is ever destroyed. Build this on day one
— retrofitting it is a rewrite.

**Budgets (build-failing):** FCP < 1.0s, interactive composer < 1.5s,
keystroke-to-paint < 16ms with 5,000 messages loaded, zero CLS while streaming,
60fps on code-heavy streams, main bundle < 250KB gzipped.

**Accessibility:** WCAG 2.2 AA, full keyboard operation with visible `:focus-visible`,
message list as a polite ARIA log announcing completed messages not tokens, nothing
conveyed by color alone, tested with a screen reader before anything is called done.

**Do not:** gradients, glassmorphism, glow, emoji in UI, mascots, onboarding tours,
spinners where a skeleton fits, modals where inline fits, toasts where an in-place
change fits, more than one accent color, animations over 320ms, raw provider errors,
or any feature outside the scope above.

**Build order:** M0 tokens + themes + layout shell that already looks finished with
zero features — do not proceed until it beats ChatGPT on looks alone. M1 one model
end to end. M2 rendering depth. M3 conversation management + branching. M4 all four
providers + compare mode. M5 craft pass (micro-interactions, every empty/error state,
artifact panel, command palette). M6 accessibility, performance, hardening.

After each milestone, screenshot both themes at mobile and desktop width, critique
your own work against the principles above in writing, and fix what you find before
continuing.

Ask me at most three clarifying questions, and only about things that change the
architecture. Everything else: decide it yourself, note the decision, move on. I am
hiring your taste — do not hand the decisions back to me.

Start with M0.
