import React from "react";
import { TaskCard, TaskCardProps } from "@/components/ui/ssot/TaskCard";
import { motion, AnimatePresence } from "framer-motion";

export interface ExpandableTaskCardProps extends TaskCardProps {
  children: React.ReactNode;
  isExpanded: boolean;
  onToggle: () => void;
}

export function ExpandableTaskCard({
  children,
  isExpanded,
  onToggle,
  ...taskCardProps
}: ExpandableTaskCardProps) {
  return (
    <div className="flex flex-col mb-4 bg-secondary/20 rounded-[20px] p-2">
      <TaskCard {...taskCardProps} onClick={onToggle} />
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-2 pb-2">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
