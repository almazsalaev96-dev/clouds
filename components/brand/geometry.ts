/**
 * The letterforms, as data.
 *
 * Kept out of the component so the proof sheet and the app draw the same
 * paths — a wordmark that differs between where it is designed and where it
 * ships is two wordmarks.
 *
 * ---------------------------------------------------------------------------
 * THE DISPLAY CUT — a Didone, letterspaced, in capitals.
 *
 * Didot was cut in Paris in the 1780s and the style is the reason French
 * luxury looks the way it does two centuries later: a vertical axis, stems
 * that go heavy while the joins go to a hairline, and flat unbracketed serifs
 * with no curve where they meet the stem. It is a letterform made by an
 * engraver rather than a scribe — which is exactly the register a name set on
 * cream paper should be in.
 *
 * The thick/thin rule is not decoration, it is one consistent logic applied
 * everywhere: verticals and any stroke travelling down-and-right carry full
 * weight; horizontals and any stroke travelling up-and-right go to a hairline.
 * Every letter below obeys it, which is what makes four capitals read as one
 * alphabet rather than four drawings.
 *
 * Grid: cap height 100, from y=10 to y=110. Stem 24, hairline 7, serifs 5
 * deep and projecting 11 either side of the stem they finish.
 * ---------------------------------------------------------------------------
 */

export const DISPLAY = {
  height: 128,
  /** Set wide. A maison letterspaces its name; a software company does not. */
  tracking: 34,
} as const;

/** A — hairline left diagonal, full-weight right, thin bar, flat feet. */
export const D_A = {
  width: 104,
  paths: [
    // Left diagonal: the up-stroke, so it stays light.
    "M48 10 H56 L28 110 H16 Z",
    // Right diagonal: the down-stroke, carrying the weight.
    "M48 10 H56 L88 110 H62 Z",
    // Bar, at hairline weight.
    "M27 80 H77 V87 H27 Z",
    // Flat feet. No bracket, no curve — the Didone signature.
    "M4 105 H40 V110 H4 Z",
    "M56 105 H100 V110 H56 Z",
  ],
} as const;

/** R — weighted stem, hairline bowl joins, a leg that lands on a serif. */
export const D_R = {
  width: 96,
  paths: [
    "M14 10 H38 V110 H14 Z",
    // Serifs on the stem, top-left only at the top because the bowl takes
    // the other side.
    "M2 10 H38 V15 H2 Z",
    "M2 105 H50 V110 H2 Z",
    // Bowl: hairline across the top and at the join, weight on the outside.
    "M38 10 H62 C78 10 88 21 88 35 C88 49 78 60 62 60 H38 V53 H60 C70 53 76 46 76 35 C76 24 70 17 60 17 H38 Z",
    // Leg: down-and-right, so it is heavy, and it finishes on a foot.
    "M52 55 H74 L94 105 H72 Z",
    "M62 105 H98 V110 H62 Z",
  ],
} as const;

/** M — weighted stems and down-stroke, hairline up-stroke. */
export const D_M = {
  width: 128,
  paths: [
    "M12 10 H36 V110 H12 Z",
    "M92 10 H116 V110 H92 Z",
    "M0 10 H36 V15 H0 Z",
    "M0 105 H48 V110 H0 Z",
    "M92 10 H128 V15 H92 Z",
    "M80 105 H128 V110 H80 Z",
    // Down-and-right: full weight.
    "M12 10 H36 L70 96 H56 Z",
    // Up-and-right: hairline.
    "M92 10 H104 L70 96 H62 Z",
  ],
} as const;

/** I — the letter the whole system is judged on: a stem and two serifs. */
export const D_I = {
  width: 52,
  paths: [
    "M14 10 H38 V110 H14 Z",
    "M2 10 H50 V15 H2 Z",
    "M2 105 H50 V110 H2 Z",
  ],
} as const;

export const WORD = [D_A, D_R, D_M, D_I] as const;

/**
 * ---------------------------------------------------------------------------
 * THE SMALL CUT.
 *
 * A hairline is 7 units on a 120-unit grid. Rendered at 16px in a sidebar that
 * is a third of a pixel, which a screen cannot draw — it either vanishes or
 * aliases into grey mud, and either way the display cut stops being the thing
 * that was designed.
 *
 * So there is a second cut for small sizes, which is what every foundry and
 * every maison has always done. It keeps the same skeleton and the same
 * thick/thin logic and drops the serifs and the extreme contrast, because at
 * 16px those are not legible detail — they are noise.
 * ---------------------------------------------------------------------------
 */
export const GRID = { height: 64, stem: 11 } as const;

export const A_LEFT = "M27 6 L12 54 L4 54 Z";
export const A_RIGHT = "M27 6 L50 54 L34 54 Z";
export const A_BAR = "M12 38 H42 V45 H12 Z";
