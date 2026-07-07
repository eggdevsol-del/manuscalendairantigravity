/**
 * FloatingProfileIcon.tsx
 * Floating avatar button in the top-right of the client home page.
 * Tapping navigates to /settings?section=profile.
 */
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";

export function FloatingProfileIcon() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  if (!user) return null;

  const initial  = (user.name || user.email || "?").charAt(0).toUpperCase();
  const avatarUrl = user.avatar || null;

  const handleTap = () => {
    setLocation("/settings?section=profile");
  };

  return (
    <button
      onClick={handleTap}
      className="fixed top-[max(16px,env(safe-area-inset-top))] right-4 z-40 w-10 h-10 rounded-full overflow-hidden border-2 border-border shadow-lg bg-secondary/80 backdrop-blur-sm transition-transform active:scale-95"
      aria-label="Open profile settings"
    >
      {avatarUrl ? (
        <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary to-accent">
          <span className="text-white font-bold text-sm">{initial}</span>
        </div>
      )}
    </button>
  );
}
