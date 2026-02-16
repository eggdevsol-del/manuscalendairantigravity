/**
 * FABMenu — SSOT Floating Action Button Menu Shell
 * 
 * All FAB menus in the app MUST use this component.
 * Visual tokens are sourced exclusively from `ui/tokens.ts → fab`.
 * 
 * Two rendering modes:
 * 1. `items` mode — simple list of labeled icon buttons (like Promotions)
 * 2. `children` mode — custom content rendered inside the panel (like Booking)
 */

import { useState, useMemo, ReactNode } from "react";
import { X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { tokens } from "@/ui/tokens";

/** Detect iPad (including iPadOS which reports as Macintosh) */
const getIsIPad = () =>
    typeof navigator !== 'undefined' &&
    (/iPad/.test(navigator.userAgent) ||
        (navigator.userAgent.includes('Macintosh') && 'ontouchend' in document));

export interface FABMenuItem {
    id: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    onClick: () => void;
    /** If true, uses the primary/highlight button style */
    highlight?: boolean;
    /** Whether to close the menu when this item is clicked. Defaults to true. */
    closeOnClick?: boolean;
}

interface FABMenuBaseProps {
    /** Icon or element to show on the toggle button when closed */
    toggleIcon: ReactNode;
    /** Override container class (for positioning tweaks) */
    className?: string;
    /** Controlled open state (optional — uncontrolled by default) */
    isOpen?: boolean;
    /** Controlled open setter (optional) */
    onOpenChange?: (open: boolean) => void;
}

interface FABMenuItemsProps extends FABMenuBaseProps {
    /** Simple list of menu items with icons */
    items: FABMenuItem[];
    children?: never;
}

interface FABMenuChildrenProps extends FABMenuBaseProps {
    /** Custom panel content (for complex flows like the Booking wizard) */
    children: ReactNode;
    items?: never;
}

type FABMenuProps = FABMenuItemsProps | FABMenuChildrenProps;

export function FABMenu(props: FABMenuProps) {
    const [internalOpen, setInternalOpen] = useState(false);

    const isOpen = props.isOpen ?? internalOpen;
    const setIsOpen = props.onOpenChange ?? setInternalOpen;

    const toggle = () => setIsOpen(!isOpen);

    const fab = tokens.fab;
    const isIPad = useMemo(() => getIsIPad(), []);

    return (
        <div className={cn(fab.container, props.className)}>
            {/* Backdrop — light overlay when open (GPU-accelerated for iOS) */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        key="fab-backdrop"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="fixed inset-0 z-[-1]"
                        style={{
                            backgroundColor: 'rgba(0,0,0,0.03)',
                            WebkitBackdropFilter: 'blur(2px)',
                            backdropFilter: 'blur(2px)',
                            transform: 'translateZ(0)',
                            willChange: 'opacity',
                        }}
                        onClick={toggle}
                    />
                )}
            </AnimatePresence>

            <AnimatePresence mode="wait">
                {isOpen && (
                    <motion.div
                        key="fab-panel"
                        initial="hidden"
                        animate="visible"
                        exit="hidden"
                        variants={fab.animation.panel}
                        className={cn(
                            fab.panel,
                            "overflow-y-auto max-h-[70vh]",
                            isIPad && "w-[440px] max-h-[60vh] p-6 gap-5"
                        )}
                    >
                        {'items' in props && props.items ? (
                            // Items mode — render labeled icon buttons
                            props.items.map((item) => (
                                <motion.div
                                    key={item.id}
                                    variants={fab.animation.item}
                                    className={fab.itemRow}
                                >
                                    <span className={fab.itemLabel}>{item.label}</span>
                                    <button
                                        className={cn(
                                            item.highlight ? fab.itemButtonHighlight : fab.itemButton
                                        )}
                                        onClick={() => {
                                            item.onClick();
                                            if (item.closeOnClick !== false) setIsOpen(false);
                                        }}
                                    >
                                        <item.icon className={fab.itemIconSize} />
                                    </button>
                                </motion.div>
                            ))
                        ) : (
                            // Children mode — render custom content
                            (props as FABMenuChildrenProps).children
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Main Toggle Button */}
            <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={toggle}
                className={cn(
                    fab.toggle,
                    isOpen ? fab.toggleOpen : fab.toggleClosed
                )}
            >
                <AnimatePresence mode="wait" initial={false}>
                    <motion.div
                        key={isOpen ? "close" : "open"}
                        initial={{ rotate: -90, opacity: 0 }}
                        animate={{ rotate: 0, opacity: 1 }}
                        exit={{ rotate: 90, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                    >
                        {isOpen ? (
                            <X className={fab.toggleIconSize} />
                        ) : (
                            props.toggleIcon
                        )}
                    </motion.div>
                </AnimatePresence>
            </motion.button>
        </div>
    );
}
