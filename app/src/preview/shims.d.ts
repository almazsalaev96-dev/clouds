/** Modules the preview build resolves through Vite aliases or query suffixes. */
declare module '*.json?raw' {
  const contents: string
  export default contents
}
declare module 'sql.js/dist/sql-asm.js' {
  const init: (config?: unknown) => Promise<unknown>
  export default init
}
/** The API, assembled in `server/app.js`. Plain JavaScript, so it carries no types. */
declare module '*/server/app.js' {
  export function createApp(): unknown
  export function dispatch(router: unknown, req: unknown, res: unknown, fallback: unknown): Promise<unknown>
  export function json(res: unknown, body: unknown, status?: number): void
}
