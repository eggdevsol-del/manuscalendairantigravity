
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
                        className="flex flex-col items-end gap-3 mb-2"
                    >
                        {/* View Toggle */}
                        <motion.div variants={itemVariants} className="flex items-center gap-3">
                            <span className="bg-black/80 text-white text-xs px-2 py-1 rounded backdrop-blur-sm shadow-sm">
                                Switch View
                            </span>
                            <Button
                                size="icon"
                                variant="secondary"
                                className={cn(
                                    "h-12 w-12 rounded-full shadow-lg border border-white/10",
                                    "bg-card/80 backdrop-blur-lg hover:bg-card"
                                )}
                                onClick={() => {
                                    onViewModeChange(viewMode === 'swipe' ? 'grid' : 'swipe');
                                    setIsOpen(false);
                                }}
                            >
                                {viewMode === 'swipe' ? <Grid className="h-5 w-5" /> : <GalleryVertical className="h-5 w-5" />}
                            </Button>
                        </motion.div>

                        {/* Create New */}
                        <motion.div variants={itemVariants} className="flex items-center gap-3">
                            <span className="bg-black/80 text-white text-xs px-2 py-1 rounded backdrop-blur-sm shadow-sm">
                                New Promotion
                            </span>
                            <Button
                                size="icon"
                                variant="secondary"
                                className={cn(
                                    "h-12 w-12 rounded-full shadow-lg border border-white/10",
                                    "bg-primary text-primary-foreground hover:bg-primary/90"
                                )}
                                onClick={() => {
                                    onAction('create');
                                    setIsOpen(false);
                                }}
                            >
                                <Plus className="h-5 w-5" />
                            </Button>
                        </motion.div>

                        {/* Send to Client */}
                        <motion.div variants={itemVariants} className="flex items-center gap-3">
                            <span className="bg-black/80 text-white text-xs px-2 py-1 rounded backdrop-blur-sm shadow-sm">
                                Send to Client
                            </span>
                            <Button
                                size="icon"
                                variant="secondary"
                                className="h-12 w-12 rounded-full shadow-lg border border-white/10 bg-card/80 backdrop-blur-lg"
                                onClick={() => {
                                    onAction('send');
                                    setIsOpen(false);
                                }}
                            >
                                <Send className="h-5 w-5" />
                            </Button>
                        </motion.div>

                        {/* Auto Apply */}
                        <motion.div variants={itemVariants} className="flex items-center gap-3">
                            <span className="bg-black/80 text-white text-xs px-2 py-1 rounded backdrop-blur-sm shadow-sm">
                                Auto-Apply
                            </span>
                            <Button
                                size="icon"
                                variant="secondary"
                                className="h-12 w-12 rounded-full shadow-lg border border-white/10 bg-card/80 backdrop-blur-lg"
                                onClick={() => {
                                    onAction('auto-apply');
                                    setIsOpen(false);
                                }}
                            >
                                <CalendarIcon className="h-5 w-5" />
                            </Button>
                        </motion.div>

                        {/* Voucher Settings */}
                        <motion.div variants={itemVariants} className="flex items-center gap-3">
                            <span className="bg-black/80 text-white text-xs px-2 py-1 rounded backdrop-blur-sm shadow-sm">
                                Voucher Settings
                            </span>
                            <Button
                                size="icon"
                                variant="secondary"
                                className="h-12 w-12 rounded-full shadow-lg border border-white/10 bg-card/80 backdrop-blur-lg"
                                onClick={() => {
                                    onAction('settings');
                                    setIsOpen(false);
                                }}
                            >
                                <Settings className="h-5 w-5" />
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
