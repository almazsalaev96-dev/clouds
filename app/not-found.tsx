import Link from "next/link";
import "./(lab)/marketlab.css";

/**
 * The global 404. With two root layouts in this app there is no single layout
 * to inherit, so this page supplies its own document — which is what Next
 * requires of a root `not-found` in that arrangement.
 */
export default function NotFound() {
  return (
    <html lang="en-GB">
      <body>
        <div className="ml-root flex min-h-dvh items-center justify-center px-6">
          <div className="max-w-md text-center">
            <p className="ml-label text-ml-text-4">404</p>
            <h1 className="ml-h1 mt-2 text-ml-text">There is nothing at this address.</h1>
            <p className="ml-body mt-3 text-ml-text-3">
              The page you were looking for has either moved or never existed. The experiments are the best place to pick
              the thread back up.
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <Link href="/" className="rounded-ml-sm bg-ml-accent px-4 py-2.5 text-[0.875rem] font-medium text-ml-accent-fg">
                Back to MarketLab
              </Link>
              <Link href="/experiments" className="rounded-ml-sm border border-ml-border px-4 py-2.5 text-[0.875rem] font-medium text-ml-text">
                Browse experiments
              </Link>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
