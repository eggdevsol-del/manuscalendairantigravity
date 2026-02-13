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

import { useState, ReactNode } from "react";
import { X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { tokens } from "@/ui/tokens";

export interface FABMenuItem {
    id: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    onClick: () => void;
    /** If true, uses the primary/highlight button style */
    highlight?: boolean;
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
    /** Optional panel class overrides (width, max-height, etc.) */
    panelClassName?: string;
    items?: never;
}

type FABMenuProps = FABMenuItemsProps | FABMenuChildrenProps;

export function FABMenu(props: FABMenuProps) {
    const [internalOpen, setInternalOpen] = useState(false);

    const isOpen = props.isOpen ?? internalOpen;
    const setIsOpen = props.onOpenChange ?? setInternalOpen;

    const toggle = () => setIsOpen(!isOpen);

    const fab = tokens.fab;

    return (
        <div className={cn(fab.container, props.className)}>
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial="hidden"
                        animate="visible"
                        exit="hidden"
                        variants={fab.animation.panel}
                        className={cn(
                            fab.panel,
                            'items' in props && props.items ? "" : (props as FABMenuChildrenProps).panelClassName
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
                                            setIsOpen(false);
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
