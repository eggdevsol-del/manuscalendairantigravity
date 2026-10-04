import { createContext, useContext } from "react";
export const PracticeContext = createContext<{
  exit: () => void;
  startGuide?: (chapterId: string) => void;
  simulate: (action: string) => void | Promise<void>;
  cart?: Record<number, number>;
  saveCart?: (quantities: Record<number, number>) => void;
} | null>(null);
export const usePractice = () => useContext(PracticeContext);
