import { useLayoutEffect, useState, type RefObject } from "react";
import { guideViewportBounds, placeGuide } from "./guidePlacement";
/** Track the visible viewport, target and measured text box, including moving sheets. */
export function useGuidePlacement(
  target: HTMLElement | null,
  bubble: RefObject<HTMLElement | null>,
  maximumWidth = 340
) {
  const [placement, setPlacement] = useState(() =>
    placeGuide(null, guideViewportBounds(), {
      width: maximumWidth,
      height: 180,
    })
  );
  useLayoutEffect(() => {
    const measure = () => {
      const bounds = guideViewportBounds();
      const el = bubble.current;
      const width = Math.min(maximumWidth, bounds.right - bounds.left);
      // Measure at the final width so wrapping is accounted for before positioning.
      if (el && el.style.width !== `${Math.max(0, width)}px`)
        el.style.width = `${Math.max(0, width)}px`;
      const next = placeGuide(target?.getBoundingClientRect() ?? null, bounds, {
        width,
        height: el ? el.scrollHeight + el.offsetHeight - el.clientHeight : 180,
      });
      setPlacement(prev =>
        Object.keys(next).every(
          key =>
            prev[key as keyof typeof prev] === next[key as keyof typeof next]
        )
          ? prev
          : next
      );
    };
    measure();
    const observer =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(measure)
        : null;
    if (target) observer?.observe(target);
    if (bubble.current) observer?.observe(bubble.current);
    let frame = 0;
    const follow = () => {
      measure();
      frame = requestAnimationFrame(follow);
    };
    frame = requestAnimationFrame(follow);
    window.addEventListener("resize", measure);
    document.addEventListener("scroll", measure, true);
    window.visualViewport?.addEventListener("resize", measure);
    window.visualViewport?.addEventListener("scroll", measure);
    return () => {
      observer?.disconnect();
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", measure);
      document.removeEventListener("scroll", measure, true);
      window.visualViewport?.removeEventListener("resize", measure);
      window.visualViewport?.removeEventListener("scroll", measure);
    };
  }, [target, bubble, maximumWidth]);
  return placement;
}
