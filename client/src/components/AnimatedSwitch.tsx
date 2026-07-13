/**
 * AnimatedSwitch — App-wide slide page transitions
 *
 * Wraps wouter's Switch to add Instagram-style slide-in/slide-out
 * animations on every route change.
 *
 * - Enter: slides in from right (x: 60 → 0)
 * - Exit: slides out to right (x: 0 → 60)
 * - Uses framer-motion AnimatePresence for mount/unmount coordination
 *
 * @version 1.0.0
 */

import { useLocation } from "wouter";
import { AnimatePresence, motion } from "framer-motion";
import React from "react";

const PAGE_VARIANTS = {
  initial: {
    x: 60,
    opacity: 0,
  },
  animate: {
    x: 0,
    opacity: 1,
  },
  exit: {
    x: 60,
    opacity: 0,
  },
};

const PAGE_TRANSITION = {
  type: "spring" as const,
  stiffness: 400,
  damping: 35,
  mass: 0.8,
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
