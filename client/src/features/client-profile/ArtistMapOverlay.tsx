/**
 * ArtistMapOverlay.tsx
 * ─────────────────────────────────────────────────────────
 * Full-screen artist map that overlays the client home feed.
 * - Shows all artists as map pins (green = "My Artists", purple = discoverable)
 * - "Search this area" button appears after panning/zooming (real-estate style)
 * - Style filter chips overlaid on the map
 * - Tapping a pin opens the existing ClientArtistCard popup
 * - Back button collapses the map
 */

import { useState, useCallback, useRef, useMemo } from "react";
import {
  MapContainer,
  TileLayer,
  useMapEvents,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { X, Search, MapPin } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { ClientArtistCard } from "@/features/client-profile/ClientArtistCard";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";

const STYLE_FILTERS = [
  "All Styles",
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
  "Minimalist",
  "Blackwork",
  "Japanese",
];

// ── Custom avatar marker ─────────────────────────────────────
function createArtistMarker(avatarUrl: string | null, name: string, isMyArtist: boolean) {
  const initial = (name || "?").charAt(0).toUpperCase();
  const ringColor = isMyArtist ? "#7c6aff" : "#10b981";

  const html = `
    <div style="
      width: 44px; height: 44px; border-radius: 50%;
      border: 3px solid ${ringColor};
      box-shadow: 0 2px 8px rgba(0,0,0,0.5);
      overflow: hidden;
      background: #1e1b2e;
      display: flex; align-items: center; justify-content: center;
    ">
      ${avatarUrl
        ? `<img src="${avatarUrl}" style="width:100%;height:100%;object-fit:cover;" />`
        : `<span style="color:white;font-size:18px;font-weight:700;">${initial}</span>`
      }
    </div>
    <div style="
      width: 0; height: 0;
      border-left: 6px solid transparent;
      border-right: 6px solid transparent;
      border-top: 8px solid ${ringColor};
      margin: 0 auto;
    "></div>
  `;

  return L.divIcon({
    html,
    className: "",
    iconSize: [44, 52],
    iconAnchor: [22, 52],
    popupAnchor: [0, -54],
  });
}

// ── Map event tracker for "Search this area" ─────────────────
function MapEventTracker({
  onMoved,
}: {
  onMoved: (bounds: L.LatLngBounds, center: L.LatLng) => void;
}) {
  const moved = useRef(false);
  useMapEvents({
    moveend(e) {
      if (!moved.current) { moved.current = true; return; } // skip initial
      onMoved(e.target.getBounds(), e.target.getCenter());
    },
    zoomend(e) {
      onMoved(e.target.getBounds(), e.target.getCenter());
    },
  });
  return null;
}

// ── Map pins renderer ─────────────────────────────────────────
function ArtistPins({
  artists,
  myArtistIds,
  onPinClick,
}: {
  artists: any[];
  myArtistIds: Set<string>;
  onPinClick: (artist: any) => void;
}) {
  const map = useMap();

  // Render markers imperatively to avoid react-leaflet Marker re-render issues
  const markersRef = useRef<L.Marker[]>([]);

  // Clear + re-add on artists change
  useMemo(() => {
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    artists.forEach(artist => {
      const lat = parseFloat(artist.lat);
      const lng = parseFloat(artist.lng);
      if (isNaN(lat) || isNaN(lng)) return;

      const isMyArtist = myArtistIds.has(artist.id);
      const icon = createArtistMarker(artist.avatar, artist.name || artist.displayName, isMyArtist);
      const marker = L.marker([lat, lng], { icon });
      marker.on("click", () => onPinClick(artist));
      marker.addTo(map);
      markersRef.current.push(marker);
    });

    return () => {
      markersRef.current.forEach(m => m.remove());
    };
  }, [artists, myArtistIds, map, onPinClick]);

  return null;
}

// ── Props ────────────────────────────────────────────────────
interface ArtistMapOverlayProps {
  onClose: () => void;
  conversations: any[];
}

export function ArtistMapOverlay({ onClose, conversations }: ArtistMapOverlayProps) {
  const [activeFilter, setActiveFilter] = useState("All Styles");
  const [searchText, setSearchText] = useState("");
  const [showSearchArea, setShowSearchArea] = useState(false);
  const [mapBounds, setMapBounds] = useState<L.LatLngBounds | null>(null);
  const [selectedArtist, setSelectedArtist] = useState<any>(null);

  // Fetch all artists for discovery
  const { data: allArtists = [] } = trpc.auth.listArtists.useQuery();

  // IDs of artists the client already has a conversation with
  const myArtistIds = useMemo(
    () => new Set(conversations.map((c: any) => c.otherUser?.id).filter(Boolean)),
    [conversations]
  );

  // Build a lookup: artistId → conversation (for "My Artists" popup)
  const convByArtistId = useMemo(() => {
    const map = new Map<string, any>();
    conversations.forEach(c => {
      if (c.otherUser?.id) map.set(c.otherUser.id, c);
    });
    return map;
  }, [conversations]);

  // Filter artists by style chip, search text, and optionally map bounds
  const visibleArtists = useMemo(() => {
    return (allArtists as any[]).filter(artist => {
      if (!artist.lat || !artist.lng) return false;

      const keywords = (artist.keywords || "").toLowerCase();
      const name = (artist.displayName || artist.name || "").toLowerCase();

      const matchesStyle =
        activeFilter === "All Styles" ||
        keywords.includes(activeFilter.toLowerCase());

      const matchesSearch =
        !searchText.trim() ||
        name.includes(searchText.toLowerCase()) ||
        keywords.includes(searchText.toLowerCase());

      const matchesBounds =
        !mapBounds ||
        mapBounds.contains([parseFloat(artist.lat), parseFloat(artist.lng)]);

      return matchesStyle && matchesSearch && matchesBounds;
    });
  }, [allArtists, activeFilter, searchText, mapBounds]);

  const handlePinClick = useCallback((artist: any) => {
    // Enrich with conversation data if available
    const conv = convByArtistId.get(artist.id);
    setSelectedArtist(conv ? { ...artist, _conv: conv } : artist);
  }, [convByArtistId]);

  const handleMapMoved = useCallback((bounds: L.LatLngBounds) => {
    setShowSearchArea(true);
    // Don't auto-apply bounds — wait for user to tap "Search this area"
  }, []);

  const handleSearchThisArea = useCallback((bounds: L.LatLngBounds) => {
    setMapBounds(bounds);
    setShowSearchArea(false);
  }, []);

  // Build the conv-shaped object for ClientArtistCard popup
  const popupConv = useMemo(() => {
    if (!selectedArtist) return null;
    if (selectedArtist._conv) return selectedArtist._conv;
    // Discovery artist — synthesise a minimal conv shape
    return {
      id: null, // no conversation yet
      otherUser: selectedArtist,
      unreadCount: 0,
      _isDiscovery: true,
    };
  }, [selectedArtist]);

  // Default center: Brisbane CBD
  const defaultCenter: [number, number] = [-27.4705, 153.026];
  const boundsRef = useRef<L.LatLngBounds | null>(null);

  return (
    <motion.div
      className="fixed inset-0 z-[200] flex flex-col bg-background"
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      exit={{ y: "100%" }}
      transition={{ type: "spring", stiffness: 300, damping: 35 }}
    >
      {/* ── Map ─────────────────────────────────────────────── */}
      <div className="relative flex-1 w-full overflow-hidden">
        <MapContainer
          center={defaultCenter}
          zoom={13}
          scrollWheelZoom
          style={{ height: "100%", width: "100%" }}
          zoomControl={false}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          />
          <MapEventTracker
            onMoved={(bounds) => {
              boundsRef.current = bounds;
              handleMapMoved(bounds);
            }}
          />
          <ArtistPins
            artists={visibleArtists}
            myArtistIds={myArtistIds}
            onPinClick={handlePinClick}
          />
        </MapContainer>

        {/* ── Top bar (back button + title) ────────────────── */}
        <div className="absolute top-0 left-0 right-0 z-[500] flex items-center gap-3 px-4 pt-[max(16px,env(safe-area-inset-top))] pb-3 bg-gradient-to-b from-background/95 to-transparent backdrop-blur-sm">
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-card border border-border flex items-center justify-center shadow-lg"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <p className="text-sm font-bold">Discover Artists</p>
            <p className="text-xs text-muted-foreground">{visibleArtists.length} artists in view</p>
          </div>
        </div>

        {/* ── Search bar overlay ───────────────────────────── */}
        <div className="absolute top-[80px] left-4 right-4 z-[500]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <input
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              placeholder="Search by name or style..."
              className="w-full h-10 pl-9 pr-4 rounded-full bg-card/95 border border-border shadow-lg text-sm outline-none focus:ring-2 focus:ring-primary/50"
            />
            {searchText && (
              <button
                onClick={() => setSearchText("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* ── Style filter chips ───────────────────────────── */}
        <div className="absolute top-[130px] left-0 right-0 z-[500] px-4">
          <div className="flex gap-2 overflow-x-auto no-scrollbar py-1">
            {STYLE_FILTERS.map(filter => (
              <button
                key={filter}
                onClick={() => setActiveFilter(filter)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border shadow transition-all ${
                  activeFilter === filter
                    ? "bg-primary text-white border-primary"
                    : "bg-card/90 text-foreground border-border hover:border-primary/50"
                }`}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>

        {/* ── "Search this area" button ────────────────────── */}
        <AnimatePresence>
          {showSearchArea && (
            <motion.div
              className="absolute bottom-[180px] left-1/2 -translate-x-1/2 z-[500]"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
            >
              <button
                onClick={() => boundsRef.current && handleSearchThisArea(boundsRef.current)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary text-white font-semibold text-sm shadow-xl"
              >
                <Search className="w-4 h-4" />
                Search this area
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Legend ──────────────────────────────────────── */}
        <div className="absolute bottom-[170px] right-4 z-[500] flex flex-col gap-1.5 bg-card/90 border border-border rounded-xl px-3 py-2 shadow-lg">
          <div className="flex items-center gap-2 text-xs">
            <div className="w-3 h-3 rounded-full bg-primary" />
            <span>My Artists</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className="w-3 h-3 rounded-full bg-emerald-500" />
            <span>Nearby</span>
          </div>
        </div>
      </div>

      {/* ── Artist card popup (slides up from bottom) ─────── */}
      <AnimatePresence>
        {popupConv && (
          <motion.div
            className="absolute bottom-0 left-0 right-0 z-[600] p-4 bg-background/98 backdrop-blur-xl border-t border-border rounded-t-3xl shadow-2xl"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 350, damping: 35 }}
          >
            {/* Drag handle */}
            <div className="w-10 h-1 rounded-full bg-border mx-auto mb-4" />

            {popupConv._isDiscovery ? (
              <DiscoveryArtistPopup
                artist={selectedArtist}
                onDismiss={() => setSelectedArtist(null)}
              />
            ) : (
              <div>
                <ClientArtistCard
                  conv={popupConv}
                  onShopToggle={() => {}}
                />
                <button
                  onClick={() => setSelectedArtist(null)}
                  className="mt-3 w-full text-center text-xs text-muted-foreground"
                >
                  Dismiss
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Popup for discovery artists (no existing conversation) ───
function DiscoveryArtistPopup({
  artist,
  onDismiss,
}: {
  artist: any;
  onDismiss: () => void;
}) {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const getOrCreate = trpc.conversations.getOrCreate.useMutation({
    onSuccess: () => {
      utils.conversations.list.invalidate();
      onDismiss();
    },
  });

  const displayName = artist.displayName || artist.businessName || artist.name || "Artist";
  const avatarUrl = artist.avatar || null;
  const bannerUrl = artist.funnelBannerUrl || null;
  const keywordList = artist.keywords
    ? artist.keywords.split(",").map((k: string) => k.trim()).filter(Boolean)
    : [];

  return (
    <div className="w-full relative rounded-2xl overflow-hidden bg-[#111] border border-border">
      {/* Banner */}
      <div className="relative h-[90px]">
        {bannerUrl
          ? <img src={bannerUrl} alt="" className="w-full h-full object-cover" />
          : <div className="w-full h-full bg-gradient-to-br from-primary/30 to-accent/20" />}
        <div className="absolute inset-0 bg-gradient-to-t from-[#111] to-transparent" />
      </div>

      {/* Info */}
      <div className="relative -mt-7 flex items-end gap-3 px-4 pb-3">
        <div className="w-12 h-12 rounded-full border-2 border-primary overflow-hidden bg-secondary/50 shadow-lg shrink-0">
          {avatarUrl
            ? <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
            : <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary to-accent">
                <span className="text-white font-bold text-lg">{displayName.charAt(0)}</span>
              </div>
          }
        </div>
        <div className="flex-1 min-w-0 pb-1">
          <p className="text-white font-bold text-base truncate">{displayName}</p>
          {artist.city && (
            <div className="flex items-center gap-1">
              <MapPin className="w-3 h-3 text-muted-foreground" />
              <p className="text-muted-foreground text-xs">{artist.city}</p>
            </div>
          )}
        </div>
      </div>

      {/* Keywords */}
      {keywordList.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-4 pb-2">
          {keywordList.slice(0, 4).map((kw: string) => (
            <span key={kw} className="px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-[11px] font-medium">
              {kw}
            </span>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 px-4 pb-4">
        <button
          onClick={() => user?.id && getOrCreate.mutate({ artistId: artist.id, clientId: user.id })}
          disabled={getOrCreate.isPending}
          className="flex-1 flex items-center justify-center gap-2 h-10 rounded-xl bg-primary text-white font-semibold text-sm disabled:opacity-50"
        >
          {getOrCreate.isPending ? "Connecting..." : "💬 Start Chat"}
        </button>
        {artist.publicSlug && (
          <a
            href={`/${artist.publicSlug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-2 h-10 rounded-xl bg-secondary text-foreground font-semibold text-sm border border-border"
          >
            🛍 View Shopfront
          </a>
        )}
      </div>

      <button
        onClick={onDismiss}
        className="w-full text-center text-xs text-muted-foreground pb-3"
      >
        Dismiss
      </button>
    </div>
  );
}
