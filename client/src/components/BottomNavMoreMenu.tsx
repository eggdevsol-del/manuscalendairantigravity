
import { useRef, useEffect } from "react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { BottomNavButton } from "@/_core/bottomNav/types";
import { useTotalUnreadCount } from "@/lib/selectors/conversation.selectors";
import { Lock } from "lucide-react";

interface BottomNavMoreMenuProps {
    isOpen: boolean;
    onClose: () => void;
    items: BottomNavButton[];
    isActive: (path?: string) => boolean;
    isTeaserClient?: boolean;
}

export function BottomNavMoreMenu({ isOpen, onClose, items, isActive, isTeaserClient }: BottomNavMoreMenuProps) {
    const totalUnreadCount = useTotalUnreadCount();
    const menuRef = useRef<HTMLDivElement>(null);

    // Click outside to close
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        }

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div
            ref={menuRef}
            className={cn(
                "absolute bottom-[85px] right-2 z-50 flex flex-col overflow-hidden",
                "w-48 max-w-[50vw]", // Max 50% width constraint
                "bg-background/95 backdrop-blur-3xl border border-white/10 shadow-2xl rounded-2xl",
                "animate-in fade-in slide-in-from-bottom-4 duration-200"
            )}
        >
            <div className="flex flex-col p-1.5 space-y-0.5">
                {items.map((item) => {
                    const active = isActive(item.path);
                    const unreadCount = item.id === "messages" ? totalUnreadCount : (item.badgeCount || 0);

                    const ItemContent = (
                        <div className={cn(
                            "flex items-center gap-3 px-3 py-3 rounded-xl transition-colors select-none",
                            active
                                ? "bg-primary/10 text-primary font-semibold"
                                : "text-foreground hover:bg-muted/50 hover:text-foreground font-medium"
                        )}>
                            <div className="relative">
                                <item.icon
                                    className={cn(
                                        "w-5 h-5",
                                        active ? "text-primary" : "text-muted-foreground"
                                    )}
                                    strokeWidth={active ? 2.5 : 2}
                                />

                                {/* Teaser Lock */}
                                {isTeaserClient && item.id === 'profile' && (
                                    <div className="absolute -top-1 -right-1 bg-background rounded-full p-0.5 shadow-sm border border-border">
                                        <Lock className="w-2.5 h-2.5 text-muted-foreground" />
                                    </div>
                                )}

                                {/* Notification Badge */}
                                {unreadCount > 0 && (
                                    <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white shadow-sm ring-1 ring-background">
                                        {unreadCount > 9 ? "!" : unreadCount}
                                    </span>
                                )}
                            </div>

                            <span className="text-sm tracking-wide truncate">
                                {item.label}
                            </span>
                        </div>
                    );

                    if (item.path) {
                        return (
                            <Link
                                key={item.id}
                                href={item.path}
                                className="block"
                                onClick={() => onClose()}
                            >
                                {ItemContent}
                            </Link>
                        );
                    }

                    return (
                        <button
                            key={item.id}
                            onClick={() => {
                                item.action?.();
                                onClose();
                            }}
                            className="text-left w-full"
                        >
                            {ItemContent}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
