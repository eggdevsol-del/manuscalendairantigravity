import { createContext, useContext, type ReactNode } from "react";
import type { ArtistSetupStep } from "@shared/artistSetup";
export const ArtistSetupContext = createContext<{
  step: ArtistSetupStep;
  onSaved: () => Promise<void>;
  progress?: ReactNode;
} | null>(null);
export const useArtistSetup = () => useContext(ArtistSetupContext);
