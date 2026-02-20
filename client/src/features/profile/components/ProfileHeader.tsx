import { Avatar, AvatarFallback, AvatarImage, Badge } from "@/components/ui";
import { MapPin, Camera } from "lucide-react";

interface ProfileHeaderProps {
    user: any;
    trustBadges: { id: string; label: string; type: 'gold' | 'platinum' }[];
    isEditMode: boolean;
    onEditAvatar: () => void;
}

export function ProfileHeader({ user, trustBadges, isEditMode, onEditAvatar }: ProfileHeaderProps) {
    if (!user) return null;

    return (
        <div className="flex flex-col items-center pt-8 pb-6 px-4 text-center">
            <div className="relative mb-4 group cursor-pointer" onClick={isEditMode ? onEditAvatar : undefined}>
                <Avatar className="w-24 h-24 border-4 border-white/5 shadow-xl transition-transform active:scale-95">
                    <AvatarImage src={user.avatar} className="object-cover" />
                    <AvatarFallback className="text-2xl bg-primary/20 text-primary font-bold">
                        {user.name?.charAt(0) || 'C'}
                    </AvatarFallback>
                </Avatar>

                {/* Edit Overlay */}
                {isEditMode && (
                    <div className="absolute inset-0 bg-black/60 rounded-full flex items-center justify-center opacity-0 animate-in fade-in zoom-in duration-200 opacity-100">
                        <Camera className="w-8 h-8 text-white" />
                    </div>
                )}
            </div>

            <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70 mb-1">
                {user.name}
            </h1>

            {user.instagramUsername && (
                <p className="text-sm text-muted-foreground mb-2 font-medium">@{user.instagramUsername}</p>
            )}

            {/* Trust Badges - Row */}
            {trustBadges && trustBadges.length > 0 && (
                <div className="flex flex-wrap justify-center gap-2 mb-3">
                    {trustBadges.map(badge => (
                        <Badge
                            key={badge.id}
                            variant="secondary"
                            className={`
                                text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 border
                                ${badge.type === 'gold' ? 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-500 border-yellow-600/20 dark:border-yellow-500/20' : ''}
                                ${badge.type === 'platinum' ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-600/20 dark:border-purple-500/20' : ''}
                            `}
                        >
                            {badge.label}
                        </Badge>
                    ))}
                </div>
            )}

            {/* Bio */}
            {user.bio && (
                <p className="text-sm text-muted-foreground/80 max-w-[280px] leading-relaxed line-clamp-3">
                    {user.bio}
                </p>
            )}

            {/* Location (Mock/Future) */}
            <div className="flex items-center gap-1 mt-3 text-xs text-muted-foreground/60">
                <MapPin className="w-3 h-3" />
                <span>Melbourne, AU</span>
            </div>
        </div>
    );
}
