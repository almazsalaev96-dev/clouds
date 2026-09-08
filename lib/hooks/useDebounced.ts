"use client";

import * as React from "react";

/**
 * A value that lags behind the one you are typing.
 *
 * For work too expensive to run per keystroke — a full scan of every message
 * in the database, say — where the input itself must stay instant. The caller
 * keeps the live value for anything cheap and gates the rest on this one.
 */
export function useDebounced<T>(value: T, ms: number): T {
  const [settled, setSettled] = React.useState(value);
  React.useEffect(() => {
    const t = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return settled;
}
