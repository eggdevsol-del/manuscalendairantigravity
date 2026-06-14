import { useState, useMemo } from "react";
import { MessageCircle, MapPin, Search, X, ChevronRight } from "lucide-react";
import { ClientArtistCard } from "@/features/client-profile/ClientArtistCard";
import { ArtistMapOverlay } from "@/features/client-profile/ArtistMapOverlay";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { AnimatePresence } from "framer-motion";

const STYLE_FILTERS = [
  "All",
  "Realism",
  "Portrait",
  "Black & Grey",
  "Colour",
  "Tāmoko",
  "Traditional",
  "Neo-Trad",
  "Geometric",
  "Watercolour",
  "Fine Line",
  "Blackwork",
  "Japanese",
];

interface ClientFeedTabProps {
  conversations: any[];
  setIsShopExpanded: (expanded: boolean) => void;
}

// Lightweight artist card for the Discover section
function DiscoverArtistCard({ artist }: { artist: any }) {
  const displayName =
    artist.displayName || artist.businessName || artist.name || "Artist";
  const bannerUrl = artist.funnelBannerUrl || null;
  const avatarUrl = artist.avatar || null;
  const location =
    artist.city ||
    (artist.businessAddress ? artist.businessAddress.split(",")[0] : null);
  const keywordList = artist.keywords
    ? artist.keywords
        .split(",")
        .map((k: string) => k.trim())
        .filter(Boolean)
    : [];

  return (
    <div className="w-full relative rounded-2xl overflow-hidden bg-[#111] shadow-lg border border-border">
      {/* Banner */}
      <div className="relative h-[100px] overflow-hidden">
        {bannerUrl ? (
          <img
            src={bannerUrl}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-primary/30 via-accent/20 to-primary/10" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#111] via-black/40 to-transparent" />
      </div>

      {/* Info Row */}
      <div className="relative -mt-7 flex items-end gap-3 px-4 pb-3">
        <div className="w-12 h-12 rounded-full border-2 border-border overflow-hidden bg-secondary/50 shrink-0 shadow-lg">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={displayName}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary to-accent">
              <span className="text-white font-bold text-lg">
                {displayName.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0 pb-1">
          <p className="text-white font-bold text-base leading-tight truncate drop-shadow-md">
            {displayName}
          </p>
          {location && (
            <div className="flex items-center gap-1 mt-0.5">
              <MapPin className="w-3 h-3 text-muted-foreground shrink-0" />
              <p className="text-muted-foreground text-xs truncate">{location}</p>
            </div>
          )}
        </div>
      </div>

      {/* Keywords */}
      {keywordList.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-4 pb-3">
          {keywordList.slice(0, 4).map((kw: string) => (
            <span
              key={kw}
              className="px-2.5 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-[11px] font-medium"
            >
              {kw}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function ClientFeedTab({
  conversations,
  setIsShopExpanded,
}: ClientFeedTabProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");
  const [mapOpen, setMapOpen] = useState(false);

  // All artists for the Discover section
  const { data: allArtists = [], isLoading: loadingArtists } =
    trpc.auth.listArtists.useQuery();

  // Filter "My Artists" by search
  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    const query = searchQuery.toLowerCase();
    return conversations.filter(conv => {
      const artist = conv.otherUser;
      if (!artist) return false;
      const name = (artist.name || artist.firstName || "").toLowerCase();
      const keywords = (artist.keywords || "").toLowerCase();
      return name.includes(query) || keywords.includes(query);
    });
  }, [conversations, searchQuery]);

  // Filter "Discover" artists by chip + search
  const filteredDiscoverArtists = useMemo(() => {
    return (allArtists as any[]).filter(artist => {
      const keywords = (artist.keywords || "").toLowerCase();
      const name = (artist.displayName || artist.name || "").toLowerCase();
      const matchesFilter =
        activeFilter === "All" ||
        keywords.includes(activeFilter.toLowerCase());
      const matchesSearch =
        !searchQuery.trim() ||
        name.includes(searchQuery.toLowerCase()) ||
        keywords.includes(searchQuery.toLowerCase());
      return matchesFilter && matchesSearch;
    });
  }, [allArtists, activeFilter, searchQuery]);

  return (
    <>
      {/* ─── Full-screen map overlay ─────────────────────────── */}
      <AnimatePresence>
        {mapOpen && (
          <ArtistMapOverlay
            onClose={() => setMapOpen(false)}
            conversations={conversations}
          />
        )}
      </AnimatePresence>

      {/* ─── Scrollable Feed ─────────────────────────────────── */}
      <div className="flex flex-col h-full relative">
        <div className="flex-1 overflow-y-auto mobile-scroll px-4 pt-4 pb-[80px] space-y-6">

          {/* ── Discover Nearby ────────────────────────────── */}
          <div className="rounded-2xl overflow-hidden border border-border shadow-lg bg-card">
            {/* Header */}
            <div className="p-3 bg-secondary/30 flex items-center gap-2 border-b border-border">
              <MapPin className="w-4 h-4 text-primary" />
              <h3 className="font-semibold text-sm flex-1">Discover Nearby Artists</h3>
            </div>

            {/* "See Artist Map" CTA */}
            <button
              onClick={() => setMapOpen(true)}
              className="w-full flex items-center justify-between px-4 py-4 bg-gradient-to-r from-primary/10 to-accent/10 hover:from-primary/20 hover:to-accent/20 transition-colors border-b border-border"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                  <MapPin className="w-5 h-5 text-primary" />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-sm">See Artist Map</p>
                  <p className="text-xs text-muted-foreground">
                    {(allArtists as any[]).filter((a: any) => a.lat && a.lng).length} artists near Brisbane
                  </p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            </button>

            {/* Style filter chips */}
            <div className="px-3 pt-3 pb-2 flex gap-2 overflow-x-auto no-scrollbar">
              {STYLE_FILTERS.map(filter => (
                <button
                  key={filter}
                  onClick={() => setActiveFilter(filter)}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                    activeFilter === filter
                      ? "bg-primary text-white border-primary shadow-md"
                      : "bg-secondary/50 text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>

            {/* Discover artist cards list */}
            <div className="px-3 pb-3 space-y-3">
              {loadingArtists ? (
                <div className="text-center py-6 text-muted-foreground text-sm">
                  Finding artists near you...
                </div>
              ) : filteredDiscoverArtists.length === 0 ? (
                <div className="text-center py-6">
                  <MapPin className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-muted-foreground text-sm">
                    No artists match your search
                  </p>
                </div>
              ) : (
                filteredDiscoverArtists.map((artist: any) => (
                  <DiscoverArtistCard key={artist.id} artist={artist} />
                ))
              )}
            </div>
          </div>

          {/* ── My Artists ──────────────────────────────────── */}
          <div>
            <h3 className="font-bold text-lg mb-3">My Artists</h3>
            {filteredConversations.length === 0 ? (
              <div className="text-center py-8">
                <MessageCircle className="w-12 h-12 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-muted-foreground text-sm">
                  {searchQuery ? "No artists match your search" : "No artists yet"}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredConversations.map((conv: any) => (
                  <ClientArtistCard
                    key={conv.id}
                    conv={conv}
                    onShopToggle={setIsShopExpanded}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ─── Floating Search Pill — transparent outer wrapper ── */}
        <div
          className="absolute bottom-0 left-0 right-0 flex items-center justify-center px-4"
          style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}
        >
          <div className="relative w-full">
            <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none z-10" />
            <Input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by name, style (e.g. realism)..."
              className="w-full pl-10 pr-10 h-11 rounded-full bg-secondary border-border focus-visible:ring-primary shadow-lg"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
