/**
 * Verifies every text/background pair in the design system against WCAG AA.
 *
 * §37 says accessibility is architectural, not a final patch. That is only
 * true if something checks it, so this runs as part of the test suite rather
 * than being asserted in a document and drifting.
 */

const luminance = (hex) => {
  const [r, g, b] = hex.replace("#", "").match(/../g)
    .map((c) => parseInt(c, 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

export const contrast = (fg, bg) => {
  const [a, b] = [luminance(fg), luminance(bg)].sort((x, y) => y - x);
  return (a + 0.05) / (b + 0.05);
};

/** Mirrors the tokens in apps/web/styles.css. */
export const PALETTES = {
  light: {
    bg: "#F7F7F5", surface: "#FFFFFF", surface2: "#F2F2F0", surface3: "#E9E9E6",
    text: "#171717", text2: "#4F4F4F", text3: "#666666",
    accent: "#0060C4", ai: "#5D4FD0", danger: "#B23125", ok: "#1B6B44",
  },
  dark: {
    bg: "#0B0B0C", surface: "#151516", surface2: "#1C1C1E", surface3: "#26262A",
    text: "#F5F5F7", text2: "#A1A1A6", text3: "#8E8E96",
    accent: "#4DA2FF", ai: "#A79BFF", danger: "#FF6B5E", ok: "#4ED08A",
  },
};

/** The values §28 supplied, kept so the regression is provable, not asserted. */
export const SPEC_TOKENS = {
  light: { text3: "#969696", accent: "#007AFF", ai: "#7C6CF2" },
  dark: { text3: "#707075" },
};

export const TEXT_TOKENS = ["text", "text2", "text3", "accent", "ai", "danger", "ok"];
export const SURFACE_TOKENS = ["bg", "surface", "surface2", "surface3"];
export const AA_NORMAL = 4.5;
