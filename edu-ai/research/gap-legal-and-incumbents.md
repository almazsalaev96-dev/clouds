# Gap Research: Content Licensing/Copyright and Exam-Prep Incumbents (September 2026)

Researcher lens: (A) copyright/licensing of past papers, mark schemes and textbooks for an AI product; (B) current features, pricing and complaints of exam-prep incumbents with AI features.
Method note: web-search snippets were the primary evidence source; most exam-board/publisher/news hosts block direct fetches from this environment. Every fact carries a source URL; items from memory are marked "(prior knowledge, unverified)". Nothing in this document is legal advice.

## 0. Executive summary

**Part A (legal).** Every board we care about asserts full copyright over past papers, mark schemes and examiner reports. Cambridge International is the strictest: its help centre says it "is unable to give permission to publish past examination papers on any website" and does not grant permission for "electronic publication of questions from past examination papers or for the reproduction of any mark schemes, examiners' reports". Pearson, AQA and IB say similar things (centres may copy internally; nobody else may republish); College Board publishes AP FRQs and scoring guidelines openly but still requires permission for reuse. The big free archives (PapaCambridge, XtremePapers, GCE Guide, PMT) and the new wave of CAIE "past papers + AI" apps (Paperstack, AI Examiner, Cambridge Assistant, ThinkIGCSE, tryexampal, Aixampapers) run on tolerance, not licences; no takedown was found, but none has a permission either. The regulatory picture in Sept 2026 gives no shortcut: the UK government's March 2026 statutory report abandoned the TDM-exception-with-opt-out and kept the status quo (no commercial TDM exception); the EU GPAI Code of Practice copyright duties are enforceable from 2 Aug 2026 (they bind our model vendors, not us); in the US, Bartz and Kadrey helped model *training* but not RAG display, and Thomson Reuters v. Ross — the closest analogue to ingesting a rival's editorial content — went against the AI company at first instance and is awaiting a Third Circuit decision. The one genuinely positive lever: Cambridge University Press & Assessment already runs an opt-in AI-licensing programme for its books and owns both the exam board and the endorsed textbooks, and the UK CLA has built a collective generative-AI licence that explicitly covers RAG. Launch strategy: own/original content + user-supplied materials processed transiently + deep links to official PDFs now; short paraphrased, cited extracts with caps; licence Cambridge and CLA repertoire before hosting or quoting mark schemes/textbooks at scale.

**Part B (incumbents).** "AI marking against the mark scheme" is now a commodity claim (Save My Exams Smart Mark, Seneca's £19.99 AI tier, Medly AI, Paperstack, ThinkIGCSE, tutor2u Examiner AI, Top Marks, Olex, ReMarkAble, MarkMe), but nobody publishes marking accuracy, nobody cites the source of a piece of feedback, and the credible UK AI markers are AQA/Edexcel/OCR-only. Complaints cluster on aggressive paywalls and surprise charges (Save My Exams), inaccurate AI marking (Medly), unusable maths in chat form, repetitive banks, static PDFs, and school anti-AI friction (Sparx's 2026 upgrade). Cambridge International students are served by a paid library (Save My Exams), a charity (ZNotes), free PDF mirrors, and small legally fragile AI apps. The white space is a Cambridge-first, examiner-report-grounded, levels/AO-based marking loop with published accuracy, a compliant bring-your-own-paper model schools can endorse, and a grade model tied to real CAIE thresholds — priced against a tutor, not against a notes site, with a free tier that is actually usable.

## PART A — LEGAL / LICENSING

### A1. Exam-board copyright statements for past papers and mark schemes

**Cambridge International (Cambridge University Press & Assessment / UCLES)**
- Cambridge's own help centre answers the question "Can I reproduce Cambridge past examination papers on the school's website/my website?" with a clear no: Cambridge "is unable to give permission to publish past examination papers on any website or school intranet" because of lack of control over the material once online, citing "several incidents of misuse of Cambridge material (including its sale online)". Source: https://help.cambridgeinternational.org/hc/en-gb/articles/203544371-Can-I-reproduce-Cambridge-past-examination-papers-on-the-school-s-website-my-website
- The permissions article states Cambridge "does not grant permission for the use of complete examination papers, nor ... for electronic publication of questions from past examination papers or for the reproduction of any mark schemes, examiners' reports, questions set in multiple choice form or music or language CDs". Source: https://help.cambridgeinternational.org/hc/en-gb/articles/115004418469-How-do-I-apply-for-permission-to-use-Cambridge-copyrighted-material (search snippet)
- The parent help category is "Publications and copyright": https://help.cambridgeinternational.org/hc/en-gb/categories/200545072-Publications-and-copyright
- General cambridge.org legal terms: materials "may be downloaded and printed solely for personal reference, but not otherwise copied, distributed, adapted or altered in any way or transmitted to others without the written permission of Cambridge University Press & Assessment". Source: https://www.cambridge.org/legal/copyright
- Public vs School Support Hub (prior knowledge, unverified): Cambridge publishes specimen papers and a limited set of recent past papers (typically the most recent series or two) on the public syllabus pages; the full archive, examiner reports and the newest series are behind the School Support Hub, which is restricted to registered-centre staff. No public statement about AI/RAG use was found in search snippets.
- Practical reading: Cambridge's stated position is the most restrictive of the boards — no electronic republication of questions, and an explicit refusal for mark schemes and examiner reports. Any server-side hosting or verbatim display of Cambridge mark schemes by a commercial AI product without a licence is contrary to their published policy.

**Pearson Edexcel**
- Pearson's copyright policy page states that all Edexcel-published materials — specifications, schemes of work, past question papers, mark schemes — are protected by copyright and "may not be copied or made available electronically in whole or in part without permission from Pearson". Source: https://qualifications.pearson.com/en/support/support-topics/exams/past-papers/pearson-copyright-policy.html
- Centres may keep copies on intranets/microsites only if access is restricted to the centre community, used for instruction only, not sold, and retained "no longer than 5 years after the examination series". Source: same page.
- Some papers containing third-party copyright (e.g. literature extracts) are not made available at all for revision because rights holders did not clear use beyond the exam. Source: https://qualifications.pearson.com/en/support/support-topics/exams/past-papers/past-papers-information-for-students.html
- The commonly-repeated claim that Pearson grants blanket permission to "non-commercial revision websites" was NOT confirmed in snippets; the policy page as surfaced speaks about centres, not third-party sites. Treat as unverified.

**AQA**
- "All AQA publications, including past question papers, mark schemes and specifications, are subject to copyright and may not normally be reproduced in whole or in part without the prior written permission of AQA." Centres need no permission for internal teaching/mock use if no charge is made. "Specific permission must be obtained from AQA in respect of past questions or other materials which it is proposed to include in text books, journals or other publications." Source: https://www.aqa.org.uk/about-us/who-we-are/our-standards/copyright-and-intellectual-property-policy and https://www.aqa.org.uk/about-us/who-we-are/our-standards/copyright-and-intellectual-property-policy/copyright-policy-for-centres ; material-use policy PDF: https://filestore.aqa.org.uk/admin/library/AQA-MAT-USE-POLICY.PDF
- AQA keeps papers/mark schemes/reports public for three years; papers go public one year after the series (the first year they are locked for mock use). Source: https://www.aqa.org.uk/past-papers-and-mark-schemes-finder (snippet)

**OCR** — no OCR-specific policy surfaced in the search budget; OCR's terms (prior knowledge, unverified) mirror AQA's: free internal centre use, written permission for republication. Treat as unverified.

**IB**
- IB's IP page: "Unauthorized use of IB content constitutes copyright infringement and will be prosecuted by the IB to the fullest extent of the law." Exam papers, questionbank and markschemes are IB copyright; public redistribution is prohibited without written licence; only specimen papers are open. Source: https://ibo.org/terms-and-conditions/intellectual-property/ and https://ibo.org/terms-and-conditions/
- IB does allow third parties (tutoring services, publishers, anyone in the ecosystem) to *purchase* past papers and markschemes from the IB Follett Store — purchase is not a redistribution licence. Source: snippet via https://llms.revisiondojo.com/ib-past-papers-legal-access-and-mark-schemes (secondary; confirm on ibo.org)
- The IB is known among students as an active enforcer (forum threads such as https://ibsurvival.com/topic/1754-ib-past-papers-punishment/ discuss it), which is why IB prep sites generally write their own IB-style questions rather than host papers.

**College Board (AP)**
- AP Central publicly posts free-response questions, scoring guidelines, sample responses and score distributions, typically for recent years (snippets say "the three most recent years" on some course pages; older PDFs remain reachable). Sources: https://apcentral.collegeboard.org/courses/ap-calculus-ab/exam/past-exam-questions ; https://apcentral.collegeboard.org/courses/ap-english-language-and-composition/exam/past-exam-questions
- Reuse of College Board content requires a permission request: https://privacy.collegeboard.org/copyright-trademark/request-instructions . Publicly posted FRQs are still copyrighted; "released" means published, not public-domain.
- Exam-security policy: students may discuss FRQs only once posted by College Board; sharing unreleased content leads to score cancellation. Source: https://apstudents.collegeboard.org/exam-policies-guidelines/exam-security-policies

### A2. What incumbents do with board PDFs

- **PapaCambridge / XtremePapers / GCE Guide**: all three host full CAIE archives (question papers, mark schemes, examiner reports, grade thresholds). E.g. https://pastpapers.papacambridge.com/papers/caie/igcse . No public record of a Cambridge lawsuit or takedown against them surfaced in search; Cambridge's stated policy nevertheless denies permission for exactly this. Their persistence appears to reflect enforcement priorities/jurisdiction (many are operated outside the UK), not a licence. (Assessment, not verified fact.)
- **Third-party disclaimer pattern**: smaller hosts (e.g. Past Papers Academy https://pastpapersacademy.com/terms , Lumia Papers https://lumiapapers.com/terms ) publish terms stating they claim no ownership and that copyright remains with the boards — a disclaimer, not a permission.
- **ZNotes**: ZNotes' own notes carry a copyright notice ("ZNotes Foundation ... no part of the documents may be copied or re-uploaded to another website without the express, written permission of the copyright owner"; not to be sold) — this appears in the PDFs' front matter (snippet via https://www.scribd.com/document/885378504/IGCSE-Physics-Znotes ). The belief that ZNotes is CC BY-NC-SA was NOT confirmed by the search snippets; the PDF notice reads as all-rights-reserved with free educational access. Treat "CC BY-NC-SA" as unverified. ZNotes also does not itself host board PDFs; it publishes its own notes and now an app ( https://apps.apple.com/us/app/znotes-study-notes-revision/id6761271207 ).
- **Physics & Maths Tutor**: hosts PDFs of past papers/mark schemes for UK boards and CAIE ( https://www.physicsandmathstutor.com/past-papers/ ). Its permission basis was not visible in snippets. (Prior knowledge, unverified: PMT states it hosts papers with the boards' permission and removes papers on request, and hosts exam-board-locked papers only after their embargo.)
- **Save My Exams**: (prior knowledge, unverified) links to/hosts past-paper PDFs but its main product is its own topic-question banks and model answers written in-house, which sidesteps board copyright for the paid layer.
- Bottom line: the large free archives run on tolerance, not licences. A venture-backed AI product with a clear owner and payment flow is a far easier enforcement target than an offshore PDF mirror.

### A3. Textbook publishers and collective licensing (2024–2026)

- **Cambridge University Press & Assessment** — has an explicit, opt-in AI licensing programme for its *academic* books: in 2024–25 it wrote to ~20,000 authors seeking opt-in consent to license their works to generative-AI companies (The Bookseller: https://www.thebookseller.com/news/cambridge-university-press--assessment-writes-to-20k-authors-for-ai-licensing-opt-in ). Cambridge's stated rationale: licensing "enables the creation of legal frameworks and formal licensing arrangements to govern use and better protect authors' rights" and "makes high-quality information available to generative AI tools so that it can help improve accuracy" (Cambridge blog: https://www.cambridge.org/mv/universitypress/about-us/news-and-blogs/uncharted-territory-ai-and-the-cambridge-approach-for-academic-book-publishing ; interview with Ben Denne: https://www.authorsalliance.org/2025/03/17/ai-licensing-an-interview-with-ben-denne-of-cambridge-university-press/ ). In August 2025 the approach was updated (snippet). Important nuance: this is the *academic press* side; whether the same programme extends to the Cambridge International endorsed-textbook range (e.g. the Cambridge International AS & A Level Business coursebook) or to assessment materials was not confirmed. The same legal entity owns the exam board, which makes Cambridge the single most valuable licensing conversation for this product.
- **Pearson, Hodder Education, OUP, Collins** — no publicly announced AI content-licensing programme for school textbooks surfaced in the search budget. (Prior knowledge, unverified: Pearson positions itself as an AI *product* company — AI study tools in Pearson+ / Mastering — rather than a content licensor; OUP has publicly discussed AI licensing of academic content and has struck some deals; HarperCollins (parent of Collins) did a 2024 opt-in AI-training deal for selected non-fiction titles via Microsoft.) These need direct verification before being relied on.
- **UK Copyright Licensing Agency (CLA)** — the CLA is developing/launching a collective "Generative AI Training Licence" covering "text use in training, fine-tuning of AI language models, and retrieval-augmented generation (RAG)", described as the first of its kind in the UK, with a planned Q3-2025 launch; it was agreed with PLS and ALCS. Sources: https://cla.co.uk/ai-and-copyright/ ; https://www.pls.org.uk/news-events-policy/news/pls-and-alcs-agree-to-development-of-pioneering-cla-generative-ai-licence/ ; https://wiggin.co.uk/insight/ai-and-copyright-copyright-licensing-agency-developing-a-generative-ai-training-licence/ ; https://uk.practicallaw.thomsonreuters.com/w-046-6706 . The CLA also states its existing licence permissions enable UK professionals to use licensed content to *prompt* generative AI tools (cla.co.uk/ai-and-copyright). Caveats: (i) the schools' CLA Education Licence is held by schools, not by edtech vendors, and covers copying by the school for its pupils — it does not license a third-party SaaS to ingest textbooks (assessment based on the licence's structure; prior knowledge, unverified for 2026 wording); (ii) the new AI licence is a *business-to-AI-developer* licence whose repertoire depends on which publishers opt in — whether Hodder/Cambridge/OUP school textbooks are in the repertoire must be asked directly; (iii) exam papers are not CLA repertoire — exam boards license them themselves.
- Actionable contacts: Cambridge permissions (help centre article above), CLA AI licensing page (https://cla.co.uk/ai-and-copyright/), College Board permissions form (https://privacy.collegeboard.org/copyright-trademark/request-instructions), IB via ibo.org terms page, AQA copyright team via the IP policy page.

### A4. Legal landscape, September 2026

**United Kingdom**
- On 18 March 2026 the government published the statutory *Report on Copyright and Artificial Intelligence* and impact assessment required by the Data (Use and Access) Act 2025 ( https://www.gov.uk/government/publications/report-and-impact-assessment-on-copyright-and-artificial-intelligence/report-on-copyright-and-artificial-intelligence ; PDF https://assets.publishing.service.gov.uk/media/69ba692226909a14239612e4/CP2602959_-_Report_on_Copyright_and_Artificial_Intelligence_web.pdf ).
- Outcome: the previously preferred "TDM exception with rights-holder opt-out" is *no longer the preferred option*; the government is maintaining the status quo and will "work with industry", "monitor", "keep under review". Law-firm summaries: Reed Smith "the 'opt-out' is dead" ( https://www.reedsmith.com/articles/uk-copyright-and-ai-report-the-opt-out-is-dead-but-what-comes-next/ ); Lewis Silkin ( https://www.lewissilkin.com/en/insights/2026/03/24/opt-out-cop-out-uk-government-rethinks-its-position-on-copyright-and-ai-102mnx9 ); Fieldfisher ( https://www.fieldfisher.com/en/services/intellectual-property/intellectual-property-blog/uk-government-maintains-status-quo-on-ai-and-copyr ); Hogan Lovells 2026 outlook ( https://www.hoganlovells.com/en/publications/ai-and-copyright-uk-outlook-for-2026 ).
- Practical meaning for us: UK law today has only the *non-commercial research* TDM exception (CDPA s.29A) — a commercial product gets no TDM safe harbour. Storing copyrighted PDFs server-side and embedding them = reproduction requiring a licence or an exception; quotation (s.30) and illustration for instruction (s.32) exceptions are narrow and fair-dealing-limited, and s.32 excludes commercial purposes in most readings (prior knowledge of statute, unverified for 2026 amendments). Original questions "in the style of" a board are not infringing per se — style is not protected — provided we do not reproduce the board's actual questions, mark-scheme wording or third-party stimulus material.

**European Union**
- The GPAI Code of Practice (final 10 July 2025) has a Copyright chapter: signatories must adopt a copyright policy, respect machine-readable TDM opt-outs (robots.txt and other protocols) when crawling, avoid piracy sites, and implement "appropriate and proportionate" safeguards against infringing outputs. Sources: https://www.lw.com/en/insights/eu-ai-act-gpai-model-obligations-in-force-and-final-gpai-code-of-practice-in-place ; https://www.cliffordchance.com/insights/resources/blogs/ip-insights/2025/10/copyright-compliance-under-the-eu-ai-act-for-gpai-model-providers.html ; https://artificialintelligenceact.eu/code-of-practice-overview/
- GPAI obligations applied from 2 Aug 2025; Commission *enforcement powers* (information requests, model access, recalls) start 2 August 2026 — i.e. now live. Source: Latham & Watkins page above.
- Relevance: we are a *deployer/downstream provider*, not a GPAI model provider (we use DeepSeek/Claude/GPT/Gemini APIs), so the copyright chapter binds our vendors, not us directly; but the DSM Directive Art. 4 commercial TDM exception (with opt-out) governs any EU-side crawling/embedding we do, and exam boards' sites typically reserve rights, so no free ride there either.

**United States**
- *Bartz v. Anthropic* (N.D. Cal.): Judge Alsup held that training on lawfully acquired books is fair use but that assembling a central library from pirated copies is not; the case then settled — a class settlement of "$1.5" (snippet truncated; prior knowledge: $1.5 billion) preliminarily approved, with a fairness hearing around late Aug/early Sept 2026. Source: https://www.nortonrosefulbright.com/en/knowledge/publications/ce8eaa5f/ai-in-litigation-series-an-update-on-ai-copyright-cases-in-2026 ; trackers https://www.mckoolsmith.com/newsroom-ailitigation , https://chatgptiseatingtheworld.com/2025/10/08/status-of-all-51-copyright-lawsuits-v-ai-oct-8-2025-no-more-decisions-on-fair-use-in-2025/
- *Kadrey v. Meta* (N.D. Cal.): summary judgment for Meta on the record presented (fair use, but Chhabria J. warned market-dilution theories could win on better evidence — prior knowledge); in July 2026 Chhabria denied certification for Ninth Circuit interlocutory review. Source: Norton Rose Fulbright update above.
- *Thomson Reuters v. Ross* (D. Del. → 3d Cir.): Bibas J. granted summary judgment that Ross's use of Westlaw headnotes to train a competing legal-research tool was *not* fair use; interlocutory appeal argued in the Third Circuit on 11 June 2026, no decision yet. Source: Norton Rose Fulbright; OSU Copyright Corner https://library.osu.edu/site/copyright/2026/03/20/fair-use-and-artificial-intelligence-2026-update/
- *NYT v. OpenAI / Microsoft* (S.D.N.Y.): ongoing; on 5 Jan 2026 Judge Stein affirmed an order compelling production of 20 million anonymised ChatGPT logs. Source: Norton Rose Fulbright.
- Why Ross matters most for us: it is the closest analogue — a non-generative tool that ingested a rival's *editorial* content (headnotes ≈ mark schemes/model answers) to build a competing product, in the same market as the rights holder. Exam boards and Save-My-Exams-type publishers sell revision products; a court could see our use of their mark schemes as market-substituting. The Bartz/Kadrey "training is transformative" reasoning helps model vendors, not a RAG product that displays the copyrighted text at inference time.

**Cross-cutting: the four use patterns**
1. Storing/embedding copyrighted PDFs server-side — reproduction in all three jurisdictions; needs a licence (or falls under a narrow research exception we don't qualify for). Highest risk when the source is Cambridge mark schemes / examiner reports, which Cambridge explicitly refuses to license for electronic publication.
2. Showing short attributed extracts — UK quotation (s.30) / US fair use may cover *short* quotes for criticism or explanation with attribution, but a systematic product feature that surfaces mark-scheme lines on demand is weakly protected. Prefer paraphrase + citation ("Cambridge 9609/32 May/June 2023 Q2(b), mark scheme point: examiner rewards analysis of X" in our own words) plus a link to the official source.
3. Transient processing of user uploads — strongest position: the user supplies the file, we process it for that user only, we do not retain it in a shared index. UK s.28A temporary copies and US fair use both favour this; keep it per-user, non-persistent by default, and never pool user uploads into a global corpus.
4. Generating original board-style questions and model answers — legitimate; style, syllabus structure and assessment-objective frameworks are ideas/facts, not expression. Guardrails: no verbatim or near-verbatim reproduction of real questions; no reuse of third-party stimulus texts/case studies; syllabus codes and AO labels can be used descriptively (nominative use) but not in a way that implies endorsement (Cambridge is protective of "endorsed" status).

## PART B — EXAM-PREP INCUMBENTS (September 2026)

### B1. Company-by-company notes

**Save My Exams (UK)** — Covers IGCSE, GCSE, A Level, IB and AP. Product: revision notes, topic-tagged exam questions, flashcards, past papers, "Target Test", mock exams, **"Smart Mark"** (AI that instantly marks short written answers), strengths/weaknesses analytics and a Test Builder. Free tier is tiny: "five revision notes and one topic question per month"; paid plans are monthly/quarterly/annual and prices "vary by location, account type, eligibility and current offers" — no single published figure surfaced. Sources: https://www.geniusfirms.com/blog/save-my-exams-review-is-it-worth-it-for-gcse-igcse-as-a-level-o-level/ ; https://useaicademy.com/blog/save-my-exams-alternatives ; https://neurageek.com/learn/study/save-my-exams-alternatives-cambridge-2026 ; Trustpilot https://www.trustpilot.com/review/www.savemyexams.com . Cambridge coverage: strong for CIE IGCSE and A Level in sciences/maths/business/economics (prior knowledge, unverified for 9609 depth). AI vendor: not disclosed. Complaints (to be detailed in B3): paywall aggressiveness, auto-renewal, answer errors.

**Physics & Maths Tutor / PMT Education (UK)** — Core resources (past papers, mark schemes, notes, topic questions by board, including CAIE) remain free; monetisation is PMT Tuition (1-to-1 from about £20/hour) and courses. PMT markets itself explicitly as the "Save My Exams free alternative" ( https://www.pmt.education/blog/students/save-my-exams-alternative-physics-maths-tutor/ ). No prominent AI feature in snippets ( https://www.myphysicsbuddy.com/blog/physics-maths-tutor-reviews-pricing-alternatives-for-physics/ ; https://www.pmt.education/blog/students/physics-and-maths-tutor-resources/ ). Medly AI publishes a "Medly vs PMT" comparison, positioning PMT as static content ( https://www.medlyai.com/uk/blog/Medly_AI_vs_PMT ).

**Seneca Learning (UK)** — Freemium; school-facing plus consumer Premium. 2026 consumer tiers per Seneca help centre: "Supreme" £9.99/month (800+ premium courses & e-books, wrong-answers and smart learning modes); "Exam Boost" £12.99/month (adds quiz mode, 10,000+ open-ended exam questions, mock exams based on study history); "AI Assistant" £19.99/month (adds "your own AI assistant", course-specific responses, "personalised feedback on mock exam answers"). Premium also lists "AI-marked exam questions", "Magic quiz assignments" and the "Amelia AI Assistant"; there is a "Premium AI for Schools" SKU. Sources: https://help.senecalearning.com/en/articles/3746290-how-much-is-premium ; https://help.senecalearning.com/en/articles/12959827-premium-ai-for-schools ; https://help.senecalearning.com/en/articles/2663301-what-is-premium . Cambridge International coverage: minimal — Seneca is built around UK boards (AQA/Edexcel/OCR/WJEC) (prior knowledge, unverified).

**Up Learn (UK)** — A Level only, video-course + adaptive quiz + on-demand tutor support; "AI-powered adaptive learning". Price from £49.99/month rolling or a cheaper "Access Until Exams" annual plan; historically an A*/A guarantee-or-refund model (prior knowledge). Sources: https://uplearn.co.uk/pricing ; https://help.uplearn.co.uk/en/articles/10534593-what-a-level-purchasing-options-are-available ; https://edtechimpact.com/products/up-learn/ ; https://www.thestudentroom.co.uk/showthread.php?t=7275718 . No Cambridge International coverage (UK boards only, prior knowledge).

**Revisely (UK/global)** — AI flashcard/quiz/notes generator from user text, plus AI marking of quiz answers; freemium with paid plan reported around $12/month. Sources: https://topai.tools/t/revisely ; https://aichief.com/ai-education-tools/revisely/ ; https://nibble-app.com/blog/revisely . Not board-specific.

**Cognito (UK)** — Free GCSE/A Level maths & science video lessons and past papers; the newer "Cognito System" app "turns your exam syllabus and study materials into a personal learning system — with exam-aligned practice, active recall, spaced repetition and AI-generated flashcards". Sources: https://cognito.org/ ; https://apps.apple.com/gb/app/cognito-system-exam-prep/id6739693298 ; Trustpilot https://www.trustpilot.com/review/cognitoedu.org . UK boards primarily.

**Medify (UK)** — UCAT/med-school entry; 20,000+ question bank and large comparative data set. Pricing: 1 week £15, 1 month £30, 1 year £210 (USD $35/$65/$450). Sources: https://help.medify.co/en/articles/9648785-how-much-does-medify-cost-where-are-the-prices ; https://medify.co/pricing . Relevant as a benchmark for "big bank + percentile benchmarking" rather than as a direct competitor.

**Medly AI (UK, viral 2025)** — "AI study partner" for GCSE, A Level, IGCSE, IB, AP, SAT, "designed around real exam specifications"; around £25/month or £100+/year. Claims from its own 2025 survey: 74% of surveyed students improved grades, 40.5% by two or more grades. Strong critique from a tutoring blog: "Medly's entire value proposition rests on AI marking that provides accurate feedback, but an investigation found it's fundamentally broken." Sources: https://www.medlyai.com/uk/blog/what-is-medly ; https://shlc-tutor.co.uk/blogs/gcse-and-11-exam-tips-revision-guides/medley-ai-review-why-this-viral-study-app-is-failing-students ; Trustpilot https://uk.trustpilot.com/review/medlyai.com ; Mumsnet thread https://www.mumsnet.com/talk/secondary/5426251-medly-exams-ai-gcse-tutor ; teacher test videos https://www.youtube.com/watch?v=Bm9GwbGCf5M . App Store listing "Medly: 9/9/9 Your GCSEs" https://apps.apple.com/gb/app/medly-999-your-gcses/id6670685314 . IGCSE listed, so partial Cambridge coverage; AI vendor undisclosed.

**Knowunity (DE)** — 30M+ users in 20 countries (early 2026); €27M Series B (June 2025, led by XAnge), €45M total; AI tutor "draws from over 3 million peer-created materials ... fine-tuned to national curricula". Sources: https://www.eu-startups.com/2025/06/german-edtech-startup-knowunity-raises-e27-million-to-bring-ai-tutor-to-1-billion-students/ ; https://tech.eu/2025/06/13/knowunity-raises-eur27m-to-bring-ai-tutor-to-1-billion-students/ ; https://technicalbeep.com/ai-learning-platform-knowunity/ . Cambridge International: not a focus (national curricula; UK GCSE present). Peer-content model = weak grounding quality.

**Studocu AI (NL)** — Launched "Studocu AI" built on 50M+ peer-shared documents from 120,000+ institutions; lecture recording, quiz generation, structured notes. Sources: https://www.prnewswire.com/news-releases/studocu-launches-ai-study-tool-built-on-50m-verified-student-resources-302595483.html ; https://www.studocu.com/en-us/ai . Higher-ed skew; not exam-board aligned.

**Paperstack (Cambridge-specific)** — "IGCSE, O Level & A Level past papers from 2000+, instant AI grading, topical questions, examiner reports, grade thresholds, and multiplayer matches", "Interactive MCQ Solver, AI Tutor". Source: https://app.paperstack.cc/ . This is the closest existing product to our thesis (hosts the full CAIE archive + AI grading) — and it hosts board PDFs in the way Cambridge's policy forbids. Pricing/traction not surfaced.

**Other Cambridge-specific AI tools found in passing**: "AI Examiner – Cambridge Past Papers with AI" ( https://www.aiexaminer.co.uk/ ); "Cambridge Assistant – IGCSE, O Level, AS & A Level Past Papers with Solutions" ( https://cambridgeassistant.com/ ); "ThinkIGCSE — Cambridge IGCSE Exam Prep with AI Tutor, Past Papers & Mock Exams" ( https://www.thinkigcse.com/ ); PastPapers.co CAIE directory ( https://pastpapers.co/cie/?dir=A-Level ); Android "A Level Past Paper & Topicals" ( https://play.google.com/store/apps/details?id=com.apptic.pastpapersalevel ). These are small; details in B1b below if fetchable.

**Sparx Maths (UK, schools)** — Adaptive maths homework sold to schools; 2026 platform upgrade (all schools by September 2026, free) adds "Lesson Quiz" and homework changes explicitly designed to "make it harder for students to rely on AI". Sources: https://support.sparxmaths.com/en/articles/469962-sparx-maths-upgrade-announcement-faqs ; a school policy PDF on Sparx and AI https://oxtedschool.org/wp-content/uploads/sites/4/2026/04/Sparx-Maths-Homework.pdf . Signal: schools are now building anti-AI-cheating friction into homework tools; students meanwhile publish "SparxSolver" AI cheats ( https://github.com/musairul/SparxSolver ). Not Cambridge International.

**Tassomai (UK)** — Retrieval-practice quizzing (KS2–GCSE); schools pay "no more than £5 per student" for two core subjects; families £29.99/month (Y7–8 bundle) or £8.99/month (Y3–6); "Mai Unlimited" AI tutor add-on £3.99/month. Sources: https://www.tassomai.com/families ; https://www.tassomai.com/mai-unlimited ; https://www.tassomai.com/teachers ; https://edtechimpact.com/products/tassomai/ . UK boards.

**ExamPal (IL/US)** — GMAT/GRE/SAT/ACT adaptive prep with "PAL" methodology; credits from $15, 7-day trial. Sources: https://exampal.app/ ; https://top10prepcourses.com/reviews/exampal-gmat-review/ . Not relevant to Cambridge.

**Tutopiya (SG)** — Online tutoring for IGCSE/A Level/IB, claims "the world's largest IGCSE and A-Level resources portal, powered by AI ... built specifically for Cambridge and Edexcel international students"; launched an AI feature for IGCSE Maths that "analyzes past paper questions, providing students with detailed guidance on how to approach and solve them based on official mark schemes". Runs aggressive SEO against ZNotes and Save My Exams ("websites like Save My Exams for IGCSE 2026"). Sources: https://www.tutopiya.com/news/igcse-maths-ai-tutor/ ; https://www.tutopiya.com/learning-portal/ ; https://www.tutopiya.com/blog/igcse-keywords/websites-like-save-my-exams/ ; https://www.tutopiya.com/blog/igcse-keywords/znotes-alternative-igcse/ .

**ZNotes (UK charity, Cambridge-native)** — Free community-written IGCSE/A Level notes (PDF + web) and a new mobile app; competitors describe it as "static PDFs with no adaptive or interactive element". Sources: https://znotes.org/ ; https://apps.apple.com/us/app/znotes-study-notes-revision/id6761271207 ; Tutopiya critique above. (Prior knowledge, unverified: ZNotes has experimented with an AI chat over its notes.)

**Thinka (HK)** — "AI Practice Platform" for IGCSE, A Level, IB, HKDSE; timed exam-style practice; HKSTP-incubated, "adopted by 50+ schools". Source: https://play.google.com/store/apps/details?id=com.thinka.thinka .

### B1b. The 2025–2026 wave of Cambridge-specific AI tools and AI-marking startups

Search surfaced a crowded long tail of small Cambridge-International AI tools, nearly all built on the same recipe: mirror the CAIE PDF archive, put an LLM next to it, sell a subscription. None showed evidence of a licence from Cambridge; all rely on the same tolerance that PapaCambridge does.

- **Paperstack** ( https://paperstack.cc/ ; app at https://app.paperstack.cc/ ): "complete archive of +15,000 CAIE past papers from 2001 till 2026", mark schemes, examiner reports, grade thresholds, "AI-powered grading, instantaneous examiner feedback, multiplayer matches". Pricing not surfaced (fetch blocked).
- **ThinkIGCSE** ( https://www.thinkigcse.com/ ): AI tutor, real past papers, mock exams, "submit written answers and get them graded by AI with a mark breakdown, detailed feedback, and tips". IGCSE only.
- **AI Examiner** ( https://www.aiexaminer.co.uk/ ): "open the original question paper alongside the mark scheme in a side-by-side viewer and select any question to get instant AI feedback".
- **Cambridge Assistant** ( https://cambridgeassistant.com/ ): "10,000+ Cambridge IGCSE, O Level, AS & A Level past papers with instant intelligent solutions". (Name risks confusion with Cambridge trade marks.)
- **ExamPal (tryexampal.com — distinct from the GMAT ExamPal)** ( https://www.tryexampal.com/ ): "AI-Powered Cambridge Exam Tutor", "1,900+ real past papers graded against the actual mark scheme".
- **Aixampapers** ( https://aixampapers.com/ ): free Cambridge past papers with an AI tutor explaining every answer step by step; "1,000+ papers with marking schemes".
- **Neurageek** ( https://neurageek.com/ ): "AI-Powered Cambridge Exam Prep | IGCSE, O Level & A Level"; publishes SEO comparison pieces against Save My Exams.
- **MarkMaster AI** ( https://www.markmasterai.com/ ): "AI Exam Companion for Cambridge IGCSE & AS".
- **BestGradez** ( https://bestgradez.com/ ): "AI-Powered Exam Prep for A Level, O Level & IGCSE".
- **XtremePapers "prepare"** ( https://prepare.xtremepape.rs/ ): the old PDF mirror has added a practice layer.

UK-board AI-marking startups (2025–2026), relevant as feature benchmarks and as evidence that "AI marking against the mark scheme" is now a commodity claim:
- **Top Marks AI** ( https://www.topmarks.ai/ ) — "UK's leading AI marking platform for GCSE and A Level, with 400+ tools across 40+ subjects"; teacher-facing; publishes its own "best AI marking software" ranking ( https://www.topmarks.ai/best-ai-marking-software ).
- **Examiner AI by tutor2u** ( https://ai.tutor2u.net/ ) — "bespoke marking prompts tailored to the specific assessment objectives of GCSE, A-Level, BTEC, and T-Levels", short answers to extended essays. tutor2u is the dominant Business/Economics teacher brand in the UK, so this is the nearest thing to a Business-9609-style AI marker (UK boards, not CAIE).
- **ReMarkAble AI** ( https://remarkableai.co.uk/gcse-ai-marker ) — student-facing free GCSE essay marker "aligned to AQA, Edexcel, and OCR mark schemes".
- **Olex.ai** ( https://olex.ai/ ) — teacher tool: "marks 30 GCSE essays in 2 minutes with examiner-level feedback"; unlimited marking on annual subscription.
- **TeachEdge.ai** ( https://www.teachedge.ai/ ) — exam-board-aligned AI marking "built by UK teachers"; notably publishes a copyright FAQ on using exam-board materials responsibly ( https://www.teachedge.ai/copyright-faqs ) — a sign that the compliant players are already treating board copyright as a positioning point.
- **MarkMe** ( https://markme.com/ ) — "Instant Marking & Feedback for GCSE and A-Level revision", thousands of past-paper questions marked in seconds.
- Platform incumbents' AI marking: Save My Exams "Smart Mark" (short answers), Seneca "AI-marked exam questions"/mock-answer feedback at £19.99/month, Medly AI essay marking (criticised as inaccurate), Tutopiya's mark-scheme-based IGCSE Maths guidance.

### B2. Feature matrix (September 2026; Y = confirmed in a cited source, P = partial/claimed, blank = not found, ? = unknown)

| Product | Topic-tagged Q bank | Model answers | Video solutions | AI marking | Predicted papers | Grade predictor | CAIE IGCSE | CAIE A Level (e.g. 9609) | Consumer price | AI vendor |
|---|---|---|---|---|---|---|---|---|---|---|
| Save My Exams | Y | Y | P (worked solutions, some video) | Y (Smart Mark, short answers) | P (mock exams) | P (strengths/weaknesses) | Y | Y | monthly/quarterly/annual; varies by region (~£50 charges reported on Trustpilot) | ? |
| PMT | Y (topic Qs by board) | Y (mark schemes) | P | – | – | – | Y (papers) | Y (papers) | free; tuition from ~£20/h | n/a |
| Seneca | Y | P | – | Y (£19.99 tier) | P (mock exams) | – | – | – | £9.99 / £12.99 / £19.99 per month | ? (Amelia assistant) |
| Up Learn | Y (adaptive) | Y | Y | – | – | P (A*/A guarantee model) | – | – | from £49.99/month | ? |
| Medly AI | Y (spec-organised) | Y | – | Y (essays; accuracy disputed) | – | – | P (IGCSE listed) | – | £9.99 / £24.99 per month (app store) | ? |
| Cognito | P | Y (past papers) | Y | P (AI flashcards) | – | – | – | – | free core; app paid | ? |
| Revisely | – (user-uploaded) | – | – | Y (quiz answers) | – | – | – | – | ~$12/month | ? |
| Knowunity | P (peer notes) | P | – | P | – | – | – | – | freemium | ? |
| Studocu AI | – (peer docs) | – | – | P (quizzes) | – | – | – | – | freemium | ? |
| Paperstack | Y (topicals) | Y (mark schemes) | – | Y (AI grading) | – | P (grade thresholds) | Y | Y | ? | ? |
| ThinkIGCSE | Y | Y | – | Y (mark breakdown) | P (mock exams) | – | Y | – | ? | ? |
| AI Examiner / Cambridge Assistant / tryexampal / Aixampapers | Y (paper-based) | Y (mark schemes) | – | Y (claimed) | – | – | Y | Y | ? (some free) | ? |
| Tutopiya | Y | Y | Y | P (IGCSE Maths) | – | – | Y | Y | tutoring-led | ? |
| ZNotes | – | – | – | – | – | – | Y (notes) | Y (notes) | free | n/a |
| Thinka | Y | ? | – | ? | – | – | Y | Y | ? | ? |
| Sparx / Tassomai | Y (adaptive) | – | Y (Sparx) | – | – | – | – | – | school-licensed; Tassomai families £8.99–£29.99 | n/a |
| Medify | Y (UCAT) | Y | Y | n/a | n/a | Y (percentiles) | n/a | n/a | £15/wk, £30/mo, £210/yr | n/a |
| tutor2u Examiner AI / Top Marks / Olex / TeachEdge / MarkMe / ReMarkAble | P | – | – | Y (AO-aligned, UK boards) | – | – | – | – | teacher subs; ReMarkAble free tier | ? |

### B3. The 10 most-complained-about gaps (from Trustpilot/app-store/forum snippets and comparison blogs)

1. **Aggressive paywalls and surprise charges** — Save My Exams free tier is "five revision notes and one topic question per month"; Trustpilot complaints about being "charged unexpectedly after a free trial ... unaware of the £50 payment" and double charges the same day (https://www.trustpilot.com/review/www.savemyexams.co.uk?page=3 and related pages). Support refunds quickly, but the pattern drives the "free alternative" SEO industry (PMT, Tutopiya, Neurageek, Aicademy).
2. **AI marking that is confidently wrong** — Medly AI: "entire value proposition rests on AI marking ... fundamentally broken" ( https://shlc-tutor.co.uk/blogs/gcse-and-11-exam-tips-revision-guides/medley-ai-review-why-this-viral-study-app-is-failing-students ); teacher test videos ( https://www.youtube.com/watch?v=Bm9GwbGCf5M ). No incumbent publishes marking-accuracy statistics against real examiner marks.
3. **Maths/quantitative answers unusable in chat/app form** — Medly "for maths, it's noted as very difficult to use on the app" (app-store snippet via https://apps.apple.com/gb/app/medly-ace-your-exams/id6670685314 ).
4. **Repetitive or shallow question banks** — Medly "questions can be repetitive"; Save My Exams "materials sometimes lacked sufficient detail, completeness, or important key examples" (Trustpilot snippets).
5. **Static PDFs, no interactivity** — ZNotes/PMT/PapaCambridge criticised (by competitors, but fairly) as "static PDFs with no adaptive or interactive element" ( https://www.tutopiya.com/blog/igcse-keywords/znotes-alternative-igcse/ ).
6. **Generic AI, not exam-board-specific** — the whole category markets against "generic ChatGPT" ("Unlike general-purpose AI tools, Medly is designed around real exam specifications"), which tells you students are already using ChatGPT and finding it un-grounded in the mark scheme.
7. **UK-board bias; Cambridge International treated as an afterthought** — Seneca, Up Learn, Cognito, Sparx, Tassomai, tutor2u Examiner AI, Top Marks, Olex, ReMarkAble are all AQA/Edexcel/OCR-first; CAIE students get Save My Exams or the grey-market PDF+AI tools.
8. **Cheating arms race with schools** — Sparx's 2026 upgrade exists to "make it harder for students to rely on AI"; student-built "SparxSolver" cheats circulate on GitHub. Tools perceived as cheating aids get blocked by schools.
9. **No transparency on where the AI's answer came from** — none of the tools surfaced show a citation to the specific mark-scheme line, examiner-report paragraph or textbook page behind a piece of feedback.
10. **Copyright fragility of the grey-market tools** — the CAIE AI tools (Paperstack, AI Examiner, Cambridge Assistant, Aixampapers, tryexampal) host material Cambridge says it never licenses for websites; any of them can disappear on a takedown, which students on forums recognise ("Past Papers illegal?" https://www.thestudentroom.co.uk/showthread.php?t=27362 ; IB enforcement threads).

### B4. Five things nobody offers Cambridge International students (as of this survey)

1. **Examiner-report-grounded feedback**: feedback that cites the Principal Examiner's actual comments for that syllabus and paper ("in 9609/32 June 2024 examiners noted candidates lost marks for not evaluating in context") — the reports exist for every CAIE series and nobody surfaces them in an AI loop.
2. **A published, audited marking-accuracy score** per syllabus/paper type (agreement with examiner marks on released candidate responses), refreshed each series. Medly's backlash shows the demand for trust; none of the tools publish it.
3. **Level-of-response ("levels-based") marking for essays with AO decomposition** for CAIE Business/Economics/History-style papers (AO1 knowledge, AO2 application, AO3 analysis, AO4 evaluation), including "how to move from Level 2 to Level 3" — UK AI markers do AOs for AQA/Edexcel; the CAIE tools do MCQ/short-answer grading.
4. **A compliant content model** — a product that a school can adopt without hosting Cambridge PDFs: bring-your-own-paper (student uploads the PDF from the School Support Hub/syllabus page or a photo), original board-style question generation, paraphrased mark-scheme criteria with links to the official source. Schools cannot officially recommend PapaCambridge-style tools.
5. **A longitudinal grade model tied to CAIE grade thresholds** — predicted grade from practice performance mapped against published component thresholds per series, with a study plan back-solved from the target grade and exam date, across the two-year AS/A2 course.

### B5. The honest "why pay us instead of Save My Exams + free ChatGPT" answer

What the combination already gives a Cambridge student: Save My Exams provides tidy topic-tagged questions and human-written model answers for the popular CAIE subjects, and free ChatGPT/Gemini/Claude will explain any concept and give plausible feedback on an essay. That is a strong baseline; a product that merely bundles the two is not worth paying for.

Where the combination fails, and where a paid product can honestly win:
- **Marking you can trust**: ChatGPT does not know the actual CAIE mark scheme or the levels descriptors for that paper, so its "you'd get 14/20" is invented; Save My Exams' Smart Mark only does short answers. We can offer AO-decomposed, levels-based marking calibrated against examiner-marked exemplars, with a published accuracy figure per paper — and we say when we are unsure.
- **Examiner voice, not internet voice**: our feedback is grounded in the syllabus, the examiner reports and endorsed textbooks (licensed or user-supplied), with the source shown next to every claim. ChatGPT cannot cite the 9609 examiner report; Save My Exams does not try.
- **A closed loop, not a pile of resources**: diagnosis → targeted original practice in the board's style → marked → misconception logged → spaced re-test → predicted grade against real thresholds → plan to the exam date. Save My Exams is a library; ChatGPT has no memory of your weaknesses across the two-year course unless you manage it yourself.
- **Original questions that never run out**: generated in the board's style for exactly the sub-topic you failed, rather than a finite bank the student exhausts before the mocks.
- **Honesty about price**: table-stakes chat is free everywhere, so the paid tier must be priced against a private tutor (£20–£50/hour), not against a £9.99 notes site; the pitch is "an examiner in your pocket for the price of one tutoring hour a month", and the free tier must be genuinely useful (unlike Save My Exams' five notes a month) or the SEO ecosystem will route around us.
- **What we should not claim**: that we replace past papers (students must still sit real papers under timed conditions), that AI marks are official, or that we are endorsed by Cambridge.

### A5. Cautious launch content strategy

**Tier 0 — Ship without any licence (safe now)**
- Our own content: syllabus-structured notes written in-house or generated and human-reviewed; original board-style questions, mark-scheme-style criteria and model answers we author; AO/levels rubrics written in our own words.
- Facts and structure: syllabus codes, topic lists, assessment objectives, paper structures, grade-threshold numbers, exam timetables (facts are not copyright; keep wording our own and add "not affiliated with or endorsed by Cambridge International").
- Bring-your-own-materials: the student uploads/photographs a past paper, mark scheme, textbook page or their handwritten answer; we process it transiently for that user only, no persistence into a shared index, deletion controls, no training on it. This is the strongest legal footing and also the only way to legitimately cover the newest series that sit behind the School Support Hub.
- Deep links, not copies: link out to the official Cambridge syllabus page / AQA finder / AP Central for the PDF, never host it.

**Tier 1 — Short attributed extracts, tightly engineered**
- Paraphrase mark-scheme points by default; when quoting, keep to a short phrase, always with full citation (board, syllabus code, component, series, question) and a link to the official source. Cap quoted text per response; log every extract for audit. Do not build a "read the mark scheme here" viewer for Cambridge content (Cambridge explicitly refuses electronic publication of mark schemes and examiner reports).
- Treat AP (College Board publishes FRQs + scoring guidelines openly) and AQA/OCR/Edexcel (public for 3–5 years) as lower-risk than Cambridge and IB for extract display, but still request permission for anything systematic.

**Tier 2 — License first, then unlock**
- Cambridge University Press & Assessment: one counterparty owns the exam board, the endorsed coursebooks and an established opt-in AI-licensing programme (academic side). Open a licensing conversation early (permissions article: https://help.cambridgeinternational.org/hc/en-gb/articles/115004418469-How-do-I-apply-for-permission-to-use-Cambridge-copyrighted-material ) for: (a) mark schemes and examiner reports as retrieval grounding (not display), (b) endorsed textbook text for RAG, (c) use of the "Cambridge International" name in a non-endorsement, descriptive way.
- CLA Generative AI licence ( https://cla.co.uk/ai-and-copyright/ ): ask which school-textbook publishers are in the repertoire and whether RAG display is covered; use it for Hodder/OUP/Collins titles if included.
- IB: buy materials from the IB Follett Store for internal authoring reference only; do not redistribute; write original IB-style questions.
- College Board: submit a permission request for systematic FRQ reuse ( https://privacy.collegeboard.org/copyright-trademark/request-instructions ).

**Operational guardrails**
- Attribution UI: every grounded claim shows a source chip (board/publisher, document, page/question) and a "view official source" link; unlicensed sources are never reproduced beyond the extract cap.
- Takedown process: published DMCA/UK-notice agent contact, 24-hour removal SLA, a per-document kill switch in the retrieval index, and a log of what was removed; honour robots.txt/TDM reservations on any crawling.
- Corpus provenance ledger: for every document in retrieval, record source URL, licence basis (own/licensed/user-supplied/public-with-permission), date ingested, and expiry (e.g. Pearson's 5-year rule, AQA's 3-year public window).
- Model-vendor terms: use API tiers with no-training defaults; note that the vendors themselves (OpenAI, Anthropic, Google, DeepSeek) carry the GPAI copyright duties under the EU Code of Practice, not us — but our own reproduction of third-party text is our liability.
- Trademark hygiene: "for Cambridge International A Level 9609" is descriptive use; avoid names like "Cambridge Assistant", avoid the Cambridge shield, add a non-affiliation notice.
- User uploads: default private, per-user encryption at rest, no cross-user retrieval, retention controls, and a policy that we never resell or pool uploaded board materials.

## Implications for our product (concrete rules/features)

1. Content architecture rule: three provenance classes — OWN (unlimited use), LICENSED (per-contract use), USER (transient, private) — enforced at the retrieval layer; no fourth "scraped" class exists in production.
2. Do not host Cambridge PDFs or build a mark-scheme viewer; instead ship "Paper Companion": the student opens the official PDF (deep link) or uploads it, and we anchor feedback to question numbers.
3. Build the examiner-report layer as paraphrased, question-indexed insights authored from the reports (facts and advice restated in our words) and cite the report by series; pursue a Cambridge licence to quote directly.
4. Levels-based AO marking for 9609 essays with a published agreement score against examiner-marked exemplars; show uncertainty; never present marks as official.
5. Generate original questions/case studies in the board's style; forbid reproduction of real questions and third-party stimulus material by construction (near-duplicate check against the reference bank at generation time).
6. Free tier must beat Save My Exams' free tier decisively (unlimited concept chat + a real daily quota of marked answers); paid tier priced against tutoring, not against notes sites.
7. Cambridge-first coverage is a genuine white space: all UK AI markers (tutor2u Examiner AI, Top Marks, Olex, ReMarkAble, MarkMe) and the big platforms (Seneca, Up Learn, Cognito) are AQA/Edexcel/OCR-first; the CAIE AI tools are small and legally fragile.
8. Trust features are differentiation: source chips, "why this mark" AO breakdown, accuracy dashboard, and a school-safe mode (no answer dumping; teacher visibility) so schools can recommend us rather than block us the way they now block AI on Sparx.
9. Legal posture for launch: UK status quo (no commercial TDM exception, March 2026 report), EU enforcement live from 2 Aug 2026 (binds our model vendors), US Ross appeal pending (closest analogue, adverse at first instance) — so licence-first for board editorial content, user-supplied for the rest.
10. Open the Cambridge University Press & Assessment conversation immediately; it is the single licensing deal that unlocks both mark schemes and endorsed textbooks and would convert the main legal risk into a moat.

## Still unverified

- Exact current Save My Exams prices by region and which subjects/9609 papers have Smart Mark coverage (pricing page fetch blocked).
- Whether ZNotes content is CC BY-NC-SA: the PDF front-matter notice reads as all-rights-reserved with free educational access; the CC claim was not confirmed anywhere.
- Pearson Edexcel's exact policy on third-party non-commercial revision websites (snippets covered centres only).
- OCR's copyright policy wording (not surfaced).
- Cambridge International's exact split between public past papers and School Support Hub content, and whether any AI/RAG statement exists in its terms (help centre blocked to fetch).
- Whether the Cambridge University Press opt-in AI-licensing programme extends to Cambridge International endorsed school textbooks or assessment materials.
- CLA Generative AI licence: launch status in 2026, repertoire (which school publishers), and whether RAG display by a commercial SaaS is covered; current wording of the Education Licence regarding AI.
- Bartz v. Anthropic settlement size (snippet truncated to "$1.5"; prior knowledge says $1.5 billion) and whether final approval was granted at the September 2026 hearing.
- Paperstack, AI Examiner, ThinkIGCSE, Cambridge Assistant, tryexampal pricing, traction and AI vendors (all fetches blocked).
- PMT's and Save My Exams' AI vendors; whether PMT has launched any AI feature (nothing found).
- Any actual takedown or legal action by Cambridge against PapaCambridge/XtremePapers/GCE Guide (none found; absence of evidence only).
- Medly AI's current price (sources conflict: ~£25/month in a blog vs £9.99/£24.99 tiers in app-store snippet).

## Sources

Exam boards / rights holders
- https://help.cambridgeinternational.org/hc/en-gb/articles/203544371-Can-I-reproduce-Cambridge-past-examination-papers-on-the-school-s-website-my-website
- https://help.cambridgeinternational.org/hc/en-gb/articles/115004418469-How-do-I-apply-for-permission-to-use-Cambridge-copyrighted-material
- https://help.cambridgeinternational.org/hc/en-gb/categories/200545072-Publications-and-copyright
- https://www.cambridge.org/legal/copyright
- https://qualifications.pearson.com/en/support/support-topics/exams/past-papers/pearson-copyright-policy.html
- https://qualifications.pearson.com/en/support/support-topics/exams/past-papers/past-papers-information-for-students.html
- https://www.aqa.org.uk/about-us/who-we-are/our-standards/copyright-and-intellectual-property-policy
- https://www.aqa.org.uk/about-us/who-we-are/our-standards/copyright-and-intellectual-property-policy/copyright-policy-for-centres
- https://filestore.aqa.org.uk/admin/library/AQA-MAT-USE-POLICY.PDF
- https://www.aqa.org.uk/past-papers-and-mark-schemes-finder
- https://ibo.org/terms-and-conditions/intellectual-property/
- https://ibo.org/terms-and-conditions/
- https://llms.revisiondojo.com/ib-past-papers-legal-access-and-mark-schemes
- https://ibsurvival.com/topic/1754-ib-past-papers-punishment/
- https://apcentral.collegeboard.org/courses/ap-calculus-ab/exam/past-exam-questions
- https://apcentral.collegeboard.org/courses/ap-english-language-and-composition/exam/past-exam-questions
- https://privacy.collegeboard.org/copyright-trademark/request-instructions
- https://apstudents.collegeboard.org/exam-policies-guidelines/exam-security-policies
- https://www.thestudentroom.co.uk/showthread.php?t=27362

Incumbent archives and disclaimers
- https://pastpapers.papacambridge.com/papers/caie/igcse
- https://pastpapersacademy.com/terms
- https://lumiapapers.com/terms
- https://www.scribd.com/document/885378504/IGCSE-Physics-Znotes
- https://www.physicsandmathstutor.com/past-papers/
- https://pastpapers.co/cie/?dir=A-Level
- https://prepare.xtremepape.rs/

Publishers and collective licensing
- https://www.thebookseller.com/news/cambridge-university-press--assessment-writes-to-20k-authors-for-ai-licensing-opt-in
- https://www.cambridge.org/mv/universitypress/about-us/news-and-blogs/uncharted-territory-ai-and-the-cambridge-approach-for-academic-book-publishing
- https://www.authorsalliance.org/2025/03/17/ai-licensing-an-interview-with-ben-denne-of-cambridge-university-press/
- https://www.insidehighered.com/news/quick-takes/2024/08/05/oxford-university-press-actively-working-ai-companies
- https://www.emarketer.com/content/microsoft-harpercollins-sign-ai-licensing-deal--author-opt-in-still-required
- https://authorsguild.org/news/harpercollins-ai-licensing-deal/
- https://cla.co.uk/ai-and-copyright/
- https://www.pls.org.uk/news-events-policy/news/pls-and-alcs-agree-to-development-of-pioneering-cla-generative-ai-licence/
- https://wiggin.co.uk/insight/ai-and-copyright-copyright-licensing-agency-developing-a-generative-ai-training-licence/
- https://uk.practicallaw.thomsonreuters.com/w-046-6706

Legal landscape
- https://www.gov.uk/government/publications/report-and-impact-assessment-on-copyright-and-artificial-intelligence/report-on-copyright-and-artificial-intelligence
- https://assets.publishing.service.gov.uk/media/69ba692226909a14239612e4/CP2602959_-_Report_on_Copyright_and_Artificial_Intelligence_web.pdf
- https://www.reedsmith.com/articles/uk-copyright-and-ai-report-the-opt-out-is-dead-but-what-comes-next/
- https://www.lewissilkin.com/en/insights/2026/03/24/opt-out-cop-out-uk-government-rethinks-its-position-on-copyright-and-ai-102mnx9
- https://www.fieldfisher.com/en/services/intellectual-property/intellectual-property-blog/uk-government-maintains-status-quo-on-ai-and-copyr
- https://www.hoganlovells.com/en/publications/ai-and-copyright-uk-outlook-for-2026
- https://www.lw.com/en/insights/eu-ai-act-gpai-model-obligations-in-force-and-final-gpai-code-of-practice-in-place
- https://www.cliffordchance.com/insights/resources/blogs/ip-insights/2025/10/copyright-compliance-under-the-eu-ai-act-for-gpai-model-providers.html
- https://artificialintelligenceact.eu/code-of-practice-overview/
- https://www.nortonrosefulbright.com/en/knowledge/publications/ce8eaa5f/ai-in-litigation-series-an-update-on-ai-copyright-cases-in-2026
- https://www.mckoolsmith.com/newsroom-ailitigation
- https://chatgptiseatingtheworld.com/2025/10/08/status-of-all-51-copyright-lawsuits-v-ai-oct-8-2025-no-more-decisions-on-fair-use-in-2025/
- https://library.osu.edu/site/copyright/2026/03/20/fair-use-and-artificial-intelligence-2026-update/

Incumbents (Part B)
- https://www.trustpilot.com/review/www.savemyexams.com ; https://www.trustpilot.com/review/www.savemyexams.co.uk?page=3
- https://www.savemyexams.com/learning-hub/support/how-to-cancel-save-my-exams-subscription/
- https://www.geniusfirms.com/blog/save-my-exams-review-is-it-worth-it-for-gcse-igcse-as-a-level-o-level/
- https://useaicademy.com/blog/save-my-exams-alternatives ; https://neurageek.com/learn/study/save-my-exams-alternatives-cambridge-2026
- https://www.pmt.education/blog/students/save-my-exams-alternative-physics-maths-tutor/ ; https://www.pmt.education/blog/students/physics-and-maths-tutor-resources/ ; https://www.physicsandmathstutor.com/whats-new/
- https://www.myphysicsbuddy.com/blog/physics-maths-tutor-reviews-pricing-alternatives-for-physics/ ; https://www.medlyai.com/uk/blog/Medly_AI_vs_PMT
- https://help.senecalearning.com/en/articles/3746290-how-much-is-premium ; https://help.senecalearning.com/en/articles/12959827-premium-ai-for-schools ; https://help.senecalearning.com/en/articles/2663301-what-is-premium
- https://uplearn.co.uk/pricing ; https://help.uplearn.co.uk/en/articles/10534593-what-a-level-purchasing-options-are-available ; https://edtechimpact.com/products/up-learn/
- https://topai.tools/t/revisely ; https://aichief.com/ai-education-tools/revisely/
- https://cognito.org/ ; https://apps.apple.com/gb/app/cognito-system-exam-prep/id6739693298 ; https://www.trustpilot.com/review/cognitoedu.org
- https://help.medify.co/en/articles/9648785-how-much-does-medify-cost-where-are-the-prices ; https://medify.co/pricing
- https://www.medlyai.com/uk/blog/what-is-medly ; https://shlc-tutor.co.uk/blogs/gcse-and-11-exam-tips-revision-guides/medley-ai-review-why-this-viral-study-app-is-failing-students ; https://uk.trustpilot.com/review/medlyai.com ; https://www.mumsnet.com/talk/secondary/5426251-medly-exams-ai-gcse-tutor ; https://www.youtube.com/watch?v=Bm9GwbGCf5M ; https://apps.apple.com/gb/app/medly-ace-your-exams/id6670685314
- https://www.eu-startups.com/2025/06/german-edtech-startup-knowunity-raises-e27-million-to-bring-ai-tutor-to-1-billion-students/ ; https://tech.eu/2025/06/13/knowunity-raises-eur27m-to-bring-ai-tutor-to-1-billion-students/ ; https://technicalbeep.com/ai-learning-platform-knowunity/
- https://www.prnewswire.com/news-releases/studocu-launches-ai-study-tool-built-on-50m-verified-student-resources-302595483.html ; https://www.studocu.com/en-us/ai
- https://paperstack.cc/ ; https://app.paperstack.cc/ ; https://www.thinkigcse.com/ ; https://www.aiexaminer.co.uk/ ; https://cambridgeassistant.com/ ; https://www.tryexampal.com/ ; https://aixampapers.com/ ; https://neurageek.com/ ; https://www.markmasterai.com/ ; https://bestgradez.com/
- https://support.sparxmaths.com/en/articles/469962-sparx-maths-upgrade-announcement-faqs ; https://oxtedschool.org/wp-content/uploads/sites/4/2026/04/Sparx-Maths-Homework.pdf ; https://github.com/musairul/SparxSolver
- https://www.tassomai.com/families ; https://www.tassomai.com/mai-unlimited ; https://www.tassomai.com/teachers
- https://exampal.app/ ; https://top10prepcourses.com/reviews/exampal-gmat-review/
- https://www.tutopiya.com/news/igcse-maths-ai-tutor/ ; https://www.tutopiya.com/learning-portal/ ; https://www.tutopiya.com/blog/igcse-keywords/websites-like-save-my-exams/ ; https://www.tutopiya.com/blog/igcse-keywords/znotes-alternative-igcse/
- https://znotes.org/ ; https://apps.apple.com/us/app/znotes-study-notes-revision/id6761271207
- https://play.google.com/store/apps/details?id=com.thinka.thinka
- https://ai.tutor2u.net/ ; https://www.topmarks.ai/ ; https://www.topmarks.ai/best-ai-marking-software ; https://remarkableai.co.uk/gcse-ai-marker ; https://olex.ai/ ; https://www.teachedge.ai/ ; https://www.teachedge.ai/copyright-faqs ; https://markme.com/
