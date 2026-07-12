import { useMemo } from "react";
import { useRegisterFABActions } from "@/contexts/BottomNavContext";
import { Plus } from "lucide-react";
import { type FABMenuItem } from "@/ui/FABMenu";

interface DashboardFABActionsProps {
  activeCategory: "business" | "social" | "personal";
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

    // New challenge for personal
    if (activeCategory === "personal") {
      items.push({
        id: "new-challenge",
        label: "New Challenge",
        icon: Plus,
        onClick: onShowChallenge,
        highlight: true,
      });
    }

    return items;
  }, [activeCategory, onShowChallenge]);

  useRegisterFABActions("dashboard", fabContent);

  return null;
}

