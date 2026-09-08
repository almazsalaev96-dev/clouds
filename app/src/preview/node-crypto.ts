/** `node:crypto`, for the browser build. The one function the marker uses. */
export const randomUUID = (): string =>
  (globalThis.crypto?.randomUUID?.()
    ?? `${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 14)}`)
export default { randomUUID }
