"use client";

/**
 * The frame of a section, while the section is still arriving.
 *
 * Projects and the notebook are fetched when you press them rather than
 * shipped to everyone who only ever chats — 138ms and 185ms to open, which is
 * free on a desk and is not free anywhere else. Measured on a slow connection
 * it was 1.4 seconds, and for all of it the screen held the shape of the room
 * you had just left: the sidebar row highlighted, the middle empty. Pressing a
 * button and watching nothing happen is the same as pressing a button that
 * does not work.
 *
 * So the frame arrives immediately and the contents fill in. It is deliberately
 * the same shape as `SectionIndex`'s own loading state — the title where the
 * title goes, the button where the button goes, three rows the height of three
 * rows — so that what replaces it lands in the same places rather than jumping.
 * It cannot import that component: the whole point is that it is here, in the
 * first bundle, and that is there, in the one being fetched.
 */
export function SectionSkeleton({ title, newLabel }: { title: string; newLabel: string }) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto" aria-busy>
      <header className="glass safe-top sticky top-0 z-10 border-b border-line">
        <div className="mx-auto flex w-full max-w-[var(--measure)] items-center gap-3 px-4 py-3">
          <h1 className="text-lg font-semibold tracking-[-0.02em] text-primary">{title}</h1>
          {/* Not a working button: pressing it would open a thing whose code is
              still in flight. It holds the space so the real one does not
              shove the title sideways when it arrives. */}
          <span
            aria-hidden
            className="skeleton ml-auto h-7 rounded-md"
            style={{ width: `${newLabel.length * 0.55 + 2.5}rem` }}
          />
        </div>
      </header>

      <div className="mx-auto w-full max-w-[var(--measure)] px-4 pb-[18vh] pt-4">
        <ul className="space-y-1" aria-hidden>
          {[0, 1, 2].map((i) => (
            <li
              key={i}
              className="skeleton h-[3.25rem] rounded-lg border border-line"
              style={{ animationDelay: `${i * 90}ms` }}
            />
          ))}
        </ul>
      </div>
    </div>
  );
}
