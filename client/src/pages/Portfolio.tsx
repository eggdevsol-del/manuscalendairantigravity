import { useAuth } from "@/_core/hooks/useAuth";
import { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useRegisterBottomNavRow } from "@/contexts/BottomNavContext";
import { BottomNavRow } from "@/components/BottomNavRow";
import { Card, CardContent } from "@/components/ui/card";
import { Heart, Trash2, Upload, Image } from "lucide-react";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { Button } from "@/components/ui/button";
import { LoadingState, PageShell, GlassSheet, PageHeader } from "@/components/ui/ssot";

export default function Portfolio() {
    const { user } = useAuth();
    const isArtist = user?.role === 'artist' || user?.role === 'admin';

    const portfolioActionsRow = useMemo(() => (
        <BottomNavRow>
            <Button variant="ghost" size="sm" className="flex-col h-auto py-2 px-3 gap-1 hover:bg-transparent min-w-[70px] snap-center shrink-0 transition-all duration-300 relative text-muted-foreground opacity-70 hover:opacity-100">
                <div className="relative"><Upload className="w-6 h-6 mb-0.5" /></div>
                <span className="text-[10px] font-medium font-normal">Upload</span>
            </Button>
            <Button variant="ghost" size="sm" className="flex-col h-auto py-2 px-3 gap-1 hover:bg-transparent min-w-[70px] snap-center shrink-0 transition-all duration-300 relative text-muted-foreground opacity-70 hover:opacity-100">
                <div className="relative"><Trash2 className="w-6 h-6 mb-0.5" /></div>
                <span className="text-[10px] font-medium font-normal">Manage</span>
            </Button>
        </BottomNavRow>
    ), []);

    useRegisterBottomNavRow("portfolio-actions", portfolioActionsRow);

    const { data: portfolioItems, isLoading } = trpc.portfolio.list.useQuery(
        isArtist ? { artistId: user?.id } : undefined
    );

    // Placeholder for mutation
    const toggleLikeMutation = trpc.portfolio.toggleLike.useMutation();

    if (isLoading) {
        return <LoadingState message="Loading gallery..." fullScreen />;
    }

    return (
        <PageShell>
            {/* 1. Page Header (Fixed) */}
            <PageHeader variant="transparent">
                <h1 className="text-2xl font-bold text-foreground">
                    {isArtist ? "My Portfolio" : "Explore"}
                </h1>
            </PageHeader>

            {/* 2. Top Context Area (Non-interactive) */}
            <div className="px-6 pt-4 pb-8 z-10 shrink-0 flex flex-col justify-center h-[20vh] opacity-80">
                <p className="text-4xl font-light text-foreground/90 tracking-tight">
                    Gallery
                </p>
                <p className="text-muted-foreground text-lg font-medium mt-1">
                    {isArtist ? "Showcase your best work" : "Discover new styles"}
                </p>
            </div>

            {/* 3. Sheet Container */}
            <GlassSheet className="bg-white/5">

                {/* Optional Sheet Header / Actions Area */}
                <div className="shrink-0 pt-6 pb-2 px-6 border-b border-white/5 flex justify-end">
                    {isArtist && (
                        <Button size="sm" variant="ghost" className="gap-2 text-muted-foreground hover:text-foreground">
                            <Upload className="w-4 h-4" />
                            Quick Upload
                        </Button>
                    )}
                </div>

                {/* Scrollable Content */}
                <div className="flex-1 w-full h-full px-4 pt-4 overflow-y-auto mobile-scroll touch-pan-y">
                    <div className="grid grid-cols-2 gap-4 pb-32 max-w-lg mx-auto">
                        {portfolioItems?.map((item) => (
                            <div key={item.id} className="relative group aspect-square rounded-2xl overflow-hidden bg-muted">
                                <img
                                    src={item.imageUrl}
                                    alt={item.description || "Portfolio item"}
                                    className="w-full h-full object-cover"
                                />
                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                                    {isArtist ? (
                                        <Button size="icon" variant="destructive" className="rounded-full h-9 w-9">
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    ) : (
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            className={`rounded-full h-9 w-9 bg-white/10 hover:bg-white/20 ${item.isLiked ? 'text-red-500' : 'text-white'}`}
                                        >
                                            <Heart className={`w-5 h-5 ${item.isLiked ? 'fill-current' : ''}`} />
                                        </Button>
                                    )}
                                </div>
                            </div>
                        ))}

                        {portfolioItems?.length === 0 && (
                            <div className="col-span-2">
                                <Empty className="py-10">
                                    <EmptyHeader>
                                        <EmptyMedia variant="icon" className="w-16 h-16 rounded-full bg-white/5">
                                            <Image className="w-8 h-8" />
                                        </EmptyMedia>
                                        <EmptyTitle>{isArtist ? "No images yet" : "No portfolio items"}</EmptyTitle>
                                        <EmptyDescription>
                                            {isArtist ? "Upload some work to showcase your talent!" : "Check back later for new work."}
                                        </EmptyDescription>
                                    </EmptyHeader>
                                </Empty>
                            </div>
                        )}
                    </div>
                </div>
            </GlassSheet>
        </PageShell>
    );
}
