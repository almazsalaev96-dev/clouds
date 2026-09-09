/**
 * The letterforms, as data.
 *
 * One grid, 64 units tall: cap line 6, baseline 54, x-height 17, stem 11.
 * Kept out of the component so the proof sheet and the app draw the same
 * paths — a wordmark that differs between where it is designed and where it
 * ships is two wordmarks.
 */

export const GRID = { height: 64, wordWidth: 186, stem: 11 } as const;

/**
 * The A.
 *
 * A broad nib held at an angle draws a thin line going up and a thick one
 * coming down. That is why calligraphic capitals have a light left diagonal
 * and a heavy right one — it is not a style, it is what the tool does. Left
 * stroke 7 wide at the baseline, right stroke 14, both narrowing to a shared
 * point at the apex, and the bar takes the thin weight so the eye reads one
 * pen at one angle rather than two unrelated decisions.
 *
 * The weights are 8 and 16 rather than 7 and 14: the rest of the word is an
 * 11-wide monoline with round caps, and a lighter A read as a different
 * family standing next to it rather than the same pen at a different angle.
 *
 * The counter stays empty. It is the paper showing through the letter, which
 * is the whole subject of the reference, and filling it would destroy the A
 * at small sizes and leave a solid triangle anywhere the identity prints in
 * a single colour.
 */
export const A_LEFT = "M26 6 L9 54 L2 54 Z";
export const A_RIGHT = "M26 6 L52 54 L38 54 Z";
export const A_BAR = "M11 38 H42 V44 H11 Z";

/** r — stem and one shoulder, stopping short so it cannot read as an n. */
export const R_STEM = "M5.5 54 V21.5";
export const R_SHOULDER = "M5.5 30 C5.5 22 12 17 21.5 17";

/** m — the same shoulder twice, identical, so the letter looks built. */
export const M_STEM = "M5.5 54 V21.5";
export const M_ARCH_1 = "M5.5 30 C5.5 22 11 17 18 17 C25 17 30.5 22 30.5 30 V54";
export const M_ARCH_2 = "M30.5 30 C30.5 22 36 17 43 17 C50 17 55.5 22 55.5 30 V54";

/** i — the stem, and the dot on the cap line. */
export const I_STEM = "M5.5 54 V21.5";
export const I_DOT = { cx: 5.5, cy: 8.5, r: 5.5 } as const;

/** Where each letter sits along the baseline. */
export const OFFSET = { r: 64, m: 96, i: 164 } as const;
