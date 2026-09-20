import { useEffect, useState } from "react";

/** Resolve semantic CSS colours for provider-hosted UI that cannot inherit CSS variables. */
export function readIvoryPalette() {
  const style = getComputedStyle(document.documentElement);
  const read = (name: string) => style.getPropertyValue(name).trim();
  return {
    primary: read("--primary"),
    surface: read("--card"),
    foreground: read("--foreground"),
    muted: read("--muted-foreground"),
    danger: read("--destructive"),
    border: read("--border"),
    ring: read("--ring"),
    font: read("--ivory-body"),
  };
}

export function useIvoryPalette() {
  const [palette, setPalette] = useState(readIvoryPalette);
  useEffect(() => {
    const update = () => setPalette(readIvoryPalette());
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);
  return palette;
}
