import { useBottomNav } from "@/contexts/BottomNavContext";
import { SheetShell } from "@/components/ui/overlays/sheet-shell";
import { Button } from "@/components/ui";
/** One portalled, keyboard-accessible host for registered booking actions. */
export function ActionPanel() {
  const { fabActions, fabChildren, isFABOpen, setFABOpen } = useBottomNav();
  if (!fabChildren && !fabActions.length) return null;
  return (
    <SheetShell
      isOpen={isFABOpen}
      onClose={() => setFABOpen(false)}
      title="Booking"
      overlayId="workspace.booking-actions"
    >
      {fabChildren || (
        <div className="space-y-3">
          {fabActions.map(action => (
            <Button
              key={action.id}
              className="w-full"
              variant="outline"
              onClick={() => {
                action.onClick?.();
                if (action.closeOnClick !== false) setFABOpen(false);
              }}
            >
              {action.label}
            </Button>
          ))}
        </div>
      )}
    </SheetShell>
  );
}
