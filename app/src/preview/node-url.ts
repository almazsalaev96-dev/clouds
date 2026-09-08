/** `node:url`, for the browser build. Module paths are only ever used to find packs. */
export const fileURLToPath = (url: string | URL): string =>
  String(url).replace(/^file:\/\//, '')
export const pathToFileURL = (path: string): URL => new URL(`file://${path}`)
export default { fileURLToPath, pathToFileURL }
