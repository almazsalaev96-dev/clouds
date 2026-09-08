/**
 * `node:fs`, for the browser build.
 *
 * There is one thing the server reads from disk at runtime: a curriculum pack. The
 * packs are bundled into the page, so this is a filesystem containing exactly those
 * — and `loadPack` parses the same bytes it would parse on a server.
 */
import pack9609 from '../../server/packs/9609.json?raw'

const FILES: Record<string, string> = { '9609.json': pack9609 }

const nameOf = (path: string) => String(path).split('/').pop() || ''

export const existsSync = (path: string): boolean => nameOf(path) in FILES

export function readFileSync(path: string, _encoding?: unknown): string {
  const name = nameOf(path)
  if (!(name in FILES)) {
    // `loadPack` catches this and reports the pack as missing, as it would on a server.
    throw Object.assign(new Error(`ENOENT: no such file, open '${path}'`), { code: 'ENOENT' })
  }
  return FILES[name]
}

export const createReadStream = (): never => {
  throw new Error('The preview serves its own assets; it does not stream files.')
}
export const statSync = (): never => {
  throw new Error('The preview serves its own assets; it does not stat files.')
}
export default { existsSync, readFileSync, createReadStream, statSync }
