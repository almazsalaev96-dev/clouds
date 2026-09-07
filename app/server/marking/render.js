/**
 * The Mark view's data (§05.12 renderer requirements).
 *
 * renderMark() turns a Mark object into exactly the structure the view draws: the
 * band strip, the calibration badge, the coaching line, an ordered list of cards
 * (one per assessment objective, or one per marking point), the student's own text
 * segmented into runs that carry their span class, the missing points, the warnings
 * and the one next action.
 *
 * It is pure data. No HTML, no markdown, no prose invented here — 05-WRKD-001 says
 * the renderer emits only the slots the Mark already contains. Quoted spans are
 * rehydrated from the transcript by offset and never from the stored quote
 * (05-WRKD-002); a span whose offsets no longer resolve is dropped from both panes
 * and counted.
 */

import { AO_LABEL, AO_ROLE, GLYPH_MEANING, REASON_TEXT } from './scheme.js'

const CLASS_ORDER = { credited: 3, partial: 2, uncredited: 1 }

const num = (n) => (typeof n === 'number' && Number.isFinite(n) ? n : null)

function transcriptOf(mark, opts) {
  if (typeof opts?.answer === 'string' && opts.answer) return opts.answer
  if (typeof mark?.transcript?.text === 'string') return mark.transcript.text
  return ''
}

/** Rehydrate one span from the transcript. Returns null when the offsets no longer resolve. */
function hydrate(span, text, klass, extra = {}) {
  const start = num(span?.char_start)
  const end = num(span?.char_end)
  if (start == null || end == null || start < 0 || end > text.length || end <= start) return null
  const quote = text.slice(start, end)
  if (span?.quote && quote !== span.quote && quote.replace(/\s+/g, ' ') !== String(span.quote).replace(/\s+/g, ' ')) return null
  return {
    class: klass,
    quote,
    char_start: start,
    char_end: end,
    line_ref: span.line_ref || null,
    reason_code: span.reason_code || null,
    reason: span.reason || null,
    evidence_kind: span.evidence_kind || null,
    links_counted: num(span.links_counted),
    case_fact_ref: span.case_fact_ref || null,
    ...extra,
  }
}

function aoCard(row, text, dropped) {
  const spans = []
  const take = (list, klass) => {
    for (const s of list || []) {
      const hydrated = hydrate(s, text, klass, { ao: row.ao })
      if (hydrated) spans.push(hydrated)
      else dropped.push({ ao: row.ao, quote: s?.quote || null })
    }
  }
  take(row.credited_spans, 'credited')
  take(row.partial_spans, 'partial')
  take(row.uncredited_attempts, 'uncredited')
  spans.sort((a, b) => a.char_start - b.char_start)

  return {
    kind: 'ao',
    id: row.ao,
    title: `${row.ao} ${AO_LABEL[row.ao] || ''}`.trim(),
    level_line: `Level ${row.level}`,
    marks_line: `${row.marks} of ${row.max}`,
    marks: row.marks,
    max: row.max,
    level: row.level,
    descriptor: row.descriptor_relied_on?.paraphrase || null,
    band_id: row.descriptor_relied_on?.band_id || null,
    evidence_rule: row.descriptor_relied_on?.evidence_rule || null,
    within_band_reason: row.within_band_reason || null,
    confidence: row.confidence ?? null,
    confidence_band: row.confidence_band || null,
    flagged: (row.confidence ?? 1) < 0.6,
    spans,
    missing: (row.missing_points || []).slice(0, 3),
    warning: null,
  }
}

function pointCard(row, text, dropped) {
  const span = row.char_start == null ? null : hydrate(row, text, row.awarded > 0 ? 'credited' : 'uncredited', { point_id: row.marking_point_id })
  if (!span && row.char_start != null) dropped.push({ point: row.marking_point_id, quote: row.quote || null })
  const failed = (row.atoms || []).filter((a) => !a.met)
  const wantsBoth = row.atoms?.length && failed.length
    // 05-WRKD-003: name the atom that failed, in the scheme's own words.
    ? `The scheme wants ${row.atoms.length === 2 ? 'both' : 'every part'}: ${row.atoms.map((a) => a.text).join(' AND ')}. Missing: ${failed.map((a) => a.text).join('; ')}.`
    : null
  return {
    kind: 'point',
    id: row.marking_point_id,
    title: row.marking_point_id,
    glyph: row.glyph,
    glyph_meaning: GLYPH_MEANING[row.glyph] || null,
    marks: row.awarded,
    max: row.max,
    ao: row.ao || null,
    credit_text: row.credit_text,
    atoms: row.atoms || [],
    atoms_line: wantsBoth,
    links_counted: num(row.links_counted),
    shared_with: row.shared_with || null,
    ecf_from: row.ecf_from || null,
    reason_code: row.reason_code || null,
    // The atoms line already names what was missing; saying it twice is noise.
    reason: wantsBoth ? null : row.reason || (row.reason_code ? REASON_TEXT[row.reason_code] : null) || null,
    spans: span ? [span] : [],
    missing: [],
    warning: null,
  }
}

/**
 * Segment the student's text into runs. Spans from different assessment objectives
 * legitimately overlap — the same sentence can earn AO2 and carry an AO3 link — so a
 * run collects every span covering it and paints the strongest class.
 */
function segment(text, spans) {
  if (!text) return []
  const cuts = new Set([0, text.length])
  for (const s of spans) { cuts.add(s.char_start); cuts.add(s.char_end) }
  const edges = [...cuts].filter((n) => n >= 0 && n <= text.length).sort((a, b) => a - b)
  const runs = []
  for (let i = 0; i < edges.length - 1; i++) {
    const start = edges[i]
    const end = edges[i + 1]
    if (end <= start) continue
    const covering = spans.filter((s) => s.char_start <= start && s.char_end >= end)
    let klass = 'plain'
    for (const s of covering) if ((CLASS_ORDER[s.class] || 0) > (CLASS_ORDER[klass] || 0)) klass = s.class
    runs.push({
      text: text.slice(start, end),
      class: klass,
      char_start: start,
      char_end: end,
      refs: covering.map((s) => ({
        class: s.class,
        ao: s.ao || null,
        point_id: s.point_id || null,
        reason_code: s.reason_code || null,
        reason: s.reason || null,
        links_counted: s.links_counted ?? null,
      })),
    })
  }
  return runs
}

/**
 * @param {object} mark  a Mark from marker.js
 * @param {{item?:object, scheme?:object, answer?:string}} [opts]
 */
export function renderMark(mark, opts = {}) {
  if (!mark || typeof mark !== 'object') {
    throw Object.assign(new Error('Nothing to render — no Mark was given'), { status: 400 })
  }
  const text = transcriptOf(mark, opts)
  const item = opts.item || {}
  const dropped = []

  const cards = []
  for (const row of mark.per_ao || []) cards.push(aoCard(row, text, dropped))
  for (const row of mark.per_point || []) cards.push(pointCard(row, text, dropped))

  // At most one examiner warning per card (05-WRKD-001).
  const spare = []
  for (const w of mark.examiner_warnings || []) {
    const card = cards.find((c) => (c.kind === 'ao' ? c.id === w.ao : c.ao === w.ao) && !c.warning)
      || cards.find((c) => !c.warning && w.matched_line_ref && c.spans.some((s) => s.line_ref === w.matched_line_ref))
    if (card) card.warning = { text: w.paraphrase, series: w.series, line_ref: w.matched_line_ref }
    else spare.push({ text: w.paraphrase, series: w.series, line_ref: w.matched_line_ref })
  }

  const loose = []
  for (const s of mark.uncredited_attempts || []) {
    const hydrated = hydrate(s, text, 'uncredited')
    if (hydrated) loose.push(hydrated)
    else dropped.push({ ao: null, quote: s?.quote || null })
  }

  const allSpans = [...cards.flatMap((c) => c.spans), ...loose]
  const band = mark.total_band
  const tariff = mark.header?.tariff ?? item.tariff ?? null
  const paper = mark.header?.paper ?? item.paper ?? null

  const heading = [
    mark.header?.command_word,
    tariff != null ? `${tariff} mark${tariff === 1 ? '' : 's'}` : null,
    paper ? `Paper ${paper}` : null,
  ].filter(Boolean).join(' · ')

  const primary = mark.next_mark_advice?.primary_action || null

  return {
    mark_id: mark.mark_id,
    heading,
    band: band
      ? {
        show: true,
        low: band.low,
        modal: band.modal,
        high: band.high,
        max: tariff,
        exact: band.exact === true,
        strip: band.exact ? `${band.modal}/${tariff}` : `${band.low} ── ${band.modal} ── ${band.high}`,
        tolerance_line: band.exact
          ? 'Every mark here is checked against the key, so there is no band.'
          : `Real examiners disagree by about ±${band.tolerance} on items like this.`,
      }
      : {
        show: false,
        low: null, modal: null, high: null, max: tariff, exact: false,
        strip: 'Feedback only',
        tolerance_line: 'Feedback only — this paper is not yet calibrated. Everything below still applies.',
      },
    badge: {
      text: mark.calibration_status?.badge_text || null,
      state: mark.calibration_status?.state || 'uncalibrated',
      provisional: mark.calibration_status?.state === 'provisional',
      qwk: mark.calibration_status?.qwk ?? null,
      n_scripts: mark.calibration_status?.n_scripts ?? null,
    },
    confidence: mark.confidence
      ? { band: mark.confidence.band, note: mark.confidence.note || null, teacher_flag: !!mark.visibility?.show_teacher_flag }
      : null,
    coaching_line: mark.command_word_check?.coaching_line || null,
    cards,
    runs: segment(text, allSpans),
    loose_spans: loose,
    checks: {
      command_word: mark.command_word_check || null,
      application: mark.application_check
        ? { ...mark.application_check, line: applicationLine(mark.application_check) }
        : null,
      data_reference: mark.data_reference_check
        ? { ...mark.data_reference_check, line: dataLine(mark.data_reference_check) }
        : null,
    },
    warnings: [
      ...(mark.warnings || []),
      ...spare.map((w) => `Examiners' report${w.series ? `, ${w.series}` : ''}: ${w.text}`),
      ...(dropped.length
        ? [dropped.length === 1
          ? 'One quoted span no longer matches the answer and was dropped.'
          : `${dropped.length} quoted spans no longer match the answer and were dropped.`]
        : []),
    ],
    next_action: primary
      ? {
        kind: primary.kind,
        label: primary.label || 'Do this next',
        text: primary.text,
        target_ao: primary.target_ao || null,
        target_line_ref: primary.target_line_ref || null,
        expected_gain: primary.expected_gain ? `Worth about ${primary.expected_gain}.` : null,
        secondary: (mark.next_mark_advice?.secondary || []).map((s) => ({
          kind: s.kind,
          target_ao: s.target_ao || null,
          label: s.label || (s.kind === 'another_like_this' ? 'Another like this' : `Why ${s.target_ao} stalled`),
        })),
      }
      : null,
    budget: mark.rationale_budget || null,
    summary: summaryLine(mark),
    dropped,
  }
}

const countLine = (check, verb, tail) =>
  `${check.passed.length} of ${check.tested} sentence${check.tested === 1 ? '' : 's'} ${check.passed.length === 1 ? verb + 's' : verb} ${tail}`

function applicationLine(check) {
  if (!check.tested) return 'No sentence in this answer attempts to use the case.'
  return countLine(check, 'use', 'a fact true of this business alone.')
}

function dataLine(check) {
  if (!check.tested) return 'No sentence in this answer uses the figures the question supplies.'
  return countLine(check, 'use', 'the supplied figures.')
}

/** One line for a list row, a share sheet or a notification. */
export function summaryLine(mark) {
  if (!mark || typeof mark !== 'object') return ''
  const tariff = mark.header?.tariff ?? null
  const band = mark.total_band
  const head = band
    ? `${band.modal}/${tariff}`
    : 'Feedback only'

  let middle = ''
  if (mark.per_ao?.length) {
    const shown = [...mark.per_ao].sort((a, b) => b.max - a.max).slice(0, 2)
      .sort((a, b) => mark.per_ao.indexOf(a) - mark.per_ao.indexOf(b))
    middle = shown.map((r) => `Level ${r.level} on ${r.ao}`).join(', ')
  } else if (mark.per_point?.length) {
    const got = mark.per_point.filter((p) => p.awarded > 0).length
    middle = `${got} of ${mark.per_point.length} marking points`
  }

  const gap = mark.next_mark_advice?.primary_action?.gap_line
    || (mark.per_ao || []).flatMap((r) => r.missing_points || [])[0]
    || (mark.command_word_check?.met === false ? 'the command word is not answered' : '')

  return [head, middle, gap].filter(Boolean).join(' · ')
}

/** A plain-text export of the Mark: the same slots, nothing added. */
export function renderPlainText(mark, opts = {}) {
  const view = renderMark(mark, opts)
  const out = []
  out.push(view.heading || 'Mark')
  out.push(view.band.strip)
  out.push(view.band.tolerance_line)
  if (view.badge.text) out.push(view.badge.text)
  out.push('')
  if (view.coaching_line) { out.push(view.coaching_line); out.push('') }

  for (const card of view.cards) {
    if (card.kind === 'ao') {
      out.push(`${card.title} · ${card.level_line} · ${card.marks_line}`)
      if (card.descriptor) out.push(`  ${card.descriptor}`)
      if (card.within_band_reason) out.push(`  ${card.marks} of ${card.max}: ${card.within_band_reason}`)
      for (const s of card.spans) {
        const glyph = s.class === 'credited' ? '+' : s.class === 'partial' ? '·' : 'x'
        out.push(`  ${glyph} ${s.line_ref ? `${s.line_ref} ` : ''}"${s.quote.replace(/\s+/g, ' ')}"${s.reason ? ` — ${s.reason}` : ''}`)
      }
      for (const m of card.missing) out.push(`  Missing: ${m}`)
    } else {
      out.push(`${card.glyph} ${card.id}  ${card.credit_text} (${card.marks}/${card.max})`)
      if (card.atoms_line) out.push(`  ${card.atoms_line}`)
      for (const s of card.spans) out.push(`  "${s.quote.replace(/\s+/g, ' ')}"${s.line_ref ? ` (${s.line_ref})` : ''}`)
      if (card.reason) out.push(`  ${card.reason}`)
      if (card.ecf_from) out.push(`  Own figure carried forward from ${card.ecf_from}.`)
      if (card.shared_with) out.push(`  Shares its evidence with ${card.shared_with.join(', ')} — the scheme allows it.`)
    }
    if (card.warning) out.push(`  Examiners' report${card.warning.series ? `, ${card.warning.series}` : ''}: ${card.warning.text}`)
    out.push('')
  }

  for (const s of view.loose_spans) {
    out.push(`x "${s.quote.replace(/\s+/g, ' ')}"${s.reason ? ` — ${s.reason}` : ''}`)
  }
  if (view.loose_spans.length) out.push('')

  if (view.checks.application) out.push(`Application: ${view.checks.application.line}`)
  if (view.checks.data_reference) out.push(`Data: ${view.checks.data_reference.line}`)
  if (view.checks.application || view.checks.data_reference) out.push('')

  if (view.next_action) {
    out.push('Do this next')
    out.push(`  ${view.next_action.text}${view.next_action.expected_gain ? ` ${view.next_action.expected_gain}` : ''}`)
    out.push('')
  }
  if (view.confidence?.note) out.push(view.confidence.note)
  for (const w of view.warnings) out.push(w)

  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n'
}

/** The AO's student-facing name, for callers that render their own labels. */
export function aoName(ao) {
  return AO_ROLE[ao] || ao
}
