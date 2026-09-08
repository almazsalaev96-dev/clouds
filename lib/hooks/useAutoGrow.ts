"use client";

import { useEffect, type RefObject } from "react";

/**
 * Grows a textarea to fit its content, so the surrounding page scrolls instead
 * of the box. Two scrollbars for one piece of text is the fastest way to lose
 * a reader's place, and a note or a paper is long text by definition.
 */
export function useAutoGrow(ref: RefObject<HTMLTextAreaElement | null>, value: string) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [ref, value]);
}
