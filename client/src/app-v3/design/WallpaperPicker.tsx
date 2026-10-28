import { useEffect, useState } from "react";
import {
  WALLPAPERS,
  getWallpaper,
  onWallpaperChange,
  setWallpaper,
  type WallpaperId,
} from "./wallpaper";

/** Live display: each wallpaper is shown as a tiny lock screen. Tapping one re-themes the app at once. */
export function WallpaperPicker() {
  const [current, setCurrent] = useState<WallpaperId>(getWallpaper);
  useEffect(() => onWallpaperChange(setCurrent), []);
  const active = WALLPAPERS.find(w => w.id === current) ?? WALLPAPERS[0];
  return (
    <div className="iosm-walls">
      <p className="iosm-walls-now">
        <small>Wallpaper</small>
        <b>{active.name}</b>
      </p>
      <div className="iosm-walls-grid" role="radiogroup" aria-label="Wallpaper">
        {WALLPAPERS.map(w => (
          <button
            key={w.id}
            type="button"
            role="radio"
            aria-checked={current === w.id}
            className="iosm-wall"
            onClick={() => setWallpaper(w.id)}
          >
            <span
              className="iosm-wall-phone"
              style={{ background: w.background, ["--a" as string]: w.accent }}
            >
              <b>9:41</b>
              <small>Wednesday</small>
              <i />
              <i />
              <i />
            </span>
            <span>{w.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
