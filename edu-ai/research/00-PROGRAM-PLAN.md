# EDU-AI MASTER PROMPT — PROGRAM PLAN (internal)

Workspace: /tmp/claude-0/-home-user-clouds/3ab4e0c1-0373-5c72-a707-49052c8ca89d/scratchpad/edu-ai
Repo: /home/user/clouds  branch: claude/educational-ai-chat-design-tke9n9
Deliverable in repo: edu-ai/MASTER-PROMPT.md (+ edu-ai/research/*.md appendices, edu-ai/designs/*.md)
Language of deliverable: English (for AI coding agents). Reply to founder in Russian.

## Phases
A. Research (8 lenses, 4 parallel workflows) -> research/*.md            [running]
B. Index + gap check -> research/INDEX.md, research/gap-*.md
C. Design: 4 independent product visions (pedagogy-first, exam-outcomes-first, craft/design-first, platform-first) -> designs/vision-*.md
D. Judge panel (3 judges, rubric) + synthesis -> designs/SYNTHESIS.md (the product bible outline & decisions)
E. Section writers (parallel) -> draft/NN-*.md
F. Editor stitch -> final/MASTER-PROMPT.md v1
G. Critics (learning scientist, product designer, CTO, Cambridge examiner/teacher, student, lawyer/privacy, "why ChatGPT still wins" adversary, completeness) -> critiques/*.md
H. Revise + polish -> final/MASTER-PROMPT.md v2
I. Copy to repo, commit, push. Optional artifact.

## Master prompt section outline (target ~25-40k words total)
00 How to use this document (for the executing AI agent/team): roles, non-negotiables, how to resolve ambiguity, definition of done
01 Mission, vision, principles; positioning: why better than ChatGPT/Gemini/Claude for learning (the honest answer)
02 Users: personas, jobs-to-be-done, exam-year moments, scenarios
03 Table-stakes parity: everything frontier chats have (acceptance checklist)
04 The learning core (unique): tutor modes & pedagogy engine; misconception diagnosis; mastery model; spaced retrieval; cognitive-debt guard; metacognition/calibration; study planner; motivation without dark patterns
05 The exam engine: past papers, mark schemes, examiner reports; AI examiner (marking by AO/level with rationale, accuracy targets); predicted grades; exam-style question generation; handwriting photo marking; timing practice
06 The library: books & papers ingestion, structure, citations, "show me in the book", licensing strategy
07 Learner memory & knowledge graph: what we remember, how it shapes tutoring, privacy controls
08 Model orchestration: routing policy across DeepSeek/Claude/GPT/Gemini, prompts, fallbacks, cost, evals
09 Design system & UX spec ("every pixel"): principles, tokens (type, space, color OKLCH, radii, motion), components, states, accessibility, dark mode, mobile, microcopy voice, anti-patterns
10 Screen-by-screen spec: onboarding, home, chat, tutor session, past-paper mode, marking view, library/reader split view, flashcards/review, planner, progress/mastery, settings, teacher/parent dashboard, sharing
11 Technical architecture: stack, data model, APIs, RAG pipeline, tools/sandbox, realtime, offline, security, privacy & compliance, performance budgets, observability, cost controls
12 Safety, integrity & wellbeing: academic-integrity stance, honesty/hallucination controls, age-appropriate design, mental health, teacher endorsement
13 Quality bar & evaluation: pedagogy evals, marking-accuracy eval vs real mark schemes (QWK targets), RAG evals, design QA checklist, performance budgets, release gates
14 Roadmap: MVP (Cambridge-first) -> v1 -> v2; milestones; metrics that matter; risks
15 Appendices: system prompts per mode, marking rubric templates, question-tagging schema, prompt templates, glossary, open questions for the founder

## Revised agent plan (usage-window economy; ~20 agents total from here)
B. Index: research/INDEX.md ............................................ done (7.3k words)
C. Visions: designs/vision-{pedagogy,craft,platform}.md ................. running
D. Judge+synthesis (1 agent): designs/JUDGING.md + designs/SYNTHESIS.md
E. Section writers (7 agents, parallel 2 workflows), each 3–6k words, write skeleton first:
   W1  draft/00-01-02.md  How to use · Mission/positioning · Users/personas/scenarios
   W2  draft/03-08.md     Table-stakes parity checklist · Model orchestration
   W3  draft/04-07.md     Learning core (pedagogy engine) · Learner memory & knowledge graph
   W4  draft/05-06.md     Exam engine · Library/content/licensing
   W5  draft/09-10.md     Design system & UX spec · Screen-by-screen spec
   W6  draft/11-12.md     Technical architecture · Safety/integrity/wellbeing
   W7  draft/13-14-15.md  Quality bar & evals · Roadmap/metrics/risks · Appendices (prompts, rubric templates, schemas, glossary, founder questions)
F. Editor (1): stitch → final/MASTER-PROMPT.md v1 (TOC, numbering, cross-refs, dedupe, consistent terms)
G. Critics (4, parallel): learning-scientist+examiner · designer+student · CTO+lawyer/privacy · "why ChatGPT still wins"+completeness → critiques/*.md (structured findings: severity, section, issue, fix)
H. Revise (2 agents split by section) + final polish (1) → final/MASTER-PROMPT.md v2
I. Deliver: edu-ai/MASTER-PROMPT.md + edu-ai/designs/ + edu-ai/research/ ; commit; push; Russian summary to founder
Rule for every agent: create output file with headings first, append as you go.
