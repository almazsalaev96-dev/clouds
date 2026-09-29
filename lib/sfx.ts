/**
 * The games' sounds, made on the spot rather than downloaded: a short rising
 * pair for right, a low buzz for wrong, a little run for a win. Nothing to
 * load, nothing to cache, and silent wherever audio is not allowed yet — a
 * browser holds sound back until the page has been touched, and a game is
 * always started by a press, so by the first answer it is allowed.
 *
 * A phone also gets a short buzz for a wrong answer, where it has one.
 */
type Sound = "right" | "wrong" | "win" | "pair";

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    const A = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!A) return null;
    ctx ??= new A();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(a: AudioContext, freq: number, at: number, len: number, type: OscillatorType, peak: number) {
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, a.currentTime + at);
  g.gain.setValueAtTime(0.0001, a.currentTime + at);
  g.gain.exponentialRampToValueAtTime(peak, a.currentTime + at + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + at + len);
  o.connect(g).connect(a.destination);
  o.start(a.currentTime + at);
  o.stop(a.currentTime + at + len + 0.02);
}

export function play(sound: Sound, on: boolean): void {
  if (sound === "wrong") {
    try { navigator.vibrate?.(40); } catch { /* fine */ }
  }
  if (!on) return;
  const a = audio();
  if (!a) return;
  if (sound === "right") { tone(a, 660, 0, 0.09, "sine", 0.08); tone(a, 990, 0.07, 0.12, "sine", 0.07); }
  else if (sound === "pair") tone(a, 880, 0, 0.1, "sine", 0.07);
  else if (sound === "wrong") tone(a, 150, 0, 0.18, "square", 0.035);
  else [523, 659, 784, 1047].forEach((f, i) => tone(a, f, i * 0.09, 0.16, "triangle", 0.07));
}
