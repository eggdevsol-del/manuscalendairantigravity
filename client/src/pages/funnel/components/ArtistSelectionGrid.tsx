import { Card } from "@/components/ui";
import { User } from "lucide-react";

interface Artist {
    id: string;
    name: string | null;
    avatar: string | null;
    bio: string | null;
}

interface ArtistSelectionGridProps {
    artists: Artist[];
    studioSlug: string;
    onSelectArtist: (artistId: string) => void;
}

export default function ArtistSelectionGrid({ artists, studioSlug, onSelectArtist }: ArtistSelectionGridProps) {
    if (!artists.length) {
        return (
            <div className="text-center text-muted-foreground p-8">
                No active artists found in this studio.
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {artists.map(artist => (
                <Card
                    key={artist.id}
                    className="p-4 bg-white/5 border-white/10 hover:bg-white/10 transition-colors cursor-pointer group"
                    onClick={() => onSelectArtist(artist.id)}
                >
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-full bg-black/40 border border-white/10 overflow-hidden flex items-center justify-center shrink-0">
                            {artist.avatar ? (
                                <img src={artist.avatar} alt={artist.name || "Artist"} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                            ) : (
                                <User className="w-8 h-8 text-white/50" />
                            )}
                        </div>
                        <div>
                            <h3 className="font-semibold text-foreground text-lg">{artist.name || "Unknown Artist"}</h3>
                            {artist.bio ? (
                                <p className="text-sm text-muted-foreground line-clamp-2">{artist.bio}</p>
                            ) : (
                                <p className="text-sm text-muted-foreground">Tap to book an appointment.</p>
                            )}
                        </div>
                    </div>
                </Card>
            ))}
        </div>
    );
}
