/**
 * The mark-scheme model (§05.3).
 *
 * Two kinds are first class and neither is a special case of the other:
 *   points — an ordered list of marking points, each awarded independently, with
 *            conjunctive atoms ("lone pair AND curly arrow"), dependencies, ECF
 *            and scheme alternatives.
 *   levels — a grid per assessment objective: bands carrying a mark range, a
 *            descriptor, an evidence rule that decides the level and a
 *            within-band rule that decides the mark inside it. Level 0 always
 *            exists (§05-SCHM-004).
 *   mixed  — both, summed.
 *
 * parseScheme() is the only door in. Nothing else in the codebase reads raw
 * scheme JSON, so a malformed scheme fails once, loudly, naming the field.
 */

export const AO_ORDER = ['AO1', 'AO2', 'AO3', 'AO4', 'AO5']

/** What each AO is called when we talk to a student. */
export const AO_ROLE = {
  AO1: 'knowledge', AO2: 'application', AO3: 'analysis', AO4: 'evaluation', AO5: 'synthesis',
}

/** The AO label used in the Mark view heading. */
export const AO_LABEL = {
  AO1: 'Knowledge', AO2: 'Application', AO3: 'Analysis', AO4: 'Evaluation', AO5: 'Synthesis',
}

/** 05-MARK-003. Closed enum; anything else is dropped by the post-lint. */
export const REASON_CODES = [
  'SINGLE_LINK', 'ASSERTION_NO_LINK', 'GENERIC_NOT_CONTEXT', 'DATA_NOT_USED', 'EVAL_IN_ANALYSE',
  'TERM_REPEATED_IN_DEFINITION', 'WRONG_STAKEHOLDER', 'NO_WORKING', 'UNITS_MISSING', 'SIG_FIG',
  'CONTRADICTION', 'ILLEGIBLE', 'OUT_OF_SCOPE', 'ATOM_NOT_MET', 'NOT_IN_INDICATIVE_VALID_ALT',
  'DUPLICATE_POINT',
]

/** The standing sentence for a reason code, used when the model gives none (§09 microcopy). */
export const REASON_TEXT = {
  SINGLE_LINK: 'One link only — the chain stops before its consequence.',
  ASSERTION_NO_LINK: 'An assertion with no connective and nothing following from it.',
  GENERIC_NOT_CONTEXT: 'Would be true of any business; it fails the cover-the-name test.',
  DATA_NOT_USED: 'The figures the question supplies are not used.',
  EVAL_IN_ANALYSE: 'No evaluation marks are available on this question.',
  TERM_REPEATED_IN_DEFINITION: 'The term is repeated inside its own definition.',
  WRONG_STAKEHOLDER: 'The effect is traced for the wrong stakeholder.',
  NO_WORKING: 'No working shown — a wrong final answer with no method scores zero.',
  UNITS_MISSING: 'The units the scheme asks for are missing.',
  SIG_FIG: 'Rounded or given to the wrong number of significant figures.',
  CONTRADICTION: 'Contradicted later in the answer.',
  ILLEGIBLE: 'Could not be read.',
  OUT_OF_SCOPE: 'Nothing in the grid credits this.',
  ATOM_NOT_MET: 'Part of the point only — the scheme wants every part.',
  NOT_IN_INDICATIVE_VALID_ALT: 'Valid under the descriptor but absent from the indicative content; credited.',
  DUPLICATE_POINT: 'Already credited under an earlier point; the scheme does not license sharing it.',
}

/** 05-PROC-010. The fixed annotation set. */
export const GLYPHS = ['✓', '×', 'Ø', 'BOD', 'CON', 'RE', 'GA', 'ECF', 'NC', 'I']

export const GLYPH_MEANING = {
  '✓': 'Credited', '×': 'Offered but not credited', 'Ø': 'Nothing offered',
  BOD: 'Benefit of the doubt', CON: 'Consequential', RE: 'Rounding error',
  GA: 'Arithmetic slip', ECF: 'Error carried forward', NC: 'Not creditable', I: 'Ignored',
}

export const POINT_TYPES = ['M', 'A', 'B', 'DM', 'DB', 'FT']

/**
 * 05-PROC-012. Command word → AO ceiling and the level a missing judgement caps at.
 * `requirement` is the clause the coaching line interpolates (§15.E owns the string).
 */
export const COMMAND_WORDS = {
  define: { ceiling: 'AO1', uncapped: null, requirement: 'the precise meaning is required' },
  state: { ceiling: 'AO1', uncapped: null, requirement: 'a statement is enough, no explanation is credited' },
  identify: { ceiling: 'AO1', uncapped: null, requirement: 'naming it is enough' },
  name: { ceiling: 'AO1', uncapped: null, requirement: 'naming it is enough' },
  list: { ceiling: 'AO1', uncapped: null, requirement: 'a list is enough, no development is credited' },
  give: { ceiling: 'AO1', uncapped: null, requirement: 'the answer alone is required' },
  describe: { ceiling: 'AO2', uncapped: null, requirement: 'the features are required, not the reasons' },
  outline: { ceiling: 'AO2', uncapped: null, requirement: 'the main features are required, briefly' },
  explain: { ceiling: 'AO2', uncapped: null, requirement: 'reasons are required, not description' },
  calculate: { ceiling: 'AO2', uncapped: null, requirement: 'the working must be shown' },
  'show that': { ceiling: 'AO2', uncapped: null, requirement: 'every step of the working is required' },
  apply: { ceiling: 'AO2', uncapped: null, requirement: 'the case must carry the answer' },
  analyse: { ceiling: 'AO3', uncapped: null, requirement: 'a chain of reasoning is required' },
  examine: { ceiling: 'AO3', uncapped: null, requirement: 'the reasoning must be developed, not listed' },
  compare: { ceiling: 'AO3', uncapped: null, requirement: 'the similarities and differences must be linked' },
  discuss: { ceiling: 'AO4', uncapped: 2, requirement: 'a judgement is required' },
  evaluate: { ceiling: 'AO4', uncapped: 2, requirement: 'a judgement is required' },
  assess: { ceiling: 'AO4', uncapped: 2, requirement: 'a judgement is required' },
  recommend: { ceiling: 'AO4', uncapped: 2, requirement: 'one option must be chosen' },
  advise: { ceiling: 'AO4', uncapped: 2, requirement: 'one course of action must be chosen' },
  justify: { ceiling: 'AO4', uncapped: 2, requirement: 'the choice must be defended' },
  'to what extent': { ceiling: 'AO4', uncapped: 2, requirement: 'a judgement about degree is required' },
}

/** 05.3 tolerance table. The only source of band width anywhere. */
export function toleranceFor(marksTotal) {
  const n = Number(marksTotal) || 0
  if (n <= 8) return 1
  if (n <= 29) return 2
  return 3
}

/** Look a command word up case-insensitively; unknown words fall back to the scheme's ceiling. */
export function commandWordRule(word, fallbackCeiling = 'AO3') {
  const key = String(word || '').trim().toLowerCase()
  const hit = COMMAND_WORDS[key]
  if (hit) return { word: String(word || '').trim(), ...hit, known: true }
  return { word: String(word || '').trim(), ceiling: fallbackCeiling, uncapped: null, requirement: 'answer the question as it is asked', known: false }
}

/** Which AOs are on offer under a ceiling. AO4 ceiling means AO1–AO4 are all live. */
export function aosUnderCeiling(ceiling) {
  const i = AO_ORDER.indexOf(ceiling)
  return i < 0 ? AO_ORDER.slice(0, 4) : AO_ORDER.slice(0, i + 1)
}

const fail = (msg) => { throw Object.assign(new Error(msg), { status: 400 }) }

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)
const asArray = (v) => (Array.isArray(v) ? v : v == null ? [] : [v])
const trim = (v) => (typeof v === 'string' ? v.trim() : '')

function intAt(v, field, { min = 0, max = Infinity } = {}) {
  const n = typeof v === 'number' ? v : Number(v)
  if (!Number.isInteger(n)) fail(`${field} must be a whole number, received ${JSON.stringify(v)}`)
  if (n < min || n > max) fail(`${field} must be between ${min} and ${max}, received ${n}`)
  return n
}

/** Freeze a whole tree so a Mark or a scheme cannot be edited after it is handed out. */
export function deepFreeze(value) {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value
  Object.freeze(value)
  for (const key of Object.keys(value)) deepFreeze(value[key])
  return value
}

function normaliseAo(raw, field) {
  const ao = String(raw || '').trim().toUpperCase().replace(/[\s_-]/g, '')
  if (!ao) return null
  if (/^AO[1-5]$/.test(ao)) return ao
  if (/^[1-5]$/.test(ao)) return `AO${ao}`
  fail(`${field} must be one of ${AO_ORDER.join(', ')}, received ${JSON.stringify(raw)}`)
}

/** Atoms of a conjunctive point: accepted as strings or as {id,text} objects. */
function parseAtoms(raw, field) {
  return asArray(raw).map((atom, i) => {
    const id = `a${i + 1}`
    if (typeof atom === 'string') {
      if (!atom.trim()) fail(`${field}[${i}] is empty; every atom needs its own wording`)
      return { id, text: atom.trim() }
    }
    if (isObj(atom)) {
      const text = trim(atom.text ?? atom.condition ?? atom.credit_text)
      if (!text) fail(`${field}[${i}].text is required on a conjunctive atom`)
      return { id: trim(atom.id) || id, text }
    }
    return fail(`${field}[${i}] must be a string or an object with a text field`)
  })
}

function parsePoint(raw, i, kindField) {
  const field = `${kindField}[${i}]`
  if (!isObj(raw)) fail(`${field} must be an object`)
  const id = trim(raw.id) || `P${i + 1}`
  const text = trim(raw.text ?? raw.credit_text ?? raw.credit ?? raw.descriptor)
  if (!text) fail(`${field}.text is required — a marking point must say what earns it`)
  const marks = intAt(raw.marks ?? 1, `${field}.marks`, { min: 0, max: 100 })
  const type = (trim(raw.type) || 'B').toUpperCase()
  if (!POINT_TYPES.includes(type)) fail(`${field}.type must be one of ${POINT_TYPES.join(', ')}, received ${JSON.stringify(raw.type)}`)
  const ao = normaliseAo(raw.ao, `${field}.ao`)
  const conjunctive = parseAtoms(raw.conjunctive ?? raw.conjunctive_conditions ?? raw.atoms, `${field}.conjunctive`)
  const dependsOn = trim(raw.depends_on ?? raw.dependsOn) || null
  if (!dependsOn && (type === 'A' || type === 'DM' || type === 'DB')) {
    fail(`${field}.depends_on is required on a ${type} point (${id}) — a dependent mark must name the mark it follows`)
  }
  const alternatives = asArray(raw.alternatives).map((a, j) => {
    const t = typeof a === 'string' ? a.trim() : trim(a?.text)
    if (!t) fail(`${field}.alternatives[${j}] must be a non-empty string`)
    return t
  })
  return {
    id,
    text,
    marks,
    ao,
    type,
    conjunctive,
    allRequired: raw.all_required === false ? false : conjunctive.length > 0,
    dependsOn,
    ecf: raw.ecf === true || raw.ecf_allowed === true || type === 'FT',
    cao: raw.cao === true,
    isw: raw.isw === true,
    ora: raw.ora === true,
    alternatives,
    accept: asArray(raw.accept).map((a) => String(a)),
    reject: asArray(raw.reject).map((a) => String(a)),
    ignore: asArray(raw.ignore).map((a) => String(a)),
    shareableWith: asArray(raw.shareable_with ?? raw.shareableWith).map((a) => String(a)),
    notes: trim(raw.notes) || null,
  }
}

function parseBand(raw, ao, i) {
  const field = `levels[${ao}].bands[${i}]`
  if (!isObj(raw)) fail(`${field} must be an object`)
  const level = intAt(raw.level, `${field}.level`, { min: 0, max: 12 })
  let range = raw.range ?? raw.marks ?? null
  if (range == null) fail(`${field}.range is required — a band must say which marks it covers, e.g. [4,8]`)
  if (typeof range === 'number') range = [range, range]
  if (!Array.isArray(range) || range.length !== 2) fail(`${field}.range must be a two-element array [lo, hi]`)
  const lo = intAt(range[0], `${field}.range[0]`, { min: 0, max: 200 })
  const hi = intAt(range[1], `${field}.range[1]`, { min: 0, max: 200 })
  if (hi < lo) fail(`${field}.range is inverted: [${lo}, ${hi}]`)
  const descriptor = trim(raw.descriptor ?? raw.text)
  if (!descriptor) fail(`${field}.descriptor is required — the band must say what it describes`)
  const withinRaw = raw.within_band_rule ?? raw.withinBandRule ?? null
  let withinBandRule = null
  if (isObj(withinRaw)) {
    withinBandRule = {}
    for (const [key, value] of Object.entries(withinRaw)) {
      const text = trim(value)
      if (!text) fail(`${field}.within_band_rule["${key}"] must say what earns that mark`)
      const m = String(key).match(/^(\d+)\s*(?:[-–]\s*(\d+))?$/)
      if (!m) fail(`${field}.within_band_rule key "${key}" must be a mark or a mark range such as "5-6"`)
      const from = Number(m[1])
      const to = m[2] == null ? from : Number(m[2])
      for (let mark = from; mark <= to; mark++) withinBandRule[mark] = text
    }
    for (let mark = lo; mark <= hi; mark++) {
      if (!withinBandRule[mark]) {
        fail(`${field}.within_band_rule does not cover ${mark} mark${mark === 1 ? '' : 's'}; every mark in the band's range needs its own evidence`)
      }
    }
  }
  return {
    bandId: trim(raw.band_id) || `${ao}.L${level}`,
    level,
    range: [lo, hi],
    descriptor,
    evidenceRule: trim(raw.evidence_rule ?? raw.evidenceRule) || null,
    withinBandRule,
    indicative: asArray(raw.indicative ?? raw.indicative_content).map((x) => (typeof x === 'string' ? x : trim(x?.text))).filter(Boolean),
  }
}

function parseGrid(rawLevels, repairs) {
  // Accept either [{ao, max, bands}] or {AO1: [bands], …}.
  let entries
  if (Array.isArray(rawLevels)) {
    entries = rawLevels.map((g, i) => {
      if (!isObj(g)) fail(`levels[${i}] must be an object with ao, max and bands`)
      return [normaliseAo(g.ao, `levels[${i}].ao`), g]
    })
  } else if (isObj(rawLevels)) {
    entries = Object.entries(rawLevels).map(([ao, g]) => [normaliseAo(ao, `levels.${ao}`), Array.isArray(g) ? { bands: g } : g])
  } else {
    return []
  }

  const grid = entries.map(([ao, g]) => {
    if (!ao) fail('every levels grid needs an ao (AO1–AO5)')
    const bandsRaw = asArray(g.bands ?? g.levels)
    if (!bandsRaw.length) fail(`levels[${ao}].bands is empty — a grid needs at least a Level 0 band`)
    const bands = bandsRaw.map((b, i) => parseBand(b, ao, i)).sort((a, b) => b.level - a.level)

    const seen = new Set()
    for (const b of bands) {
      if (seen.has(b.level)) fail(`levels[${ao}] declares Level ${b.level} twice`)
      seen.add(b.level)
    }

    const top = bands[0]
    const max = g.max == null ? top.range[1] : intAt(g.max, `levels[${ao}].max`, { min: 0, max: 200 })
    if (top.range[1] !== max) {
      fail(`levels[${ao}].max is ${max} but the top band tops out at ${top.range[1]}; the grid must reach the AO tariff`)
    }

    if (!seen.has(0)) {
      const lowest = bands[bands.length - 1]
      if (lowest.range[0] === 0) {
        fail(`levels[${ao}] has no Level 0 band and Level ${lowest.level} already covers 0 marks; give Level 0 its own band`)
      }
      bands.push({
        bandId: `${ao}.L0`, level: 0, range: [0, 0],
        descriptor: `No creditable ${AO_ROLE[ao] || 'work'}`,
        evidenceRule: null, withinBandRule: { 0: `no creditable ${AO_ROLE[ao] || 'work'}` }, indicative: [],
      })
      repairs.push(`levels[${ao}]: added the missing Level 0 band`)
    }

    // Every mark from 0 to max must be reachable through exactly one band.
    const owner = new Array(max + 1).fill(null)
    for (const b of bands) {
      for (let m = b.range[0]; m <= Math.min(b.range[1], max); m++) {
        if (owner[m] != null) fail(`levels[${ao}]: Level ${b.level} and Level ${owner[m]} both claim ${m} mark${m === 1 ? '' : 's'}`)
        owner[m] = b.level
      }
    }
    const gap = owner.findIndex((v) => v == null)
    if (gap >= 0) fail(`levels[${ao}]: no band awards ${gap} mark${gap === 1 ? '' : 's'}; the bands must cover 0 to ${max}`)

    return { ao, max, bands }
  })

  grid.sort((a, b) => AO_ORDER.indexOf(a.ao) - AO_ORDER.indexOf(b.ao))
  return grid
}

function parseContext(raw) {
  if (!isObj(raw)) return null
  const kind = trim(raw.kind) || 'none'
  if (!['none', 'case_study', 'data_response', 'practical_setup'].includes(kind)) {
    fail(`context.kind must be none, case_study, data_response or practical_setup, received ${JSON.stringify(raw.kind)}`)
  }
  if (kind === 'none') return null
  const dataSeries = asArray(raw.data_series ?? raw.dataSeries).map((s, i) => {
    if (!isObj(s)) fail(`context.data_series[${i}] must be an object with a label and values`)
    return {
      label: trim(s.label) || `series ${i + 1}`,
      unit: trim(s.unit) || null,
      values: asArray(s.values).map((v) => Number(v)).filter((v) => Number.isFinite(v)),
      period: trim(s.period) || null,
    }
  })
  if (kind === 'data_response' && !dataSeries.length) {
    fail('context.data_series is required when context.kind is data_response — the figures are the only ground truth for the data check')
  }
  return {
    kind,
    caseStudyId: trim(raw.case_study_id) || null,
    businessName: trim(raw.business_name ?? raw.businessName) || null,
    caseFacts: asArray(raw.case_facts ?? raw.caseFacts).map((f) => String(f).trim()).filter(Boolean),
    dataSeries,
  }
}

function parseCalibration(raw) {
  if (!isObj(raw)) return null
  const state = trim(raw.state) || 'provisional'
  if (!['gated', 'provisional', 'uncalibrated', 'n/a'].includes(state)) {
    fail(`calibration.state must be gated, provisional, uncalibrated or n/a, received ${JSON.stringify(raw.state)}`)
  }
  const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : null)
  return {
    state,
    qwk: num(raw.qwk),
    humanLine: num(raw.human_line ?? raw.humanLine),
    nScripts: num(raw.n_scripts ?? raw.nScripts),
    lastAudit: trim(raw.last_audit ?? raw.lastAudit) || null,
    paperLabel: trim(raw.paper_label ?? raw.paperLabel) || null,
  }
}

/**
 * Validate and normalise a mark scheme. Throws a 400 naming the offending field.
 * Returns a frozen scheme; passing a parsed scheme back in is a no-op.
 */
export function parseScheme(json) {
  if (isObj(json) && json.__margin === 'scheme@1') return json
  if (typeof json === 'string') {
    try { json = JSON.parse(json) } catch { fail('scheme body is not valid JSON') }
  }
  if (!isObj(json)) fail('scheme must be an object')

  const repairs = []
  const kindRaw = trim(json.kind ?? json.scheme_type) || (json.levels ? 'levels' : 'points')
  const kind = kindRaw.toLowerCase()
  if (!['points', 'levels', 'mixed', 'practical'].includes(kind)) {
    fail(`scheme.kind must be points, levels, mixed or practical, received ${JSON.stringify(kindRaw)}`)
  }

  const points = asArray(json.points ?? json.marking_points).map((p, i) => parsePoint(p, i, 'points'))
  const grid = parseGrid(json.levels, repairs)

  if ((kind === 'points' || kind === 'practical') && !points.length) {
    fail('scheme.points is empty — a points scheme needs at least one marking point')
  }
  if (kind === 'levels' && !grid.length) fail('scheme.levels is empty — a levels scheme needs at least one AO grid')
  if (kind === 'mixed' && (!points.length || !grid.length)) {
    fail('a mixed scheme needs both scheme.points and scheme.levels')
  }

  const ids = new Set()
  for (const p of points) {
    if (ids.has(p.id)) fail(`points declares the id "${p.id}" twice; marking-point ids must be unique`)
    ids.add(p.id)
  }
  for (const p of points) {
    if (p.dependsOn && !ids.has(p.dependsOn)) {
      fail(`points[${p.id}].depends_on names "${p.dependsOn}", which is not a marking point in this scheme`)
    }
    if (p.dependsOn === p.id) fail(`points[${p.id}].depends_on points at itself`)
    for (const other of p.shareableWith) {
      if (!ids.has(other)) fail(`points[${p.id}].shareable_with names "${other}", which is not a marking point in this scheme`)
    }
  }

  const pointsMarks = points.reduce((s, p) => s + p.marks, 0)
  const gridMarks = grid.reduce((s, g) => s + g.max, 0)
  const derivedTotal = pointsMarks + gridMarks

  const totalRaw = json.marks_total ?? json.marksTotal ?? json.max ?? json.tariff
  const marksTotal = totalRaw == null ? derivedTotal : intAt(totalRaw, 'scheme.marks_total', { min: 1, max: 200 })
  if (!marksTotal) fail('scheme.marks_total is 0; a scheme must be worth at least one mark')
  if (derivedTotal !== marksTotal) {
    fail(`scheme.marks_total is ${marksTotal} but the scheme awards ${derivedTotal} (${pointsMarks} from marking points, ${gridMarks} from the levels grid); a scheme whose parts do not sum to its tariff cannot be marked`)
  }

  // AO tariff split: declared or derived, and it must sum to the item tariff.
  const declared = json.ao_split ?? json.aoSplit ?? json.ao_tariff ?? null
  const derivedSplit = {}
  for (const g of grid) derivedSplit[g.ao] = (derivedSplit[g.ao] || 0) + g.max
  for (const p of points) if (p.ao) derivedSplit[p.ao] = (derivedSplit[p.ao] || 0) + p.marks
  const unassigned = points.filter((p) => !p.ao).reduce((s, p) => s + p.marks, 0)

  let aoTariff
  if (isObj(declared)) {
    aoTariff = {}
    for (const [rawAo, value] of Object.entries(declared)) {
      const ao = normaliseAo(rawAo, `scheme.ao_split.${rawAo}`)
      aoTariff[ao] = intAt(value, `scheme.ao_split.${ao}`, { min: 0, max: 200 })
    }
    const sum = Object.values(aoTariff).reduce((s, n) => s + n, 0)
    if (sum !== marksTotal) {
      fail(`scheme.ao_split sums to ${sum} but the item tariff is ${marksTotal}; the AO tariffs must sum to the tariff`)
    }
    for (const [ao, value] of Object.entries(derivedSplit)) {
      if (aoTariff[ao] == null) fail(`scheme.ao_split has no entry for ${ao}, which the scheme awards ${value} mark${value === 1 ? '' : 's'} for`)
      if (!unassigned && aoTariff[ao] !== value) {
        fail(`scheme.ao_split.${ao} is ${aoTariff[ao]} but the scheme awards ${value} there`)
      }
    }
  } else {
    if (unassigned) {
      fail(`${unassigned} mark${unassigned === 1 ? ' is' : 's are'} on marking points with no ao; give every point an ao or declare scheme.ao_split`)
    }
    aoTariff = derivedSplit
    const sum = Object.values(aoTariff).reduce((s, n) => s + n, 0)
    if (sum !== marksTotal) {
      fail(`the AO tariffs sum to ${sum} but the item tariff is ${marksTotal}`)
    }
  }

  const ordered = {}
  for (const ao of AO_ORDER) if (aoTariff[ao] != null) ordered[ao] = aoTariff[ao]

  const commandWord = trim(json.command_word ?? json.commandWord) || null
  const aoCeiling = normaliseAo(json.ao_ceiling ?? json.aoCeiling, 'scheme.ao_ceiling')
    || commandWordRule(commandWord, Object.keys(ordered).pop() || 'AO3').ceiling

  const ecfRaw = isObj(json.ecf_policy) ? json.ecf_policy : {}
  const scope = trim(ecfRaw.scope) || (ecfRaw.allowed ? 'within-part' : 'none')
  if (!['none', 'within-part', 'across-parts', 'whole-question'].includes(scope)) {
    fail(`scheme.ecf_policy.scope must be none, within-part, across-parts or whole-question, received ${JSON.stringify(ecfRaw.scope)}`)
  }

  const penaltiesRaw = isObj(json.penalties) ? json.penalties : {}
  const unitsMissing = penaltiesRaw.units_missing ?? null
  if (unitsMissing != null && !['lose_A_mark', 'lose_B_mark', 'none'].includes(unitsMissing)) {
    fail(`scheme.penalties.units_missing must be lose_A_mark, lose_B_mark or none, received ${JSON.stringify(unitsMissing)}`)
  }

  const scheme = {
    __margin: 'scheme@1',
    id: trim(json.id) || null,
    version: trim(json.version) || null,
    kind,
    questionId: trim(json.question_id ?? json.questionId) || null,
    part: trim(json.part) || null,
    paper: json.paper == null ? null : String(json.paper),
    syllabus: trim(json.syllabus ?? json.syllabus_version) || null,
    packVersion: trim(json.pack_version ?? json.packVersion) || null,
    commandWord,
    commandWordDefRef: trim(json.command_word_def_ref) || null,
    aoCeiling,
    marksTotal,
    tolerance: json.tolerance == null ? toleranceFor(marksTotal) : intAt(json.tolerance, 'scheme.tolerance', { min: 0, max: 10 }),
    bestFit: json.best_fit === undefined ? grid.length > 0 : json.best_fit === true,
    levelProcedure: trim(json.level_procedure ?? json.levelProcedure) || (grid.length ? 'best_fit' : 'points'),
    wordingStatus: trim(json.wording_status) || 'own_paraphrase',
    aoSplit: ordered,
    points,
    levels: grid,
    indicative: asArray(json.indicative_content ?? json.indicative).map((x, i) => {
      if (typeof x === 'string') return { id: `IC${i + 1}`, text: x.trim(), ao: null }
      if (!isObj(x)) fail(`scheme.indicative_content[${i}] must be a string or an object with a text field`)
      const text = trim(x.text)
      if (!text) fail(`scheme.indicative_content[${i}].text is required`)
      return { id: trim(x.id) || `IC${i + 1}`, text, ao: normaliseAo(x.ao ?? x.ao_hint, `scheme.indicative_content[${i}].ao`) }
    }),
    context: parseContext(json.context),
    ecfPolicy: { allowed: ecfRaw.allowed === true || scope !== 'none', scope },
    penalties: {
      sigFigOncePerPaper: penaltiesRaw.sig_fig_once_per_paper === true,
      unitsMissing: unitsMissing || 'none',
    },
    diagramRequired: json.diagram_required === true,
    workingRequired: json.working_required === true || points.some((p) => p.type === 'M' || p.type === 'A'),
    examinerInsights: asArray(json.examiner_insights).map((e, i) => {
      if (!isObj(e)) fail(`scheme.examiner_insights[${i}] must be an object`)
      const paraphrase = trim(e.paraphrase ?? e.text)
      if (!paraphrase) fail(`scheme.examiner_insights[${i}].paraphrase is required`)
      return {
        id: trim(e.id) || `ei_${i + 1}`,
        series: trim(e.series) || null,
        paraphrase,
        heuristic: trim(e.heuristic) || null,
        ao: normaliseAo(e.ao, `scheme.examiner_insights[${i}].ao`),
      }
    }),
    calibration: parseCalibration(json.calibration),
    repairs,
  }

  return deepFreeze(scheme)
}

/** The item tariff this scheme marks against. */
export function maxMarks(scheme) {
  return parseScheme(scheme).marksTotal
}

/** The AO tariff split, in AO order. A copy, so a caller cannot edit the scheme. */
export function aoSplit(scheme) {
  return { ...parseScheme(scheme).aoSplit }
}

/** Every band for one AO, highest level first. */
export function bandsFor(ao, scheme) {
  const s = parseScheme(scheme)
  const grid = s.levels.find((g) => g.ao === ao)
  return grid ? grid.bands : []
}

/**
 * The band an AO's grid gives at `band` (a level number).
 * Throws naming the AO and the level when the grid has no such band, because a
 * Mark that cites a level the grid does not contain is a schema error (05-MARK-002).
 */
export function levelFor(ao, band, scheme) {
  const s = parseScheme(scheme)
  const grid = s.levels.find((g) => g.ao === ao)
  if (!grid) fail(`this scheme has no ${ao} grid; its AOs are ${s.levels.map((g) => g.ao).join(', ') || 'none'}`)
  const level = intAt(band, `${ao} level`, { min: 0, max: 12 })
  const hit = grid.bands.find((b) => b.level === level)
  if (!hit) fail(`${ao} has no Level ${level}; its levels are ${grid.bands.map((b) => b.level).join(', ')}`)
  return hit
}

/** The band that owns a mark inside an AO grid. */
export function bandForMark(ao, marks, scheme) {
  const bands = bandsFor(ao, scheme)
  return bands.find((b) => marks >= b.range[0] && marks <= b.range[1]) || null
}

/** The within-band rule text that earns exactly this mark, when the scheme carries one. */
export function withinBandReason(ao, level, marks, scheme) {
  const band = levelFor(ao, level, scheme)
  if (!band.withinBandRule) return null
  return band.withinBandRule[marks] || null
}

/** One marking point by id. */
export function pointById(scheme, id) {
  return parseScheme(scheme).points.find((p) => p.id === id) || null
}

/** May these two marking points be credited from the same span? (05-SCHM-009) */
export function sharesSpan(scheme, aId, bId) {
  const a = pointById(scheme, aId)
  const b = pointById(scheme, bId)
  if (!a || !b) return false
  return a.shareableWith.includes(bId) || b.shareableWith.includes(aId)
}
