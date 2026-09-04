/** Human-readable interval, the way a study app should say it. */
export function formatDuration(ms: number): string {
  const minutes = ms / 60_000;
  if (minutes < 1) return '<1 min';
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const hours = minutes / 60;
  if (hours < 24) return `${Math.round(hours)} h`;
  const days = hours / 24;
  if (days < 30) return `${Math.round(days)} d`;
  const months = days / 30.44;
  if (months < 12) return `${months.toFixed(months < 2 ? 1 : 0)} mo`;
  return `${(days / 365.25).toFixed(1)} yr`;
}

export function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}
