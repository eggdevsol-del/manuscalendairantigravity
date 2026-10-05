export type GuideBounds = {
  top: number;
  left: number;
  right: number;
  bottom: number;
};
export type GuideRect = {
  top: number;
  left: number;
  width: number;
  height: number;
};
/** Fit beside the target when possible, otherwise use the largest clear space. */
export function placeGuide(
  target: GuideRect | null,
  bounds: GuideBounds,
  size: { width: number; height: number },
  preferred = "bottom"
) {
  const width = Math.max(0, Math.min(size.width, bounds.right - bounds.left));
  const available = Math.max(0, bounds.bottom - bounds.top);
  const height = Math.min(size.height, available);
  const clamp = (v: number, min: number, max: number) =>
    Math.max(min, Math.min(v, Math.max(min, max)));
  const gap = 14;
  if (!target)
    return { left: bounds.left, top: bounds.top, width, maxHeight: available };
  const center = target.left + target.width / 2 - width / 2;
  const candidates = [
    {
      side: "bottom",
      left: center,
      top: target.top + target.height + gap,
      space: bounds.bottom - target.top - target.height - gap,
    },
    {
      side: "top",
      left: center,
      top: target.top - height - gap,
      space: target.top - gap - bounds.top,
    },
    {
      side: "right",
      left: target.left + target.width + gap,
      top: target.top,
      space: available,
    },
    {
      side: "left",
      left: target.left - width - gap,
      top: target.top,
      space: available,
    },
  ].filter(
    c =>
      c.side === "top" ||
      c.side === "bottom" ||
      (c.left >= bounds.left && c.left + width <= bounds.right)
  );
  const fits = candidates.filter(c => c.space >= height);
  const pick =
    fits.find(c => c.side === preferred) ||
    fits[0] ||
    candidates.sort((a, b) => b.space - a.space)[0];
  const maxHeight = Math.min(available, Math.max(0, pick.space));
  // Very large targets can occupy the whole screen: retain a usable, bounded bubble.
  const limit = maxHeight >= Math.min(80, available) ? maxHeight : available;
  const shownHeight = Math.min(height, limit);
  const top = pick.side === "top" ? target.top - shownHeight - gap : pick.top;
  return {
    left: clamp(pick.left, bounds.left, bounds.right - width),
    top: clamp(top, bounds.top, bounds.bottom - shownHeight),
    width,
    maxHeight: limit,
  };
}
export function guideViewportBounds(
  owner: HTMLElement | null = null
): GuideBounds {
  const view = window.visualViewport;
  const style = getComputedStyle(document.documentElement);
  const safe = (name: string) =>
    Math.max(12, parseFloat(style.getPropertyValue(name)) || 0);
  let left = (view?.offsetLeft || 0) + safe("--app-safe-left");
  let top = (view?.offsetTop || 0) + safe("--app-safe-top");
  let right =
    (view?.offsetLeft || 0) +
    (view?.width ?? window.innerWidth) -
    safe("--app-safe-right");
  let bottom =
    (view?.offsetTop || 0) +
    (view?.height ?? window.innerHeight) -
    safe("--app-safe-bottom");
  const nav = document.getElementById("bottom-nav")?.getBoundingClientRect();
  if (!owner && nav && nav.top > top && nav.top < bottom) bottom = nav.top - 12;
  if (owner) {
    const r = owner.getBoundingClientRect();
    left = Math.max(left, r.left + 12);
    top = Math.max(top, r.top + 12);
    right = Math.min(right, r.right - 12);
    bottom = Math.min(bottom, r.bottom - 12);
  }
  return {
    left,
    top,
    right: Math.max(left, right),
    bottom: Math.max(top, bottom),
  };
}
