
import {
    Plus,
    Send,
    Calendar as CalendarIcon,
    Settings,
    Grid,
    GalleryVertical,
    CreditCard
} from "lucide-react";
import { useState } from "react";
import { FABMenu, type FABMenuItem } from "@/ui/FABMenu";
import { PromotionWizardContent, WizardStep } from "./PromotionWizardContent";
import { cn } from "@/lib/utils";

interface PromotionBurgerMenuProps {
    viewMode: 'swipe' | 'grid';
    onViewModeChange: (mode: 'swipe' | 'grid') => void;
    onAction: (action: 'create' | 'send' | 'auto-apply' | 'settings') => void;
    isOpen?: boolean;
    onOpenChange?: (open: boolean) => void;
    className?: string;
}

export function PromotionBurgerMenu({
    viewMode,
    onViewModeChange,
    onAction,
    isOpen,
    onOpenChange,
    className
}: PromotionBurgerMenuProps) {
    const [isCreating, setIsCreating] = useState(false);
    const [currentStep, setCurrentStep] = useState<WizardStep>('type');

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
            onClick: () => setIsCreating(true),
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

    // Close handler for wizard
    const handleClose = () => {
        setIsCreating(false);
        if (onOpenChange) onOpenChange(false);
    };


    if (isCreating) {
        return (
            <FABMenu
                toggleIcon={<CreditCard className="h-6 w-6" />}
                isOpen={isOpen}
                onOpenChange={(open) => {
                    if (!open) setIsCreating(false);
                    if (onOpenChange) onOpenChange(open);
                }}
                className={className}
            >
                <div className="w-full">
                    <PromotionWizardContent
                        onClose={handleClose}
                        onStepChange={setCurrentStep}
                    />
                </div>
            </FABMenu>
        );
    }

    return (
        <FABMenu
            items={items}
            toggleIcon={<CreditCard className="h-6 w-6" />}
            isOpen={isOpen}
            onOpenChange={onOpenChange}
            className={className}
        />
    );
}
