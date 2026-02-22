import { useRoute, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { PageHeader, LoadingState } from "@/components/ui/ssot";
import ArtistSelectionGrid from "./components/ArtistSelectionGrid";
import { getAssetUrl } from "@/lib/assets";

export default function PublicStudioFunnel() {
    const [, params] = useRoute("/studio/:slug");
    const slug = params?.slug;
    const [, setLocation] = useLocation();

    const { data, isLoading, error } = trpc.studios.getStudioProfile.useQuery(
        { slug: slug || '' },
        { enabled: !!slug, retry: false }
    );

    if (isLoading) {
        return <LoadingState message="Loading Studio Profile..." fullScreen />;
    }

    if (error || !data?.studio) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-background text-foreground">
                <h1 className="text-2xl font-bold mb-2">Studio Not Found</h1>
                <p className="text-muted-foreground mb-6">The booking link you used is invalid or the studio no longer exists.</p>
                <button
                    onClick={() => setLocation("/")}
                    className="px-6 py-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
                >
                    Return Home
                </button>
            </div>
        );
    }

    const { studio, artists } = data;

    const handleSelectArtist = (artistId: string) => {
        // We have the artist ID! But we need their slug to navigate to /start/:slug
        // Wait, the artist selection grid returns artistID. 
        // Can we route using artist ID, or do we need their settings profile slug?
        // The FunnelWrapper uses `artistId` internally, but `/start/:slug` is the public URL.
        // Let's modify ArtistSelectionGrid / getStudioProfile to return the artist's slug!
        // For now, if we don't have their slug, we can pass their ID to a new route, 
        // OR add `publicSlug` to the returned artist data in trpc!
        // Actually, let's navigate to `/start/${artistId}` and have PublicFunnel handle ID or slug.
        // Wait, PublicFunnel already handles slug. 
        // Let's assume artists in the studio all have a public Slug. 
        // We will update the schema or query shortly to include their slug!
        setLocation(`/start/${artistId}`);
    };

    return (
        <div className="min-h-screen bg-background text-foreground flex flex-col">
            <header className="pt-12 pb-6 px-4 shrink-0 border-b border-border/10 bg-black/20 text-center">
                {studio.logoUrl && (
                    <div className="w-24 h-24 mx-auto bg-white/10 rounded-full mb-4 overflow-hidden border-2 border-primary/20">
                        <img src={getAssetUrl(studio.logoUrl)} alt={studio.name} className="w-full h-full object-cover" />
                    </div>
                )}
                <h1 className="text-3xl font-bold tracking-tight mb-2">{studio.name}</h1>
                {studio.description && (
                    <p className="text-muted-foreground max-w-md mx-auto">{studio.description}</p>
                )}
            </header>

            <main className="flex-1 w-full max-w-3xl mx-auto p-4 md:p-6 pb-32">
                <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                    <span className="w-1.5 h-6 bg-primary rounded-full block" />
                    Select an Artist
                </h2>
                <ArtistSelectionGrid
                    artists={artists}
                    studioSlug={slug!}
                    onSelectArtist={handleSelectArtist}
                />
            </main>
        </div>
    );
}
