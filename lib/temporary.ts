"use client";

import { db } from "./db";

/**
 * A chat that is not kept.
 *
 * ## What the app can actually promise
 *
 * Everything here lives in one origin's IndexedDB. There is no server to not
 * write to, and holding a long thread in memory alone would lose it to a
 * reload — so a temporary chat *is* written to disk while it is open. Saying
 * otherwise would be the easy version of this feature and a lie: the bytes
 * would still be there.
 *
 * What it can promise is a retention rule, kept exactly:
 *
 *   - it is out of the sidebar, out of search, and out of memory in both
 *     directions while it is open
 *   - it is deleted, with its messages, when the tab that owns it is gone
 *
 * Which is said on screen in those words rather than as "nothing is stored".
 *
 * ## Whose tab
 *
 * The obvious implementation — delete every temporary chat at startup — has a
 * failure that is not obvious and is unforgivable: opening a second tab
 * deletes the temporary chat you are in the middle of in the first one. This
 * app's cardinal rule is that it does not destroy work, and "it was temporary"
 * is not a defence when you were still typing in it.
 *
 * So a temporary chat records the tab that made it, and tabs with one open say
 * so in `localStorage` every twenty seconds. At startup the sweep deletes only
 * the chats whose tab has stopped saying anything — a tab that was closed, or
 * crashed, or was killed by the phone. A tab that is merely quiet is still
 * beating.
 *
 * The heartbeat runs only while this tab has a temporary chat. Somebody who
 * never opens one never pays for the timer.
 */

const ALIVE = "temp.alive.";
const OWNER = "temp.session";

/** How often a tab with a temporary chat says it is still here. */
export const HEARTBEAT_MS = 20_000;

/** And how long silence means gone. Three missed beats, so one stalled frame is not death. */
export const STALE_MS = 70_000;

/**
 * This tab's identity, which is what `sessionStorage` is actually for: it is
 * per-tab and it survives a reload, so a reload keeps the chat and closing the
 * tab does not.
 */
export function sessionId(): string {
  if (typeof window === "undefined") return "";
  try {
    let id = sessionStorage.getItem(OWNER);
    if (!id) {
      id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
      sessionStorage.setItem(OWNER, id);
    }
    return id;
  } catch {
    /* private mode with storage off. The chat then behaves as one whose owner
       is already gone, which is the safe direction for a thing called
       temporary: it gets swept, rather than outliving the promise. */
    return "";
  }
}

let timer: ReturnType<typeof setInterval> | undefined;

/** Start saying this tab is here, if it is not saying so already. */
export function holdOpen() {
  if (typeof window === "undefined" || timer) return;
  beat();
  timer = setInterval(beat, HEARTBEAT_MS);
  // Best effort, and only that: a delete started here may not finish before
  // the tab goes. The sweep at startup is the mechanism; this only makes the
  // common case tidy sooner.
  window.addEventListener("pagehide", letGo, { once: true });
}

function beat() {
  const id = sessionId();
  if (!id) return;
  try {
    localStorage.setItem(ALIVE + id, String(Date.now()));
  } catch {
    /* storage full or off — the chat is swept on the next start, which is the
       promise, reached the slow way */
  }
}

/** Stop saying it, and take the key with us. */
export function letGo() {
  if (timer) clearInterval(timer);
  timer = undefined;
  try {
    const id = sessionId();
    if (id) localStorage.removeItem(ALIVE + id);
  } catch {
    /* nothing to clear */
  }
}

/** The tabs still saying they are here. Stale keys are dropped on the way past. */
export function liveSessions(now = Date.now()): Set<string> {
  const live = new Set<string>();
  if (typeof window === "undefined") return live;
  try {
    const dead: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith(ALIVE)) continue;
      const at = Number(localStorage.getItem(key));
      if (Number.isFinite(at) && now - at < STALE_MS) live.add(key.slice(ALIVE.length));
      else dead.push(key);
    }
    for (const key of dead) localStorage.removeItem(key);
  } catch {
    /* with no storage to read, nothing is live, and everything temporary is
       swept — see the note in `sessionId` about which way to fail */
  }
  return live;
}

/**
 * Delete the temporary chats whose tab is gone, and their messages.
 *
 * Returns how many, for the check that measures this rather than trusting it.
 */
export async function sweepTemporary(): Promise<number> {
  const live = liveSessions();
  live.add(sessionId());
  const rows = await db.conversations.filter((c) => Boolean(c.temporary)).toArray();
  const dead = rows.filter((c) => !c.tempSession || !live.has(c.tempSession));
  if (!dead.length) return 0;
  const ids = dead.map((c) => c.id);
  await db.transaction("rw", db.conversations, db.messages, async () => {
    await db.messages.where("conversationId").anyOf(ids).delete();
    await db.conversations.bulkDelete(ids);
  });
  return ids.length;
}

/** What the interface says about it, in one place so the two surfaces cannot drift. */
export const TEMPORARY_RULE =
  "Not kept. It stays out of the sidebar, out of search and out of memory, and it is deleted when you close this tab.";
