/**
 * Moving between rooms.
 *
 * Every section change in this app was a cut: chat vanished, code appeared,
 * and nothing said the two were next to each other or which way you had gone.
 * A cut is the right edit when the next shot is somewhere else entirely; it is
 * the wrong one for walking through a door, and this app is doors.
 *
 * The browser will do the work if you ask it to. `startViewTransition` takes a
 * snapshot, runs your state change, takes another, and cross-fades between
 * them — and where an element on both sides carries the same
 * `view-transition-name`, it *moves* rather than cross-fading. That is what
 * carries the message bar from the middle of a blank page down to the dock on
 * the first send: same box, same name, one continuous move, no code beyond the
 * name itself.
 *
 * Three ways out, all of which end with the state having changed:
 *
 *  - no support (Firefox today): the update runs plainly, which is exactly
 *    what the app did before this file existed;
 *  - reduced motion: the same, deliberately, because a page-sized cross-fade
 *    is the kind of motion the setting exists to refuse;
 *  - an update that throws: the browser still commits, and the `finished`
 *    rejection is swallowed rather than surfacing as an unhandled rejection.
 */

type ViewTransition = { finished: Promise<void>; ready: Promise<void> };
type WithVT = Document & { startViewTransition?: (cb: () => void) => ViewTransition };

/** Which way you went. The stylesheet slides the room accordingly. */
export type Direction = "forward" | "back";

export function withTransition(update: () => void, direction: Direction = "forward"): void {
  const doc = document as WithVT;
  const reduced =
    typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (typeof doc.startViewTransition !== "function" || reduced) {
    update();
    return;
  }

  /* The direction is an attribute rather than a class because the pseudo
     elements it selects hang off the root, and the root is the only place a
     rule can reach them from. It is removed when the transition ends so a
     transition that is not a room change is never accidentally directional. */
  const root = document.documentElement;
  root.dataset.nav = direction;

  const transition = doc.startViewTransition(update);
  const clear = () => {
    if (root.dataset.nav === direction) delete root.dataset.nav;
  };
  transition.finished.then(clear, clear);
}
