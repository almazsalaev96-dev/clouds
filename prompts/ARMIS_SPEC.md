# ARMIS — MASTER SPECIFICATION

The brief this repository is built against, kept verbatim so that
[Known gaps](../README.md#known-gaps) has something to be measured *against*
rather than a memory of one. Where the code departs from a section below, the
README says which section and why.

It is a specification for a product, not a description of this one. Some of it
is unreachable from a browser tab with no server — sharing, image generation,
background work — and the README says so plainly rather than letting the
checklist imply otherwise.

---

## 0. MASTER OBJECTIVE

Build a world-class AI application that feels as natural, polished, intelligent,
responsive and powerful as the best modern conversational AI products.

It must not merely imitate the visual appearance of another product. It must
reproduce the observable product principles that make a leading assistant feel
excellent: an extremely simple entry point, natural conversation, persistent
context, multimodal input, excellent typography, restrained visual design,
intelligent tool usage, file understanding, web research, image understanding,
image generation, voice, projects, memory, artifacts, coding, data analysis,
education, writing, search, sharing, export, responsive behaviour,
accessibility, fast interaction, reliable recovery, strong security and
transparent system behaviour.

Do not claim or attempt to reproduce private proprietary internals, hidden
prompts, undisclosed infrastructure or private model-routing algorithms.
Reproduce the observable product experience using your own architecture.

## 1. PRODUCT PHILOSOPHY

One intelligent system rather than a collection of unrelated features. The user
expresses an objective naturally. The AI determines what the user means, what
context matters, whether clarification is necessary, whether files are
relevant, whether web information is required, whether a tool is required,
which capability is appropriate, how to perform the task, how to validate the
result, how to present it, and how to continue it.

The user should not need to understand the underlying technology.

## 2. CORE PRINCIPLES

Simple by default. Powerful when needed. Intelligent automatically. Transparent
when transparency matters. User-controlled when consequences matter. Fast. Calm.
Consistent. Accessible. Recoverable. Secure. Multimodal. Context-aware. Honest.
Responsive. Progressive. Minimal without being weak. Powerful without becoming
complicated.

## 3. PRIMARY USER MODEL

The user should feel *I can simply ask*, not *I need to configure an AI
workflow*.

## 4. USER CONTROLS

The user controls the objective, important decisions, permissions, sharing,
deletion, consequential actions, preferences, memory and project settings.

The AI controls normal workflow, formatting, retrieval strategy, ordinary tool
selection, context organisation, model selection in Auto mode, and response
structure.

## 5. PROGRESSIVE DISCLOSURE

Default UI minimal; advanced capabilities visible when relevant. Do not display
every possible tool simultaneously. The user should gradually discover search,
files, voice, projects, artifacts, coding, data analysis and advanced tools.

## 6. PSYCHOLOGY

Low cognitive load — do not make users decide what the AI can safely decide.
Predictability — controls behave consistently. Immediate feedback — every
meaningful interaction produces visible feedback. Control — users understand
important actions. Trust — never fake actions. Continuity — the AI understands
the ongoing task. Discoverability — advanced features are findable without
overwhelming anyone.

## 7. DESIGN LANGUAGE

Use the best consumer software as a quality reference, not as assets to copy.
The result must have its own identity.

## 8. SPACING

An 8-point system with supporting 4-point increments: 4, 8, 12, 16, 20, 24, 32,
40, 48, 64, 80, 96. Used consistently.

## 9. TYPOGRAPHY

SF Pro, Inter, Geist, system UI; fallback system sans-serif. Weights 400, 500,
600, 700. Avoid excessive font-weight variation.

## 10. TYPE SCALE

11–12 px caption · 13–14 px secondary UI · 15–17 px body · 18–20 px subheading ·
24–28 px heading · 32–36 px large heading · 40–48 px display. Default body 16 px.

## 11. LINE HEIGHT

Body ~1.5–1.7. Headings ~1.15–1.3. Code ~1.45–1.6.

## 12. LIGHT THEME

Background `#FFFFFF` · Secondary `#F7F7F8` · Surface `#F1F1F3` · Primary text
`#1F1F1F` · Secondary text `#6B6B6B` · Muted text `#8A8A8A` · Border `#E8E8E8` ·
Hover `#F2F2F2` · Accent `#2563EB` · Success `#16A34A` · Warning `#D97706` ·
Error `#DC2626`.

## 13. DARK THEME

Background `#0D0D0D` · Secondary `#141414` · Surface `#1B1B1B` · Primary text
`#F5F5F5` · Secondary text `#B5B5B5` · Muted text `#858585` · Border `#292929` ·
Hover `#202020` · Accent `#4F8CFF` · Success `#32D583` · Warning `#F5B041` ·
Error `#FF6B6B`.

Do not simply invert light. Dark must be deliberately designed.

## 14. COLOR RULES

Semantic tokens, never hardcoded colours scattered through the codebase:
`background.primary`, `background.secondary`, `surface.primary`,
`surface.secondary`, `text.primary`, `text.secondary`, `text.muted`,
`border.default`, `border.strong`, `accent.primary`, `status.success`,
`status.warning`, `status.error`.

## 15. CONTRAST

Important text stays readable. Do not use extremely light grey for primary
information. Never rely on colour alone for success, failure, selection,
warnings or permissions.

## 16. BORDERS

1 px default. Stronger only where hierarchy requires it. Not every section needs
a visible border.

## 17. SHADOWS

Subtle. Very subtle elevation for popovers, medium for dialogs, stronger only
when floating above complex content.

## 18. RADIUS

6–8 px small controls · 8–12 px buttons and inputs · 12–16 px cards · 16–24 px
large containers and the composer · 999 px pills.

## 19. ICONS

One coherent family. 20 px common, 16 px small, 24 px large. Interactive target
approximately 44 × 44 px.

## 20. BREAKPOINTS

< 480 compact mobile · 480–767 mobile · 768–1023 tablet · 1024–1279 small
desktop · 1280–1439 desktop · 1440+ large desktop. Behaviour follows available
width, not a device name.

## 21. DESKTOP LAYOUT

Sidebar 280 px · collapsed 72 px · header 60 px · conversation 720–800 px (ideal
760) · composer 600–760 px (ideal 680).

## 22. LARGE DESKTOP

Do not stretch conversational text across the display. Unused space should
create calmness.

## 23. TABLET

Collapsible sidebar, larger content region, touch-friendly controls, optional
secondary panels.

## 24. IPAD

Portrait, landscape, split view, multitasking, trackpad, keyboard, Apple Pencil,
touch. For document workflows allow a document area plus an assistant panel of
roughly 280–360 px where space allows.

## 25. MOBILE

Conversation, composer, essential navigation, essential actions. Secondary
functionality moves into menus, sheets, drawers and overflow controls.

## 26. SAFE AREAS

Notches, Dynamic Island, home indicators, keyboard insets, iPad multitasking
boundaries. The composer must never be hidden behind the keyboard.

## 27. MOTION

Hover 100–150 ms · press 80–120 ms · dropdown 150–220 ms · sidebar 200–300 ms ·
modal 200–300 ms · page transition 200–350 ms · toast 180–250 ms · skeleton
cycle 1400–2000 ms. Appropriate easing. Avoid unnecessary motion.

## 28. REDUCED MOTION

Respect `prefers-reduced-motion`: replace large movement with opacity, a subtle
state change, or an instant transition.

## 29. APPLICATION STRUCTURE

```
App
├── Authentication
├── AppShell
│   ├── Sidebar
│   ├── Header
│   └── Main
│       ├── EmptyState
│       ├── Conversation
│       ├── Project
│       ├── Search
│       ├── Files
│       ├── Artifacts
│       └── Settings
└── Global overlays — modals, sheets, popovers, toasts, command menu
```

## 30. SIDEBAR

Expanded 280 px, collapsed 64–72 px. New Chat, Search, Projects, Recent
conversations, Pinned, Archived, Settings, Profile.

## 31. NEW CHAT

Creates the conversation, focuses the composer, preserves project context when
started inside a project, and resets temporary state appropriately. `⌘N`.

## 32. SEARCH

Reaches conversations, messages, projects, files and artifacts.

## 33. PROJECTS

Persistent workspaces holding instructions, conversations, files, artifacts,
memory and settings.

## 34. CONVERSATION LIST

Title, project indicator, pin indicator, overflow menu. Open, rename, pin,
unpin, archive, move, share, delete.

## 35. HOVER STATES

Secondary actions may appear on hover on desktop, without layout jumping.

## 36. MOBILE CONVERSATION ACTIONS

Long press, swipe where appropriate, overflow menu. Gestures are never the only
route to critical functionality.

## 37. SIDEBAR COLLAPSE

~200–300 ms. Icons stay centred. Tooltips for unfamiliar icons.

## 38. HEADER

56–64 px, ideally 60. Left: sidebar button, conversation or project identity.
Middle: optional model or mode selector. Right: share, temporary, more.

## 39. MODEL SELECTOR

Auto, Fast, Balanced, Reasoning, Advanced — names may vary. The behaviour must
be understandable, meaningful, honest and not unnecessarily technical.

## 40. AUTO MODE

Selects capability from complexity, reasoning, latency, files, vision, tools,
coding and task requirements.

## 41. TEMPORARY CHAT

Explicit visual status. It follows the product's defined retention rules and
must not silently behave like a normal persistent chat.

## 42. SHARE

Explain what becomes accessible before sharing. Never accidentally share
private project files, unrelated chats, hidden instructions, account metadata or
private memory.

## 43. EMPTY CHAT

A friendly greeting, a small set of useful suggestions, and nothing else. The
goal is *ask anything*.

## 44–47. COMPOSER

One box: text, multiline, attachments, images, PDF, documents, voice, tools,
web/search, drag and drop, clipboard paste, drafts, send, stop.

Collapsed 52–60 px, expanded ~80–120 px, maximum bounded by the viewport and
then scrolling internally. Padding ~12–16 px.

## 48. ATTACHMENT BUTTON

Upload file, upload image, camera, photo library, recent files — showing only
capabilities that actually exist.

## 49. DRAG AND DROP

Drag onto the composer with a clear drop target, and validate on drop.

## 50. CLIPBOARD

Pasted images become attachments where supported. Pasted text stays text. Very
large pasted content may become a document.

## 51. DRAFTS

Auto-saved while typing, on navigation, on suspension and on reload. Never lose
someone's writing.

## 52. SEND

Enter sends, Shift+Enter is a newline, and the user can change it.

## 53–55. SEND AND GENERATION STATES

Empty, disabled, ready, sending, generating, stopped, failed, retrying. During
generation Send becomes Stop, and Stop interrupts. A stopped answer keeps what
was generated, is marked interrupted, and offers Continue, Regenerate and Copy.

## 56. MESSAGE TYPES

User, assistant, system/internal UI state, tool activity, citation, artifact,
error. Internal system instructions are never exposed as ordinary user-visible
content.

## 57–60. MESSAGE LAYOUT

A user message carries text, attachments, an optional edit state and an optional
timestamp — and little metadata beyond that. An assistant message prioritises
the answer, then structure, then sources, then actions. User bubbles: padding
10–14 px, radius 12–16 px, max width 80–85%. Assistant content stays more open;
not every answer belongs in a card.

## 61–62. MESSAGE ACTIONS AND STATES

Copy, regenerate, continue, edit, feedback, more. Sending, sent, streaming,
completed, interrupted, failed, retrying, edited, deleted.

## 63. STREAMING

Render incrementally. Do not rerender the whole conversation per token. Batch UI
updates.

## 64. SCROLL

Follow generation when the user is at the bottom; never pull them down when they
have scrolled up. Offer *Jump to latest*.

## 65–68. COPY, EDIT, REGENERATE, CONTINUE

Copy takes exactly the relevant content, confirms, and handles failure; code
copies separately. Editing shows an editor with Cancel and Save & regenerate,
and never silently destroys the original. Regenerate produces a new version and
preserves the previous one as a branch. Continue resumes an incomplete response
rather than restarting the task.

## 69–74. RENDERING

Headings, paragraphs, bold, italic, lists, nested lists, links, quotes, code,
tables, equations, images and citations.

Code blocks: language label, copy, optional run, optional edit, optional
download; long code scrolls horizontally rather than wrapping awkwardly. Tables
are normal on desktop, scroll horizontally on mobile, and virtualise when large.
Equations render properly with a readable fallback. Links are recognisable and
their destination is never hidden.

## 75–81. FILES

Upload → validate → security scan → store → parse → OCR if necessary →
structure detection → chunk → index → ready.

States: selected, uploading, uploaded, scanning, processing, indexing, ready,
failed, unsupported, deleted, expired.

Validate size, MIME, the actual format, integrity and support — never the
filename extension alone. Extract a PDF's text, headings, pages, tables, images
and metadata, and preserve page references. OCR scanned PDFs, associating text
with its page, and never claim OCR is perfect. Retrieve relevantly from large
files using chunking, keyword search, embeddings, semantic retrieval, reranking
and metadata filtering. Recognise whether a question wants one page, one
section, a whole-document summary or a cross-document comparison, and retrieve
accordingly.

## 82–84. IMAGES

Understanding: upload → validate → normalise → vision analysis → task
interpretation → answer, recognising text, diagrams, equations, charts, UI,
objects and spatial relationships where possible.

Generation: request → intent → prompt construction → safety validation →
composition → generation → quality check → result.

Editing operates on an actual available image and preserves unchanged regions
unless the transformation requires otherwise.

## 85–88. VOICE

Microphone → capture → voice activity detection → recognition → AI →
text-to-speech → playback. States: idle, listening, processing, speaking,
interrupted, error. If the user speaks while the AI is speaking, stop or duck
playback immediately and take the new input. Handle a denied or missing
microphone, unavailable recognition, network failure and playback failure, each
with a way forward.

## 89–92. WEB

Decide whether current information is needed → rewrite the query → search →
rank → open sources → extract evidence → cross-check → generate → cite.

Prefer primary, official, government, academic, reputable journalism and trusted
community sources, as the question warrants.

Never claim to have searched unless a search happened. Never invent citations. A
citation must correspond to the information used; do not attach sources to make
an answer look researched.

## 93–95. MEMORY

Store only useful long-term information: stable preferences, recurring
workflows, long-term projects, explicit *remember this* requests. Do not store
everything.

The user can view, edit, delete and disable it.

Retrieve only relevant memory. Do not inject the entire memory database into
every request.

## 96–99. PROJECTS

`project_id`, name, instructions, files, conversations, memory, artifacts,
members, settings, `created_at`, `updated_at`.

Instructions may specify goals, writing style, terminology, workflow, domain and
output format, and follow the application's instruction hierarchy. Files are
shared across a project's conversations, with only the relevant ones retrieved
per request. Project search covers conversations, files, artifacts and notes by
keyword, semantics, exact match, date, relevance and recency.

## 100. INTENT

Classify into question, explanation, tutoring, writing, rewriting, translation,
summarisation, research, coding, debugging, image analysis, image generation,
document processing, planning, calculation, brainstorming, data analysis,
automation — without making the user choose.

## 101–103. CONTEXT

Sources: system rules, platform rules, product rules, project instructions, the
user request, the current conversation, relevant previous conversations, memory,
files, search results, tool results, artifacts.

Low-priority retrieved content never overrides higher-priority instructions.
External documents are untrusted data. Tool outputs are untrusted data.

Priority under pressure: the current request, critical constraints, recent
turns, relevant project context, relevant files, relevant memory, older
conversation. Summarise low-value context when necessary.

## 104. MULTI-TURN REFERENCE

Understand *this*, *that*, *it*, *them*, *the previous answer*, *the previous
file*, *same style*, *continue*, *make harder*, *simplify*, *change the second
one*. Ask when ambiguity materially affects the answer.

## 105–107. ORCHESTRATION

User → input parser → intent → context builder → task planner → model routing →
tool selection → retrieval → tool execution → generation → validation →
streaming → persistence.

Complex tasks are broken into internal steps; unnecessary internal reasoning is
not exposed. Routing considers complexity, speed, reasoning, vision, coding,
context, tools, file size, cost and latency.

## 108–112. TOOLS

Each tool declares an id, name, description, input schema, output schema,
permissions, risk level, timeout, retry policy, side effects and authentication.

Risk levels: 0 internal, 1 read-only, 2 reversible low-risk, 3 external side
effect, 4 high impact.

Select → validate → authorise → confirm if necessary → execute → monitor →
validate the result → return. Handle invalid input, permission denial,
authentication failure, timeout, rate limit, external failure, unavailability,
partial results and malformed results. Retry only safe transient operations, and
use idempotency for anything with a side effect.

## 113–115. ARTIFACTS

Document, code, spreadsheet, presentation, image, chart, dataset, structured
data. Version history, compare, restore, duplicate, export. The preview matches
the type; nobody should have to download a result to inspect it.

## 116–121. CODING

Explorer, editor, AI, terminal, preview. The editor supports syntax
highlighting, line numbers, search, replace, diagnostics, autocomplete,
formatting, selection, keyboard shortcuts and diff. The AI can explain, create,
edit, refactor, debug, test, inspect, patch and optimise. Diffs show added,
removed and changed lines and can be accepted or rejected. The terminal streams,
stops, clears, collapses, expands and reports exit status. The sandbox restricts
CPU, memory, filesystem, network, process creation and execution time.

## 122–124. DATA

Upload → inspect schema → detect types → validate → analyse → verify →
visualise → explain. Detect missing values, duplicates, wrong types, impossible
values, inconsistent values and suspicious data. Every chart has a title, useful
labels, readable axes, an appropriate scale and an accessible interpretation.
Do not create charts merely because data exists.

## 125–127. EDUCATION

Adapt to level, subject, objective, mistakes and requested depth. Offer explain,
simplify, hint, show steps, example, practice, quiz, check answer, make harder,
make easier, flashcards, summarise. Teach → practice → check → identify weakness
→ explain it → practice again.

## 128–129. WRITING

Understand audience, purpose, tone, length, language and format. Support
rewrite, shorten, expand, simplify, formalise, make friendly, proofread,
translate and change tone.

## 130–131. SEARCH AND COMMANDS

Global search by exact match, keyword, semantics, date, project, file, artifact
and conversation. A command menu for advanced users — new chat, search, open
project, open settings, toggle sidebar, start voice, upload file — fully
keyboard navigable.

## 132. SETTINGS

Account, appearance, general, AI, memory, voice, files, notifications, privacy,
security, data, integrations, keyboard, accessibility, about.

## 133. PERSONALITY

Affects wording, tone, verbosity and style. Never overrides truthfulness,
safety, system constraints or permissions.

## 134. NOTIFICATIONS

Background task completed, export completed, integration issue, account issue,
system issue. Avoid spam.

## 135–136. LONG TASKS

Queued, running, paused, completed, failed, cancelled. Show numerical progress
only when it is genuinely measurable; otherwise *Working…*. A task carries
`task_id`, `user_id`, `conversation_id`, type, status, progress, `created_at`,
`started_at`, `updated_at`, `completed_at`, error and result.

## 137–138. RESPONSE QUALITY

Before delivering, check factual consistency, the request, constraints,
calculations, citations, file references, formatting and missing requirements.
Do not expose private chain-of-thought. Say so when uncertain; do not
manufacture confidence.

## 139–141. ERRORS

An error carries a code, a user message, a technical message, whether it is
retryable, severity and a request id. Kinds: `AUTH_ERROR`, `PERMISSION_ERROR`,
`NETWORK_ERROR`, `RATE_LIMIT`, `MODEL_UNAVAILABLE`, `TOOL_ERROR`, `FILE_ERROR`,
`VALIDATION_ERROR`, `SERVER_ERROR`, `TIMEOUT`, `CANCELLED`. What the user sees
is simple and actionable, technical only where the detail helps, and offers
Retry where retry is safe.

## 142. OFFLINE

Cached conversations, drafts and local editing where practical.
Network-dependent capabilities clearly indicate that they are unavailable.

## 143–144. RESPONSIVE PRIORITY AND PENCIL

Mobile: conversation > composer > essential actions. Desktop: conversation plus
navigation plus workspace. iPad: conversation plus document plus an optional
assistant panel. Where supported, handwriting, drawing, PDF annotation,
selection and markup, interpreted where possible.

## 145–146. ACCESSIBILITY

VoiceOver, keyboard, screen readers, dynamic text, contrast, reduced motion,
focus management, semantic labels. Opening a modal moves focus into it; closing
returns focus to the trigger; Escape closes non-destructive overlays.

## 147–148. PERFORMANCE

Lazy loading, caching, virtualisation, incremental rendering, optimistic UI,
code splitting, compressed assets, efficient state. Safe operations — rename,
pin, archive — may update immediately and revert with an explanation if the
backend refuses.

## 149–152. DATA MODEL

Tables: users, sessions, conversations, messages, message_branches, attachments,
files, file_chunks, projects, project_members, project_files, memories,
memory_embeddings, tasks, tool_calls, tool_results, artifacts,
artifact_versions, shares, notifications, feedback, usage_records, audit_logs.

Conversation: id, user_id, project_id, title, model_preference, created_at,
updated_at, archived_at, deleted_at, temporary, metadata.

Message: id, conversation_id, parent_id, branch_id, role, content, status,
model, created_at, updated_at, metadata.

File: id, owner_id, project_id, name, mime_type, size, storage_key, status,
checksum, created_at, expires_at, metadata.

## 153–156. API

`POST/GET/PATCH/DELETE /conversations`, `/messages` and
`/messages/:id/regenerate|continue`, `/files`, `/projects`, `POST /search`,
`POST /tools/execute`.

Streaming events: `response.started`, `message.created`, `content.delta`,
`tool.started`, `tool.progress`, `tool.completed`, `citation.added`,
`artifact.created`, `response.completed`, `response.error`.

On disconnect: preserve visible content, reconnect, request missing events,
resume if supported, deduplicate, then complete or mark interrupted.
Side-effecting operations support idempotency keys.

## 157–168. SECURITY AND PRIVACY

Never put provider secrets in frontend code: frontend → your backend →
provider. The backend verifies ownership of every conversation, file, project,
artifact, task and share. One user must never reach another's conversations,
files, projects, memory or artifacts.

Treat websites, PDFs, uploaded documents, tool outputs and external data as
untrusted. Validate files, scan where appropriate, parse in isolation, sandbox,
limit resources, and never execute uploaded content as trusted application code.
Keep secrets out of bundles, repositories, logs, error messages and
client-visible responses. Sessions expire, rotate, log out, invalidate, store
securely and recover. Rate-limit login, chat, search, uploads, tools and
expensive generation. Audit security-sensitive actions — actor, action,
resource, time, result — without logging unnecessary private content.

Shared content is isolated from private project context, memory, account
information, hidden instructions and unrelated files. Define retention for
conversations, temporary chats, files, logs, analytics, deleted content and
artifacts. Define the account-deletion lifecycle, and do not claim immediate
physical deletion if backups retain data for a time.

## 169–174. API PLUMBING

Consistent errors — error, code, message, request_id, details, retryable.
Cursor pagination for dynamic collections. Index titles, message text, project
names, file metadata and artifact metadata. Cache only where safe, and never put
private data in a shared cache. Use workers for file processing, OCR, indexing,
large exports, long AI tasks and background jobs, with retry, timeout,
cancellation and dead-letter handling.

## 175–179. ARCHITECTURE

Frontend → API gateway → authentication, conversation service, AI orchestrator,
model gateway, file service, retrieval service, tool service, artifact service,
search service, notification service, analytics, database, object storage,
queue and workers. Do not create dozens of microservices prematurely.

Abstract providers behind your own model gateway. Keep system, platform,
product, project, user, retrieved information and tool output separate, and
version prompts. Record the model, version, configuration, tools used and
relevant execution metadata. Monitor latency, errors, model availability, tool
success, file processing, search latency, database performance and streaming
reliability.

## 180. PERFORMANCE TARGETS

Immediate interaction response, smooth scrolling, minimal unnecessary rerenders,
a responsive composer, fast navigation, efficient streaming, progressive file
processing. Frontend responsiveness matters as much as backend speed.

## 181–184. TESTING

Unit, integration, end-to-end, visual regression, accessibility, load, security,
AI evaluation.

Security: authentication bypass, authorisation bypass, IDOR, XSS, CSRF where
applicable, injection, prompt injection, file attacks, tool abuse, privilege
escalation, rate-limit bypass, session theft, cross-user data leakage.

Network: fast, slow, offline, reconnect, timeout, partial response, duplicate
request, lost event, server restart.

AI: simple question, complex reasoning, ambiguous request, long conversation,
file question, multiple files, web research, tool failure, model failure,
context overflow, contradictory context, prompt injection, partial completion.

## 185–188. UI STATES AND SURFACES

Every interactive component considers default, hover, focus, pressed, selected,
disabled, loading, success, error, empty, processing, offline and permission
denied.

Modals only when the user must focus on a decision; otherwise inline UI,
popovers, dropdowns or sheets. Toasts for copied, saved, exported, completed and
minor errors — never for critical information that must remain visible. Banners
for system-wide problems, account issues and important persistent warnings.

## 189–191. ONBOARDING AND DISCOVERY

No giant tutorial. Start immediately. Teach advanced features contextually and
only when useful. Advanced users get keyboard-driven commands.

## 192–194. INTERNATIONALISATION

Do not hard-code English assumptions. Support English, Russian, Uzbek and
others, and design for longer translations. Architecture supports right-to-left;
do not hard-code left and right where logical start and end belong. Localise
dates, times, numbers and currency.

## 195–198. MULTI-DEVICE

Sync conversations, projects, files, artifacts, settings and drafts where
supported. Detect conflicts rather than silently destroying newer content.
Drafts may be local and sync when the connection returns, with conflicts handled
explicitly. Let users control notification categories without configuring dozens
of useless ones.

## 199–201. ANALYTICS AND FEEDBACK

Measure activation, retention, feature usage, errors, latency and successful
task completion, without collecting unnecessary personal content. Measure answer
quality, tool accuracy, citation accuracy, file accuracy, task completion, user
corrections and regeneration frequency. Allow positive and negative feedback
with an optional explanation, attached to the response it is about.

## 202–206. LONG-RUNNING WORK

Show *Working…*, and a stage only if the stage is real. Tasks may continue when
the user leaves, and notify on completion. Cancellation stops future work,
preserves completed work, marks the task cancelled and prevents duplicate
execution. If four of five operations succeed, preserve the four, identify the
failure and allow retry. One capability failing must not take the rest of the
application with it.

## 207–209. QUALITY GATES

A response carries response_id, conversation_id, message_id, content, citations,
attachments, artifacts, tool_activity, usage, status, created_at.

For every action: can the user understand it, does the UI respond immediately,
is the next action obvious, can the user recover?

For every answer: did it understand the request, use relevant context, obey
constraints, invent nothing, actually use the tools it claims, cite real
sources, and produce something usable?

## 210–215. COMPONENT AND STATE ARCHITECTURE

The component tree runs App → Auth → AppShell (Sidebar, Header, Main) →
Conversation (MessageList, ScrollControls, Composer) plus Projects, Search,
Files, Artifacts, Settings, CommandMenu and the overlays.

Keep UI state, server state, conversation state, AI execution state, file state,
project state and user preference state separate rather than in one object.
UI state is `sidebarOpen`, `activeModal`, `composerFocused`, `selectedMessage`,
`theme`, `mobileMenuOpen`. Server state is conversations, projects, files,
artifacts, user, settings. AI state is idle, planning, searching, processing,
toolRunning, generating, completed, failed, cancelled. File state is selected,
uploading, processing, ready, failed, deleted.

## 216–222. DESIGN SYSTEM

Foundation: typography, colour, spacing, radius, elevation, icons, motion.
Controls: button, icon button, input, textarea, select, checkbox, switch, radio,
slider. Navigation: sidebar, tabs, breadcrumbs, command menu, pagination.
Feedback: toast, alert, banner, progress, skeleton, spinner, empty state. AI:
message, composer, tool activity, citation, artifact, voice, model selector.

Every reusable component has predictable props, controlled and uncontrolled
behaviour where appropriate, accessible labels, loading, disabled and error
states, responsive behaviour and theme support. Use tokens, not hardcoded
values. Themes change tokens, not component logic. Prefer fluid layouts, grid,
flexbox, min/max widths, logical properties and container queries over
device-specific hacks. Use skeletons only where the final structure is
predictable. Safe actions respond immediately and reverse on failure.

## 223–229. EMPTY, FAILED AND MISSING

Every collection has a useful empty state that says what is empty and what to do
next — never *nothing here*. No search results shows the query, the absence, an
alternative and a way to clear. A failed file shows its name, what failed,
whether retry works, and a way to remove it. A failed tool says something useful
without exposing internal infrastructure. A model fallback that materially
changes behaviour is communicated. A network failure preserves the draft, the
generated content and the user's state, and offers retry.

## 230–232. SECURITY AND OWNERSHIP UX

Security should be strong without being frightening. Ask for permissions when
they matter, explaining what, why, scope and duration. Users should understand
what belongs to them, what is shared, what is temporary and what can be deleted.

## 233–237. EXPORT AND SHARING

PDF, Markdown, plain text, DOCX, CSV, XLSX, PPTX, code, image — exposing only
formats actually implemented. States: preparing, generating, ready, failed.
Repeated clicks must not start duplicate downloads. Share links have a unique
id, access control, revocation and expiry where appropriate, and a shared page
contains only the shared content.

## 238–241. ACCOUNT AND INTEGRATIONS

Profile, authentication, sessions, preferences, data, privacy. Show active
sessions and devices where supported, with logout and revocation. Integrations
are disconnected, connecting, connected, expired, error or disconnecting, and a
failure says what failed, whether reconnection is required and what data is
affected.

## 242–243. COST AND FALLBACK

Use a lightweight capability for simple tasks and a stronger one for complex
reasoning; parallelise independent operations when safe. A configured, compatible
fallback provider may be used when one is unavailable — never silently sending
data to an unexpected provider.

## 244–250. QUALITY OF THE WORK ITSELF

Rank retrieved content by relevance, authority, recency and user context. Do not
blindly trust the first search result; cross-check what matters. Say so when
document parsing looks unreliable rather than answering confidently from
corrupted extraction. State the limitation when an image is too blurry, cropped,
unreadable or ambiguous. Compute numbers reliably, and check units and
arithmetic. Before presenting substantial code, check syntax, imports, obvious
logic, security and edge cases, and test it where execution is available. When
somebody is trying to learn, explain at their level rather than only handing
over the answer.

## 251–257. MEMORY, CONTEXT AND TRUST

Personalisation should improve usefulness without becoming intrusive. Do not
save secrets, passwords, API keys or unnecessary private information. More
context is not better context: retrieve the relevant, not the maximum.

Preserve branches when the user explores alternatives rather than forcing one
linear history, while keeping the architecture from overwhelming ordinary use.
Message metadata may include model, tool usage, timestamps, status, citations
and artifact references, with only the appropriate parts exposed. An optional
trust panel may show files used, sources, tools used, artifacts created and
external actions — displaying only activity that really happened.

## 258–264. THE TASK ENGINE

Goal → understand → clarify only if necessary → plan → gather → retrieve → use
tools → create → verify → deliver → iterate.

The user should not have to search, download, parse, extract, summarise, format
and export by hand when the AI can safely orchestrate it — while retaining
control over consequential actions. Long work becomes a persistent job that
survives a restart without duplicating side effects, with unique ids,
idempotency, explicit state transitions and retries. Impossible states are
unrepresentable: queued → running → completed, queued → cancelled, running →
cancelled, running → failed; never completed → running without a new execution.

## 265–276. DATA AND RELIABILITY

Transactions where related records change together. Foreign keys, unique
constraints, indexes and validation. Large files, images, exports and artifacts
live in object storage. Large files store chunks and indexes efficiently.
Temporary files expire, and temporary, persistent and deleted are clearly
distinguished. Invalidate caches when a resource changes. Prevent duplicate
messages, conflicting edits, double tool actions and stale overwrites. Every
important request carries a trace id. Retry only transient, safe, idempotent
operations. Every external call has a timeout. Unreliable dependencies get a
circuit breaker. A rate limit is explained, with retry timing where known.

## 277–284. OPERATIONS

Feature flags for beta features, experimental models, risky UI changes and
gradual deployment. A rollback strategy for every major deployment. Alerts on
error spikes, latency spikes, queue growth, database failures, model failures
and tool failures. Tested backups — one never restored is not known to work. A
defined disaster-recovery process with objectives. Collect only the data the
product needs. Structured logs with sensitive values redacted. Do not send full
conversation text into analytics.

## 285–292. QA

Accessibility: keyboard only, VoiceOver, screen reader, zoom, large text, high
contrast, reduced motion, touch.

Visual: 320, 375, 390, 430, 768, 1024, 1280, 1440 and 1920+.

Content: one word, a huge paragraph, a huge code block, a huge table, many
attachments, a long filename, unusual characters, emoji, multilingual text, RTL
text.

Errors: network failure, permission denial, timeout, malformed input,
unavailable dependency — for every feature.

Security: authorisation, authentication, session handling, file isolation,
prompt injection, tool injection, XSS, CSRF, IDOR, privilege escalation.

Performance: thousands of messages, many files, a large project, simultaneous
requests, a long streaming response, a large code file, a large dataset.

UX, for every feature: can I understand it, use it immediately, undo it, recover
from failure, find it again, and does it behave consistently?

Do not ship a feature because it works. It must also be understandable,
responsive, accessible, secure, recoverable, visually coherent and performant.

## 293. NEVER

Fake tool activity, fake search, fake citations, fake progress. Hide important
failures. Silently delete work. Expose private context or API keys. Overload the
interface, or make every feature visible at once. Require unnecessary
configuration. Make every interaction a modal, or every element a card. Use
excessive animation, random colours or mixed icon styles. Make buttons tiny.
Rely only on hover, or only on gestures. Treat mobile or accessibility as an
afterthought.

## 294–299. THE CHECKS THAT MATTER

Every screen: clear hierarchy, consistent spacing, typography and controls, a
clear primary action and clear secondary ones, enough whitespace, strong
contrast, responsive behaviour, accessible controls.

Every interaction: trigger, immediate feedback, state change, completion state,
failure state, recovery.

Every AI operation: intent, context, constraints, plan, execution, validation,
result.

Every tool: schema, authorisation, validation, execution, timeout, retry, result
validation, error handling, audit where appropriate.

Every file: upload, validation, security, processing, indexing, retrieval,
citation and page tracking, deletion.

Every project: instructions, files, chats, memory, artifacts, permissions,
search, settings.

## 300–302. WHAT IT SHOULD FEEL LIKE

Not *a website with an AI API connected to it* — a complete AI working
environment, where the interface disappears into the task. The user should not
have to think about models, tokens, retrieval, embeddings, tool schemas, queues,
APIs, databases or orchestration unless they want to. They should think *what do
I want to accomplish*, and say it.

Open the app → a calm interface → start → type, speak or upload → the AI
understands the intent, resolves the context, decides whether to ask, plans,
retrieves, uses tools if needed, creates, validates, streams → review, edit,
continue or regenerate → an artifact if one is warranted → save, export or share
→ carry on.

Fast. Quiet. Intelligent. Natural. Reliable. Powerful. Premium. Flexible.
Human-centred. Multimodal. Context-aware. Trustworthy.

## 303. FINAL PRINCIPLES

Do not make users operate the AI; let them operate the objective. Hide
complexity and reveal power progressively. Never fake capability, activity or
citations. Never silently perform consequential actions or destroy work.
Preserve context intelligently and user control absolutely. Make every
interaction responsive, every failure recoverable, every component accessible
and security architectural. Make memory selective, retrieval relevant, tools
permission-aware and files secure. Keep the interface calm and the advanced
parts discoverable. Make mobile first-class, desktop powerful and iPad
excellent. Make multimodal input natural, behaviour adaptive, and the system
honest about uncertainty. Prefer a coherent product to a feature-heavy one, and
optimise the whole experience rather than individual screens. Never sacrifice
usability for novelty, power for simplicity, or trust for appearance.

## 304. IN ONE SENTENCE

Build a calm, premium, AI-first universal workspace where people express
legitimate goals naturally, while the system understands context, plans
workflows, retrieves information, uses tools, processes files and images,
creates artifacts, validates results, remembers what is relevant, adapts to the
conversation, and keeps offering the simplest useful interface for whatever they
are trying to do.

## 305. DEFINITION OF DONE

Visual design system · light mode · dark mode · desktop · tablet · iPad · mobile
· sidebar · header · composer · message system · streaming · stop · regenerate ·
edit · continue · search · projects · memory · files · PDF processing · OCR ·
image understanding · image generation · voice · web and search · citations ·
tool system · artifact system · coding workspace · data analysis · education
workflows · writing workflows · export · sharing · notifications · background
tasks · offline handling · synchronisation · database · API · streaming recovery
· security · authentication · authorisation · privacy · accessibility ·
performance · observability · testing · AI evaluation · error recovery · backup
and recovery · internationalisation architecture · final visual QA · final
security QA · final performance QA · final AI quality QA.

---

## THE STANDARD

Do not judge the product by *does it look like the one I was thinking of*.
Judge it by:

> Can a person accomplish almost any legitimate task through natural
> conversation, while the interface stays simple enough that they never need to
> understand the complexity underneath?
