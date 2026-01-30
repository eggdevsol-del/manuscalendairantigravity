import { useAuth } from "@/_core/hooks/useAuth";
<<<<<<< HEAD
import { Card } from "@/components/ui";
=======
import { Card } from "@/components/ui/card";
import { PageShell, GlassSheet, PageHeader } from "@/components/ui/ssot";
>>>>>>> f67b805f30b6e59529d357c59fa5a255ab93fc80

export default function Wallet() {
    const { user } = useAuth();
    const isArtist = user?.role === 'artist' || user?.role === 'admin';

    return (
        <PageShell>
            {/* 1. Page Header */}
            <PageHeader title={isArtist ? "Vouchers" : "Wallet"} />

            {/* 2. Top Context Area */}
            <div className="px-6 pt-4 pb-8 z-10 shrink-0 flex flex-col justify-center h-[20vh] opacity-80">
                <p className="text-4xl font-light text-foreground/90 tracking-tight">
                    {isArtist ? "Promotions" : "Wallet"}
                </p>
                <p className="text-muted-foreground text-lg font-medium mt-1">
                    {isArtist ? "3 Active" : "$0.00 Balance"}
                </p>
            </div>

            {/* 3. Sheet Container */}
            <GlassSheet className="bg-white/5">

                {/* Sheet Title */}
                <div className="shrink-0 pt-6 pb-2 px-6 border-b border-white/5">
                    <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                        {isArtist ? "Sales History" : "Recent Transactions"}
                    </h2>
                </div>

                {/* Scrollable Content */}
                <div className="flex-1 w-full h-full px-4 pt-4 overflow-y-auto mobile-scroll touch-pan-y">
                    <div className="space-y-3 pb-32 max-w-lg mx-auto">
                        {/* Placeholder Card */}
                        <Card className="p-4 rounded-2xl bg-white/5 border-white/5 shadow-none">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="font-medium text-foreground">Account Created</p>
                                    <p className="text-xs text-muted-foreground">Just now</p>
                                </div>
                                <span className="text-emerald-500 font-medium">+$0.00</span>
                            </div>
                        </Card>
                        <div className="p-12 text-center text-muted-foreground/40 text-sm">
                            No other transactions yet.
                        </div>
                    </div>
                </div>
            </GlassSheet>
        </PageShell>
    );
}
