import { Avatar, AvatarFallback, AvatarImage, Badge } from "@/components/ui";
import { MapPin, Camera } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface ProfileHeaderProps {
  user: any;
  trustBadges: { id: string; label: string; type: "gold" | "platinum" }[];
  isEditMode: boolean;
  onEditAvatar: () => void;
  isCompact?: boolean;
}

export function ProfileHeader({
  user,
  trustBadges,
  isEditMode,
  onEditAvatar,
  isCompact,
}: ProfileHeaderProps) {
  if (!user) return null;

  return (
    <motion.div 
      layout
      className={`flex ${isCompact ? "flex-row items-center gap-4 px-6 pt-6 pb-2 text-left" : "flex-col items-center pt-8 pb-6 px-4 text-center"}`}
    >
      <motion.div
        layout
        className={`relative group ${isCompact ? "w-12 h-12 shrink-0" : "w-24 h-24 mb-4 cursor-pointer"}`}
        onClick={isEditMode && !isCompact ? onEditAvatar : undefined}
      >
        <Avatar className="w-full h-full border-4 border-white/5 shadow-xl transition-transform active:scale-95">
          <AvatarImage src={user.avatar} className="object-cover" />
          <AvatarFallback className="text-2xl bg-primary/20 text-primary font-bold">
            {user.name?.charAt(0) || "C"}
          </AvatarFallback>
        </Avatar>

        {/* Edit Overlay */}
        {isEditMode && !isCompact && (
          <div className="absolute inset-0 bg-black/60 rounded-full flex items-center justify-center opacity-0 animate-in fade-in zoom-in duration-200 opacity-100">
            <Camera className="w-8 h-8 text-white" />
          </div>
        )}
      </motion.div>

      <motion.div layout className={`flex flex-col min-w-0 ${isCompact ? "flex-1" : "items-center w-full"}`}>
        <motion.h1 
          layout 
          className={`font-bold bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70 ${isCompact ? "text-xl truncate" : "text-2xl mb-1"}`}
        >
          {user.name}
        </motion.h1>

        {/* Location (always visible, moved up when compact) */}
        {user.city && (
          <motion.div layout className={`flex items-center gap-1 text-xs text-muted-foreground/60 ${isCompact ? "mt-0.5" : "mt-3"}`}>
            <MapPin className="w-3 h-3" />
            <span className="truncate">{user.city}</span>
          </motion.div>
        )}
      </motion.div>

      <AnimatePresence>
        {!isCompact && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }} 
            animate={{ opacity: 1, height: "auto" }} 
            exit={{ opacity: 0, height: 0 }}
            className="flex flex-col items-center overflow-hidden w-full"
          >
            {user.instagramUsername && (
              <p className="text-sm text-muted-foreground mb-2 font-medium mt-1">
                @{user.instagramUsername}
              </p>
            )}

            {/* Trust Badges - Row */}
            {trustBadges && trustBadges.length > 0 && (
              <div className="flex flex-wrap justify-center gap-2 mb-3 mt-1">
                {trustBadges.map(badge => (
                  <Badge
                    key={badge.id}
                    variant="secondary"
                    className={`
                                      text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 border
                                      ${badge.type === "gold" ? "bg-yellow-500/10 text-yellow-600 dark:text-yellow-500 border-yellow-600/20 dark:border-yellow-500/20" : ""}
                                      ${badge.type === "platinum" ? "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-600/20 dark:border-purple-500/20" : ""}
                                  `}
                  >
                    {badge.label}
                  </Badge>
                ))}
              </div>
            )}

            {/* Bio */}
            {user.bio && (
              <p className="text-sm text-muted-foreground/80 max-w-[280px] leading-relaxed line-clamp-3 mt-1">
                {user.bio}
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
