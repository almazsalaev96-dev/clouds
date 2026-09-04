/**
 * Applies the saved theme before first paint so a dark-mode user never gets a
 * white flash. Runs from localStorage, which is the right tool here: a per-device
 * display preference, not study data.
 */
const SCRIPT = `try{var t=localStorage.getItem('atlas-theme');if(t==='dark'||t==='light'){document.documentElement.dataset.theme=t}}catch(e){}`;

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: SCRIPT }} />;
}
