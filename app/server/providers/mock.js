/**
 * The deterministic mock provider (§08.7 rung 5 of every ladder, §08.11).
 *
 * This is what serves the product when no API key is configured, so it is not a
 * placeholder: it does the three jobs the app asks a model to do — marking
 * judgements, tutor Turns, and an honest answer to anything else — with real
 * work over the material it is given.
 *
 * Determinism: every choice is seeded from a hash of the request, so the same
 * request always produces the same reply. Nothing in the output path reads the
 * clock or Math.random. Timing (the streaming tick) is not output.
 */
import { priceOf } from './types.js'

const CHUNK_MS = 12

/** Weighted coverage at or above this credits a marking point. */
const CREDIT_AT = 0.65

/* ------------------------------------------------------------------ *
 * Seeded randomness
 * ------------------------------------------------------------------ */

function hash32(str) {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h >>> 0
}

/** mulberry32 — small, fast, and reproducible across runs and machines. */
function rng(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const pick = (list, r) => list[Math.floor(r() * list.length) % list.length]

/* ------------------------------------------------------------------ *
 * Text normalisation, stemming, synonyms
 * ------------------------------------------------------------------ */

const STOP = new Set((
  'a an the and or but if then than that this these those of to in on at by for with from as is are was were be been being ' +
  'it its do does did not no so such into over under about your you they them their there here we our us i my me ' +
  'can could should would will shall may might must have has had he she his her him one two more most much many ' +
  'any each every other some all both when while which what why how where who whom whose also through upon just ' +
  'very really only even still yet after before during between'
).split(' '))

/** Exam-domain synonym clusters. Each member maps to the cluster's first word. */
const SYNONYM_SETS = [
  ['cost', 'costs', 'expense', 'expenses', 'expenditure', 'outlay'],
  ['revenue', 'turnover', 'sales', 'income', 'takings'],
  ['profit', 'surplus', 'earnings', 'margin'],
  ['increase', 'increases', 'rise', 'rises', 'grow', 'growth', 'higher', 'up', 'improve', 'improves', 'boost'],
  ['decrease', 'decreases', 'fall', 'falls', 'drop', 'lower', 'down', 'reduce', 'reduces', 'reduction', 'decline'],
  ['because', 'since', 'therefore', 'thus', 'hence', 'so', 'consequently'],
  ['customer', 'customers', 'consumer', 'consumers', 'buyer', 'buyers', 'client', 'clients'],
  ['employee', 'employees', 'worker', 'workers', 'staff', 'labour', 'workforce'],
  ['firm', 'firms', 'business', 'businesses', 'company', 'companies', 'organisation', 'organization'],
  ['price', 'prices', 'pricing', 'charge', 'charges'],
  ['demand', 'demands', 'want', 'wants', 'need', 'needs'],
  ['quality', 'standard', 'standards'],
  ['motivation', 'motivated', 'morale', 'satisfaction'],
  ['cash', 'liquidity', 'cashflow'],
  ['loan', 'loans', 'debt', 'borrowing', 'gearing', 'overdraft'],
  ['efficiency', 'efficient', 'productivity', 'productive'],
  ['risk', 'risks', 'risky', 'uncertainty'],
  ['energy', 'heat', 'thermal'],
  ['force', 'forces', 'push', 'pull'],
  ['mass', 'weight'],
  ['speed', 'velocity', 'rate'],
  ['atom', 'atoms', 'particle', 'particles', 'molecule', 'molecules'],
  ['electron', 'electrons', 'lone pair', 'negative charge'],
  ['bond', 'bonds', 'bonding', 'link', 'links', 'linkage'],
  ['cell', 'cells', 'organism', 'organisms'],
  ['market', 'markets', 'segment', 'segments'],
  ['train', 'training', 'develop', 'development', 'upskill'],
  ['supply', 'supplies', 'supplier', 'suppliers'],
  ['competition', 'competitor', 'competitors', 'rival', 'rivals'],
  ['capacity', 'output', 'production', 'volume'],
  ['invest', 'investment', 'capital', 'funding', 'finance'],
]

const SUFFIXES = ['ational', 'ation', 'ements', 'ement', 'ingly', 'edly', 'ising', 'izing', 'ised', 'ized', 'ing', 'ers', 'er', 'est', 'ies', 'ied', 'es', 'ed', 'ly', 's']

const SYNONYM = new Map()
for (const set of SYNONYM_SETS) {
  const head = stemWord(set[0])
  for (const word of set) SYNONYM.set(stemWord(word), head)
}

/** Crude but stable stemmer: enough to make "reduces" and "reduction" meet. */
function stemWord(word) {
  let w = String(word).toLowerCase()
  if (w.length <= 3) return w
  if (w.endsWith('ies') && w.length > 4) return w.slice(0, -3) + 'y'
  const doubleS = w.endsWith('ss')
  for (const suf of SUFFIXES) {
    if (doubleS && (suf === 's' || suf === 'es')) continue
    if (w.length - suf.length >= 4 && w.endsWith(suf)) { w = w.slice(0, -suf.length); break }
  }
  if (w.length > 4 && w.endsWith('e')) w = w.slice(0, -1)
  return w
}

function normalise(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[^a-z0-9%$£€.\-+/' ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Content stems of a phrase, synonym-canonicalised, stopwords dropped. */
function terms(text) {
  const out = []
  for (const raw of normalise(text).split(' ')) {
    const word = raw.replace(/^['.\-+/]+|['.\-+/]+$/g, '')
    if (!word || STOP.has(word)) continue
    if (/^[\d.$£€%\-+/]+$/.test(word)) { out.push(word.replace(/[^0-9.]/g, '')); continue }
    const s = stemWord(word)
    out.push(SYNONYM.get(s) || s)
  }
  return out
}

const termSet = (text) => new Set(terms(text))

/** Split into sentences, keeping exact offsets so quotes stay verbatim. */
function sentences(text) {
  const out = []
  const re = /[^\n.!?]+[.!?]*/g
  const src = String(text || '')
  let m
  while ((m = re.exec(src))) {
    const raw = m[0]
    const lead = raw.length - raw.trimStart().length
    const body = raw.trim()
    if (body.replace(/[^a-zA-Z0-9]/g, '').length > 2) {
      out.push({ text: body, start: m.index + lead, end: m.index + lead + body.length })
    }
  }
  return out
}

/**
 * Term weights for one scheme: a term used by every marking point discriminates
 * nothing, a term used by one point is that point's key term. Without this a
 * bag of shared vocabulary ("cost", "unit", "output") credits the wrong point.
 */
function weighting(corpus) {
  const df = new Map()
  for (const text of corpus) for (const t of new Set(terms(text))) df.set(t, (df.get(t) || 0) + 1)
  return {
    weight: (t) => 1 / (1 + (df.get(t) || 0)),
    /** Terms this phrase alone uses — the scheme's own words for this point. */
    distinctive: (text) => terms(text).filter(t => (df.get(t) || 0) <= 1 && t.length >= 5),
  }
}

const FLAT = { weight: () => 1, distinctive: () => [] }

/**
 * How much of `needle` is evidenced in `hay`, weighted so the scheme's own key
 * terms carry the decision. A verbatim phrase match scores 1 outright; a phrase
 * whose distinctive term is absent is capped below the credit threshold.
 */
function coverage(needle, haySet, hayNormalised, w = FLAT) {
  const want = terms(needle)
  if (!want.length) return 0
  const phrase = normalise(needle)
  if (phrase.length > 8 && hayNormalised.includes(phrase)) return 1
  let hit = 0, total = 0
  for (const t of want) {
    const weight = w.weight(t)
    total += weight
    if (haySet.has(t)) hit += weight
  }
  const score = total > 0 ? hit / total : 0
  const keyTerms = w.distinctive(needle)
  if (keyTerms.length && keyTerms.every(t => !haySet.has(t))) return Math.min(score, 0.5)
  return score
}

/* ------------------------------------------------------------------ *
 * Reading the request
 * ------------------------------------------------------------------ */

/** Every JSON object or array that parses inside a blob of prompt text. */
function jsonObjectsIn(text) {
  const src = String(text || '')
  const found = []
  let attempts = 0
  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    if (c !== '{' && c !== '[') continue
    // Cheap pre-filter: a JSON value never opens with prose, so a brace not
    // followed by a quote, a bracket or a close is skipped without scanning.
    const next = (src.slice(i + 1, i + 40).match(/\S/) || [''])[0]
    if (!'"{[}]'.includes(next) && !(c === '[' && /[-\d]/.test(next))) continue
    if (++attempts > 500) break
    let depth = 0, inStr = false, esc = false
    for (let j = i; j < src.length && j - i < 200000; j++) {
      const d = src[j]
      if (esc) { esc = false; continue }
      if (d === '\\') { esc = true; continue }
      if (d === '"') { inStr = !inStr; continue }
      if (inStr) continue
      if (d === '{' || d === '[') depth++
      else if (d === '}' || d === ']') {
        depth--
        if (depth === 0) {
          const slice = src.slice(i, j + 1)
          if (slice.length > 6) {
            try { found.push(JSON.parse(slice)); i = j } catch { /* not JSON — keep scanning */ }
          }
          break
        }
      }
    }
  }
  return found
}

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)

/** Depth-first search for the first node satisfying `test`. */
function findNode(root, test, depth = 0) {
  if (depth > 6 || root === null || typeof root !== 'object') return null
  if (!Array.isArray(root) && test(root)) return root
  for (const value of Array.isArray(root) ? root : Object.values(root)) {
    if (value && typeof value === 'object') {
      const hit = findNode(value, test, depth + 1)
      if (hit) return hit
    }
  }
  return null
}

const hasKey = (o, ...keys) => isObj(o) && keys.some(k => k in o)

/** Scheme, item and misconceptions, from JSON in the prompt or from its prose. */
function readMaterial(req) {
  const system = String(req.system || '')
  const blobs = jsonObjectsIn(system)
  let scheme = null, item = null, misconceptions = []

  for (const blob of blobs) {
    if (!scheme) {
      const s = findNode(blob, o => hasKey(o, 'marking_points', 'markingPoints', 'levels', 'indicative_content', 'indicativeContent', 'indicative'))
      if (s) scheme = s
    }
    if (!item) {
      const it = findNode(blob, o => hasKey(o, 'stem') && (hasKey(o, 'tariff', 'command_word', 'commandWord', 'marks', 'kind')))
      if (it) item = it
    }
    const mis = findNode(blob, o => Array.isArray(o.misconceptions) && o.misconceptions.length)
    if (mis) misconceptions = misconceptions.concat(mis.misconceptions)
  }

  const tag = readItemTag(system)
  let points = readPoints(scheme, system)
  if (!points.length) points = readPointsBracket(system)
  let levels = readLevels(scheme)
  if (!levels.length) levels = readLevelsProse(system)
  const indicative = readIndicative(scheme, system)
  if (!misconceptions.length) misconceptions = readMisconceptions(system)

  return {
    scheme,
    item,
    stem: readStem(item, system, tag),
    commandWord: String(
      item?.command_word || item?.commandWord || tag.commandWord || scheme?.command_word || scheme?.commandWord ||
      readLabelled(system, ['command word']) || (String(system || '').match(/command word is ([A-Za-z]+)/i) || [])[1] || ''
    ).split(/\s+[—–-]\s+/)[0].trim(),
    tariff: Number(item?.tariff ?? item?.marks ?? scheme?.marks_total ?? scheme?.marksTotal ?? scheme?.tariff ?? tag.tariff ?? 0) || 0,
    points,
    levels,
    indicative,
    misconceptions: misconceptions.map(m => (typeof m === 'string' ? { id: '', text: m } : { id: String(m.id || m.code || ''), text: String(m.text || m.label || m.description || m.name || '') })).filter(m => m.text),
    caseFacts: readList(scheme?.context?.case_facts || scheme?.context?.caseFacts).length
      ? readList(scheme?.context?.case_facts || scheme?.context?.caseFacts)
      : bulletsUnder(system, ['case facts']),
  }
}

/** The bullet list under a heading, as the marking prompt writes case facts. */
function bulletsUnder(system, labels) {
  const block = readSection(system, labels)
  if (!block) return []
  return block.split('\n').map(l => l.replace(/^\s*[-*•]\s*/, '').trim()).filter(t => t.length > 2)
}

const readList = (v) => (Array.isArray(v) ? v.map(x => (typeof x === 'string' ? x : String(x?.text || x?.credit_text || ''))).filter(Boolean) : [])

/** Marking points, either from the scheme object or from scheme-shaped prose. */
function readPoints(scheme, system) {
  const raw = scheme?.marking_points || scheme?.markingPoints || scheme?.points
  const out = []
  if (Array.isArray(raw)) {
    for (const [i, p] of raw.entries()) {
      if (typeof p === 'string') { out.push({ id: 'MP' + (i + 1), text: p, marks: 1, atoms: [], alternatives: [], dependsOn: null }); continue }
      out.push({
        id: String(p.id || p.code || 'MP' + (i + 1)),
        text: String(p.credit_text || p.creditText || p.text || p.description || ''),
        marks: Number(p.marks ?? p.mark ?? 1) || 1,
        atoms: readList(p.conjunctive || p.conjunctive_conditions || p.conjunctiveConditions || p.atoms).filter(() => p.all_required !== false && p.allRequired !== false),
        alternatives: readList(p.alternatives).concat(readList(p.accept)),
        dependsOn: p.depends_on || p.dependsOn || null,
        ao: String(p.ao || ''),
      })
    }
  }
  if (out.length) return out.filter(p => p.text)

  // Prose fallback: "M1 (1 mark): text", "B2 — text", "1. text [2]".
  const lines = String(system || '').split('\n')
  for (const line of lines) {
    const m = line.match(/^\s*[-*•]?\s*((?:[A-Z]{1,3}\d{1,2})|(?:\d{1,2}[.)]))\s*(?:\((\d+)\s*marks?\))?\s*[:–—-]\s*(.+?)\s*(?:\[(\d+)\])?\s*$/)
    if (!m) continue
    const text = m[3].trim()
    // "AO3 — 8 marks" is a grid heading, not a marking point.
    if (/^AO\d/i.test(m[1]) || /^\d+\s*marks?$/i.test(text)) continue
    if (text.length < 6 || text.split(/\s+/).length < 3) continue
    out.push({
      id: m[1].replace(/[.)]$/, ''),
      text,
      marks: Number(m[2] || m[4] || 1) || 1,
      atoms: text.split(/\s+and\s+/i).length > 1 && /\band\b/i.test(text) ? text.split(/\s+and\s+/i).map(s => s.trim()) : [],
      alternatives: [],
      dependsOn: null,
      ao: '',
    })
  }
  return out
}

/**
 * Scheme lines as the marking prompt renders them:
 *   M1 [B AO1, 1 mark] the lone pair attacks the carbonyl carbon
 *     every part required: lone pair drawn AND arrow to the carbon
 *     alternatives (credit once): a // b
 *     depends on M3
 */
function readPointsBracket(system) {
  const lines = String(system || '').split('\n')
  const out = []
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^\s*([A-Z]{1,3}\d{1,2})\s*\[([^\]]*)\]\s*(.+)$/)
    if (!m) continue
    const meta = m[2]
    const point = {
      id: m[1],
      text: m[3].trim(),
      marks: Number((meta.match(/(\d+)\s*marks?/) || [])[1] || 1) || 1,
      ao: (meta.match(/AO\d/i) || [''])[0].toUpperCase(),
      atoms: [],
      alternatives: [],
      dependsOn: null,
    }
    for (let j = i + 1; j < lines.length; j++) {
      if (!/^\s+\S/.test(lines[j])) break
      const atoms = lines[j].match(/every part required:\s*(.+)$/i)
      const alts = lines[j].match(/alternatives[^:]*:\s*(.+)$/i)
      const accept = lines[j].match(/accept:\s*(.+)$/i)
      const depends = lines[j].match(/depends on\s+(\S+)/i)
      if (atoms) point.atoms = atoms[1].split(/\s+AND\s+/).map(t => t.trim()).filter(Boolean)
      if (alts) point.alternatives.push(...alts[1].split('//').map(t => t.trim()).filter(Boolean))
      if (accept) point.alternatives.push(...accept[1].split(';').map(t => t.trim()).filter(Boolean))
      if (depends) point.dependsOn = depends[1].replace(/[.,]$/, '')
      i = j
    }
    out.push(point)
  }
  return out
}

/**
 * A grid as the marking prompt renders it:
 *   AO3 — 8 marks
 *     Level 2 (4–8): Developed analysis · evidence: two counted links
 *       4: one developed chain
 */
function readLevelsProse(system) {
  const groups = []
  let current = null
  for (const line of String(system || '').split('\n')) {
    const head = line.match(/^\s*(AO\d|[A-Z][A-Za-z ]{0,20}?)\s*[—–-]\s*(\d+)\s*marks?\s*$/)
    if (head) {
      current = { ao: head[1].trim(), max: Number(head[2]) || 0, bands: [] }
      groups.push(current)
      continue
    }
    const band = line.match(/^\s*Level\s+(\d+)\s*\((\d+)\s*[–—-]\s*(\d+)\)\s*:\s*(.+)$/i)
    if (band && current) {
      const split = band[4].split(/\s*·\s*evidence:\s*/i)
      current.bands.push({
        level: Number(band[1]) || 0,
        lo: Number(band[2]) || 0,
        hi: Number(band[3]) || 0,
        descriptor: split[0].trim(),
        evidence: (split[1] || '').trim(),
      })
    }
  }
  for (const g of groups) g.bands.sort((a, b) => a.level - b.level)
  return groups.filter(g => g.bands.length)
}

/** Levels grids, normalised to [{ao, max, bands:[{level, lo, hi, descriptor}]}]. */
function readLevels(scheme) {
  const raw = scheme?.levels || scheme?.level_grid || scheme?.grids
  if (!Array.isArray(raw) || !raw.length) return []
  const groups = []
  for (const g of raw) {
    if (!isObj(g)) continue
    const bandsRaw = Array.isArray(g.bands) ? g.bands : Array.isArray(g.levels) ? g.levels : null
    if (bandsRaw) {
      const bands = bandsRaw.map(b => normaliseBand(b)).filter(Boolean).sort((a, b) => a.level - b.level)
      if (bands.length) groups.push({ ao: String(g.ao || g.strand || 'AO'), max: Number(g.max ?? bands[bands.length - 1].hi) || bands[bands.length - 1].hi, bands })
    } else if ('level' in g || 'range' in g || 'descriptor' in g) {
      const b = normaliseBand(g)
      if (b) {
        const bucket = groups.find(x => x.ao === String(g.ao || 'AO')) || (groups.push({ ao: String(g.ao || 'AO'), max: 0, bands: [] }), groups[groups.length - 1])
        bucket.bands.push(b)
      }
    }
  }
  for (const g of groups) {
    g.bands.sort((a, b) => a.level - b.level)
    if (!g.max) g.max = g.bands.length ? g.bands[g.bands.length - 1].hi : 0
  }
  return groups.filter(g => g.bands.length)
}

function normaliseBand(b) {
  if (!isObj(b)) return null
  const range = Array.isArray(b.range) ? b.range : null
  const lo = Number(range ? range[0] : b.low ?? b.min ?? b.marks ?? 0) || 0
  const hi = Number(range ? range[1] : b.high ?? b.max ?? b.marks ?? lo) || lo
  const level = Number(b.level ?? b.band ?? 0) || 0
  const descriptor = String(b.descriptor || b.description || b.text || '')
  if (!descriptor && !range && !('level' in b)) return null
  return { level, lo: Math.min(lo, hi), hi: Math.max(lo, hi), descriptor, evidence: String(b.evidence_rule || b.evidenceRule || '') }
}

function readIndicative(scheme, system) {
  const raw = scheme?.indicative_content || scheme?.indicativeContent || scheme?.indicative
  const out = []
  if (Array.isArray(raw)) {
    for (const [i, c] of raw.entries()) {
      if (typeof c === 'string') out.push({ id: 'IC' + (i + 1), text: c, ao: '' })
      else if (isObj(c)) out.push({ id: String(c.id || 'IC' + (i + 1)), text: String(c.text || c.content || ''), ao: String(c.ao_hint || c.ao || '') })
    }
  }
  if (out.length) return out.filter(c => c.text)
  for (const [i, text] of bulletsUnder(system, ['indicative content', 'indicative points']).entries()) {
    if (text.length > 8) out.push({ id: 'IC' + (i + 1), text, ao: '' })
  }
  return out
}

function readMisconceptions(system) {
  const block = readSection(system, ['misconception', 'misconceptions', 'common errors'])
  if (!block) return []
  return block.split('\n')
    .map(line => line.replace(/^\s*[-*•\d.)]+\s*/, '').trim())
    .filter(t => t.length > 8)
    .map((text, i) => {
      const m = text.match(/^([A-Za-z]{2,}[-_]?\d{1,3})\s*[:–—-]\s*(.+)$/)
      const body = m ? m[2] : text
      const belief = body.match(/students think\s*[""']([^""']+)[""']/i)
      return { id: m ? m[1] : 'MIS' + (i + 1), text: belief ? belief[1] : body }
    })
}

function readStem(item, system, tag) {
  const fromItem = item?.stem || item?.question || item?.text
  if (fromItem) return String(fromItem).trim()
  if (tag.stem) return tag.stem
  return readSection(system, ['question', 'stem', 'the question under study', 'the question', 'item']) || ''
}

/**
 * The tutor prompt carries the question as a tagged block:
 *   <item paper="4" command="Evaluate" tariff="20" kind="levels"> … </item>
 * It is reference data, never instructions — only these fields are read.
 */
function readItemTag(system) {
  const block = String(system || '').match(/<item\b([^>]*)>([\s\S]*?)<\/item>/i)
  if (!block) return {}
  const attrs = {}
  for (const m of block[1].matchAll(/(\w+)\s*=\s*"([^"]*)"/g)) attrs[m[1].toLowerCase()] = m[2]
  const body = block[2].split('\n').map(l => l.trim()).filter(Boolean).filter(l => !/^stimulus\s*:/i.test(l))
  return {
    stem: body.join(' ').trim(),
    commandWord: attrs.command || '',
    tariff: Number(attrs.tariff) || 0,
    kind: attrs.kind || '',
  }
}

/** The text after a "Label:" marker on the same line. */
function readLabelled(system, labels) {
  for (const label of labels) {
    const re = new RegExp('^\\s*' + label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*:\\s*(.+)$', 'im')
    const m = String(system || '').match(re)
    if (m) return m[1].trim()
  }
  return ''
}

/** The block under a "Label…:" heading, to the next blank line or heading. */
function readSection(system, labels) {
  const lines = String(system || '').split('\n')
  for (const label of labels) {
    const head = new RegExp('^[#>*\\s-]*' + label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i')
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (!head.test(line)) continue
      // "Label: value" on one line, where the value is not the start of a list.
      const inline = line.match(/^[^:]{0,120}:\s*(\S.*)$/)
      if (inline && !/^[-•]/.test(inline[1])) return inline[1].trim()
      if (!/:\s*$/.test(line.trim())) continue
      const block = []
      for (let j = i + 1; j < lines.length; j++) {
        if (!lines[j].trim()) { if (block.length) break; continue }
        if (/^[A-Z][A-Za-z ]{2,30}([ —–-][^\n]*)?:\s*$/.test(lines[j].trim())) break
        block.push(lines[j])
      }
      if (block.length) return block.join('\n').trim()
    }
  }
  return ''
}

/** The student's own text: the last user message, minus any label line. */
function readAnswer(req) {
  const msgs = Array.isArray(req.messages) ? req.messages : []
  for (let i = msgs.length - 1; i >= 0; i--) {
    if (msgs[i]?.role !== 'user') continue
    let body = String(msgs[i].content || '')
    const tagged = body.match(/<answer>([\s\S]*?)<\/answer>/i)
    if (tagged) return tagged[1].trim()
    body = body.replace(/^\s*(?:student(?:'s)?\s+)?(?:answer|response|attempt)[^\n:]{0,60}:\s*/i, '')
    return body.trim()
  }
  return ''
}

/** The rung the caller asked for, 1..5, defaulting to a conceptual pointer. */
function readRung(req) {
  const hay = String(req.system || '') + '\n' + (Array.isArray(req.messages) ? req.messages.map(m => m.content).join('\n') : '')
  const numeric = hay.match(/your rung this turn\s*[:=-]?\s*(\d)/i)
    || hay.match(/["']?rung["']?\s*[:=]\s*(\d)/i)
    || hay.match(/\brung\s+(\d)\b/i)
  if (numeric) {
    const n = Number(numeric[1])
    if (n >= 1 && n <= 5) return n
  }
  const named = [
    [/full\s+solution|worked\s+solution|whole\s+answer|model\s+answer/i, 5],
    [/worked\s+step|partial\s+work|with\s+a\s+blank/i, 4],
    [/procedural|next\s+step|hint/i, 3],
    [/conceptual|principle|narrow/i, 2],
    [/metacognitive|orient/i, 1],
  ]
  for (const [re, n] of named) if (re.test(hay)) return n
  return 2
}

/* ------------------------------------------------------------------ *
 * The marking engine
 * ------------------------------------------------------------------ */

const LINK_WORDS = ['because', 'so ', 'therefore', 'which means', 'this means', 'leads to', 'leading to', 'resulting in', 'as a result', 'causes', 'causing', 'due to', 'thus', 'hence', 'consequently', 'in turn']
const JUDGEMENT_WORDS = ['overall', 'in conclusion', 'to conclude', 'i recommend', 'i would recommend', 'the best', 'most important', 'on balance', 'the firm should', 'should choose', 'my judgement', 'the strongest']
const WEIGH_WORDS = ['however', 'although', 'whereas', 'on the other hand', 'but ', 'nevertheless', 'while ', 'in contrast', 'more important than', 'outweigh']
const CONDITION_WORDS = ['depends on', 'provided that', 'so long as', 'unless', 'if the', 'only if', 'in the short run', 'in the long run', 'would change']

function countAny(hay, words) {
  let n = 0
  for (const w of words) {
    let from = 0
    for (;;) {
      const at = hay.indexOf(w, from)
      if (at < 0) break
      n++
      from = at + w.length
    }
  }
  return n
}

/** Everything the engines need about the student's text, computed once. */
function analyse(answer, material) {
  const norm = normalise(answer)
  const set = termSet(answer)
  const sents = sentences(answer)
  const words = norm ? norm.split(' ').length : 0
  // Application is credited from the case's own facts, never from echoing the
  // question: a fact counts only when most of it, and at least two of its
  // content terms, are actually in the student's text.
  const caseHits = material.caseFacts.filter(f => {
    const want = terms(f)
    const hit = want.filter(t => set.has(t)).length
    return want.length > 0 && hit >= Math.min(2, want.length) && hit / want.length >= 0.7
  }).length
  return {
    norm,
    set,
    sents,
    words,
    links: Math.min(6, countAny(norm, LINK_WORDS)),
    judgement: countAny(norm, JUDGEMENT_WORDS) > 0,
    weighing: Math.min(4, countAny(norm, WEIGH_WORDS)),
    conditions: Math.min(3, countAny(norm, CONDITION_WORDS)),
    context: caseHits,
    numbers: (answer.match(/\d[\d,.]*/g) || []).length,
  }
}

/** Best verbatim sentence for a phrase, with offsets. */
function bestQuote(phrase, view) {
  let best = null
  for (const s of view.sents) {
    const score = coverage(phrase, termSet(s.text), normalise(s.text))
    if (!best || score > best.score) best = { score, quote: s.text, start: s.start, end: s.end }
  }
  return best && best.score > 0 ? best : null
}

/**
 * Points marking. Every atom of a conjunctive point must be evidenced; a point
 * with alternatives is credited on its best branch; a dependent point cannot be
 * credited unless the point it depends on is.
 */
function markPoints(material, view) {
  const w = weighting(material.points.map(p => p.text))
  const credited = []
  const results = []
  for (const p of material.points) {
    const branches = [p.text, ...p.alternatives].filter(Boolean)
    let score = 0
    for (const b of branches) score = Math.max(score, coverage(b, view.set, view.norm, w))

    let failedAtom = null
    if (p.atoms.length > 1) {
      const atomScores = p.atoms.map(a => ({ atom: a, score: coverage(a, view.set, view.norm) }))
      const worst = atomScores.reduce((a, b) => (a.score <= b.score ? a : b))
      score = Math.min(score, worst.score + 0.15)
      if (worst.score < 0.5) failedAtom = worst.atom
    }

    const blockedBy = p.dependsOn && !credited.includes(p.dependsOn) ? p.dependsOn : null
    const met = score >= CREDIT_AT && !failedAtom && !blockedBy
    const partial = !met && score >= 0.4
    if (met) credited.push(p.id)

    const quote = met || partial ? bestQuote(branches[0], view) : null
    const usable = quote && quote.score >= 0.25
    results.push({
      id: p.id,
      text: p.text,
      ao: p.ao,
      evidence_kind: evidenceKind(String(p.ao || '')),
      max: p.marks,
      met,
      partial,
      method_correct: met || partial,
      awarded: met ? p.marks : 0,
      score: Math.round(score * 100) / 100,
      class: met ? 'credited' : partial ? 'partial' : 'uncredited',
      reason_code: met ? null : reasonCode({ failedAtom, blockedBy, view, partial }),
      links_counted: view.links,
      atoms: p.atoms.map(a => ({ text: a, met: coverage(a, view.set, view.norm) >= 0.5 })),
      quote: usable ? quote.quote : null,
      start: usable ? quote.start : null,
      end: usable ? quote.end : null,
      reason: met
        ? `Credited: your answer carries "${keyPhrase(p.text)}".`
        : blockedBy
          ? `Not credited: this point depends on ${blockedBy}, and ${blockedBy} is not evidenced.`
          : failedAtom
            ? `Not credited: "${trimPhrase(failedAtom)}" is missing, and this point needs every part of it.`
            : partial
              ? `Part-way: you touch "${keyPhrase(p.text)}" but not in the terms the scheme credits.`
              : `Not credited: nothing in your answer states "${keyPhrase(p.text)}".`,
    })
  }
  return results
}

/**
 * The named diagnosis behind a refusal to credit. These are the codes the mark
 * renderer knows; anything it does not recognise it drops, so an honest null is
 * better than a guess.
 */
function reasonCode({ failedAtom, blockedBy, view, partial }) {
  if (failedAtom) return 'ATOM_NOT_MET'
  if (blockedBy) return 'NO_WORKING'
  if (partial && view.context === 0) return 'GENERIC_NOT_CONTEXT'
  if (view.links === 0) return 'ASSERTION_NO_LINK'
  if (view.links === 1) return 'SINGLE_LINK'
  return 'OUT_OF_SCOPE'
}

/** Levels marking: a driver metric per AO, mapped onto the grid's own bands. */
function markLevels(material, view) {
  const w = weighting(material.indicative.map(c => c.text))
  const threads = material.indicative.map(c => ({ ...c, score: coverage(c.text, view.set, view.norm, w) }))
  const touched = threads.filter(t => t.score >= 0.5)
  const perAo = []

  const grids = material.levels.length
    ? material.levels
    : material.tariff
      ? [{ ao: 'AO', max: material.tariff, bands: syntheticBands(material.tariff) }]
      : []

  for (const grid of grids) {
    const ao = grid.ao.toUpperCase()
    let metric
    if (ao.includes('AO1')) metric = touched.length + (view.words > 40 ? 1 : 0)
    else if (ao.includes('AO2')) metric = view.context
    else if (ao.includes('AO3')) metric = view.links
    else if (ao.includes('AO4')) metric = (view.judgement ? 1 : 0) + Math.min(2, view.weighing) + view.conditions
    else metric = touched.length + view.links + (view.judgement ? 1 : 0) + view.context

    const bands = grid.bands
    const need = bands.map((_, i) => (i === 0 ? 0 : i === 1 ? 1 : i === 2 ? 2 : 2 + (i - 2) * 2))
    let idx = 0
    for (let i = 0; i < bands.length; i++) if (metric >= need[i]) idx = i
    const band = bands[idx]
    const span = (need[idx + 1] ?? need[idx] + 2) - need[idx]
    const within = span > 0 ? Math.min(1, Math.max(0, (metric - need[idx]) / span)) : 1
    const marks = Math.max(band.lo, Math.min(band.hi, band.lo + Math.round(within * (band.hi - band.lo))))

    const above = bands[idx + 1] || null
    perAo.push({
      ao: grid.ao,
      max: grid.max,
      level: band.level,
      nextBand: above ? { level: above.level, descriptor: above.descriptor, evidence: above.evidence } : null,
      marks,
      metric,
      descriptor: band.descriptor,
      confidence: Math.round((0.6 + Math.min(0.3, metric * 0.05)) * 100) / 100,
      reason: levelReason(ao, view, touched.length, band),
      within_band_reason: `${marks} of ${band.hi}: ${trimPhrase(band.evidence || band.descriptor, 80)}.`,
      quotes: quotesFor(ao, view, touched),
      spans: quotesFor(ao, view, touched).map(q => ({
        quote: q.quote,
        start: q.start,
        end: q.end,
        char_start: q.start,
        char_end: q.end,
        class: 'credited',
        evidence_kind: evidenceKind(ao),
        links_counted: ao.includes('AO3') ? view.links : 0,
        reason: `Counted for ${grid.ao}: ${trimPhrase(band.descriptor, 50)}.`,
        reason_code: null,
      })),
      missing: missingFor(ao, view, threads),
      reason_code: aoReasonCode(ao, view),
    })
  }

  return { perAo, threads, touched }
}

function syntheticBands(total) {
  const cuts = [0, Math.max(1, Math.round(total * 0.35)), Math.max(2, Math.round(total * 0.65)), total]
  return [
    { level: 0, lo: 0, hi: 0, descriptor: 'No creditable response', evidence: '' },
    { level: 1, lo: 1, hi: cuts[1], descriptor: 'Limited: one idea, not developed', evidence: '' },
    { level: 2, lo: cuts[1] + 1, hi: cuts[2], descriptor: 'Developed: ideas linked to the question', evidence: '' },
    { level: 3, lo: Math.min(total, cuts[2] + 1), hi: total, descriptor: 'Effective: developed and weighed', evidence: '' },
  ].filter(b => b.lo <= b.hi)
}

function levelReason(ao, view, touchedCount, band) {
  if (ao.includes('AO1')) return `Level ${band.level}: ${touchedCount === 0 ? 'no scheme idea is stated accurately' : touchedCount + ' scheme idea' + (touchedCount === 1 ? '' : 's') + ' stated accurately'}.`
  if (ao.includes('AO2')) return `Level ${band.level}: ${view.context === 0 ? 'nothing here is true only of this case — the answer would read the same about any firm' : view.context + ' point' + (view.context === 1 ? '' : 's') + ' tied to this case'}.`
  if (ao.includes('AO3')) return `Level ${band.level}: ${view.links === 0 ? 'assertions with no causal step' : view.links + ' causal link' + (view.links === 1 ? '' : 's') + ' counted'}.`
  if (ao.includes('AO4')) return `Level ${band.level}: ${view.judgement ? 'a judgement is committed to' : 'no judgement is committed to'}, ${view.weighing ? 'with weighing of both sides' : 'with no weighing'}${view.conditions ? ', and a condition is named' : ''}.`
  return `Level ${band.level}: ${band.descriptor || 'best fit against the grid'}.`
}

/** What kind of evidence a span is, for the objective it was counted under. */
function evidenceKind(ao) {
  if (ao.includes('AO1')) return 'concept'
  if (ao.includes('AO2')) return 'case fact'
  if (ao.includes('AO3')) return 'causal chain'
  if (ao.includes('AO4')) return 'judgement'
  return 'scheme point'
}

/** Why this AO sits where it does, in the renderer's own vocabulary. */
function aoReasonCode(ao, view) {
  if (ao.includes('AO2') && view.context === 0) return 'GENERIC_NOT_CONTEXT'
  if (ao.includes('AO3')) return view.links === 0 ? 'ASSERTION_NO_LINK' : view.links === 1 ? 'SINGLE_LINK' : null
  if (ao.includes('AO4') && !view.judgement) return 'ASSERTION_NO_LINK'
  return null
}

function quotesFor(ao, view, touched) {
  const out = []
  for (const t of touched.slice(0, 3)) {
    const q = bestQuote(t.text, view)
    if (q && q.score >= 0.4) out.push({ quote: q.quote, start: q.start, end: q.end, ref: t.id })
  }
  if (!out.length && view.sents.length) {
    const s = view.sents[0]
    out.push({ quote: s.text, start: s.start, end: s.end, ref: ao })
  }
  return out
}

function missingFor(ao, view, threads) {
  const missed = threads.filter(t => t.score < 0.5).slice(0, 3).map(t => t.text)
  if (missed.length) return missed
  if (ao.includes('AO4') && !view.judgement) return ['no judgement: the answer stops before deciding']
  if (ao.includes('AO3') && view.links < 2) return ['no second link: the chain stops at the first effect']
  if (ao.includes('AO2') && view.context === 0) return ['no case detail: nothing here is specific to this business']
  return []
}

/** A clause short enough to quote inside a sentence, cut on a word boundary. */
function trimPhrase(text, limit = 70) {
  const t = String(text || '').replace(/\s+/g, ' ').trim().replace(/[.,;:]+$/, '')
  if (t.length <= limit) return t
  return t.slice(0, t.lastIndexOf(' ', limit) > 20 ? t.lastIndexOf(' ', limit) : limit).trim() + '…'
}

/** A short, quotable fragment of a marking point, for feedback prose. */
const keyPhrase = (text) => trimPhrase(text, 52)

/** The full marking judgement: points, levels, totals and prose. */
function judge(req, material) {
  const answer = readAnswer(req)
  const view = analyse(answer, material)
  const points = markPoints(material, view)
  const { perAo, touched } = markLevels(material, view)

  const usePoints = points.length > 0
  const total = usePoints
    ? points.reduce((n, p) => n + p.awarded, 0)
    : perAo.reduce((n, a) => n + a.marks, 0)
  const max = usePoints
    ? points.reduce((n, p) => n + p.max, 0) || material.tariff
    : perAo.reduce((n, a) => n + a.max, 0) || material.tariff

  const missed = usePoints ? points.filter(p => !p.met) : []
  const gained = usePoints ? points.filter(p => p.met) : []
  const tolerance = max <= 8 ? 1 : max <= 29 ? 2 : 3

  const strengths = usePoints
    ? gained.length
      ? `You have ${gained.length} of ${points.length} marking points: ${gained.map(p => p.id).join(', ')}.`
      : 'None of the marking points is evidenced yet.'
    : perAo.length
      ? perAo.map(a => `${a.ao} level ${a.level} (${a.marks}/${a.max})`).join('; ') + '.'
      : 'No grid was supplied, so this is a description rather than a mark.'

  const nextStep = usePoints
    ? missed.length
      ? `Next: write the line that earns ${missed[0].id} — ${keyPhrase(missed[0].text)}.`
      : 'Next: take the near-transfer version of this question unaided.'
    : nextStepForLevels(perAo, view)

  const gapLine = usePoints
    ? missed.length ? `The gap is ${keyPhrase(missed[0].text)}.` : 'Nothing in the scheme is left unevidenced.'
    : perAo.length && perAo[0].missing.length ? `The gap is ${keyPhrase(perAo[0].missing[0])}.` : ''
  const summary = [strengths, gapLine].filter(Boolean).join(' ')

  return {
    answer, view, material, points, perAo, touched,
    usePoints, total, max, tolerance,
    band: { low: Math.max(0, total - tolerance), modal: total, high: Math.min(max, total + tolerance) },
    summary, strengths, nextStep,
    missing: usePoints ? missed.map(p => p.text) : perAo.flatMap(a => a.missing),
    confidence: Math.round((usePoints ? 0.72 + Math.min(0.2, gained.length * 0.04) : 0.68 + Math.min(0.2, view.links * 0.04)) * 100) / 100,
  }
}

function nextStepForLevels(perAo, view) {
  const weakest = [...perAo].sort((a, b) => (a.marks / (a.max || 1)) - (b.marks / (b.max || 1)))[0]
  if (!weakest) return 'Next: add one linked chain — cause, mechanism, effect on this case.'
  const ao = weakest.ao.toUpperCase()
  const target = weakest.nextBand
    ? ` That is ${weakest.ao} level ${weakest.nextBand.level}: ${trimPhrase(weakest.nextBand.evidence || weakest.nextBand.descriptor, 60)}.`
    : ''
  if (ao.includes('AO4') && !view.judgement) return `Next: end with a decision and the condition it rests on — one sentence, no new argument.${target}`
  if (ao.includes('AO3')) return `Next: extend your strongest point by one step — say what that effect then causes.${target}`
  if (ao.includes('AO2')) return `Next: rewrite one sentence so it is false of any other firm — use a fact from the case.${target}`
  if (ao.includes('AO1')) return `Next: state one relevant concept accurately before you use it.${target}`
  return `Next: work the band above the one you are in.${target}`
}

/* ------------------------------------------------------------------ *
 * Tutor Turns
 * ------------------------------------------------------------------ */

const COMMAND_ASKS = {
  define: 'the class the term belongs to and what separates it from its neighbours',
  describe: 'features stated, no reasons',
  explain: 'a reason chained to an effect',
  analyse: 'a chain: cause, mechanism, effect',
  evaluate: 'a judgement, weighed, and the condition it rests on',
  discuss: 'both sides, then a decision',
  calculate: 'the working, then the answer with its unit',
  justify: 'the choice and the evidence that beats the alternative',
  assess: 'the weight of each side before the verdict',
  suggest: 'a workable option and why it fits this case',
  state: 'the fact alone, no development',
  compare: 'a stated similarity or difference, both sides named',
}

function tutorTurn(req, material, seedRng) {
  const rung = readRung(req)
  const answer = readAnswer(req)
  const view = analyse(answer, material)
  const points = material.points
  const marked = points.length ? markPoints(material, view) : []
  const missed = marked.filter(p => !p.met)
  const got = marked.filter(p => p.met)
  const command = material.commandWord.toLowerCase()
  const ask = COMMAND_ASKS[command] || ''
  const target = missed[0] || points[0] || null
  const thread = material.indicative.find(c => coverage(c.text, view.set, view.norm) < 0.5) || material.indicative[0] || null
  const mis = material.misconceptions.find(m => coverage(m.text, view.set, view.norm) >= 0.45) || null

  const parts = []
  let handback = 'Write the next line.'

  // (1) Task-level acknowledgement, only when something is actually right.
  if (got.length) parts.push(`${got[0].id} is there: ${keyPhrase(got[0].text)}.`)
  else if (view.links && rung >= 2 && !mis) parts.push('You have a first causal step.')

  // (2) One diagnosis, named where the Pack names it.
  if (mis) parts.push(`The wrong turn is ${mis.id ? mis.id + ': ' : ''}${trimPhrase(mis.text)}.`)

  // (3) Exactly one move, sized to the rung.
  if (rung <= 1) {
    const a = target ? headNoun(target.text) : thread ? headNoun(thread.text) : 'the first idea in the question'
    const b = points[1] ? headNoun(points[1].text) : material.indicative[1] ? headNoun(material.indicative[1].text) : 'something else in the syllabus point'
    if (command) parts.push(`Start at the command word: ${material.commandWord} wants ${ask || 'exactly what it names, nothing more'}.`)
    parts.push(`Which one is this question testing — ${a} or ${b}?`)
    handback = 'Name the concept, then start your first line.'
  } else if (rung === 2) {
    if (target) parts.push(`Marks here come from ${keyPhrase(target.text)} — the principle, not the arithmetic.`)
    else if (thread) parts.push(`The scheme rewards ${keyPhrase(thread.text)}.`)
    else parts.push('Marks come from the principle the command word names, stated in exam terms.')
    parts.push(`Which part of that is missing from what you wrote?`)
    handback = 'Add the missing part in one sentence.'
  } else if (rung === 3) {
    parts.push(`Next step: ${imperative(target ? target.text : thread ? thread.text : 'state the principle, then apply it to this case')}.`)
    handback = 'Write that line.'
  } else if (rung === 4) {
    const worked = workedStep(target, thread, material, view)
    parts.push(worked.text)
    handback = worked.handback
  } else {
    const full = fullSolution(material, marked, view)
    parts.push(full.text)
    handback = full.handback
  }

  parts.push(handback)
  const body = oneQuestionOnly(cap(parts.filter(Boolean).join(' '), rung >= 5 ? 150 : 120))
  return { text: body, rung, handback, mis, got, missed, view }
}

const BREAK_WORDS = /^(do|does|did|is|are|was|were|will|can|must|should|may|because|when|as|so|that|which|and|or|then|therefore|falls?|rises?|increases?|decreases?|changes?|means?|gives?|shows?|leads?|causes?|equals?)$/i

/** The head noun phrase of a marking point — what to name it by. */
function headNoun(text) {
  const words = String(text || '').replace(/\s+/g, ' ').trim().replace(/[.,;:]$/, '').split(' ')
  const start = /^(the|a|an)$/i.test(words[0] || '') ? 1 : 0
  const out = []
  for (let i = start; i < words.length && out.length < 5; i++) {
    if (out.length >= 1 && BREAK_WORDS.test(words[i])) break
    out.push(words[i])
  }
  return out.join(' ') || 'the idea in the question'
}

/** Turn a scheme statement into something the student can be told to do. */
function imperative(text) {
  const t = String(text || '').replace(/\s+/g, ' ').trim()
    .replace(/^(?:candidate|student)s?\s+(?:should|must|may)\s+/i, '')
    .replace(/^(?:the\s+)?(?:answer|response)\s+(?:states?|shows?|gives?)\s+/i, 'state ')
  if (!t) return 'the line the scheme credits'
  const verbs = /^(state|write|show|draw|name|explain|calculate|link|apply|compare|define|identify|give|set)\b/i
  if (verbs.test(t)) return trimPhrase(t.charAt(0).toLowerCase() + t.slice(1))
  return `the line that states ${keyPhrase(t)}`
}

/** Rung 4: a worked step with the last clause blanked. */
function workedStep(target, thread, material, view) {
  const source = target ? target.text : thread ? thread.text : ''
  if (!source) {
    return {
      text: 'Take the first half from the scheme: name the concept, then say what it does here. The second half is yours: ___ .',
      handback: 'Fill the blank in one sentence.',
    }
  }
  const words = source.replace(/\s+/g, ' ').trim().split(' ')
  const keep = Math.max(3, Math.ceil(words.length * 0.6))
  const given = words.slice(0, keep).join(' ')
  const numeric = view.numbers > 0 && /calculat|=|\d/.test(source + material.stem)
  return {
    text: numeric
      ? `Set it out like this: ${given} = ___ . The scheme gives the method mark for the line above and the accuracy mark for what goes in the blank.`
      : `Half of it, from the scheme: "${given} ___". The blank is the part that earns the mark.`,
    handback: 'Complete the blank, then read it back against the command word.',
  }
}

/** Rung 5: the full answer, then the near-transfer instruction. */
function fullSolution(material, marked, view) {
  const lines = (material.points.length ? material.points : material.indicative).slice(0, 4)
    .map((p, i) => `${i + 1}. ${trimPhrase(p.text)}.`)
  const body = lines.length
    ? `Full answer: ${lines.join(' ')}`
    : `Full answer: state the principle the command word names, apply it to the case in one sentence, then say what follows from it${view.judgement ? ' and hold your judgement' : ' and commit to a judgement'}.`
  const gapped = marked.filter(p => !p.met).length
  return {
    text: `${body} You had ${gapped ? gapped + ' of these missing' : 'the shape of this'}; the next item changes the numbers and you take it unaided.`,
    handback: 'Start the near-transfer item now.',
  }
}

/** Keep exactly one question mark addressed to the student (04-TURN-004). */
function oneQuestionOnly(text) {
  const first = text.indexOf('?')
  if (first < 0) return text
  return text.slice(0, first + 1) + text.slice(first + 1).replace(/\?/g, '.')
}

/** Trim to a word budget on a sentence boundary (04-TURN-001). */
function cap(text, limit) {
  const parts = text.split(/(?<=[.?])\s+/)
  const out = []
  let count = 0
  for (const p of parts) {
    const n = p.split(/\s+/).filter(Boolean).length
    if (count + n > limit && out.length) break
    out.push(p)
    count += n
  }
  return out.join(' ').trim()
}

/* ------------------------------------------------------------------ *
 * Anything else: brief, honest, non-committal
 * ------------------------------------------------------------------ */

function plainAnswer(req, material, r) {
  const question = lastUserText(req)
  const asked = trimPhrase(sentences(question)[0]?.text || question, 90)
  const asksForMark = /\b(mark|grade|score|boundary|threshold|percentage|a\*|predicted)\b/i.test(question)
  const asksForQuote = /\b(quote|cite|source|page|reference|says)\b/i.test(question)
  const lines = []
  if (asked) lines.push(`You asked: "${asked}".`)
  if (asksForMark) {
    lines.push('I will not put a number or a grade on that. Without the scheme for that paper and this year\'s thresholds it would be a guess that reads like a fact.')
  } else if (asksForQuote) {
    lines.push('No source carrying that is loaded here, so I will not quote one.')
  } else {
    lines.push('I can work from the question in front of you, your own writing and the Pack — nothing else is loaded here, and I will not fill the gap by inventing one.')
  }
  lines.push(pick([
    'Paste the question and your attempt and I will mark it against the scheme.',
    'Give me the question and I will start you at the rung that fits what you already know.',
    'Name the syllabus point and I will pull a past question for it.',
  ], r))
  return lines.join(' ')
}

function lastUserText(req) {
  const msgs = Array.isArray(req.messages) ? req.messages : []
  for (let i = msgs.length - 1; i >= 0; i--) if (msgs[i]?.role === 'user') return String(msgs[i].content || '')
  return ''
}

/* ------------------------------------------------------------------ *
 * Schema-driven output
 * ------------------------------------------------------------------ */

const key = (k) => String(k || '').toLowerCase().replace(/[^a-z0-9]/g, '')

const NUMBER_KEYS = [
  ['total', ['total', 'totalmarks', 'marksawarded', 'awarded', 'score', 'mark', 'marks', 'result']],
  ['max', ['max', 'maxmarks', 'outof', 'tariff', 'available', 'maximum', 'marksavailable', 'marksmax']],
  ['level', ['level', 'band', 'levelnumber', 'bandnumber']],
  ['confidence', ['confidence', 'certainty', 'conf']],
  ['low', ['low', 'bandlow', 'min', 'lower', 'minimum']],
  ['high', ['high', 'bandhigh', 'upper', 'maximumband']],
  ['tolerance', ['tolerance', 'spread', 'width']],
  ['rung', ['rung', 'ladderrung', 'step']],
  ['charstart', ['charstart', 'start', 'startindex', 'from', 'offset']],
  ['charend', ['charend', 'end', 'endindex', 'to']],
]

const STRING_KEYS = [
  ['id', ['id', 'pointid', 'markingpointid', 'code', 'ref', 'reference', 'itemid', 'markid']],
  ['ao', ['ao', 'objective', 'assessmentobjective', 'strand']],
  ['quote', ['quote', 'span', 'evidence', 'excerpt', 'citedtext', 'text_span']],
  ['reason', ['reason', 'rationale', 'why', 'justification', 'comment', 'note', 'explanation', 'descriptorreason', 'withinbandreason']],
  ['feedback', ['feedback', 'summary', 'advice', 'overall', 'headline', 'message', 'body', 'response', 'answer', 'turn', 'prose', 'content', 'text']],
  ['next', ['next', 'nextstep', 'action', 'handback', 'todo', 'improvement', 'improve', 'target']],
  ['descriptor', ['descriptor', 'description', 'banddescriptor', 'leveldescriptor']],
  ['front', ['front', 'question', 'prompt', 'cue']],
  ['back', ['back', 'solution', 'value']],
  ['title', ['title', 'name', 'label', 'heading']],
  ['point', ['point', 'markingpoint', 'credittext', 'statement', 'missing', 'gap']],
  ['status', ['status', 'state', 'calibration', 'calibrationstatus', 'verdict', 'band_label']],
]

function resolveKey(table, k) {
  const norm = key(k)
  for (const [canon, aliases] of table) if (aliases.includes(norm)) return canon
  for (const [canon, aliases] of table) if (aliases.some(a => norm.endsWith(a) || norm.startsWith(a))) return canon
  return null
}

const LIST_KEYS = [
  ['points', ['points', 'perpoint', 'perpoints', 'markingpoints', 'pointmarks', 'criteria', 'checks']],
  ['atoms', ['atoms', 'conditions', 'conjunctiveconditions', 'parts']],
  ['perAo', ['perao', 'aos', 'objectives', 'levels', 'aomarks', 'bands', 'grid']],
  ['spans', ['spans', 'creditedspans', 'quotes', 'evidence', 'citations']],
  ['missing', ['missing', 'missingpoints', 'gaps', 'notcredited', 'uncredited', 'improvements', 'nextsteps', 'advice']],
  ['cards', ['cards', 'flashcards']],
  ['items', ['items', 'questions', 'followups']],
  ['misconceptions', ['misconceptions', 'errors', 'diagnoses']],
]

/**
 * Build a value for `schema`, drawing on the computed judgement/turn context.
 * Unknown fields still get a type-correct, honest value — never a lorem string.
 */
function synth(schema, name, ctx, r, depth = 0) {
  if (!isObj(schema)) return null
  if (Array.isArray(schema.enum) && schema.enum.length) return chooseEnum(schema.enum, name, ctx, r)
  if (Array.isArray(schema.oneOf) && schema.oneOf.length) return synth(schema.oneOf[0], name, ctx, r, depth)
  if (Array.isArray(schema.anyOf) && schema.anyOf.length) return synth(schema.anyOf[0], name, ctx, r, depth)
  if ('const' in schema) return schema.const

  const type = Array.isArray(schema.type) ? schema.type[0] : schema.type
  if (type === 'object' || (!type && schema.properties)) {
    const out = {}
    const props = schema.properties || {}
    const required = Array.isArray(schema.required) ? schema.required : []
    const el = ctx.element && typeof ctx.element === 'object' ? ctx.element : null
    // Inside an "advice" or "next step" object, prose means the next step.
    const scoped = /^(advice|next|nextstep|improvement|action|handback)$/.test(key(name))
      ? { ...ctx, strings: { ...ctx.strings, feedback: ctx.strings.next || ctx.strings.feedback } }
      : ctx
    for (const [k, sub] of Object.entries(props)) {
      // The engine decided this field has no value. An optional field is then
      // left out rather than filled with a plausible-looking placeholder.
      const owned = el ? (k in el ? el[k] : key(k) in el ? el[key(k)] : undefined) : undefined
      if (owned === null && !required.includes(k)) continue
      out[k] = synth(sub, k, scoped, r, depth + 1)
    }
    if (!Object.keys(props).length && ctx.element) return { ...ctx.element }
    return out
  }
  if (type === 'array' || schema.items) {
    const items = schema.items || { type: 'string' }
    const list = listFor(name, ctx)
    const min = Number(schema.minItems || 0)
    if (list && list.length) {
      const capped = schema.maxItems ? list.slice(0, Number(schema.maxItems)) : list
      return capped.map(el => synth(items, singular(name), { ...ctx, element: el }, r, depth + 1))
    }
    const n = Math.max(min, depth > 2 ? 0 : 1)
    return Array.from({ length: n }, () => synth(items, singular(name), ctx, r, depth + 1))
  }
  if (type === 'boolean') return boolFor(name, ctx)
  if (type === 'integer' || type === 'number') {
    const v = numberFor(name, ctx, type === 'integer')
    const lo = schema.minimum ?? schema.exclusiveMinimum
    const hi = schema.maximum ?? schema.exclusiveMaximum
    let out = v
    if (typeof lo === 'number') out = Math.max(lo, out)
    if (typeof hi === 'number') out = Math.min(hi, out)
    return type === 'integer' ? Math.round(out) : out
  }
  if (type === 'null') return null
  return tidy(stringFor(name, ctx, r))
}

const singular = (name) => String(name || '').replace(/ies$/, 'y').replace(/s$/, '')

/** No doubled stops after an elision, no stray whitespace. */
const tidy = (text) => String(text || '').replace(/…\s*\./g, '…').replace(/[ \t]+/g, ' ').replace(/ ([.,;:])/g, '$1').trim()

function listFor(name, ctx) {
  // A list the current element owns beats the document-wide one: an AO's spans
  // are its own, not every span on the script.
  const el = ctx.element
  if (el && typeof el === 'object') {
    const own = el[name] ?? el[key(name)]
    if (Array.isArray(own)) return own
  }
  const canon = resolveKey(LIST_KEYS, name)
  if (canon && ctx.lists[canon]) return ctx.lists[canon]
  return null
}

function chooseEnum(values, name, ctx, r) {
  const asString = values.map(v => String(v).toLowerCase())
  const el = ctx.element && typeof ctx.element === 'object' ? ctx.element : null

  // The engine already decided this field — use its answer when the enum has it.
  const owned = el ? (el[name] ?? el[key(name)]) : undefined
  if (owned !== undefined && owned !== null) {
    const at = asString.indexOf(String(owned).toLowerCase())
    if (at >= 0) return values[at]
  }
  const canon = resolveKey(STRING_KEYS, name)
  const wanted = canon === 'status' ? String(ctx.strings.status || '') : canon === 'ao' ? String(el?.ao || ctx.strings.ao || '') : ''
  if (wanted) {
    const at = asString.indexOf(wanted.toLowerCase())
    if (at >= 0) return values[at]
  }
  if (el) {
    for (const [i, v] of asString.entries()) {
      if (el.met === true && /credit|met|award|yes|pass|true/.test(v) && !/^(un|not|no)/.test(v)) return values[i]
      if (el.met === false && (/^(un|not|no)/.test(v) || /miss|fail|absent|reject/.test(v))) return values[i]
    }
  }
  if (typeof values[0] === 'number') return numberFor(name, ctx, true)
  return pick(values, r)
}

function boolFor(name, ctx) {
  const norm = key(name)
  const el = ctx.element || {}
  if (typeof el === 'object') {
    const own = el[name] ?? el[key(name)]
    if (typeof own === 'boolean') return own
  }
  if (/^(met|credited|awarded|correct|pass|passed|ok|valid|present)$/.test(norm)) return el.met ?? ctx.booleans.met ?? false
  if (/verified|checked/.test(norm)) return true
  if (/degraded|provisional|mock|fallback|estimate/.test(norm)) return true
  if (/partial/.test(norm)) return el.partial ?? false
  if (/leak|praise|error|invented|fabricat/.test(norm)) return false
  if (/gate|shown|show|visible|display/.test(norm)) return true
  return false
}

function numberFor(name, ctx, integer) {
  const el = ctx.element || {}
  if (typeof el === 'object') {
    const own = el[name] ?? el[key(name)]
    if (typeof own === 'number' && Number.isFinite(own)) return own
  }
  const canon = resolveKey(NUMBER_KEYS, name)
  const n = ctx.numbers
  switch (canon) {
    case 'total': return el.awarded ?? el.marks ?? n.total ?? 0
    case 'max': return el.max ?? n.max ?? 0
    case 'level': return el.level ?? n.level ?? 0
    case 'confidence': return el.confidence ?? n.confidence ?? 0.7
    case 'low': return n.low ?? Math.max(0, (n.total ?? 0) - (n.tolerance ?? 1))
    case 'high': return n.high ?? (n.total ?? 0) + (n.tolerance ?? 1)
    case 'tolerance': return n.tolerance ?? 1
    case 'rung': return n.rung ?? 2
    case 'charstart': return el.start ?? 0
    case 'charend': return el.end ?? 0
    default: break
  }
  if (typeof el.marks === 'number') return el.marks
  return integer ? 0 : 0
}

function stringFor(name, ctx, r) {
  const found = stringCandidate(name, ctx, r)
  if (found) return found
  const el = ctx.element || {}
  if (typeof el === 'string') return el
  return ctx.strings.feedback ? shorten(ctx.strings.feedback, r) : ctx.strings.next || ''
}

function stringCandidate(name, ctx, r) {
  const el = ctx.element || {}
  if (typeof el === 'object') {
    const own = el[name] ?? el[key(name)]
    if (typeof own === 'string') return own
  }
  const canon = resolveKey(STRING_KEYS, name)
  const s = ctx.strings
  switch (canon) {
    case 'id': return el.id || el.ref || s.id || ''
    case 'ao': return el.ao || s.ao || ''
    // An element that carries the key at all owns the answer, empty included:
    // a not-credited point must not borrow another point's span.
    case 'quote': return 'quote' in el ? (el.quote || '') : (typeof el === 'string' ? el : s.quote || '')
    case 'reason': return 'reason' in el ? (el.reason || '') : (s.reason || '')
    case 'descriptor': return el.descriptor || s.descriptor || ''
    case 'feedback': return s.feedback || ''
    case 'next': return s.next || ''
    case 'front': return el.front || s.front || ''
    case 'back': return el.back || s.back || ''
    case 'title': return el.title || el.id || s.title || ''
    case 'point': return el.text || (typeof el === 'string' ? el : '') || s.point || ''
    case 'status': return s.status || 'provisional'
    default: break
  }
  if (typeof el === 'string') return el
  return el.text || el.quote || ''
}

function shorten(text, r) {
  const parts = String(text).split(/(?<=[.?])\s+/).filter(Boolean)
  if (!parts.length) return ''
  return parts[Math.floor(r() * parts.length) % parts.length]
}

/* ------------------------------------------------------------------ *
 * Job classification and assembly
 * ------------------------------------------------------------------ */

const MARK_SIGNALS = [/mark scheme/i, /marking point/i, /examiner/i, /\baward\b/i, /level descriptor/i, /indicative content/i, /per[_ ]ao/i, /best[ -]fit/i, /mark the (?:answer|response|attempt|script)/i, /credited span/i, /marks_total/i]
const TUTOR_SIGNALS = [/\btutor\b/i, /socratic/i, /hand[ -]?back/i, /\brung\b/i, /help ladder/i, /do not give (?:the|them the) answer/i, /one move/i, /misconception/i, /effort gate/i]

const countMatches = (text, patterns) => patterns.reduce((n, re) => n + (re.test(text) ? 1 : 0), 0)

function schemaKeys(schema, out = new Set(), depth = 0) {
  if (!isObj(schema) || depth > 6) return out
  for (const [k, sub] of Object.entries(schema.properties || {})) { out.add(key(k)); schemaKeys(sub, out, depth + 1) }
  if (schema.items) schemaKeys(schema.items, out, depth + 1)
  for (const branch of [].concat(schema.oneOf || [], schema.anyOf || [])) schemaKeys(branch, out, depth + 1)
  return out
}

function classify(req, schema, material) {
  const system = String(req.system || '')
  const keys = schema ? schemaKeys(schema) : new Set()
  const marky = ['perao', 'perpoint', 'markingpoints', 'points', 'levels', 'creditedspans', 'awarded', 'total', 'marks', 'band'].filter(k => keys.has(k)).length
  const tutory = ['rung', 'handback', 'turn', 'move', 'movetype', 'misconception'].filter(k => keys.has(k)).length
  if (tutory >= 1 && tutory >= marky) return 'tutor'
  if (marky >= 2) return 'mark'

  const markScore = countMatches(system, MARK_SIGNALS) + (material.points.length || material.levels.length ? 1 : 0) + (marky ? 1 : 0)
  const tutorScore = countMatches(system, TUTOR_SIGNALS)
  const hasMaterial = material.points.length || material.indicative.length || material.levels.length || material.stem
  if (markScore === 0 && tutorScore === 0) return schema ? 'generic' : 'plain'
  if (markScore > tutorScore && hasMaterial) return 'mark'
  if (tutorScore > 0) return hasMaterial ? 'tutor' : schema ? 'generic' : 'plain'
  return schema ? 'generic' : hasMaterial ? 'mark' : 'plain'
}

/** Card and item generation get real content built from the Pack material. */
function generatedLists(material, verdict, r) {
  const source = material.points.length ? material.points : material.indicative
  const cards = source.slice(0, 5).map((p, i) => ({
    id: p.id || 'card' + (i + 1),
    front: material.commandWord && i === 0
      ? `${material.commandWord}: what does the scheme credit here?`
      : `What earns the mark for ${headNoun(p.text)}?`,
    back: trimPhrase(p.text) + '.',
    text: p.text,
  }))
  const items = source.slice(0, 3).map((p, i) => ({
    id: 'itm' + (i + 1),
    title: headNoun(p.text),
    front: `Same skill, changed context: apply ${headNoun(p.text)} to a firm you have not seen.`,
    back: trimPhrase(p.text) + '.',
    text: p.text,
  }))
  return {
    cards: cards.length ? cards : [{ id: 'card1', front: 'What does this command word require?', back: verdict.nextStep, text: verdict.nextStep }],
    items,
    misconceptions: material.misconceptions.map(m => ({ id: m.id, text: m.text })),
    _r: r,
  }
}

function buildContext(req, material, kind, r) {
  if (kind === 'tutor') {
    const turn = tutorTurn(req, material, r)
    const gen = generatedLists(material, { nextStep: turn.handback }, r)
    return {
      text: turn.text,
      lists: {
        points: [],
        perAo: [],
        spans: [],
        missing: turn.missed.map(p => ({ id: p.id, text: p.text })),
        cards: gen.cards,
        items: gen.items,
        misconceptions: turn.mis ? [{ id: turn.mis.id, text: turn.mis.text }] : gen.misconceptions,
      },
      numbers: { rung: turn.rung, total: 0, max: material.tariff, confidence: 0.7, tolerance: 1, level: 0 },
      strings: {
        feedback: turn.text,
        next: turn.handback,
        reason: turn.mis ? turn.mis.text : 'One move per Turn, then the work comes back to you.',
        id: turn.mis?.id || '',
        status: 'ok',
        title: material.commandWord || 'Turn',
      },
      booleans: {},
    }
  }

  if (kind === 'plain') {
    const text = plainAnswer(req, material, r)
    return {
      text,
      lists: { points: [], perAo: [], spans: [], missing: [], cards: [], items: [], misconceptions: [] },
      numbers: { total: 0, max: 0, confidence: 0.5, tolerance: 1, level: 0, rung: 0, low: 0, high: 0 },
      strings: { feedback: text, next: 'Paste the question and your attempt.', reason: 'No scheme is loaded for this.', status: 'unknown', id: '', title: '' },
      booleans: {},
    }
  }

  const verdict = judge(req, material)
  const gen = generatedLists(material, verdict, r)
  const spans = verdict.usePoints
    ? verdict.points.filter(p => p.quote).map(p => ({
        id: p.id, marking_point_id: p.id, evidence_kind: evidenceKind(String(p.ao || '')), quote: p.quote, start: p.start, end: p.end, char_start: p.start, char_end: p.end,
        ao: p.ao, reason: p.reason, reason_code: p.reason_code, class: p.class, met: p.met, links_counted: p.links_counted, text: p.text,
      }))
    : verdict.perAo.flatMap(a => a.spans.map(q => ({
        id: a.ao, quote: q.quote, start: q.start, end: q.end, char_start: q.start, char_end: q.end,
        ao: a.ao, reason: a.reason, reason_code: a.reason_code, class: 'credited', met: true, links_counted: q.links_counted, text: q.quote,
      })))

  return {
    text: '',
    verdict,
    lists: {
      points: verdict.points,
      perAo: verdict.perAo.map(a => ({
        ...a,
        id: a.ao,
        quote: a.quotes[0]?.quote || null,
        start: a.quotes[0]?.start ?? null,
        end: a.quotes[0]?.end ?? null,
        char_start: a.quotes[0]?.start ?? 0,
        char_end: a.quotes[0]?.end ?? 0,
      })),
      spans,
      missing: verdict.missing.map((t, i) => ({ id: 'MISS' + (i + 1), text: t, quote: null })),
      cards: gen.cards,
      items: gen.items,
      misconceptions: gen.misconceptions,
    },
    numbers: {
      total: verdict.total,
      max: verdict.max,
      level: verdict.perAo[0]?.level ?? 0,
      confidence: verdict.confidence,
      low: verdict.band.low,
      high: verdict.band.high,
      tolerance: verdict.tolerance,
      rung: 0,
    },
    strings: {
      feedback: verdict.summary,
      next: verdict.nextStep,
      reason: verdict.strengths,
      descriptor: verdict.perAo[0]?.descriptor || '',
      quote: spans[0]?.quote || '',
      id: '',
      ao: verdict.perAo[0]?.ao || '',
      status: 'provisional',
      title: material.commandWord || 'Mark',
      point: verdict.missing[0] || '',
    },
    booleans: {},
  }
}

/** Prose for a marking judgement when the caller asked for no schema. */
function markProse(ctx) {
  const v = ctx.verdict
  const lines = [`${v.total}/${v.max} — band ${v.band.low}–${v.band.high}.`, v.strengths]
  if (v.usePoints) {
    for (const p of v.points.slice(0, 8)) lines.push(`${p.id} — ${p.reason}`)
  } else {
    for (const a of v.perAo) lines.push(`${a.ao} level ${a.level}, ${a.marks}/${a.max}. ${a.reason}`)
  }
  lines.push(v.nextStep)
  return lines.join('\n')
}

/* ------------------------------------------------------------------ *
 * The Provider surface
 * ------------------------------------------------------------------ */

const estimateTokens = (text) => Math.max(1, Math.ceil(String(text || '').length / 4))

function produce(req) {
  const seed = hash32(JSON.stringify({
    s: req.system || '',
    m: (req.messages || []).map(x => `${x.role}:${x.content}`),
    e: req.effort || '',
    t: req.temperature ?? null,
    k: req.schema ? JSON.stringify(req.schema) : '',
  }))
  const r = rng(seed)
  const material = readMaterial(req)
  const kind = classify(req, req.schema, material)
  const ctx = buildContext(req, material, kind, r)

  let text, json = undefined
  if (req.schema) {
    json = synth(req.schema, 'root', ctx, r)
    text = JSON.stringify(json, null, 2)
  } else if (kind === 'mark') {
    text = markProse(ctx)
  } else {
    text = ctx.text
  }
  if (!req.schema) text = text.split('\n').map(tidy).join('\n')

  const usage = {
    in: estimateTokens(req.system) + (req.messages || []).reduce((n, m) => n + estimateTokens(m.content), 0),
    out: estimateTokens(text),
  }
  return { text, json, model: 'mock', usage, costUsd: priceOf('mock', usage) }
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

/** Word-boundary chunks, three to six words each, so streaming looks like typing. */
function chunks(text) {
  const out = []
  const parts = String(text).split(/(\s+)/)
  let buf = '', words = 0
  for (const part of parts) {
    buf += part
    if (part.trim()) words++
    if (words >= 4 || buf.length > 48) { out.push(buf); buf = ''; words = 0 }
  }
  if (buf) out.push(buf)
  return out
}

export const mock = {
  name: 'mock',
  configured: true,

  async complete(req) {
    const res = produce(req)
    await sleep(CHUNK_MS)
    return res
  },

  async *stream(req) {
    const res = produce(req)
    for (const chunk of chunks(res.text)) {
      await sleep(CHUNK_MS)
      yield chunk
    }
    return res
  },
}

export default mock
