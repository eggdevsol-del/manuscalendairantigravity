import { tokens } from "@/ui/tokens";
import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface SheetHeaderProps {
    children: ReactNode;
    className?: string;
}

export function SheetHeader({ children, className }: SheetHeaderProps) {
    return (
        <div className={cn(
            tokens.sheetSecondary.header,
            className
        )}>
            {children}
        </div>
    );
}
