/**
 * AnimatedSwitch — iOS push/pop navigation transitions
 *
 * - Forward (going deeper): new page slides in from right ON TOP, old page stays still.
 * - Back (going shallower): old page slides out to right, page beneath is revealed.
 * - Only ONE page animates at a time.
 *
 * @version 4.0.0
 */

import { useLocation } from "wouter";
import { AnimatePresence, motion } from "framer-motion";
import React, { useRef } from "react";

/** Route depths — bottom-nav tabs are 0, sub-pages are 1+ */
const ROOT_ROUTES = new Set([
  "/dashboard", "/discover", "/profile", "/conversations",
  "/calendar", "/settings", "/merchant",
]);

function getDepth(path: string): number {
  if (ROOT_ROUTES.has(path)) return 0;
  // Check first segment for root routes
  const base = "/" + (path.split("/")[1] || "");
  if (ROOT_ROUTES.has(base)) return 0;
  return 1;
}

const TRANSITION = {
  type: "tween" as const,
  duration: 0.25,
  ease: [0.12, 0, 0.04, 1] as [number, number, number, number],
};

interface AnimatedSwitchProps {
  children: React.ReactNode;
}

export function AnimatedSwitch({ children }: AnimatedSwitchProps) {
  const [location] = useLocation();
  const prevLocation = useRef(location);
  const directionRef = useRef<"forward" | "back">("forward");

  // Compute direction on each render (before animation starts)
  if (prevLocation.current !== location) {
    const prevDepth = getDepth(prevLocation.current);
    const newDepth = getDepth(location);
    directionRef.current = newDepth > prevDepth ? "forward" : newDepth < prevDepth ? "back" : "forward";
    prevLocation.current = location;
  }

  const direction = directionRef.current;

  return (
    <div style={{ position: "relative", width: "100%", minHeight: "100%" }}>
      <AnimatePresence initial={false} custom={direction}>
        <motion.div
          key={location}
          custom={direction}
          variants={{
            initial: (dir: string) => ({
              x: dir === "forward" ? "100%" : 0,
              zIndex: dir === "forward" ? 2 : 1,
            }),
            animate: {
              x: 0,
              zIndex: 1,
            },
            exit: (dir: string) => ({
              x: dir === "back" ? "100%" : 0,
              zIndex: dir === "back" ? 2 : 1,
            }),
          }}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={TRANSITION}
          style={{
            position: "absolute",
            width: "100%",
            top: 0,
            left: 0,
          }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
