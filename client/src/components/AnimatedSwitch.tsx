import { useLocation } from "wouter";
import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

/** Mount one route at a time: exiting routers otherwise resolve the new route too. */
export function AnimatedSwitch({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const reducedMotion = useReducedMotion();
  return (
    <motion.div
      key={location}
      initial={reducedMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.12 }}
      style={{ width: "100%", minHeight: "100dvh" }}
    >
      {children}
    </motion.div>
  );
}
