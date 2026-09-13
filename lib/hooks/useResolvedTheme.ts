"use client";

import * as React from "react";
import { useSettings } from "@/lib/store";

/**
 * Light or dark, as it stands right now — the same answer the boot script
 * writes onto the root, including when the setting is "system" and the machine
 * flips at sunset. The preview needs it as a value rather than as CSS, because
 * what it is styling lives in a frame the app's stylesheet cannot reach.
 */
export function useResolvedTheme(): "light" | "dark" {
  const setting = useSettings((s) => s.theme);
  /* Read from the root, which the boot script stamped before first paint —
     not defaulted to light and corrected in an effect. That correction was a
     second value, and a second value here is a second srcDoc: every web
     preview loaded twice, ran its scripts twice, and put two of every console
     line in the drawer. Nothing about it looked wrong, which is why it took a
     frame-lifecycle trace to see. */
  const [theme, setTheme] = React.useState<"light" | "dark">(() =>
    typeof document !== "undefined" && document.documentElement.dataset.theme === "dark"
      ? "dark"
      : "light",
  );
  React.useEffect(() => {
    if (setting !== "system") {
      setTheme(setting === "dark" ? "dark" : "light");
      return;
    }
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => setTheme(mq.matches ? "dark" : "light");
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [setting]);
  return theme;
}
