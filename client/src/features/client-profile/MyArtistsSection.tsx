/**
 * MyArtistsSection.tsx
 * Shows artists the client has conversations with OR has favourited.
 * Sorting: active conversations first (by lastMessageAt), then favourites-only.
 * Hidden entirely if both lists are empty.
 */
import { useMemo } from "react";
import { Users } from "lucide-react";
import { ClientArtistCard } from "@/features/client-profile/ClientArtistCard";
import { FavouriteHeartButton } from "@/features/client-profile/FavouriteHeartButton";
import { trpc } from "@/lib/trpc";

interface MyArtistsSectionProps {
  conversations: any[];
  favouriteIds: string[];
  isFavourited: (artistId: string) => boolean;
  toggleFavourite: (artistId: string) => void;
  onShopToggle: (expanded: boolean) => void;
}

export function MyArtistsSection({
  conversations,
  favouriteIds,
  isFavourited,
  toggleFavourite,
  onShopToggle,
}: MyArtistsSectionProps) {
  // Get all artists from the platform for matching favourites without conversations
  const { data: allArtists = [] } = trpc.auth.listArtists.useQuery();

  // IDs of artists with active conversations
  const conversationArtistIds = useMemo(
    () => new Set(conversations.map((c: any) => c.otherUser?.id).filter(Boolean)),
    [conversations]
  );

  // Favourited artists who do NOT have an active conversation
  const favouriteOnlyArtists = useMemo(() => {
    return favouriteIds
      .filter(id => !conversationArtistIds.has(id))
      .map(id => (allArtists as any[]).find((a: any) => a.id === id))
      .filter(Boolean);
  }, [favouriteIds, conversationArtistIds, allArtists]);

  const hasConversations = conversations.length > 0;
  const hasFavouritesOnly = favouriteOnlyArtists.length > 0;

  // Hide section entirely if nothing to show
  if (!hasConversations && !hasFavouritesOnly) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Users className="w-4 h-4 text-primary" />
        <h3 className="font-bold text-base">My Artists</h3>
      </div>

      {/* Active conversations — always first */}
      {conversations.map((conv: any) => (
        <div key={conv.id} className="relative">
          <ClientArtistCard conv={conv} onShopToggle={onShopToggle} />
          {/* Heart overlay on top-right of card */}
          {conv.otherUser?.id && (
            <div className="absolute top-3 right-3 z-20">
              <FavouriteHeartButton
                artistId={conv.otherUser.id}
                isFavourited={isFavourited(conv.otherUser.id)}
                onToggle={toggleFavourite}
                size="sm"
              />
            </div>
          )}
        </div>
      ))}

      {/* Favourited-only artists (no conversation yet) */}
      {favouriteOnlyArtists.map((artist: any) => {
        // Create a synthetic conv object so ClientArtistCard can render
        const syntheticConv = {
          id: `fav-${artist.id}`,
          otherUser: artist,
          unreadCount: 0,
          _isFavouriteOnly: true,
        };

        return (
          <div key={artist.id} className="relative">
            <ClientArtistCard conv={syntheticConv} onShopToggle={onShopToggle} />
            <div className="absolute top-3 right-3 z-20">
              <FavouriteHeartButton
                artistId={artist.id}
                isFavourited={true}
                onToggle={toggleFavourite}
                size="sm"
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
