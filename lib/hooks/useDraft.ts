import * as React from "react";

/**
 * A text field over a stored value, typed into without a round trip.
 *
 * A field whose value came straight from the database and whose onChange
 * only wrote to it lost letters: React put the old value back until the
 * live query caught up, so the caret jumped to the end after every key,
 * fast typing dropped characters and IME composition broke. This keeps
 * what is typed locally, writes it a moment after typing stops (and on
 * leaving the field), and only takes the stored value back while the
 * field is not being typed in — so a rename from elsewhere still shows.
 */
export function useDraft(stored: string, commit: (v: string) => void, delay = 300, owner = "") {
  const [draft, setDraft] = React.useState(stored);
  const focused = React.useRef(false);
  const timer = React.useRef<number | null>(null);
  const latest = React.useRef(commit);
  const pending = React.useRef<string | null>(null);
  /* The same field reused for another record (the next canvas, the next
     project): what was typed for the last one is saved to the last one,
     not to this, and the field starts from this one's value. */
  const ownerRef = React.useRef(owner);
  if (ownerRef.current !== owner) {
    ownerRef.current = owner;
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
    if (pending.current !== null) latest.current(pending.current);
    pending.current = null;
    focused.current = false;
    setDraft(stored);
  }
  latest.current = commit;

  React.useEffect(() => {
    if (!focused.current && pending.current === null) setDraft(stored);
  }, [stored]);

  const flush = React.useCallback(() => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
    if (pending.current !== null) {
      latest.current(pending.current);
      pending.current = null;
    }
  }, []);

  React.useEffect(() => flush, [flush]);

  return {
    value: draft,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const v = e.target.value;
      setDraft(v);
      pending.current = v;
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(flush, delay);
    },
    onFocus: () => { focused.current = true; },
    onBlur: () => { focused.current = false; flush(); },
  };
}
