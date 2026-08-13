import { useMemo } from "react";
import { useRegisterFABActions } from "@/contexts/BottomNavContext";
import { Plus } from "lucide-react";
import { type FABMenuItem } from "@/ui/FABMenu";

interface DashboardFABActionsProps {
  activeCategory: "business" | "clients" | "suppliers";
  onShowChallenge: () => void;
}

/**
 * DashboardFABActions — Global FAB actions for the Dashboard page.
 *
 * Task-specific actions (Email, SMS, Mark Done, Go to Messages) are now
 * rendered inline inside the expandable TaskCard, not in the FAB.
 */
export function DashboardFABActions({
  activeCategory,
  onShowChallenge,
}: DashboardFABActionsProps) {
  const fabContent = useMemo<FABMenuItem[]>(() => {
    const items: FABMenuItem[] = [];

    // FAB items are now minimal — task actions are inline in cards

    return items;
  }, [activeCategory, onShowChallenge]);

  useRegisterFABActions("dashboard", fabContent);

  return null;
}

