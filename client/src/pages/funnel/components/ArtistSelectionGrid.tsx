import { Card } from "@/components/ui";
import { UserAvatar } from "@/components/ui/ssot";

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

export default function ArtistSelectionGrid({
  artists,
  studioSlug,
  onSelectArtist,
}: ArtistSelectionGridProps) {
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
          className="p-4 bg-secondary/50 border-border hover:bg-secondary/50 transition-colors cursor-pointer group"
          onClick={() => onSelectArtist(artist.id)}
        >
          <div className="flex items-center gap-4">
            <UserAvatar name={artist.name} avatar={artist.avatar} size="xl" />
            <div>
              <h3 className="font-semibold text-foreground text-lg">
                {artist.name || "Unknown Artist"}
              </h3>
              {artist.bio ? (
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {artist.bio}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Tap to book an appointment.
                </p>
              )}
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
