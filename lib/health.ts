/**
 * Which providers are having a bad minute.
 *
 * A model that will not answer is not a fact about the model, it is a fact
 * about right now: a company is overloaded, a key has run out of credit, a
 * key was revoked. The app knows this the moment it happens and used to
 * throw it away — so the next question went to the same company, failed the
 * same way, and the person watched it fail twice before being told to switch
 * by hand.
 *
 * So failures are remembered, briefly, and routing walks around them. The
 * memory is in this module and nowhere else: it is about this browser in
 * this minute, it must not survive a reload (a provider that was down an
 * hour ago is not down now), and writing it to the database would make a
 * transient outage look like a setting.
 *
 * Nothing here ever leaves a person with no model at all. Where every
 * provider is ailing the whole memory is ignored, because an app that
 * refuses to try is worse than one that tries and fails.
 */
import type { ErrorKind, ProviderId } from "./types";

/** How long a kind of failure is worth remembering. */
const FOR: Partial<Record<ErrorKind, number>> = {
  /* Their end. Usually minutes. */
  provider_down: 2 * 60_000,
  /* A limit clears on its own, and often within the minute. */
  rate_limit: 90_000,
  /* Credit and keys do not fix themselves while you wait, so these are
     remembered long enough to stop a whole session going the same way, and
     not so long that adding credit in another tab is ignored. */
  quota: 10 * 60_000,
  bad_key: 10 * 60_000,
};

/* Deliberately not `network`, `timeout` or `unknown`. A connection that
   dropped is as likely to be the café as the company, and marking every
   provider unwell because the wi-fi went would empty the bench. */

const hurt = new Map<ProviderId, { until: number; kind: ErrorKind }>();

/** Something went wrong, and it was the provider's end. */
export function noteFailure(provider: ProviderId, kind: ErrorKind, now = Date.now()): void {
  const span = FOR[kind];
  if (!span) return;
  hurt.set(provider, { until: now + span, kind });
}

/** It answered. Whatever we thought was wrong with it is over. */
export function noteSuccess(provider: ProviderId, now = Date.now()): void {
  const row = hurt.get(provider);
  if (row && row.until > now) hurt.delete(provider);
  else if (row) hurt.delete(provider);
}

/** Why this provider is being stepped around, if it is. */
export function ailmentOf(provider: ProviderId, now = Date.now()): ErrorKind | null {
  const row = hurt.get(provider);
  if (!row) return null;
  if (row.until <= now) {
    hurt.delete(provider);
    return null;
  }
  return row.kind;
}

export const isAiling = (provider: ProviderId, now = Date.now()): boolean =>
  ailmentOf(provider, now) !== null;

/**
 * The models worth trying, of the ones offered.
 *
 * Empty in, empty out. Everything ailing in, everything back out — see the
 * note at the top: the last thing this should do is decide nobody can be
 * asked.
 */
export function wellOnly<T extends { provider: ProviderId }>(models: T[], now = Date.now()): T[] {
  const well = models.filter((m) => !isAiling(m.provider, now));
  return well.length ? well : models;
}

/**
 * Whether a failure is worth carrying to another company.
 *
 * The ones that are about the company rather than about the question — and
 * one that is about the window: a conversation too long for this model is
 * carried to a model with a larger one (`roomier`, the same company allowed)
 * rather than to another company at random. A content filter stays put: it
 * would land the same way anywhere, and moving it would only spend a
 * second key.
 *
 * Lived inside the chat hook until every other room needed it too: a spent
 * key stopped the Notebook, the Study room and the tutor outright while
 * three other keys sat unused, because the single-shot calls those rooms
 * make never went near the hook that knew this.
 */
export function worthMoving(kind: ErrorKind): boolean {
  return kind === "provider_down" || kind === "rate_limit" || kind === "quota" || kind === "bad_key" || kind === "context_length";
}

/** In words, for the line under an answer. */
export function whyAvoided(kind: ErrorKind, name: string): string {
  return kind === "rate_limit"
    ? `${name} was rate-limiting a moment ago`
    : kind === "quota"
      ? `${name} is out of credit`
      : kind === "bad_key"
        ? `${name} rejected the key`
        : `${name} was having trouble a moment ago`;
}

/** For tests and for "try them all again" in settings. */
export function forgetHealth(): void {
  hurt.clear();
}
