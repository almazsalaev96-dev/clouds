# Progress

_Updated at the end of each working session. Kept honest: stubbed means stubbed._

## Done

### Phase 0 — Foundations ✅
- pnpm workspace, TypeScript strict everywhere, shared base config.
- `@atlas/learning`: FSRS-6 (ported faithfully from the reference implementation,
  including learning/relearning steps, same-day stability, difficulty damping with
  mean reversion, and deterministic id-seeded fuzz), interleaved session building,
  mastery estimation with an anti-cram rule, calibration, and marks-at-risk
  prioritisation. **51 tests.**
- `@atlas/content`: schemas where provenance and licence are required fields, the
  Cambridge 9609 syllabus with paper and AO weightings, mark arithmetic, and a
  60-item authored starter deck. **18 tests.**
- `@atlas/web`: installable offline PWA — Today, Review, Syllabus map, Settings.
  Event-sourced study log in IndexedDB; every screen is a projection replayed
  through the engine.

**Phase 0 acceptance ("review real cards, on web, offline, with correct
scheduling") is met**, verified by a browser end-to-end run:
keyboard-only session completes · reviews persist across reload · streak recorded ·
calibration appears once there are enough rated answers · lapsed cards return
within the same sitting · the app loads and reads its data with the network off.

## Next

### Phase 1 — the owner's real use case, end to end
1. Upload a past paper + mark scheme, OCR and pair them.
2. Auto-generate items from uploaded material, with a fast human review queue.
3. AI marking against the real level descriptors, with the length-bias and
   valid-but-unlisted-reasoning defences from MASTER-PROMPT.md §6.3.
4. Timed mock mode and honest grade prediction with a confidence band.

### Then
Phase 2 mobile + sync · Phase 3 any subject, any board · Phase 4 mocks and social ·
Phase 5 scale and polish.

## Known gaps (deliberate, not forgotten)

- Single subject seeded. The engine is subject-agnostic; the *content* is not yet.
- No accounts and no sync — everything is device-local by design until Phase 2.
- No AI features yet. No key is wired, nothing calls a model, nothing pretends to.
- Service worker caches the shell only; there is no background sync queue yet.
- Marks per sub-topic are a teaching estimate, labelled as such in the UI.

## What I need from the owner

- [ ] Full subject list + exam board + syllabus codes + **exam dates**
- [ ] Materials: syllabuses, textbooks, notes, **past papers + mark schemes +
      examiner reports**
- [ ] API keys (Anthropic, and any of OCR / TTS / ASR) — via a secret store, not chat
- [ ] Preferred languages for the interface and for the tutor
- [ ] Whether this stays private or ships to classmates (changes auth, moderation,
      licensing)

Defaults are already chosen for all of these (MASTER-PROMPT.md §20), so nothing is
blocked while waiting.
