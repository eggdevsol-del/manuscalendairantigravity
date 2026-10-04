import { createContext, useContext } from "react";
import type { ArtistSetupStep } from "@shared/artistSetup";
export const ArtistSetupContext = createContext<{
  step: ArtistSetupStep;
  onSaved: () => Promise<void>;
} | null>(null);
export const useArtistSetup = () => useContext(ArtistSetupContext);
