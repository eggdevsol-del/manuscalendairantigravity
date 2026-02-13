
import { useState } from "react";
import {
    Plus,
    Send,
    Calendar as CalendarIcon,
    Settings,
    Grid,
    GalleryVertical,
    X,
    CreditCard
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

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
    const [isOpen, setIsOpen] = useState(false);

    // Staggered animation for menu items
    const containerVariants = {
        hidden: { opacity: 0, scale: 0.8 },
        visible: {
            opacity: 1,
            scale: 1,
            transition: {
                delayChildren: 0.1,
                staggerChildren: 0.05
            }
        }
    };

    const itemVariants = {
        hidden: { y: 20, opacity: 0 },
        visible: { y: 0, opacity: 1 }
    };

    return (
        <div className={cn("fixed bottom-24 right-5 z-50 flex flex-col items-end gap-4", className)}>
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial="hidden"
                        animate="visible"
                        exit="hidden"
                        variants={containerVariants}
                        className="mb-4 p-4 rounded-[2rem] border border-white/10 shadow-2xl flex flex-col items-end gap-4 bg-gray-100/[0.85] dark:bg-slate-950/[0.85] backdrop-blur-[32px]"
                    >
                        {/* View Toggle */}
                        <motion.div variants={itemVariants} className="flex items-center justify-end gap-3 w-full">
                            <span className="text-xs font-medium text-muted-foreground">
                                Switch View
                            </span>
                            <Button
                                size="icon"
                                variant="secondary"
                                className={cn(
                                    "h-10 w-10 rounded-full shadow-lg border border-white/10",
                                    "bg-white/5 hover:bg-white/10"
                                )}
                                onClick={() => {
                                    onViewModeChange(viewMode === 'swipe' ? 'grid' : 'swipe');
                                    setIsOpen(false);
                                }}
                            >
                                {viewMode === 'swipe' ? <Grid className="h-4 w-4" /> : <GalleryVertical className="h-4 w-4" />}
                            </Button>
                        </motion.div>

                        {/* Create New */}
                        <motion.div variants={itemVariants} className="flex items-center justify-end gap-3 w-full">
                            <span className="text-xs font-medium text-muted-foreground">
                                New Promotion
                            </span>
                            <Button
                                size="icon"
                                variant="secondary"
                                className={cn(
                                    "h-10 w-10 rounded-full shadow-lg border border-white/10",
                                    "bg-primary text-primary-foreground hover:bg-primary/90"
                                )}
                                onClick={() => {
                                    onAction('create');
                                    setIsOpen(false);
                                }}
                            >
                                <Plus className="h-4 w-4" />
                            </Button>
                        </motion.div>

                        {/* Send to Client */}
                        <motion.div variants={itemVariants} className="flex items-center justify-end gap-3 w-full">
                            <span className="text-xs font-medium text-muted-foreground">
                                Send to Client
                            </span>
                            <Button
                                size="icon"
                                variant="secondary"
                                className="h-10 w-10 rounded-full shadow-lg border border-white/10 bg-white/5 hover:bg-white/10"
                                onClick={() => {
                                    onAction('send');
                                    setIsOpen(false);
                                }}
                            >
                                <Send className="h-4 w-4" />
                            </Button>
                        </motion.div>

                        {/* Auto Apply */}
                        <motion.div variants={itemVariants} className="flex items-center justify-end gap-3 w-full">
                            <span className="text-xs font-medium text-muted-foreground">
                                Auto-Apply
                            </span>
                            <Button
                                size="icon"
                                variant="secondary"
                                className="h-10 w-10 rounded-full shadow-lg border border-white/10 bg-white/5 hover:bg-white/10"
                                onClick={() => {
                                    onAction('auto-apply');
                                    setIsOpen(false);
                                }}
                            >
                                <CalendarIcon className="h-4 w-4" />
                            </Button>
                        </motion.div>

                        {/* Voucher Settings */}
                        <motion.div variants={itemVariants} className="flex items-center justify-end gap-3 w-full">
                            <span className="text-xs font-medium text-muted-foreground">
                                Voucher Settings
                            </span>
                            <Button
                                size="icon"
                                variant="secondary"
                                className="h-10 w-10 rounded-full shadow-lg border border-white/10 bg-white/5 hover:bg-white/10"
                                onClick={() => {
                                    onAction('settings');
                                    setIsOpen(false);
                                }}
                            >
                                <Settings className="h-4 w-4" />
                            </Button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Main Toggle Button */}
            <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                    "h-14 w-14 rounded-full shadow-2xl flex items-center justify-center transition-colors border border-white/10",
                    isOpen ? "bg-white text-primary" : "bg-primary text-white"
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
                        {isOpen ? <X className="h-6 w-6" /> : <CreditCard className="h-6 w-6" />}
                    </motion.div>
                </AnimatePresence>
            </motion.button>
        </div>
    );
}
