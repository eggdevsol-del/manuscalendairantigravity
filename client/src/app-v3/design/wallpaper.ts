/** iOS Modern wallpapers: the same design in several colourways. The choice is per device. */
export type WallpaperId =
  | "violet"
  | "ocean"
  | "sunset"
  | "forest"
  | "graphite"
  | "rose"
  | "dawn";

export interface Wallpaper {
  id: WallpaperId;
  name: string;
  /** Preview gradient, matching the --wall token in ios-modern.css. */
  background: string;
  accent: string;
}

export const WALLPAPERS: Wallpaper[] = [
  {
    id: "violet",
    name: "Midnight",
    background:
      "linear-gradient(170deg,#1b1840,#2e2766 38%,#4b3592 72%,#7a4cad)",
    accent: "#ff6a5c",
  },
  {
    id: "ocean",
    name: "Ocean",
    background:
      "linear-gradient(170deg,#071a33,#0b3157 40%,#10577a 75%,#1b8a9a)",
    accent: "#ffb340",
  },
  {
    id: "sunset",
    name: "Sunset",
    background:
      "linear-gradient(170deg,#2a1033,#6b1f4f 40%,#c2455a 75%,#f08a5d)",
    accent: "#ffd166",
  },
  {
    id: "forest",
    name: "Forest",
    background:
      "linear-gradient(170deg,#0c1f17,#173a2b 40%,#2b5e45 75%,#5c8f6a)",
    accent: "#f2c14e",
  },
  {
    id: "graphite",
    name: "Graphite",
    background:
      "linear-gradient(170deg,#121417,#262a31 40%,#3e4550 75%,#66707e)",
    accent: "#0a84ff",
  },
  {
    id: "rose",
    name: "Rosé",
    background:
      "linear-gradient(170deg,#2b0f1e,#5c1a3a 40%,#a03a63 75%,#e07a9a)",
    accent: "#ffffff",
  },
  {
    id: "dawn",
    name: "Dawn",
    background:
      "linear-gradient(170deg,#3b3a7a,#7a6cc2 40%,#d89bc4 75%,#ffc39a)",
    accent: "#ff5e7e",
  },
];

const KEY = "tattoi-wallpaper";
const EVENT = "tattoi-wallpaper";

export function getWallpaper(): WallpaperId {
  try {
    const v = localStorage.getItem(KEY) as WallpaperId | null;
    if (v && WALLPAPERS.some(w => w.id === v)) return v;
  } catch {}
  return "violet";
}

export function applyWallpaper(id: WallpaperId = getWallpaper()) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.wall = id;
}

export function setWallpaper(id: WallpaperId) {
  try {
    localStorage.setItem(KEY, id);
  } catch {}
  applyWallpaper(id);
  window.dispatchEvent(new CustomEvent(EVENT, { detail: id }));
}

export function onWallpaperChange(fn: (id: WallpaperId) => void) {
  const h = (e: Event) => fn((e as CustomEvent<WallpaperId>).detail);
  window.addEventListener(EVENT, h);
  return () => window.removeEventListener(EVENT, h);
}
