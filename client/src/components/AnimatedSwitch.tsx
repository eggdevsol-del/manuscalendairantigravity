/**
 * AnimatedSwitch — App-wide slide page transitions
 *
 * Instagram-style: new page slides in from right edge,
 * exiting page slides out to right edge. No fade.
 * Snap-stop easing: linear for 96%, deceleration in last 4%.
 *
 * @version 3.0.0
 */

import { useLocation } from "wouter";
import { AnimatePresence, motion } from "framer-motion";
import React from "react";

const PAGE_VARIANTS = {
  initial: {
    x: "100%",
  },
  animate: {
    x: 0,
  },
  exit: {
    x: "100%",
  },
};

const PAGE_TRANSITION = {
  type: "tween" as const,
  duration: 0.25,
  ease: [0.12, 0, 0.04, 1] as [number, number, number, number],
};

interface AnimatedSwitchProps {
  children: React.ReactNode;
}

export function AnimatedSwitch({ children }: AnimatedSwitchProps) {
  const [location] = useLocation();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location}
        variants={PAGE_VARIANTS}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={PAGE_TRANSITION}
        style={{
          position: "relative",
          width: "100%",
          minHeight: "100%",
        }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
