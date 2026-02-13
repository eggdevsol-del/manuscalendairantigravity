
import {
    Plus,
    Send,
    Calendar as CalendarIcon,
    Settings,
    Grid,
    GalleryVertical,
    CreditCard
} from "lucide-react";
import { FABMenu, type FABMenuItem } from "@/ui/FABMenu";

interface PromotionBurgerMenuProps {
    viewMode: 'swipe' | 'grid';
    onViewModeChange: (mode: 'swipe' | 'grid') => void;
    onAction: (action: 'create' | 'send' | 'auto-apply' | 'settings') => void;
    className?: string;
}

export function PromotionBurgerMenu({
    viewMode,
    onViewModeChange,
    onAction,
    className
}: PromotionBurgerMenuProps) {

    const items: FABMenuItem[] = [
        {
            id: 'switch-view',
            label: 'Switch View',
            icon: viewMode === 'swipe' ? Grid : GalleryVertical,
            onClick: () => onViewModeChange(viewMode === 'swipe' ? 'grid' : 'swipe'),
        },
        {
            id: 'create',
            label: 'New Promotion',
            icon: Plus,
            onClick: () => onAction('create'),
            highlight: true,
        },
        {
            id: 'send',
            label: 'Send to Client',
            icon: Send,
            onClick: () => onAction('send'),
        },
        {
            id: 'auto-apply',
            label: 'Auto-Apply',
            icon: CalendarIcon,
            onClick: () => onAction('auto-apply'),
        },
        {
            id: 'settings',
            label: 'Voucher Settings',
            icon: Settings,
            onClick: () => onAction('settings'),
        },
    ];

    return (
        <FABMenu
            items={items}
            toggleIcon={<CreditCard className="h-6 w-6" />}
            className={className}
        />
    );
}
