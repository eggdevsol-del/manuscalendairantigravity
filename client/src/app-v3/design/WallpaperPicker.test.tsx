import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { WallpaperPicker } from "./WallpaperPicker";
import { getWallpaper } from "./wallpaper";

describe("WallpaperPicker", () => {
  beforeEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset.wall;
  });

  it("defaults to Midnight", () => {
    render(<WallpaperPicker />);
    expect(screen.getByRole("radio", { name: /Midnight/ })).toHaveAttribute(
      "aria-checked",
      "true"
    );
  });

  it("re-themes the app and remembers the choice", () => {
    render(<WallpaperPicker />);
    fireEvent.click(screen.getByRole("radio", { name: /Ocean/ }));
    expect(document.documentElement.dataset.wall).toBe("ocean");
    expect(getWallpaper()).toBe("ocean");
    expect(screen.getByRole("radio", { name: /Ocean/ })).toHaveAttribute(
      "aria-checked",
      "true"
    );
  });
});
