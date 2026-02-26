import { LucideIcon } from "lucide-react";
import { ReactNode } from "react";

export interface BottomNavButton {
  id: string;
  label: string;
  icon: LucideIcon;
  path?: string; // If it's a link
  action?: () => void; // If it's a button
  badgeCount?: number; // For notifications
}

export interface BottomNavRow {
  id: string;
  items: BottomNavButton[];
  // Alternatively, for maximum flexibility in custom rows (like slider inputs), we might allow a custom render.
  // However, the "Frozen API" request implies strict data structure usually.
  // User asked for "BottomNavButton (label, icon...)", "BottomNavPage", "BottomNavRow".
  // For now, let's define the strict data shape, but allow the context to handle the ReactNode rendering.
  // Actually, the request says "Ensure all BottomNav action sets are created... ONLY through the registry".
  // If we want to freeze the *rendering* to be consistent, we should render from Data, not generic ReactNode.
  // BUT, the current implementation passes `<QuickActionsRow />` which is a component.
  // Refactoring `Chat` to pass a list of *data objects* and having `BottomNav` render them would be a big refactor (changing `QuickActionsRow` from a component to a data definition).
  // The user said "Avoid refactors unless required for enforcing the contract."
  // Maybe the "contract" is that you register a *Row Component* or *Row Data*?
  // "BottomNavPage (id, buttons[])" suggests data-driven.
  // Let's support BOTH or stick to Data if mandated.
  // "BottomNavButton (label, icon...)"
  // Let's define the types for the Main Nav first as Data.
  // And for Contextual rows, if they are simple buttons, use Data. If complex, maybe strict container?
  // Let's define the types primarily.
}

export type BottomNavRegistry = Record<string, ReactNode>;
// Note: Currently the context stores ReactNode. Changing this to strict data structure would break existing `QuickActionsRow` unless we refactor it.
// Given "Avoid refactors", I will keep generic ReactNode capabilities for the *Contextual* slot but ENFORCE Data Structure for the *Main* slot via `defaultNav`.
