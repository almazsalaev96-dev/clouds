# Technical Architecture for an Exam-Success AI Tutor: Multi-Model Orchestration, RAG over Textbooks & Past Papers, Tools, Cost and Compliance

*Research lens: technical architecture. Date of research: 6 September 2026. Method note: WebSearch budget for the session was exhausted after the first 8 queries (shared budget across parallel researchers), and the egress proxy blocked most third-party hosts (openai.com, ai.google.dev, api-docs.deepseek.com, openrouter.ai, huggingface.co, mathpix.com, turbopuffer.com, cohere.com, e2b.dev, etc.). Verified facts therefore come mainly from `platform.claude.com` (Anthropic docs, fetched in full), `cloud.google.com` (Vertex AI / Document AI / Speech pricing pages, downloaded and parsed locally), GitHub READMEs (primary sources for open-source tooling), PyPI/npm registries (version freshness), and the eight search-result summaries that did run. Anything else is marked **(prior knowledge, unverified)** or **(search snippet, not primary)**.*

---

## 0. Executive summary

1. **Four-provider line-up as of Sept 2026 (verified where marked):** Anthropic — Claude Fable 5.1 ($10/$50), Opus 5 ($5/$25, released 24 Jul 2026), Sonnet 5 ($2/$10, released 30 Jun 2026, introductory price made permanent), Haiku 4.5 ($1/$5); all 1M context except Haiku (200K); 128K max output (Haiku 64K) [S1][S2][S3][S4][S5]. Google — Gemini 3.1 Pro Preview ($2/$12 ≤200K; $4/$18 >200K), Gemini 3.8/3.7/3.6 Flash (introductory $0.75/$3.75 until 31 Dec 2026, then $1.50/$7.50), Gemini 3.5 Flash ($1.50/$9), 3.5 Flash-Lite ($0.30/$2.50), 3.1 Flash-Lite ($0.25/$1.50) [S10]. OpenAI — GPT-5.6 "Sol" ($5/$0.50 cached/$30), "Terra" ($2/$12), "Luna" ($0.20/$1.20), ~1.05M context, 128K output, reasoning effort default `medium` (search snippets only) [S20][S21][S22]. DeepSeek — V4-Pro (1.6T MoE, 49B active) and V4-Flash (284B, 13B active), 1M context, 384K max output, thinking + non-thinking modes, tool calls, JSON, OpenAI- and Anthropic-compatible APIs; list prices $0.435/$0.87 (Pro) and $0.14/$0.28 (Flash) with conflicting reports of peak/off-peak pricing after 16 Aug 2026 (search snippets only, contradictory) [S23][S24].
2. **Cache economics dominate everything.** Anthropic cache reads are 10% of input price (2.5% on Fable 5.1), 5-minute writes 1.25×, 1-hour writes 2×; minimum cacheable prefix is 512 tokens on Opus 5, 1,024 on Sonnet 5, 4,096 on Haiku 4.5 [S1][S6]. Cached tokens do not count toward Anthropic input-TPM rate limits [S7]. Gemini cached input is 10% of base and additionally charges cache storage per hour (search snippet: ~$1/M-tokens/hour Flash, $4.50 Pro — not verified on the Vertex page) [S11]. GPT-5.6 cached input is 90% off and cache writes cost 1.25× (snippet) [S21].
3. **Anthropic's own measured guidance says: caching + token trimming + `low` effort on a frontier model beats multi-model cascades for most workloads.** Prompt caching cut agent-loop cost 2.7–5.3×; `low` effort saved 33–50% on knowledge work for 1–3 accuracy points; multi-model pays only when task difficulty is bimodal (advisor pattern) or the corpus exceeds one context window (orchestrator pattern) [S8]. Our routing policy is therefore built on **one primary family per task class + effort tuning**, not on a per-token cheapest-model cascade.
4. **Recommended primary routing:** tutoring dialogue → Claude Sonnet 5 (effort low/medium, cached persona + syllabus); trivial turns → Haiku 4.5 or Gemini 3.5 Flash-Lite; essay/long-answer marking → Claude Opus 5 (effort high, structured outputs JSON per Assessment Objective) with GPT-5.6 Sol as calibration second-marker; math/STEM → Opus 5 or GPT-5.6 Sol with mandatory sandbox verification, DeepSeek V4-Pro (thinking) as low-cost second solver; vision/handwriting → Gemini 3.1 Pro / 3.8 Flash first, Claude Opus 5 high-res tier (2,576 px, 4,784 visual tokens) for dense worked solutions [S9]; whole-book reading → Gemini 1M (PDF pages billed as images) or Claude 1M with page-level citations; bulk jobs → Batch APIs (50% off) on Haiku 4.5 / Gemini Flash-Lite; voice → Gemini Live API; embeddings → Voyage 4 family (Anthropic's recommended provider) or Gemini Embedding ($0.15/M) [S12][S10].
5. **Cost per active student (own model, Section 6):** median student (~150 tutoring turns, 4 essays, 15 photo solves, 20 min voice per month) ≈ **$1.6–2.2/month** in model spend; heavy exam-season user (500 turns, 8 essays, 30 photos, 60 min voice) ≈ **$8–13/month**; without caching multiply chat costs by ~2.5×. A $15–20/month plan is viable only with per-tier quotas and forced routing for the heavy tail.
6. **Rate limits are not the bottleneck; spend caps are.** Anthropic Start tier caps monthly spend at $500, Build at $1,000, Scale at $200,000; Scale tier gives 10,000 RPM / 10M ITPM / 2M OTPM per model for Opus 5, Sonnet 5 and Haiku 4.5 [S7]. Get to Scale/Custom before launch marketing.
7. **Data residency is asymmetric:** Anthropic first-party offers only `inference_geo: "us"` or `"global"` (1.1× price for US-only) and workspace geo `"us"` only — **no EU inference geo** [S13]. Claude on Vertex AI has regional endpoints at +10% (Opus 5 $5.50/$27.50 regional vs $5.00/$25.00 global) [S10]. For EU/UK school contracts requiring EU processing, route Claude through Vertex regional endpoints (and Gemini "non-global" at +10%).
8. **PDF ingestion:** Claude accepts 600 pages / 32 MB per request (100 pages on 200K-context models), processes each page as text + image, ~1,500–3,000 text tokens per page plus image tokens; citations return 1-indexed page numbers; scanned PDFs without a text layer are not citable [S14][S15]. Gemini bills one PDF page as one image [S10]. For a permanent corpus, do not send PDFs to the LLM at query time — parse once, chunk structurally, store, retrieve.
9. **Parser choice (olmOCR-bench, verified table):** Chandra OCR 83.1, Infinity-Parser 82.5, olmOCR v0.4 82.4, PaddleOCR-VL 80.0, Marker 1.10 76.1, DeepSeek-OCR 75.7, MinerU 2.5 75.2, Mistral OCR API 72.0 overall; "Old Scans Math" is the weakest category for every tool (29–84) [S16]. Marker's own README puts Marker balanced at 76.0 vs Gemini 3.5 Flash 76.4 [S17]. **Implication: for past papers and textbooks use a two-pass pipeline — a local layout parser (Docling/Marker/MinerU) for structure + a frontier VLM (Gemini 3.x / Claude) pass for equations, diagrams and mark-scheme tables, reconciled per page.**
10. **Docling is the right structural backbone:** MIT license, DoclingDocument JSON with reading order, tables, formulas, image classification; HybridChunker is tokenizer-aware and carries headings/captions/page provenance per chunk; v2.126.0 released 4 Sep 2026 [S18][S19][S30]. Marker is Apache-2.0 code but model weights require a paid licence above $5M revenue [S17]; MinerU 3.4 (Jun 2026) uses its own Apache-derived licence [S25]; Chunkr is AGPL-3.0 [S26].
11. **Vector store:** start on **Postgres + pgvector 0.8.6** (HNSW, halfvec, sparsevec for learned-sparse/BM25-style vectors, iterative index scans for filtered queries, hybrid search with Postgres FTS + RRF) [S27]. Move hot indexes to a dedicated engine only when p95 retrieval > 100 ms at scale. Turbopuffer/Qdrant/Pinecone pricing could not be verified (blocked) — see open questions.
12. **Embeddings:** Voyage `voyage-4` / `voyage-4-large` / `voyage-4-lite` (32K context, MRL dims 256–2048, int8/binary quantisation), `voyage-context-4` (contextualised chunk embeddings, 120K context — ideal for textbook chapters), `voyage-multimodal-3.5` (PDF-page/figure screenshots), rerankers `rerank-2.5` / `rerank-2.5-lite` [S12]. Gemini Embedding costs $0.15/M tokens online, $0.12/M batch [S10].
13. **Grounding controls that are free or nearly free:** Claude citations (`page_location`, `char_location`, `content_block_location` for pre-chunked RAG content; `cited_text` not billed as output) [S15]; Claude structured outputs (constrained grammar, 24-hour grammar cache, cannot be combined with citations in one call) [S28]; Gemini `response_json_schema` [S31].
14. **Spaced repetition:** FSRS-6 is the standard (21 parameters, default desired retention 0.9, learning steps 1m/10m); benchmark on 350M reviews from 10k Anki users: FSRS-6 log-loss 0.346 vs HLR 0.469 vs DASH 0.368; FSRS-7 (34 params) 0.337 [S32][S33][S34]. `ts-fsrs` 5.4.2 (MIT, Sep 2026) and `py-fsrs` 6.3.2 (Aug 2026) exist; run the optimiser per student once ≥ ~1,000 reviews exist.
15. **Code execution:** Anthropic's server-side sandbox (5 GiB RAM, 1 CPU, no internet, pandas/numpy/scipy/sympy/mpmath/matplotlib preinstalled, containers reusable for 30 days, 1,550 free container-hours/month then $0.05/hour, free when combined with web search/fetch) covers "verify this maths" for Claude routes [S29][S1]. For provider-neutral verification and graphing, run **Pyodide in the browser** (MPL-2.0; NumPy, SciPy, SymPy, matplotlib available) for instant, zero-cost checks and E2B/Modal server sandboxes for heavy jobs [S35][S36].
16. **Math rendering & input:** KaTeX 0.18.6 (MIT, synchronous SSR-capable) for output; MathLive 0.110 (MIT, `<math-field>`, virtual keyboard, LaTeX/MathML/MathJSON export, Compute Engine for evaluation) for input [S37][S38]. TikZJax renders TikZ to SVG in-browser via WASM TeX (LPPL) but is thinly maintained [S39]; prefer Mermaid 11.17 for flow/graph diagrams and generated SVG for maths figures.
17. **Voice:** Gemini 2.5 Flash Live API pricing (Vertex): text in $0.50/M, audio in $3/M, text out $2/M, audio out $12/M; audio is metered at 25 tokens/second (so ≈ $0.0045 per input minute, $0.018 per output minute) [S10]. Gemini 2.5 Flash TTS: $0.50/M text in, $10/M audio out; Gemini 3.1 Flash TTS (preview) $1/$20; Chirp 3 HD $30/M characters; Speech-to-Text v2 standard $0.016/min, dynamic batch $0.003/min [S40][S41]. Anthropic has **no** realtime voice API — voice routes must be Gemini or OpenAI (OpenAI realtime pricing not verified).
18. **Web search for "what's on this year's syllabus":** Claude web search is $10 per 1,000 searches with `allowed_domains` (restrict to exam-board domains) and dynamic filtering that runs search results through code execution before they hit context [S42]; Gemini Grounding with Google Search includes 5,000 free queries/month across Gemini 3 models, then $14 per 1,000 [S10].
19. **Application stack recommendation:** Next.js 16.3 + React 19.2 + TypeScript; Vercel AI SDK 7 (`ai@7.0.93`) as the provider-neutral streaming/tool layer with a thin custom router on top; Postgres (+pgvector) as the single source of truth; Redis for session/cache/rate limiting; S3-compatible object storage; Inngest 4 or Trigger.dev 4 for durable background jobs; Better Auth 1.7 (or Clerk) for auth with parental-consent flows; Stripe + regional PSPs; Expo SDK 57 for iOS/Android from the same TypeScript codebase; Langfuse 4 (MIT, self-hostable, prompt versioning + LLM-as-judge) for observability [S43][S44][S45][S46]. Version/date evidence from npm/PyPI on 6 Sep 2026.
20. **Security:** OWASP GenAI/LLM Top 10 (2026 release) leads with Prompt Injection, Sensitive Information Disclosure, Excessive Agency, and adds "Hidden Context Exposure" and "Vector and Embedding Weaknesses" — directly relevant to a RAG product that ingests student-uploaded PDFs [S47]. Treat every retrieved chunk and uploaded file as untrusted data; never let tools act on instructions found in documents; isolate per-tenant embeddings.
21. **Compliance calendar (partly prior knowledge):** GDPR (children's consent age 13–16 by member state, 72-hour breach notification, DPIAs for high-risk processing) [S48]; UK GDPR + ICO Age Appropriate Design Code (15 standards; default-high privacy, no nudges, DPIA) (prior knowledge, unverified); COPPA (<13, verifiable parental consent, school-consent exception; FTC amended rule effective June 2025 with compliance deadline April 2026) [S49] (dates prior knowledge, unverified); FERPA (education records, school-official exception) [S50]; EU AI Act — Annex III lists education systems that determine access/admission, evaluate learning outcomes, steer the learning process, or monitor prohibited behaviour during tests as **high-risk**, with high-risk obligations originally applying from 2 Aug 2026 and a Commission "Digital Omnibus" proposal (Nov 2025) to delay to Dec 2027 tied to standards availability (prior knowledge, unverified — must be re-checked before EU school sales).
22. **Performance budgets:** Core Web Vitals thresholds are LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1 [S51]. Our own targets: TTFT < 800 ms p50 / < 1.5 s p95 for cached tutoring turns; retrieval < 120 ms p95; first-visible-token requires a cached prefix, `effort: low/medium`, streaming with `display: "summarized"` thinking so the UI can show progress, and parallel retrieval + speculative "thinking" indicator.
23. **Freshness/lifecycle risks:** Haiku 4.5 retirement "not sooner than 15 Oct 2026" means a Haiku 5-class replacement is likely soon; Sonnet 5 committed to ≥ 30 Jun 2027, Opus 5 ≥ 24 Jul 2027, Fable 5.1 ≥ 1 Sep 2027 [S2]. Gemini 3.8/3.7/3.6 Flash prices double on 1 Jan 2027 [S10]. Budget models must be behind a config flag, never hard-coded.
24. **Tokeniser trap:** Claude 4.7+ tokeniser produces ~30% more tokens for the same text than Sonnet 4.6-era models; 1M tokens ≈ 555K words on the new tokeniser [S1][S2]. Re-baseline all token budgets and cache thresholds when switching models.
25. **The "every pixel" mandate has an architecture cost:** streaming UI needs resumable streams, optimistic rendering of maths (KaTeX), incremental citation chips, and offline-first note/flashcard state (PWA + local SQLite in Expo). These are product requirements that must be in the data model from day one (see Section 5).

---

## 1. Part A — Model line-ups and routing policy (September 2026)

### 1.1 Anthropic (verified from platform.claude.com, 6 Sep 2026)

| Model | API ID | Context | Max output | Input / Output $/MTok | 5m cache write / 1h write / read | Batch in/out | Thinking | Knowledge cutoff | Released / retirement |
|---|---|---|---|---|---|---|---|---|---|
| Claude Fable 5.1 | `claude-fable-5-1` | 1M | 128K | $10 / $50 | $12.50 / $20 / **$0.25** | $5 / $25 | Adaptive, always on; effort low→max | Jun 2026 | ≥ 1 Sep 2027 |
| Claude Opus 5 | `claude-opus-5` | 1M | 128K (300K batch beta) | $5 / $25 | $6.25 / $10 / $0.50 | $2.50 / $12.50 | Adaptive default; disable only ≤ high effort | May 2026 | 24 Jul 2026 / ≥ 24 Jul 2027 |
| Claude Sonnet 5 | `claude-sonnet-5` | 1M | 128K (300K batch beta) | $2 / $10 | $2.50 / $4 / $0.20 | $1 / $5 | Adaptive; sampling params rejected | Jan 2026 | 30 Jun 2026 / ≥ 30 Jun 2027 |
| Claude Haiku 4.5 | `claude-haiku-4-5-20251001` | 200K | 64K | $1 / $5 | $1.25 / $2 / $0.10 | $0.50 / $2.50 | Manual extended thinking (`budget_tokens`); no effort | Feb 2025 | 15 Oct 2025 / ≥ 15 Oct 2026 |
| Opus 4.8 / 4.7 / 4.6 (legacy) | — | 1M | 128K | $5 / $25 | as Opus 5 | $2.50 / $12.50 | Adaptive | — | still served |
| Sonnet 4.6 (legacy) | — | 1M | 128K | $3 / $15 | $3.75 / $6 / $0.30 | $1.50 / $7.50 | Adaptive | — | still served |

Sources: pricing [S1], models overview [S2], Opus 5 [S3], Sonnet 5 [S4], Haiku 4.5 [S5].

Other verified Anthropic facts that shape the design:

- **Fast mode** (research preview) on Opus 5 / Opus 4.8: up to 2.5× output tokens/sec at $10/$50 per MTok; separate rate limits; not on Batch [S1].
- **Long context at flat price**: a 900K-token request costs the same per token as a 9K one on 4.6+ models [S1].
- **Structured outputs**: `output_config.format` JSON schema and `strict: true` tools; constrained sampling with compiled grammar cached 24 h; no recursive schemas, no numeric/string constraints; incompatible with citations in the same request [S28].
- **Citations**: PDFs → page ranges (1-indexed), plain text → char ranges, custom content → block indices; `cited_text` is not billed as output or subsequent input; scanned PDFs without a text layer are not citable [S15].
- **PDF support**: 600 pages / 32 MB per request (100 pages if the request context < 1M); each page = extracted text (~1,500–3,000 tokens) + page image (image token formula); Files API upload once, reference by `file_id` [S14].
- **Vision**: images cost ⌈w/28⌉×⌈h/28⌉ visual tokens; 4.7+ models use a high-resolution tier (long edge 2,576 px, cap 4,784 tokens) vs 1,568 px / 1,568 tokens on older models; up to 600 images per request (100 on 200K models); images anywhere in the prompt invalidate the messages cache when added/removed [S9][S6].
- **Files API**: 500 MB per file, 1 TB per organisation, workspace-scoped (not per end user) — never accept `file_id` from clients; optional `expires_in_seconds` 1 h–90 d; ~500 requests/min [S52].
- **Batch API**: 100,000 requests or 256 MB per batch, most finish < 1 h, expire at 24 h, results kept 29 days, caching works best-effort (30–98% hit rates) [S53].
- **Rate limits** (per model, Start/Build/Scale): Opus 5, Sonnet 5, Haiku 4.5 all 1,000/5,000/10,000 RPM; 2M/5M/10M ITPM; 400K/1M/2M OTPM; Fable 5.x lower (1,000/2,000/4,000 RPM; 0.5M/1.5M/4M ITPM; 100K/300K/800K OTPM). Spend caps $500 / $1,000 / $200,000 per month. Cache reads do not count toward ITPM [S7].
- **Code execution tool**: Linux container, 1 CPU, 5 GiB RAM, no internet, Python + bash, pandas/numpy/scipy/scikit-learn/statsmodels/matplotlib/seaborn/sympy/mpmath; containers reusable 30 days (checkpointed after ~5 min idle); REPL state persists with `code_execution_20260120`+; 90-second per-cell limit in programmatic tool calling; 1,550 free container-hours/month, then $0.05/h; free when web search/fetch is in the request [S29][S1].
- **Web search**: $10 per 1,000 searches; `allowed_domains`/`blocked_domains`; `user_location`; dynamic filtering runs results through code execution; web fetch is free beyond tokens [S42][S1].
- **Data residency**: `inference_geo` `"us"` (1.1×) or `"global"`; workspace geo only `"us"`; no EU option first-party [S13].
- **Managed Agents** (server-run agent loop + sandbox): $0.08 per session-hour plus tokens [S1] — relevant for long "build my revision plan" jobs but not for latency-sensitive chat.
- Anthropic does **not** sell an embedding model; its docs recommend Voyage AI [S12]. No realtime voice API exists (absence in docs; prior knowledge).

### 1.2 Google Gemini (verified from the Vertex AI pricing page downloaded 6 Sep 2026 [S10]; model capabilities from search snippets and SDK README)

| Model (Vertex naming) | Input $/MTok (≤200K / >200K) | Output $/MTok | Cached input | Notes |
|---|---|---|---|---|
| Gemini 3.1 Pro Preview | $2.00 / $4.00 | $12.00 / $18.00 | $0.20 / $0.40 | Text, image, video, audio in; 1M context; thinking (snippet) |
| Gemini 3.8 Flash ("most intelligent Flash", cookbook) | **$0.75 intro until 31 Dec 2026**, then $1.50 | **$3.75 intro**, then $7.50 | $0.075 → $0.15 | Non-global +10% ($0.825 / $4.125) |
| Gemini 3.7 Flash / 3.6 Flash | same intro/standard as 3.8 | same | same | CodeMender same pricing |
| Gemini 3.5 Flash (launched 19 May 2026, snippet) | $1.50 | $9.00 | $0.15 | 1M in / 64K out; thinking levels minimal/low/medium/high (snippet) |
| Gemini 3.5 Flash-Lite | $0.30 | $2.50 | $0.03 | "fastest option" (cookbook) |
| Gemini 3.1 Flash-Lite | $0.25 (audio $0.50) | $1.50 | $0.025 | |
| Gemini 3 Flash Preview | $0.50 (audio $1.00) | (not captured) | $0.05 | |
| Gemini 2.5 Pro | $1.25 / $2.50 | $10 / $15 | $0.125 / $0.25 | legacy |
| Gemini 2.5 Flash | $0.30 (audio $1.00) | $2.50 | $0.03 | legacy |
| Gemini 2.5 Flash-Lite | $0.10 (audio $0.30) | $0.40 | $0.01 | cheapest text model |
| Gemini 2.5 Flash **Live API** | text $0.50; audio/video/image $3.00 | text $2.00; **audio $12.00** | — | 25 audio tokens/sec; 258 video tokens/sec |
| Gemini Omni Flash / Omni 1.1 Flash | $1.50 (1,120 tokens/image; 32 tokens/audio-sec) | $9.00 text; $17.50 video out | — | |
| Gemini 3.5 Live Translate | audio in $3.50 | audio out $21.00 | — | 70+ languages speech-to-speech |
| Gemini Deep Research Agent | $2 | $12 | $0.20 | agentic research |
| Gemini Embedding | $0.15/M tokens online, $0.12/M batch | free | — | `gemini-embedding-001` in SDK README; `output_dimensionality` supported [S31] |
| Priority tier | 1.8× standard (e.g. 3.5 Flash $2.70 / $16.20) | | | |
| Flex/Batch | 50% off (snippet [S11]); Gemini cookbook claims "up to 90%" for Batch API [S54] — **disagreement, verify** | | | |
| Grounding with Google Search | 5,000 free queries/month across Gemini 3 models, then $14 / 1,000 | | | |
| PDFs | billed as image input, one page = one image | | | |

Not verified (blocked pages): context-cache storage cost per hour (snippet: ~$1/M-token-hour Flash, $4.50 Pro [S11]); Gemini 3.x native-audio Live API pricing; PDF page limit (prior knowledge: up to 1,000 pages and ~258 tokens per page image — unverified for 3.x); free tier quotas.

### 1.3 OpenAI (search snippets only — official pages blocked)

| Model | Input / cached / output $/MTok | Context | Max output | Notes |
|---|---|---|---|---|
| GPT-5.6 Sol (flagship) | $5.00 / $0.50 / $30.00 | 1,050,000 | 128,000 | reasoning modes standard/pro; `reasoning.effort` default medium; structured outputs via JSON schema; tools/function calling [S20][S22] |
| GPT-5.6 Terra | $2.00 / (90% off) / $12.00 | — | — | mid tier [S21] |
| GPT-5.6 Luna | $0.20 / — / $1.20 | — | — | budget tier [S21] |
| Batch | 50% off input and output | | | [S21] |
| Long-context surcharge | requests > 272K input tokens billed at 2× input and 1.5× output for the whole request | | | [S21] |
| Cache writes | 1.25× uncached input on GPT-5.6+ | | | [S21] |

Prior knowledge, unverified for 2026: Responses API (`client.responses.create`, `previous_response_id`, file inputs) and Realtime API over WebSocket/WebRTC exist (confirmed in the openai-node README [S55]); realtime audio pricing, file-search/vector-store storage pricing, embeddings (`text-embedding-3-large` ≈ $0.13/M) and fine-tuning prices could not be verified. One search summary also mentioned a "GPT-6 Astra" listing on a third-party pricing site [S21]; treat as unconfirmed.

### 1.4 DeepSeek (search snippets only — official pages blocked; sources disagree)

- Models: **V4-Pro-0813** (1.6T total / 49B active) and **V4-Flash-0731** (284B / 13B active), both GA, 1M context, 384K max output, JSON output, tool calls, thinking and non-thinking modes with `reasoning_effort` (low/high/max), OpenAI ChatCompletions- and Anthropic-Messages-compatible endpoints [S23][S24]. Experimental `deepseek-v4-flash-vision-exp` (announced 21 Aug 2026) accepts images at V4-Flash prices [S24].
- Pricing (conflicting): one aggregator reports V4-Flash $0.14 input / $0.28 output and V4-Pro $0.435 / $0.87 with cache hits ~31× cheaper; another reports that after 16 Aug 2026 DeepSeek moved to peak/off-peak pricing (Flash $0.22/$0.66 off-peak vs $0.44/$1.32 peak; Pro $0.66/$1.98 off-peak vs $1.32/$3.96 peak) [S23]. **Do not budget on DeepSeek numbers until read from api-docs.deepseek.com.**
- Compliance note: DeepSeek is a PRC-headquartered provider; several education procurement frameworks in the EU/UK/US restrict or prohibit sending student data to it (prior knowledge, unverified). Architecturally: keep DeepSeek behind a feature flag, use it only for non-PII workloads (e.g., second-opinion maths solving on anonymised problem text, synthetic question generation), and never for conversations containing student identifiers.

### 1.5 Recommended routing policy

Design principle (from Anthropic's measured data [S8] and the price tables): pick **one primary model per task class**, tune `effort`/thinking level per route, cache aggressively, and use a second provider for (a) failover, (b) calibration/second opinion on high-stakes grading, and (c) modalities the primary lacks (voice, video).

| Task class | Primary | Effort / config | Fallback #1 | Fallback #2 / second opinion | Why |
|---|---|---|---|---|---|
| Tutoring dialogue (Socratic explanations, worked examples, exam technique) | **Claude Sonnet 5** | adaptive, `effort: medium` (drop to `low` for short follow-ups), 1h-cached system prompt + syllabus block; `display: "summarized"` | Gemini 3.8 Flash (intro $0.75/$3.75) | GPT-5.6 Terra | Best speed/intelligence at $2/$10 with 1M context and adaptive thinking [S2][S4]; Gemini 3.8 Flash is ~2.5× cheaper but its price doubles in 2027 [S10] |
| Trivial/short turns (acknowledgements, navigation, "next question") | **Haiku 4.5** (or Gemini 3.5 Flash-Lite) | no thinking; `max_tokens` ≤ 300 | Gemini 3.5 Flash-Lite ($0.30/$2.50) | DeepSeek V4-Flash (non-PII only) | Classifier-gated; Haiku cache minimum is 4,096 tokens so keep the shared prefix above that or skip caching [S6] |
| Essay / long-answer marking against a mark scheme (AO-level marks, examiner-style feedback) | **Claude Opus 5** | `effort: high`, structured outputs JSON (per-AO marks, evidence spans, next-step advice); mark scheme + examiner report cached (1h) | Claude Sonnet 5 (draft mark, then Opus confirms if disagreement > 1 band) | **GPT-5.6 Sol** (`reasoning.effort: high`) as calibration marker on a sample; Fable 5.1 for appeals/"why did I lose marks" deep review | Accuracy outweighs cost; Anthropic's data shows Opus 5 at default effort is "cheapest to peak score" in agentic coding [S8] — treat as analogous until our marking eval says otherwise |
| Maths / STEM problem solving | **Claude Opus 5** (`effort: high`) with mandatory code-execution verification (SymPy/numeric) | if answer is numeric/symbolic → sandbox check before display | GPT-5.6 Sol (pro reasoning) | DeepSeek V4-Pro thinking `max` as cheap second solver (agreement voting) | Two independent solvers + CAS check gives an "agreement" confidence signal without human cost |
| Code (CS/IT syllabi, Python for data) | **Claude Sonnet 5** (Opus 5 for hard) | `effort: medium/high`; sandbox runs tests | GPT-5.6 Terra | — | Coding is Claude's strongest measured domain [S8] |
| Vision: handwriting, diagrams, graphs, photographed worksheets | **Gemini 3.1 Pro** (dense/complex) or **Gemini 3.8 Flash** (routine) | first pass transcription to LaTeX/Markdown + confidence; then hand text to the reasoning route | Claude Opus 5 / Sonnet 5 high-res tier (2,576 px) | Mathpix (prior knowledge: dedicated math OCR, per-request pricing) for exact handwritten-maths transcription | Gemini multimodal pricing is lowest; Claude's high-res tier costs up to ~3× tokens vs standard [S9]; always downsample to ≤ 2,000 px long edge |
| Long-document reading (whole textbook, 600-page PDF, full past-paper set) | **Gemini 3.1 Pro** for whole-book Q&A (1M; PDF pages billed as images) | context cache the book; ask for page-anchored answers | **Claude Opus 5 / Sonnet 5** when page-level citations must be machine-verifiable (`page_location`) [S15] | — | Prefer RAG for the permanent corpus; whole-document mode is for user uploads ("here's my teacher's notes") |
| Bulk offline jobs: syllabus tagging, flashcard/MCQ generation, summarising examiner reports, question-to-mark-scheme linking | **Batch API on Haiku 4.5** ($0.50/$2.50) or Sonnet 5 batch ($1/$5) for quality-critical tagging | 1h cache on shared corpus context; structured outputs | Gemini 3.5 Flash-Lite batch | DeepSeek V4-Flash off-peak (non-PII corpus work) | 50% batch discount stacks with cache [S1][S53] |
| Voice tutor / oral exam practice (IB orals, language speaking papers) | **Gemini Live API** (2.5 Flash Live priced; use newest native-audio model available) | server-side session broker; tool calls into the same RAG | OpenAI Realtime (pricing unverified) | Pipeline mode: Google STT v2 ($0.016/min) → Sonnet 5 → Gemini 2.5 Flash TTS ($10/M audio tokens) | Anthropic has no voice API; Live API ≈ $0.02–0.03 per conversational minute (Section 6) |
| Read-aloud of explanations (accessibility) | **Gemini 2.5 Flash TTS** ($0.50 in / $10 out per M tokens) | cache audio per explanation hash | Chirp 3 HD ($30/M chars) | ElevenLabs (unverified pricing) for premium voices | |
| Embeddings | **Voyage `voyage-4`** (docs) + `voyage-context-4` (textbook chunks) + `voyage-multimodal-3.5` (figures/pages); `voyage-4-lite` for queries if latency-bound | 1024-d default; store int8; `input_type` query/document | **Gemini Embedding** $0.15/M | `voyage-4-nano` (Apache-2.0 open weights) self-hosted for on-prem school deployments | [S12][S10] |
| Reranking | Voyage `rerank-2.5-lite` (latency) / `rerank-2.5` (quality) | top-50 → top-8 | Cohere Rerank (pricing unverified) | self-hosted bge-reranker-v2-m3 (prior knowledge) | Rerank cost per query can exceed LLM cost at scale — measure |
| Web lookups (syllabus changes, exam dates) | **Claude web search** with `allowed_domains` = exam-board domains, `max_uses: 3` | $10 / 1,000 searches | Gemini Grounding (5,000 free/month, then $14/1,000) | — | Domain-restricted search prevents "random blog" answers about syllabus content |
| LLM-as-judge for evals | **Claude Opus 5** (`effort: high`) + GPT-5.6 Sol (cross-family agreement) | Batch API | — | — | Never judge a model's output only with the same model family |

**Fallback mechanics:** every route has a primary provider, a same-model alternative host (Claude on Vertex AI uses the same IDs `claude-opus-5`, `claude-sonnet-5` [S2][S10]), and a cross-family fallback. Failover triggers: HTTP 529/503, 429 without `retry-after` < 2 s, TTFT > 4 s, or provider status degradation. Fallback responses are tagged in telemetry so quality drift is measurable. Note that switching model invalidates prompt caches (caches are model-scoped) — expect a cost spike during failover.

**A/B strategy:** (1) route-level experiments in Langfuse/Braintrust with sticky per-student assignment; (2) pairwise preference judging (Opus 5 judge + GPT-5.6 judge; disagreement → human teacher panel); (3) outcome proxies — mark gain on retest, retention curves from FSRS, "asked for hint again within 2 turns" rate; (4) hold-out cohort never exposed to the cheapest tier to detect quality erosion.

**Latency targets:** TTFT p50 < 800 ms, p95 < 1.5 s for cached Sonnet 5 turns; retrieval + rerank < 120 ms p95; end-to-end essay marking < 45 s with progressive rendering (per-AO cards stream in); voice round-trip < 700 ms (Live API). Effort caps: `low`/`medium` in chat; `high` reserved for marking, STEM proofs, and appeals. Enable `display: "summarized"` so a "thinking" progress line can be shown instead of a blank pause (default is `omitted` on 4.7+ models — skill notes [S56]).

---

## 2. Part B — RAG over textbooks & past papers

### 2.1 Ingestion pipeline (design)

```
[Source PDF/DOCX/EPUB/images]
   │
   ├─► Fingerprint + dedupe (sha256, syllabus code, year/session) ─► Object storage (raw)
   │
   ├─► Pass 1: structural parse (Docling default; Marker/MinerU as alternates)
   │        → DoclingDocument JSON: reading order, headings, tables, formulas, figure crops, page provenance
   │
   ├─► Pass 2: VLM page audit (Gemini 3.8 Flash batch, escalate to 3.1 Pro/Claude Opus 5 for flagged pages)
   │        → re-transcribe equations (LaTeX), mark-scheme tables, diagrams → alt-text + structured JSON
   │        → per-page confidence; disagreements between Pass 1 and Pass 2 queue for human QA
   │
   ├─► Document typing: textbook | syllabus | question paper | mark scheme | examiner report | specimen | grade thresholds
   │
   ├─► Structure-aware segmentation
   │        textbook: chapter → section → subsection → paragraph/figure/table/worked example
   │        question paper: paper → section → question → part (a)(i) → marks
   │        mark scheme: question part → mark points (M1/A1/B1 or level descriptors) → guidance notes
   │        examiner report: question → commentary
   │
   ├─► Cross-linking: question ↔ mark-scheme item ↔ examiner-report comment ↔ syllabus objective ↔ textbook section
   │        (deterministic keys: syllabus_code/paper/year/session/question_id; LLM-assisted for syllabus objective tags)
   │
   ├─► Chunking (HybridChunker, tokenizer aligned to embedding model; 256–512 tokens; tables kept whole; mark points kept with their question)
   │
   ├─► Embedding (voyage-context-4 for textbooks; voyage-4 for Q/MS/ER; voyage-multimodal-3.5 for figure crops)
   │        + BM25/sparse (Postgres tsvector or sparsevec)
   │
   └─► Postgres: documents, sections, chunks(vector halfvec(1024), tsv, metadata jsonb), links; figures in object storage
```

**Why two passes.** Every parser in the verified benchmark is weak on "old scans math" (best 83.8, most 46–74) and mid on tables (60–88) [S16]. Exam papers are exactly that content. Structural parsers are cheap and deterministic (reading order, hierarchy, page numbers); frontier VLMs are far better at equations and hand-drawn diagrams. Reconciling them per page with a confidence score and a human QA queue is the only way to reach the "answer must match the mark scheme" quality bar.

### 2.2 Parser options (matrix)

| Tool | Type | Verified strengths | Licence / cost | Verdict for us |
|---|---|---|---|---|
| **Docling** (IBM) | local, MIT | PDF/DOCX/PPTX/XLSX/HTML/EPUB/images/audio; layout, reading order, table structure, code, formulas, image classification; chart-to-table; VLM pipeline option (GraniteDocling); HierarchicalChunker/HybridChunker with heading/caption/page metadata; LangChain/LlamaIndex integrations; v2.126.0 (4 Sep 2026) [S18][S19][S30] | MIT | **Default structural backbone** |
| **Marker** (Datalab) | local / hosted | olmOCR-bench 76.0 balanced (83.5 digital PDFs), 2.9 pages/s; fast mode 66.6 @ 7.4 pages/s; equations→LaTeX; optional LLM mode; hosted API "1B+ pages/week", SOC 2 [S17]; marker-pdf 2.0.0 (Jul 2026) | Apache-2.0 code, **weights need paid licence above $5M revenue** | Alternate for speed; licence review needed |
| **MinerU** | local | OmniDocBench v1.6: 86.5 (pipeline) to 95.3 (hybrid/VLM); formulas→LaTeX, tables→HTML, OCR 109 languages; 3.4 (Jun 2026) [S25] | MinerU licence (Apache-derived) | Strong for scanned/multilingual (ЕГЭ, UNT papers) |
| **olmOCR / Chandra / PaddleOCR-VL / DeepSeek-OCR** | open VLM OCR | olmOCR-bench 82.4 / 83.1 / 80.0 / 75.7; olmOCR "< $200 per million pages" self-hosted [S16] | open | Consider Chandra/olmOCR as the OCR engine inside Pass 2 for cost at scale |
| **Mistral OCR API** | hosted | olmOCR-bench 72.0 [S16]; pricing not verified (prior knowledge ≈ $1 per 1,000 pages) | hosted | Not best-in-class on this benchmark |
| **Gemini native PDF** | hosted | Marker README cites Gemini Flash 3.5 at 76.4 on olmOCR-bench [S17]; one page = one image billing [S10] | per token | Pass-2 auditor, not Pass-1 parser |
| **Claude native PDF** | hosted | text+image per page; citations with page numbers; 600 pages/request [S14][S15] | per token | Query-time reading of user uploads |
| **Google Document AI** | hosted | Enterprise Document OCR $1.50 / 1,000 pages (first 1,000/month free); Layout Parser (with initial chunking) $10 / 1,000 pages; Form Parser $30 / 1,000 pages [S57] | per page | Reasonable managed fallback; Layout Parser price is 6–7× a self-hosted parser |
| **Reducto / Chunkr / LlamaParse / Azure DI** | hosted | Chunkr: AGPL-3.0 open core, layout+OCR+semantic chunking with bounding boxes, cloud API uses proprietary models [S26]; LlamaCloud legacy repo deprecated May 2026, migrate to `llama-cloud` ≥ 1.0 [S58]; Reducto and Azure pricing not verified | mixed | Evaluate Reducto on a 200-page past-paper sample if in-house Pass 2 misses tables |
| **Mathpix** | hosted | (prior knowledge) best-in-class handwritten maths → LaTeX; per-request pricing | per request | Use for handwritten student work when exactness matters |

### 2.3 Metadata schema per chunk (required, not optional)

`doc_id, doc_type (textbook|syllabus|qp|ms|er|specimen|thresholds), board (CAIE|AQA|Edexcel|OCR|IB|CollegeBoard|FIPI…), syllabus_code (e.g. 9609), syllabus_version_years ([2023,2025]), subject, level (IGCSE|AS|A2|IB HL|AP…), paper (1|2|3|4), variant (11|12|13…), year, session (FM|MJ|ON), question_id (e.g. 2(b)(ii)), marks, command_word (evaluate|analyse|explain…), assessment_objectives (AO1..AO4), level_descriptor_band, topic_path (["1 Business and its environment","1.2 Business structure"]), page_start, page_end, bbox, figure_ids, language, source_hash, ingest_version, parse_confidence`.

Everything above is filterable in SQL; retrieval always applies `syllabus_code` and `syllabus_version` filters first (mark schemes and syllabi change; a 2021 answer can be wrong for the 2026 syllabus).

### 2.4 Retrieval design

1. **Query understanding (Haiku 4.5, structured output):** intent (explain|practise|mark|plan), syllabus code(s), topic path guess, question reference if any, language.
2. **Hybrid retrieval:** pgvector HNSW cosine on `halfvec(1024)` + Postgres full-text (`tsvector`, BM25-style ranking via `ts_rank_cd` or sparsevec learned-sparse) → RRF fusion; filtered by metadata; `hnsw.iterative_scan` on for heavily filtered queries [S27].
3. **Graph expansion:** for any hit on a question, pull its linked mark-scheme items and examiner-report commentary; for any textbook hit, pull the syllabus objective and 1–2 linked past questions.
4. **Rerank:** top-50 → top-8 with `rerank-2.5-lite`; escalate to `rerank-2.5` for marking flows.
5. **Context assembly with citations:** send chunks as Claude *custom content documents* (block-indexed citations, no re-chunking) [S15] or as Gemini text parts with explicit `[chunk_id]` tags; instruct the model to cite chunk IDs; UI resolves to "Textbook §1.2 p.34" or "9609/22 M/J 2024 Q3(b) MS".
6. **Grounding gate:** if the top reranked score is below threshold or the model's answer cites nothing, respond with "not in your syllabus materials" + offer general explanation flagged as unverified.

### 2.5 Syllabus knowledge graph

Nodes: Board → Qualification → Syllabus(version) → Unit → Topic → Learning objective; Paper → Question → Part; Mark scheme item; Examiner comment; Textbook section; Figure; Glossary term; Command word. Edges: `assesses`, `answered_by`, `commented_on`, `explained_in`, `prerequisite_of`, `same_topic_as (cross-board)`. Store in Postgres (adjacency tables) — no separate graph DB is warranted at this scale; use recursive CTEs. Cross-board equivalence edges (e.g., CAIE 9609 "price elasticity" ≈ Edexcel Business Theme 1.2.3) let one explanation bank serve many curricula and are the key to generalisation.

### 2.6 Hallucination controls

- Citations mandatory in "syllabus mode"; unsupported sentences are visually de-emphasised.
- For marking: the model must quote the mark-scheme point it credits (Claude citations make quoted text free of output-token cost [S15]).
- Numeric/symbolic answers verified in sandbox (SymPy) before display; disagreement → show both and ask the student to check.
- Self-consistency on high-stakes marks: Opus 5 marks twice (temperature not settable on Sonnet 5/Opus 5 — vary prompt order instead) plus GPT-5.6 Sol; report a confidence band.
- Model-family diversity for judges [S8].
- Retrieval-time injection defence: strip instructions from chunks, wrap in XML delimiters, system prompt states that documents are data (OWASP LLM01/LLM08/LLM09 [S47]).

### 2.7 Evaluation

- **Retrieval set:** 500 questions per syllabus (initially 9609) with gold chunk IDs; metrics Recall@8, nDCG@8, MRR; target Recall@8 ≥ 0.92 before launch.
- **Generation set (Ragas 0.4.3, MIT [S59][S30]):** faithfulness, answer relevancy, context precision/recall; plus custom "mark-scheme adherence" metric (does the credited point exist verbatim in the MS?).
- **Marking set:** 300 real student essays double-marked by qualified examiners; metrics exact-band agreement, ±1-mark agreement, quadratic weighted kappa vs examiner; target QWK ≥ 0.80 on 9609 Paper 2 20-markers before enabling "predicted grade".
- Human review queue: 2% random + all low-confidence; teacher raters paid; results feed Langfuse datasets.

### 2.8 Caching and cost of RAG

- Corpus embedding one-off: a 400-page textbook ≈ 200K tokens → $0.03 (Gemini Embedding) — negligible; VLM Pass 2 dominates: 400 pages × ~1,500 tokens in + 800 out on Gemini 3.8 Flash batch ≈ $0.9 per book at intro price (≈ $1.8 standard); with Claude Sonnet 5 batch ≈ $2.6 per book.
- Per query: embedding (~$0.000005) + rerank (unverified; assume $0.001–0.002) + retrieval compute — rerank is the item to watch.
- Cache the "syllabus pack" (persona + syllabus outline + command-word definitions, ≈ 3–6K tokens) with 1-hour TTL; cache per-conversation history automatically (top-level `cache_control`) [S6].

---

## 3. Part C — Tools and engines

| Need | Recommendation | Evidence / notes |
|---|---|---|
| Code execution for verification (server) | Anthropic code execution tool on Claude routes (SymPy, numpy, matplotlib preinstalled; 5 GiB; no internet; 30-day reusable containers; 1,550 free hours/month) [S29]; **E2B** (Apache-2.0 SDKs, self-host via Terraform on AWS/GCP; e2b 2.46.4 Sep 2026) or **Modal** (modal 1.5.5) for provider-neutral heavy jobs [S35] | E2B/Modal pricing not verified (blocked) |
| Code execution in-browser | **Pyodide** (MPL-2.0; NumPy, SciPy, SymPy, matplotlib, pandas ports; micropip) [S36] | Use for instant answer checking, plotting, and offline; load lazily (~several MB) — prior knowledge on size |
| CAS & graphing | SymPy (server/Pyodide); **Desmos API** and **GeoGebra Apps API** for interactive graphs | Desmos/GeoGebra licences: Desmos API requires a (free for many non-commercial/edu cases) API key and commercial terms; GeoGebra is GPL/non-commercial with commercial licensing — (prior knowledge, unverified; legal review required) |
| Unit checking | `pint` (Python) in sandbox; JS `js-quantities`/custom | prior knowledge |
| Maths rendering | **KaTeX 0.18.6** (MIT; synchronous, SSR-friendly) [S37] | MathJax only if a required macro is missing |
| Maths input | **MathLive 0.110** (MIT; `<math-field>`, mobile virtual keyboard, LaTeX/MathML/MathJSON, screen-reader speech; Compute Engine for evaluation) [S38] | Also accept handwriting via camera → Gemini/Mathpix |
| Diagrams | **Mermaid 11.17** for flow/sequence/mind maps; generated SVG (D3/Recharts) for graphs; **TikZJax** (LPPL, WASM TeX) only for legacy TikZ [S39]; **Excalidraw 0.18** embed for student sketches | Store diagrams as source (Mermaid/TikZ/JSON) + rendered SVG |
| Spaced repetition | **FSRS-6** via `ts-fsrs` 5.4.2 (MIT) client-side + `py-fsrs` 6.3.2 optimiser server-side; desired retention 0.9 default, learning steps 1m/10m, max interval 36,500 d [S32][S33]; benchmark superiority over HLR/DASH on 350M reviews [S34] | Exam-date-aware variant: raise desired retention toward 0.95 in the final 3 weeks; cap intervals at exam date |
| Calendar / study plan | Internal scheduler (durable jobs in Inngest/Trigger.dev) + ICS export; Google/Microsoft calendar OAuth later | |
| Web search | Claude web search ($10/1k, domain filters) [S42]; Gemini Grounding (5k free/month, $14/1k) [S10]; Exa/Tavily unverified | Restrict to exam-board and textbook-publisher domains for syllabus facts |
| STT | Google Speech-to-Text v2: $0.016/min standard (volume tiers down to $0.004), dynamic batch $0.003/min [S41]; Deepgram/AssemblyAI unverified | Whisper-class on-device for privacy modes (prior knowledge) |
| TTS | Gemini 2.5 Flash TTS $0.50/M text in, $10/M audio out; Gemini 3.1 Flash TTS preview $1/$20; Chirp 3 HD $30/M chars; Neural2 $16/M chars; Standard $4/M chars [S40] | Cache audio per explanation hash |
| Realtime voice | Gemini Live API (2.5 Flash Live: audio in $3/M, out $12/M; 25 tokens/s) [S10]; Gemini 3.5 Live Translate for language-learning speech-to-speech ($3.50/$21) | OpenAI Realtime as fallback (pricing unverified) |
| Handwriting OCR | Gemini 3.x vision (cheapest), Claude high-res tier, Mathpix for maths exactness; DeepSeek-OCR/OCR-2 (MIT, Oct 2025 / Jan 2026) as self-hosted option [S60] | Always keep the original image for teacher review |

---

## 4. Part D — Application stack, architecture, security, compliance, performance

### 4.1 Reference architecture

```
Clients: Next.js 16 web (PWA, offline notes/flashcards) │ Expo SDK 57 iOS/Android (shared TS packages) │ Teacher console (same web app, role-gated)
        │  HTTPS + SSE/streaming fetch (resumable stream IDs)
Edge/API: Next.js route handlers + a dedicated Node (or Bun) "AI gateway" service
        ├─ Auth (Better Auth / Clerk; passkeys; parental consent + school SSO via SAML/OIDC)
        ├─ Router: task classifier → route table (Section 1.5) → provider adapters (Vercel AI SDK 7 providers: anthropic, google-vertex, openai, deepseek)
        ├─ Prompt registry (Langfuse prompts, versioned, cached in Redis)
        ├─ Retrieval service (pgvector + FTS + rerank) — same process or sidecar
        ├─ Tool executors: sandbox broker (Anthropic code exec / E2B), Desmos state, FSRS, calendar
        └─ Guardrails: input classifier (self-harm, exam malpractice, PII), output filters, injection scrubber
Data:   Postgres 16 (+pgvector 0.8.6) — tenants, users, conversations, messages(parts jsonb), documents, chunks, links, cards, reviews, marks
        Redis — sessions, rate limits/quotas, stream resumption buffers, prompt cache
        Object storage (S3/GCS) — raw PDFs, page images, figure crops, audio
        ClickHouse (optional, via Langfuse) — traces/analytics
Async:  Inngest 4 / Trigger.dev 4 — ingestion DAG, batch API polling, nightly FSRS optimisation, eval runs
Obs:    Langfuse 4 self-hosted (traces, prompts, datasets, LLM-as-judge) [S46]; Sentry; OpenTelemetry
Models: Anthropic API (global/us) ─ Vertex AI (Claude regional + Gemini) ─ OpenAI ─ DeepSeek (flagged)
```

**Why these choices.**
- *Next.js 16.3 / React 19.2 / TypeScript*: mature streaming (RSC + route handlers), one language across web, mobile (Expo) and gateway; versions verified on npm 6 Sep 2026 [S43].
- *Vercel AI SDK 7 vs custom streaming*: AI SDK gives provider abstraction (OpenAI, Anthropic, Google, and gateway), `streamText`/`generateObject`, `useChat`, tool loops (`ToolLoopAgent`) [S44]. Use it for transport and UI message streams, but keep our own router and our own provider-specific features (Anthropic `cache_control`, `output_config.effort`, citations; Gemini thinking level, context cache) via provider options / raw SDKs (`@anthropic-ai/sdk` 0.124, `@google/genai` 2.21, `openai` 7.10 — versions verified [S43]). Rationale: the differentiators (caching, citations, structured outputs) are exactly the provider-specific bits an abstraction layer lags on.
- *Postgres + pgvector*: one datastore for relational, vector, FTS and graph adjacency; HNSW + halfvec + iterative scans are sufficient to tens of millions of chunks [S27]; Supabase or Neon acceptable managed options (Neon/Supabase reachability not verified). Only add a dedicated vector DB when p95 > 100 ms at target QPS.
- *Redis*: quotas per student/plan/route (token-bucket mirroring provider limits), resumable stream buffers, prompt/audio caches.
- *Background jobs*: Inngest 4.20 / Trigger.dev 4.5 (verified versions [S43]) give durable steps, retries, and fan-out for ingestion and batch polling; Temporal if the team already knows it.
- *Auth*: Better Auth 1.7.3 (verified [S43]) or Clerk; must support under-13 flows (parental email consent), school SSO (Google Workspace for Education, Microsoft Entra, Clever/ClassLink in the US — prior knowledge), and age assurance signals.
- *Payments*: Stripe globally (Stripe Tax, Checkout, Billing); regional PSPs for markets Stripe underserves — Kazakhstan (Kaspi Pay), Russia (YooKassa/СБП), India (Razorpay/UPI) — (prior knowledge, unverified; sanctions/legal review required for RU). Design a `PaymentProvider` interface and an entitlement service decoupled from PSP webhooks.
- *Mobile*: Expo SDK 57 (verified npm [S43]) — shared TS domain packages, EAS Update for OTA, Expo Router; native only if a feature demands it (camera maths capture works in Expo). PWA for desktop/Chromebook (schools).
- *Observability & evals*: Langfuse (MIT core, self-host, prompt versioning, datasets, LLM-as-judge, OpenTelemetry, Vercel AI SDK integration) [S46]; Braintrust 0.37 (verified PyPI) as a hosted eval/experiments alternative; Helicone (Apache-2.0, proxy or async logging, 10k free requests/month) if a gateway-style logger is preferred [S61]. LangSmith not verified.

### 4.2 Realtime streaming architecture

- Server-Sent Events / streaming `fetch` from the gateway; each assistant turn has a `stream_id`; partial parts written to Redis every ~250 ms so a reconnecting client (mobile network switch) resumes from offset — the AI SDK's UI message stream is the transport, our buffer is the durability.
- Parts model per message: `text`, `thinking_summary`, `citation`, `tool_call`, `tool_result`, `math` (LaTeX), `diagram` (Mermaid/SVG), `flashcard_suggestion`, `mark_card` (per-AO JSON). UI renders parts incrementally; KaTeX renders on part boundaries to avoid flicker.
- Voice: client ↔ gateway WebSocket ↔ Gemini Live; the gateway injects tool results (RAG lookups) and records transcripts as normal messages.
- Backpressure/quotas enforced in the gateway before the provider call; provider `retry-after`/rate-limit headers surfaced to a per-route circuit breaker.

### 4.3 Multi-tenant data model sketch (Postgres)

```
orgs(id, type: school|family|individual, region, data_residency: eu|uk|us|global, plan)
users(id, org_id, role: student|teacher|parent|admin, birth_year_bucket, consent_status, locale)
guardian_links(parent_user_id, student_user_id, consent_evidence_id)
classes(id, org_id, teacher_id, syllabus_id) ; class_members(class_id, student_id)
syllabi(id, board, code, version_years, subject, level) ; syllabus_nodes(id, syllabus_id, parent_id, path, title, objective_text)
documents(id, org_id NULL for global corpus, type, board, syllabus_id, paper, variant, year, session, title, storage_key, hash, licence, parse_version)
sections(id, document_id, parent_id, kind: chapter|section|question|part|ms_item|er_comment|figure|table, label, page_start, page_end, bbox, marks, ao[], command_word)
chunks(id, section_id, text, tokens, embedding halfvec(1024), tsv tsvector, metadata jsonb, embed_model, embed_version)
links(src_section_id, dst_section_id, kind: answered_by|commented_on|assesses|explained_in|prerequisite_of|equivalent_to, confidence, provenance)
conversations(id, user_id, org_id, syllabus_id, mode, model_policy_version) ; messages(id, conversation_id, role, parts jsonb, model, route, usage jsonb, cost_usd, cached_tokens, trace_id)
uploads(id, user_id, storage_key, kind, retention_until, scan_status)   -- student-uploaded files, per-tenant embeddings in chunks with org_id
attempts(id, user_id, section_id (question part), answer_parts jsonb, marks_awarded, ao_breakdown jsonb, model_marks jsonb, teacher_override jsonb, confidence)
cards(id, user_id, source_section_id, front, back, fsrs_state jsonb) ; reviews(card_id, ts, rating, elapsed_days, scheduled_days)
study_plans(id, user_id, exam_date, syllabus_id, plan jsonb) ; events(user_id, type, ts, props jsonb)
eval_datasets / eval_runs (or delegated to Langfuse)
```
Row-level security by `org_id`; global corpus rows have `org_id NULL` and are read-only to tenants; per-tenant uploads never mix into global retrieval; provider files (`file_id`) are stored server-side only and, if using the Anthropic Files API for a school with strict isolation, one Anthropic workspace per tenant (max 100 workspaces per org) [S52].

### 4.4 Prompt management & versioning

Prompts live in Langfuse with semantic versions and labels (`prod`, `canary`); the gateway pins `model_policy_version` per conversation so a mid-conversation prompt change never breaks caches or behaviour; cached prefixes are byte-stable (no timestamps inside the cached block — put dynamic context after the last breakpoint [S6]); every change ships with an eval run on the marking and tutoring datasets; rollbacks are label flips.

### 4.5 Safety filters

Input side: self-harm/abuse detection (route to safe-messaging flow, human escalation for schools), sexual content, exam malpractice (live exam paper leaks, "solve my exam now" during known exam windows — use exam timetables), PII in prompts (redact before third-party providers where policy requires). Output side: age-appropriate language, no personal-data regurgitation from documents, citation presence in syllabus mode. Use a cheap classifier (Haiku 4.5 or a fine-tuned small model) plus provider refusals (`stop_reason: "refusal"` handling on Opus 5 / Fable 5.1 [S56]).

### 4.6 Security (prompt injection, PII)

- OWASP GenAI Top 10 2026: LLM01 Prompt Injection, LLM02 Sensitive Information Disclosure, LLM03 Excessive Agency, LLM04 Supply Chain, LLM05 Data/Model Poisoning, LLM06 Unbounded Consumption, LLM07 Misinformation, LLM08 Hidden Context Exposure, LLM09 Vector and Embedding Weaknesses, LLM10 Improper Output Handling [S47].
- Controls: documents and retrieved chunks are wrapped as data and never given tool authority; tools are allow-listed per route with least privilege (a tutoring turn cannot call "delete card"); sandbox has no network [S29]; per-tenant vector partitions + RLS (LLM09); output HTML sanitised and Mermaid rendered in a sandboxed iframe (LLM10); token/cost quotas per user/route (LLM06); model/version pinning and SBOM for parsers (LLM04); PII minimisation before provider calls, retention limits, and DLP scanning of uploads; secrets never in prompts; Files API IDs never client-supplied [S52].

### 4.7 Privacy & compliance

| Regime | What it means for us | Status of evidence |
|---|---|---|
| GDPR / UK GDPR | Controller for consumer users, processor for schools (DPA + SCCs); DPIA required (children + profiling); children's consent age 13–16 by member state; 72-hour breach notification; data-subject rights tooling (export/delete) [S48] | Verified summary via Google Cloud GDPR page; Article numbers prior knowledge |
| UK ICO Age Appropriate Design Code | 15 standards incl. best interests of the child, DPIA, age-appropriate application, default high-privacy settings, no detrimental nudges, data minimisation, geolocation off by default, parental controls transparency | prior knowledge, unverified (ico.org.uk blocked) |
| COPPA (US, <13) | Verifiable parental consent, notice, data minimisation, school-consent exception for educational use; FTC amended rule (finalised Jan 2025, effective Jun 2025, compliance by Apr 2026) adds separate consent for third-party disclosures and written retention policies | Requirements verified via Google Cloud COPPA page [S49]; dates prior knowledge |
| FERPA (US schools) | Education records, school-official exception (we act under the school's direct control), no re-use for other purposes, parent access | Summary [S50]; details prior knowledge |
| EU AI Act | Annex III "education and vocational training" high-risk categories: systems determining access/admission, evaluating learning outcomes and steering the learning process, assessing appropriate level of education, monitoring prohibited behaviour during tests. A grade-predicting/auto-marking product used by schools is plausibly high-risk → risk management, data governance, technical documentation, logging, human oversight, accuracy/robustness, conformity assessment, registration. Original application date 2 Aug 2026; Digital Omnibus proposal (Nov 2025) would defer Annex III obligations to Dec 2027 (or until standards exist). Transparency duties (Art. 50: tell users they talk to an AI) apply regardless. | **prior knowledge, unverified — highest-priority legal check** |
| Data residency | Anthropic first-party: US or global only [S13]; Vertex regional endpoints for both Claude and Gemini at +10% [S10]; store EU tenants' data in EU regions (Postgres/object storage) | Verified |
| Provider data use | Anthropic: images/uploads not used for training; Fable 5.1 requires 30-day retention (not ZDR-eligible) [S9][S56]; code execution and Files API not ZDR-eligible [S29][S52] | Verified |

Practical stance: ship a per-tenant **policy object** (`residency`, `allowed_providers`, `retention_days`, `age_band`, `consent_mode`) that the router and storage layer consult on every request; EU school tenants default to Vertex regional Claude/Gemini, no DeepSeek, no US-only features requiring Anthropic Files API.

### 4.8 Performance budgets

| Metric | Target | Basis |
|---|---|---|
| LCP / INP / CLS | ≤ 2.5 s / ≤ 200 ms / ≤ 0.1 (p75) | Core Web Vitals [S51] |
| TTFT (cached tutoring turn) | p50 < 800 ms, p95 < 1.5 s | product target; requires cached prefix, `effort: low/medium`, streaming |
| Retrieval + rerank | p95 < 120 ms | pgvector HNSW + light reranker |
| Essay mark (20-marker) | first AO card < 8 s, complete < 45 s | Opus 5 high effort, streamed structured output |
| Voice round trip | < 700 ms | Live API |
| Initial JS (chat route) | < 180 KB gzipped, KaTeX/MathLive/Mermaid/Pyodide lazy-loaded | prior-knowledge budget |
| Offline | notes, flashcards, downloaded syllabus packs usable offline (PWA + SQLite in Expo) | |

### 4.9 Cost controls

Cache everything stable (1h TTL for syllabus packs; automatic conversation caching); route by classifier; per-plan token quotas with soft (slow-down to cheaper tier) and hard limits; Batch API for all unattended work; `max_tokens` discipline on short routes; image downsampling to ≤ 2,000 px before vision calls [S9]; `response_inclusion: "excluded"` on web search to avoid echoing results [S42]; nightly cost-per-active-student dashboards by route/model; alerts when a student's day exceeds 3× median.

---

## 5. Data-model and API contract highlights for the build prompt

- `POST /chat` → `{conversation_id, message_parts[]}` returns SSE with typed parts; server chooses route; response headers include `x-route`, `x-model`, `x-cache-read-tokens`.
- `POST /mark` → `{attempt_id}` returns streamed `mark_card` parts (schema: `{ao: string, awarded: int, max: int, evidence: [{quote, chunk_id}], improvement: string, band: string, confidence: 0..1}`).
- `POST /ingest` (admin) → DAG run id; every document ends with `parse_report` (per-page confidence, disagreements, human QA items).
- `GET /retrieve?q=&syllabus=&filters=` (internal) → chunks with scores and link expansions — used by chat, marking, flashcard generation and the teacher console alike.
- `POST /cards/review` → FSRS update; `GET /plan` → exam-date-aware schedule.
- All tables carry `org_id` + RLS; all model calls carry `trace_id` into Langfuse; all prompts referenced by `(name, version)`.

---

## 6. Honest cost model

Assumptions (per active student per month; token counts are engineering estimates, prices verified above unless noted).

**Tutoring turn (Sonnet 5):** 6,000 input tokens (system+syllabus pack 3,000 cached 1h; history 2,000 auto-cached; RAG 1,000 fresh) → ~1,800 uncached × $2/M = $0.0036; ~4,200 cached × $0.20/M = $0.00084; output 700 tokens (400 visible + ~300 adaptive thinking at low/medium) × $10/M = $0.007 → **≈ $0.0114 per turn**. Same turn on Haiku 4.5 ≈ $0.0057; on Gemini 3.8 Flash (intro) ≈ $0.0043 (≈ $0.0086 at 2027 standard price); on Opus 5 with 1,500 output tokens ≈ $0.050. Uncached Sonnet 5 turn ≈ $0.019 (so caching saves ~40% at this shape; more with longer histories).

**Blended chat turn** (60% cheap tier @ $0.005, 35% Sonnet 5 @ $0.0114, 5% Opus 5 @ $0.05) ≈ **$0.0095**.

**Essay mark (Opus 5, high effort):** 3,500 uncached in ($0.0175) + 6,000 cached MS/exemplars ($0.003) + 4,500 out incl. thinking ($0.1125) ≈ **$0.13 per essay**; Sonnet 5 draft mark ≈ $0.053; adding a GPT-5.6 Sol calibration mark on 20% of essays adds ≈ $0.03 average (snippet pricing).

**Photo solve (Gemini 3.8 Flash transcription + Sonnet 5 explanation):** ≈ $0.003 + $0.012 ≈ **$0.015**.

**Voice minute (Gemini 2.5 Flash Live):** input audio 1,500 tokens × $3/M = $0.0045; output audio ~50% of the minute = 750 tokens × $12/M = $0.009; text/tool tokens ≈ $0.002 → **≈ $0.016 per minute** (pipeline alternative STT $0.016 + LLM $0.01 + TTS ≈ $0.015 ≈ $0.04/min).

**Bulk (batch Haiku):** 200 flashcards/month ≈ $0.05; embeddings/retrieval per query ≈ $0.001–0.002 (rerank dominates; unverified vendor price).

| Persona | Usage | Model spend / month |
|---|---|---|
| Median student | 150 chat turns, 4 essays (Sonnet draft + Opus confirm on 50%), 15 photos, 20 voice min, 200 cards | 1.43 + 0.47 + 0.23 + 0.32 + 0.20 (retrieval/rerank/misc) ≈ **$2.6** (≈ $1.6 if voice unused and essays Sonnet-only) |
| Exam-season heavy user | 500 turns, 8 essays (all Opus), 30 photos, 60 voice min, 400 cards | 4.75 + 1.04 + 0.45 + 0.96 + 0.60 ≈ **$7.8**; with 10% of turns escalating to Opus and longer histories ≈ **$10–13** |
| School seat (light) | 60 turns, 2 essays, 5 photos, no voice | ≈ **$0.9** |

Non-model costs at 10k MAU (rough, prior knowledge): Postgres/Redis/object storage $600–1,500; observability self-hosted $200; ingestion of a 2,000-document corpus one-off ≈ $2–4k (VLM pass + human QA labour dominates). Peak-season multiplier 2–3× on chat.

Implications: at $15–20/month consumer pricing, gross margin on model spend is fine for the median (85–90%) but the heavy tail needs quotas (e.g., 40 Opus-class marks/month, voice minutes cap) or upsell; school seats at $3–6/seat/year are viable only with strict routing to cheap tiers and batch pre-computation.

---

## 7. Top 15 technical risks and mitigations

| # | Risk | Mitigation |
|---|---|---|
| 1 | Marking accuracy below examiner agreement → trust collapse | Examiner-labelled eval set (QWK ≥ 0.80 gate), dual-model + citation-of-MS requirement, confidence bands, teacher override loop, never show "predicted grade" below threshold |
| 2 | Parser errors on scanned/maths-heavy papers (benchmarks ≤ 84 on old-scan maths [S16]) | Two-pass parse + human QA queue; store page images; show source page on hover so students can verify |
| 3 | Provider price/lifecycle shocks (Gemini Flash doubles 1 Jan 2027; Haiku 4.5 may retire after Oct 2026; DeepSeek peak/off-peak) [S10][S5] | Route table in config; monthly re-pricing job; eval suite to swap models in < 1 week |
| 4 | Cache invalidation bugs silently doubling cost (timestamps, image toggles, effort changes) [S6] | Assert `cache_read_input_tokens > 0` in CI on golden conversations; alert on cache-hit-rate drop |
| 5 | Spend caps (Start $500 / Build $1,000) throttle launch [S7] | Reach Scale/Custom tier before marketing; multi-provider failover |
| 6 | No EU inference geo on Anthropic first-party [S13] | Vertex regional endpoints for EU/UK tenants; policy object enforced in router |
| 7 | EU AI Act high-risk classification for auto-marking/grade prediction | Legal determination now; build logging, human oversight, technical documentation from day one; keep "teacher-in-the-loop" as a product mode |
| 8 | Children's data (COPPA/AADC/GDPR) violations | Age gating, parental/school consent flows, data minimisation, retention timers, DPIA, no ads/profiling |
| 9 | Prompt injection via uploaded documents / retrieved chunks (LLM01/08/09) [S47] | Data/instruction separation, tool allow-lists per route, per-tenant vector isolation, sandbox without network |
| 10 | Latency regressions from thinking models (blank pauses) | `effort: low/medium` in chat, `display: "summarized"`, streamed progress UI, TTFT SLOs with alerts |
| 11 | Rerank/retrieval cost or latency exceeding LLM cost at scale | Measure per-query; use lite reranker, cache query→chunk results, precompute for common questions |
| 12 | Copyright/licensing of textbooks and past papers (board and publisher terms) | Licence field per document; tenant-provided materials stay tenant-scoped; legal review of exam-board reuse terms (out of this lens's scope but architecturally enforced) |
| 13 | Tokeniser change (+30% tokens on 4.7+) breaking budgets [S1] | Token budgets expressed per model; `count_tokens` in CI |
| 14 | Vendor lock-in to one SDK's abstractions | AI SDK for transport only; provider-specific features via native SDKs behind our adapter interface |
| 15 | Mobile offline/resume failures during exams season traffic | Resumable streams (Redis buffers), offline packs, load tests at 3× peak |

---

## Implications for our product (testable rules and features)

1. **One primary model per task class, effort-tuned** — tutoring on Sonnet 5 (`effort: medium`), marking on Opus 5 (`effort: high`), trivial turns on Haiku 4.5/Flash-Lite; cascades only where a classifier can decide *before* the call. Test: ≥ 95% of turns hit the intended route; blended chat turn ≤ $0.012.
2. **Cache-first prompt layout**: static persona + syllabus pack (≥ 1,024 tokens, 1h TTL) before any dynamic content; CI asserts cache reads on golden transcripts. Test: cache-read share ≥ 60% of input tokens in production.
3. **Citations are non-negotiable in syllabus mode**; unsupported claims are visually de-emphasised. Test: ≥ 98% of syllabus-mode answers contain ≥ 1 resolvable citation.
4. **Marking output is structured JSON per AO with quoted mark-scheme evidence**; UI renders per-AO cards progressively. Test: schema-valid 100%; QWK ≥ 0.80 vs examiners on 9609 P2 before public "grade" claims.
5. **Dual-family verification on high-stakes marks** (Opus 5 + GPT-5.6 Sol on a sample; disagreement > 1 band → human). Test: disagreement rate tracked weekly, < 10%.
6. **Every numeric/symbolic answer is machine-verified** (SymPy in sandbox/Pyodide) before display; show "verified" badge. Test: 0 unverified numeric finals in STEM routes.
7. **Two-pass ingestion with per-page confidence and human QA**; source page image viewable from every citation. Test: page-level transcription accuracy ≥ 98% on a 200-page audit set.
8. **Metadata-first retrieval**: syllabus code + version filters applied before similarity; hybrid BM25+vector with RRF; rerank top-50→8. Test: Recall@8 ≥ 0.92 on the gold set.
9. **Question ↔ mark scheme ↔ examiner report ↔ textbook links are first-class rows**, used for "why did I lose marks" and "show me a past question on this". Test: ≥ 95% of questions in indexed papers linked to MS items.
10. **Cross-board equivalence graph** so explanations generalise beyond CAIE. Test: a topic query in Edexcel returns CAIE-derived explanations with correct terminology mapping.
11. **Vision routes downsample to ≤ 2,000 px and transcribe first, reason second** (transcript shown for student confirmation). Test: median photo-solve cost ≤ $0.02.
12. **Voice via Gemini Live with the same RAG tools**; transcripts stored as messages. Test: round-trip < 700 ms p50; cost ≤ $0.02/min.
13. **Batch everything unattended** (tagging, flashcards, summaries, evals) with 1h caches. Test: ≥ 80% of offline tokens billed at batch rates.
14. **FSRS-6 scheduling with exam-date awareness** (retention raised near exams, intervals capped at exam date; per-student optimisation after ~1,000 reviews). Test: predicted vs observed recall calibration error < 5%.
15. **Per-tenant policy object** drives provider choice, residency, retention, age mode; EU school tenants → Vertex regional only. Test: zero requests from EU tenants to non-EU endpoints in audit logs.
16. **Data/instruction separation and least-privilege tools** per route; sandboxes without network; per-tenant embedding partitions. Test: red-team injection suite (documents with hidden instructions) passes 100%.
17. **Resumable streams and typed message parts** (text, math, citation, diagram, mark_card, flashcard_suggestion). Test: reconnect mid-answer loses zero content.
18. **Performance SLOs baked into CI**: LCP ≤ 2.5 s, INP ≤ 200 ms, TTFT p50 < 800 ms on cached turns; heavy libraries lazy-loaded. Test: Lighthouse + synthetic TTFT checks on each deploy.
19. **Prompt/model policy versioning pinned per conversation**; evals run on every prompt change; rollback = label flip. Test: no cache-hit-rate drop after prompt deploys.
20. **Cost governance**: per-plan quotas by route (Opus-class marks/month, voice minutes), soft degrade to cheaper tier, daily anomaly alerts. Test: 99th-percentile student spend ≤ 6× median.
21. **Model-agnostic adapters** with provider-native features (Anthropic caching/citations/structured outputs; Gemini thinking level/context cache; OpenAI reasoning effort) exposed through one internal interface. Test: swapping the tutoring model behind a flag requires no UI change.
22. **Age-appropriate defaults**: no ads/profiling, high-privacy defaults, parental/school consent gates, retention timers on uploads. Test: DPIA completed; consent coverage 100% for under-16 accounts.
23. **Teacher console shares the retrieval and marking services** (no separate stack), with override capture feeding evals. Test: teacher overrides reduce model-examiner disagreement quarter over quarter.
24. **Web lookups restricted to exam-board/publisher domains** for syllabus facts. Test: 0 citations to non-allow-listed domains in syllabus mode.

---

## Open questions / things we could not verify

1. OpenAI GPT-5.6 official pricing, realtime audio pricing, file-search/vector-store pricing, embeddings and fine-tuning prices (openai.com and developers.openai.com blocked; only aggregator snippets).
2. DeepSeek V4 official pricing after 16 Aug 2026 — aggregators disagree (flat $0.14/$0.28 vs peak/off-peak $0.22–0.44 / $0.66–1.32 for Flash); also whether the Anthropic-compatible endpoint supports caching semantics.
3. Gemini: context-cache **storage** price per hour on 3.x models; Gemini 3.x native-audio Live API pricing; PDF page limits and tokens/page on 3.x; Batch discount (Vertex "Flex/Batch" 50% vs cookbook "up to 90%").
4. Mathpix, Reducto, Azure Document Intelligence, LlamaParse (llama-cloud ≥ 1.0) current pricing and accuracy on exam papers.
5. Vector DB pricing (Turbopuffer, Qdrant Cloud, Pinecone) — needed only if pgvector proves insufficient.
6. Reranker pricing (Voyage rerank-2.5, Cohere Rerank) — could dominate per-query cost.
7. E2B / Modal sandbox pricing and cold-start latency; Pyodide bundle size on current release (314.x).
8. Desmos API and GeoGebra commercial licensing terms for a paid ed-tech product.
9. EU AI Act: current status of the Digital Omnibus delay and whether auto-marking/grade prediction for consumers (not schools) falls under Annex III; UK AADC applicability tests; FTC COPPA amended-rule dates.
10. Anthropic: whether a Haiku 5-class model is imminent (Haiku 4.5 retirement floor 15 Oct 2026); EU inference geo roadmap; Fable 5.1 30-day retention requirement vs school ZDR demands.
11. Exam-board licensing terms for reproducing past papers/mark schemes inside a commercial product (not architecture, but it gates the corpus).
12. Real-world TTFT/throughput numbers per model (Artificial Analysis and provider status pages were not reachable) — must be measured in our own region before finalising SLOs.

---

## Sources

- [S1] Anthropic pricing — https://platform.claude.com/docs/en/about-claude/pricing
- [S2] Anthropic models overview — https://platform.claude.com/docs/en/about-claude/models/overview
- [S3] Claude Opus 5 overview — https://platform.claude.com/docs/en/models/opus-5/overview
- [S4] Claude Sonnet 5 overview — https://platform.claude.com/docs/en/models/sonnet-5/overview
- [S5] Claude Haiku 4.5 overview — https://platform.claude.com/docs/en/models/haiku-4-5/overview
- [S6] Anthropic prompt caching — https://platform.claude.com/docs/en/build-with-claude/prompt-caching
- [S7] Anthropic rate limits — https://platform.claude.com/docs/en/api/rate-limits
- [S8] Anthropic, Optimizing for cost and intelligence (measured multi-model data) — https://platform.claude.com/docs/en/about-claude/models/optimizing-for-cost-and-intelligence
- [S9] Anthropic vision — https://platform.claude.com/docs/en/build-with-claude/vision
- [S10] Google Cloud Vertex AI generative AI pricing (downloaded and parsed 6 Sep 2026) — https://cloud.google.com/vertex-ai/generative-ai/pricing
- [S11] CloudZero, Gemini pricing 2026 (search snippet) — https://www.cloudzero.com/blog/gemini-pricing/
- [S12] Anthropic embeddings guide (Voyage models) — https://platform.claude.com/docs/en/build-with-claude/embeddings
- [S13] Anthropic data residency — https://platform.claude.com/docs/en/manage-claude/data-residency
- [S14] Anthropic PDF support — https://platform.claude.com/docs/en/build-with-claude/pdf-support
- [S15] Anthropic citations — https://platform.claude.com/docs/en/build-with-claude/citations
- [S16] olmOCR repository and olmOCR-bench table — https://github.com/allenai/olmocr
- [S17] Marker repository (benchmarks, licence) — https://github.com/datalab-to/marker
- [S18] Docling repository — https://github.com/docling-project/docling
- [S19] Docling chunking concepts — https://raw.githubusercontent.com/docling-project/docling/main/docs/concepts/chunking.md
- [S20] OpenAI reasoning guide / GPT-5.6 (search snippets) — https://developers.openai.com/api/docs/guides/reasoning ; https://openai.com/index/gpt-5-6/
- [S21] Morph, OpenAI API pricing 2026 (search snippet) — https://www.morphllm.com/openai-api-pricing ; BenchLM — https://benchlm.ai/openai/api-pricing
- [S22] OpenRouter GPT-5.6 Sol (search snippet) — https://openrouter.ai/openai/gpt-5.6-sol
- [S23] DeepSeek pricing aggregators (search snippets, conflicting) — https://www.cloudzero.com/blog/deepseek-pricing/ ; https://coworker.ai/blog/deepseek-api-pricing ; https://www.aipricing.guru/deepseek-pricing/
- [S24] DeepSeek V4 guides (search snippets) — https://www.morphllm.com/deepseek-v4 ; https://api-docs.deepseek.com/news/news260424/
- [S25] MinerU repository — https://github.com/opendatalab/MinerU
- [S26] Chunkr repository — https://github.com/lumina-ai-inc/chunkr
- [S27] pgvector repository — https://github.com/pgvector/pgvector
- [S28] Anthropic structured outputs — https://platform.claude.com/docs/en/build-with-claude/structured-outputs
- [S29] Anthropic code execution tool — https://platform.claude.com/docs/en/agents-and-tools/tool-use/code-execution-tool
- [S30] PyPI JSON API (versions/dates: docling 2.126.0, marker-pdf 2.0.0, ragas 0.4.3, fsrs 6.3.2, langfuse 4.15.1, braintrust 0.37.0, e2b 2.46.4, modal 1.5.5, mineru 3.4.5, anthropic 1.4.0, openai 3.8.0, google-genai 2.22.0) — https://pypi.org/pypi/<package>/json
- [S31] Google Gen AI Python SDK README — https://github.com/googleapis/python-genai
- [S32] py-fsrs — https://github.com/open-spaced-repetition/py-fsrs
- [S33] ts-fsrs — https://github.com/open-spaced-repetition/ts-fsrs
- [S34] SRS benchmark — https://github.com/open-spaced-repetition/srs-benchmark
- [S35] E2B — https://github.com/e2b-dev/E2B
- [S36] Pyodide — https://github.com/pyodide/pyodide
- [S37] KaTeX — https://github.com/KaTeX/KaTeX
- [S38] MathLive — https://github.com/arnog/mathlive
- [S39] TikZJax — https://github.com/kisonecat/tikzjax
- [S40] Google Cloud Text-to-Speech pricing (parsed) — https://cloud.google.com/text-to-speech/pricing
- [S41] Google Cloud Speech-to-Text pricing (parsed) — https://cloud.google.com/speech-to-text/pricing
- [S42] Anthropic web search tool — https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-search-tool
- [S43] npm registry (versions/dates: ai 7.0.93, next 16.3.4, react 19.2.8, ts-fsrs 5.4.2, mathlive 0.110.0, katex 0.18.6, mermaid 11.17.2, @excalidraw/excalidraw 0.18.1, expo 57.0.20, pyodide 314.0.6, @anthropic-ai/sdk 0.124.0, openai 7.10.0, @google/genai 2.21.0, better-auth 1.7.3, inngest 4.20.0, @trigger.dev/sdk 4.5.16) — https://registry.npmjs.org/<package>
- [S44] Vercel AI SDK — https://github.com/vercel/ai
- [S45] Expo — https://github.com/expo/expo
- [S46] Langfuse — https://github.com/langfuse/langfuse
- [S47] OWASP GenAI/LLM Top 10 (2026) — https://github.com/GenAI-Security-Project/GenAI-LLM-Top10 (legacy: https://github.com/OWASP/www-project-top-10-for-large-language-model-applications)
- [S48] Google Cloud GDPR overview — https://cloud.google.com/privacy/gdpr
- [S49] Google Cloud COPPA overview — https://cloud.google.com/security/compliance/coppa
- [S50] Google Cloud FERPA overview — https://cloud.google.com/security/compliance/ferpa
- [S51] web-vitals library (Core Web Vitals thresholds) — https://github.com/GoogleChrome/web-vitals
- [S52] Anthropic Files API — https://platform.claude.com/docs/en/build-with-claude/files
- [S53] Anthropic batch processing — https://platform.claude.com/docs/en/build-with-claude/batch-processing
- [S54] Gemini API cookbook — https://github.com/google-gemini/cookbook
- [S55] OpenAI Node SDK README — https://github.com/openai/openai-node
- [S56] Anthropic `claude-api` skill reference (cached 2026-06-24; model IDs, thinking/effort semantics, refusal handling) — bundled skill documentation, corroborated by [S1]–[S5]
- [S57] Google Cloud Document AI pricing (parsed) — https://cloud.google.com/document-ai/pricing
- [S58] llama_cloud_services (deprecated May 2026) — https://github.com/run-llama/llama_cloud_services
- [S59] Ragas — https://github.com/explodinggradients/ragas
- [S60] DeepSeek-OCR — https://github.com/deepseek-ai/DeepSeek-OCR ; DeepSeek org — https://github.com/deepseek-ai
- [S61] Helicone — https://github.com/Helicone/helicone
- [S62] Anthropic choosing a model — https://platform.claude.com/docs/en/about-claude/models/choosing-a-model
- [S63] Search summaries used for Anthropic/OpenAI/Gemini/DeepSeek overviews (Finout, CloudZero, MetaCTO, DevTk, BenchLM, Evolink, Layer3Labs, Gate.ai, Appwrite, NxCode, Atlas Cloud) — URLs as listed in the search results of 6 Sep 2026; treated as secondary.
