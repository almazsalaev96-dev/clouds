/**
 * Put the three typefaces in `public/fonts/` if they are not already there.
 *
 * The files are committed, so on a normal checkout this does nothing. It exists for
 * a build that starts from a tree without them — a file deploy that did not carry
 * the binaries. Fetching at build time keeps the *runtime* free of a third party:
 * the reader still gets the fonts from this origin, and Google never sees them.
 *
 * A failure here is not a build failure. The stacks in `tokens.css` name a real
 * fallback for every face, so the page sets in system type rather than not at all.
 */
import { mkdir, writeFile, access } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
const QUERY = 'https://fonts.googleapis.com/css2?'
  + 'family=Source+Serif+4:opsz,wght@8..60,600;8..60,700'
  + '&family=IBM+Plex+Sans:wght@400;500;600'
  + '&family=IBM+Plex+Mono:wght@400;500&display=swap'
const KEEP = ['latin', 'latin-ext', 'cyrillic', 'cyrillic-ext']

const here = dirname(fileURLToPath(import.meta.url))
const out = join(here, '..', 'public', 'fonts')

const slug = (family) => family.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

async function main() {
  await mkdir(out, { recursive: true })
  // `fonts.css` names every file; if the first one is there, so are the rest.
  try {
    await access(join(out, 'ibm-plex-sans-latin.woff2'))
    return console.log('fonts: already present')
  } catch { /* fetch them */ }

  const css = await (await fetch(QUERY, { headers: { 'User-Agent': UA } })).text()
  const blocks = [...css.matchAll(/\/\*\s*([a-z-]+)\s*\*\/\s*@font-face\s*\{[^}]*\}/g)]
  const seen = new Set()
  let written = 0
  for (const [block, subset] of blocks.map(m => [m[0], m[1]])) {
    if (!KEEP.includes(subset)) continue
    const family = /font-family:\s*'([^']+)'/.exec(block)?.[1]
    const url = /url\((https:\/\/[^)]+\.woff2)\)/.exec(block)?.[1]
    if (!family || !url) continue
    const name = `${slug(family)}-${subset}.woff2`
    if (seen.has(name)) continue
    seen.add(name)
    const body = Buffer.from(await (await fetch(url)).arrayBuffer())
    await writeFile(join(out, name), body)
    written++
  }
  console.log(`fonts: wrote ${written} files`)
}

main().catch((err) => {
  console.warn(`fonts: not fetched (${err.message}) — the page will set in its fallback stack`)
})
