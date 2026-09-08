/** `node:path`, for the browser build: the four string operations the server makes. */
const clean = (p: string) => p.replace(/\/+$/, '')
export const dirname = (p: string): string => clean(p).split('/').slice(0, -1).join('/') || '/'
export const basename = (p: string, ext?: string): string => {
  const b = clean(p).split('/').pop() || ''
  return ext && b.endsWith(ext) ? b.slice(0, -ext.length) : b
}
export const extname = (p: string): string => {
  const b = basename(p)
  const at = b.lastIndexOf('.')
  return at > 0 ? b.slice(at) : ''
}
export const join = (...parts: string[]): string =>
  parts.filter(Boolean).join('/').replace(/\/{2,}/g, '/')
export const resolve = join
/** Collapse "." and ".." — `serveStatic` uses it to refuse a path that escapes root. */
export const normalize = (p: string): string => {
  const absolute = p.startsWith('/')
  const out: string[] = []
  for (const part of p.split('/')) {
    if (!part || part === '.') continue
    if (part === '..') out.pop()
    else out.push(part)
  }
  return (absolute ? '/' : '') + out.join('/')
}
export const sep = '/'
export default { dirname, basename, extname, join, resolve, normalize, sep }
