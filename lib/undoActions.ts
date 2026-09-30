/**
 * The undo for what a tool did, kept apart from the tools themselves: a
 * message's Undo chip asks whether it can undo on every render, and that
 * question should not bring the whole tool catalogue into the first
 * download. The tools (`actions.ts`) are loaded when a message is sent.
 */
/* Undo lives in memory: the closures are this session's, and a chip on a
   message from last week has nothing to take back that a person could
   still want taken back the same way. */
const UNDO = new Map<string, () => Promise<void>>();

export function keepUndo(actionId: string, undo: (() => Promise<void>) | undefined): void {
  if (undo) UNDO.set(actionId, undo);
}
export function canUndo(actionId: string): boolean {
  return UNDO.has(actionId);
}
export async function undoAction(actionId: string): Promise<boolean> {
  const f = UNDO.get(actionId);
  if (!f) return false;
  UNDO.delete(actionId);
  await f();
  return true;
}
