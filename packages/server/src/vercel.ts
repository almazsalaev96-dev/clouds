/**
 * Serverless entry point.
 *
 * The application is a plain request handler, so the only thing this adds is
 * the platform's calling convention plus two honest declarations:
 *
 *  - `durable: false` — there is no database attached, so the store lives in a
 *    warm instance's memory and does not survive a restart. The interface says
 *    so rather than letting someone discover it by losing work.
 *  - `secureCookies: true` — the deployment is HTTPS.
 *
 * Attaching a database is a Store adapter, not a rewrite: `Store` is an
 * interface and every caller goes through it.
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import { createHandler } from "./app.ts";

const app = createHandler({
  secureCookies: true,
  durable: Boolean(process.env.DATABASE_URL),
});

export default function handler(req: IncomingMessage, res: ServerResponse) {
  return app.handler(req, res);
}
