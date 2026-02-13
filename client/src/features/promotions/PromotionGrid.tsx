
import { motion } from "framer-motion";
import { PromotionCard, PromotionCardData } from "./PromotionCard";
import { cn } from "@/lib/utils";

interface PromotionGridProps {
    cards: any[];
    onSelect: (card: any) => void;
    selectedCardId: number | null;
}

export function PromotionGrid({ cards, onSelect, selectedCardId }: PromotionGridProps) {
    if (cards.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-8 text-center h-64">
                <p className="text-muted-foreground">No promotions found.</p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4 pb-32 overflow-y-auto h-full w-full">
            {cards.map((card, index) => (
                <motion.div
                    key={card.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    onClick={() => onSelect(card)}
                    className={cn(
                        "cursor-pointer transform transition-all duration-200",
                        selectedCardId === card.id ? "scale-[1.02] ring-2 ring-primary" : "hover:scale-[1.01]"
                    )}
                >
                    <PromotionCard
                        data={card as PromotionCardData}
                        selected={selectedCardId === card.id}
                        size="sm"
                        className="w-full shadow-lg"
                    />
                </motion.div>
            ))}
        </div>
    );
}
