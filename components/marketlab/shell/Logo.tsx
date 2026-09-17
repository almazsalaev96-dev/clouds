/**
 * The mark: three bars rising to a point, which is a chart and a lab flask at
 * the same time. Drawn rather than lettered so it holds at 20px in the sidebar.
 */
export function Logo({ size = 26, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none" aria-hidden className={className}>
      <rect x="0.75" y="0.75" width="26.5" height="26.5" rx="7.25" fill="var(--ml-navy)" />
      <rect x="0.75" y="0.75" width="26.5" height="26.5" rx="7.25" stroke="var(--ml-navy-line)" strokeWidth="1.5" />
      <rect x="6" y="16" width="3.4" height="6" rx="1.2" fill="var(--ml-navy-fg-2)" />
      <rect x="12.3" y="11.5" width="3.4" height="10.5" rx="1.2" fill="var(--ml-navy-fg-2)" />
      <rect x="18.6" y="7" width="3.4" height="15" rx="1.2" fill="#74a0ff" />
      <circle cx="20.3" cy="7" r="2.6" fill="var(--ml-navy)" stroke="#74a0ff" strokeWidth="1.6" />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={className}>
      <span className="font-semibold tracking-[-0.02em]">Market</span>
      <span className="font-normal tracking-[-0.02em] text-ml-text-3">Lab</span>
    </span>
  );
}
