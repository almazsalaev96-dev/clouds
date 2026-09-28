/**
 * Opening the Studio from anywhere.
 *
 * The Studio sheet lives once, at the top of the app; every room that has
 * something to make study material from — a book dropped into the
 * Notebook, a page, a document in the Tutor, the Studio room itself —
 * asks for it through this one event rather than each growing its own.
 * Tiny on purpose: it is imported by rooms that load with the first screen.
 */
import type { ToolId } from "./standards";

export interface StudioRequest {
  /** What to make it from. None: the sheet asks. */
  source?: { name: string; text: string };
  /** A tool to start on. */
  tool?: ToolId;
  /** Ask for a file straight away. */
  pick?: boolean;
  /** Write from a topic rather than a source. */
  topic?: string;
}

export const STUDIO_EVENT = "armi:studio";

export function openStudio(req: StudioRequest = {}): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<StudioRequest>(STUDIO_EVENT, { detail: req }));
}
