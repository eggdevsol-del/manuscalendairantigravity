/**
 * ArtistMapOverlay.tsx
 * Full-screen artist map overlay.
 *
 * Fixes applied:
 * - Search bar + chips shifted down 25px (no X-button overlap)
 * - "Search this area" re-filters by map bounds
 * - Tap backdrop closes artist popup
 * - Artist card sits above bottom nav (pb-[77px] safe area)
 * - Search filters by name, displayName, businessName, email, keywords
 * - Legend + My Artists vs Discovery pin colours
 */

import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import { MapContainer, TileLayer, useMapEvents, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { X, Search, MapPin } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { ClientArtistCard } from "@/features/client-profile/ClientArtistCard";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";

// ── Leaflet default icon fix ─────────────────────────────────
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const STYLE_FILTERS = [
  "All Styles", "Realism", "Portrait", "Black & Grey", "Colour",
  "Tāmoko", "Traditional", "Neo-Trad", "Geometric", "Watercolour",
  "Fine Line", "Blackwork", "Japanese", "Minimalist",
];

// ── Avatar marker factory ────────────────────────────────────
function createArtistMarker(avatarUrl: string | null, name: string, isMyArtist: boolean) {
  const initial = (name || "?").charAt(0).toUpperCase();
  const ring = isMyArtist ? "#7c6aff" : "#10b981";

  return L.divIcon({
    html: `
      <div style="width:44px;height:52px;display:flex;flex-direction:column;align-items:center;">
        <div style="
          width:44px;height:44px;border-radius:50%;
          border:3px solid ${ring};
          box-shadow:0 2px 10px rgba(0,0,0,0.55);
          overflow:hidden;background:#1e1b2e;
          display:flex;align-items:center;justify-content:center;
        ">
          ${avatarUrl
            ? `<img src="${avatarUrl}" style="width:100%;height:100%;object-fit:cover;" />`
            : `<span style="color:white;font-size:18px;font-weight:700;">${initial}</span>`
          }
        </div>
        <div style="
          width:0;height:0;
          border-left:6px solid transparent;
          border-right:6px solid transparent;
          border-top:8px solid ${ring};
        "></div>
      </div>`,
    className: "",
    iconSize: [44, 52],
    iconAnchor: [22, 52],
    popupAnchor: [0, -55],
  });
}

// ── Map event hook — fires after user pans/zooms ─────────────
function MapEventTracker({ onMoved }: { onMoved: (b: L.LatLngBounds) => void }) {
  const isFirst = useRef(true);
  useMapEvents({
    moveend(e) {
      if (isFirst.current) { isFirst.current = false; return; }
      onMoved(e.target.getBounds());
    },
    zoomend(e) { onMoved(e.target.getBounds()); },
  });
  return null;
}

// ── Imperative marker renderer ───────────────────────────────
function ArtistPins({
  artists, myArtistIds, onPinClick,
}: {
  artists: any[];
  myArtistIds: Set<string>;
  onPinClick: (a: any) => void;
}) {
  const map = useMap();
  const markersRef = useRef<L.Marker[]>([]);

  useEffect(() => {
    // Clear previous
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    artists.forEach(artist => {
      const lat = parseFloat(artist.lat);
      const lng = parseFloat(artist.lng);
      if (isNaN(lat) || isNaN(lng)) return;

      const isMyArtist = myArtistIds.has(artist.id);
      const icon = createArtistMarker(
        artist.avatar,
        artist.displayName || artist.name || "",
        isMyArtist
      );
      const marker = L.marker([lat, lng], { icon });
      marker.on("click", () => onPinClick(artist));
      marker.addTo(map);
      markersRef.current.push(marker);
    });

    return () => { markersRef.current.forEach(m => m.remove()); };
  }, [artists, myArtistIds, map, onPinClick]);

  return null;
}

// ── Main component ───────────────────────────────────────────
interface ArtistMapOverlayProps {
  onClose: () => void;
  conversations: any[];
}

export function ArtistMapOverlay({ onClose, conversations }: ArtistMapOverlayProps) {
  const { user } = useAuth();
  const [activeFilter, setActiveFilter] = useState("All Styles");
  const [searchText, setSearchText] = useState("");
  const [showSearchArea, setShowSearchArea] = useState(false);
  const [mapBounds, setMapBounds] = useState<L.LatLngBounds | null>(null);
  const [selectedArtist, setSelectedArtist] = useState<any>(null);
  const boundsRef = useRef<L.LatLngBounds | null>(null);

  const { data: allArtists = [] } = trpc.auth.listArtists.useQuery();

  // IDs of artists the client already talks to
  const myArtistIds = useMemo(
    () => new Set(conversations.map((c: any) => c.otherUser?.id).filter(Boolean)),
    [conversations]
  );

  // Lookup conv by artistId
  const convByArtistId = useMemo(() => {
    const m = new Map<string, any>();
    conversations.forEach(c => { if (c.otherUser?.id) m.set(c.otherUser.id, c); });
    return m;
  }, [conversations]);

  // Filter artists for pins
  const visibleArtists = useMemo(() => {
    return (allArtists as any[]).filter(artist => {
      if (!artist.lat || !artist.lng) return false;

      const keywords   = (artist.keywords     || "").toLowerCase();
      const name       = (artist.name          || "").toLowerCase();
      const dispName   = (artist.displayName   || "").toLowerCase();
      const bizName    = (artist.businessName  || "").toLowerCase();
      const email      = (artist.email         || "").toLowerCase();
      const q          = searchText.trim().toLowerCase();

      const matchesSearch = !q ||
        name.includes(q) || dispName.includes(q) ||
        bizName.includes(q) || email.includes(q) || keywords.includes(q);

      const matchesStyle = activeFilter === "All Styles" ||
        keywords.includes(activeFilter.toLowerCase());

      const matchesBounds = !mapBounds ||
        mapBounds.contains([parseFloat(artist.lat), parseFloat(artist.lng)]);

      return matchesSearch && matchesStyle && matchesBounds;
    });
  }, [allArtists, searchText, activeFilter, mapBounds]);

  const handlePinClick = useCallback((artist: any) => {
    const conv = convByArtistId.get(artist.id);
    setSelectedArtist(conv ? { ...artist, _conv: conv } : artist);
  }, [convByArtistId]);

  const handleMapMoved = useCallback((bounds: L.LatLngBounds) => {
    boundsRef.current = bounds;
    setShowSearchArea(true);
  }, []);

  const handleSearchThisArea = useCallback(() => {
    if (boundsRef.current) setMapBounds(boundsRef.current);
    setShowSearchArea(false);
  }, []);

  const popupConv = useMemo(() => {
    if (!selectedArtist) return null;
    if (selectedArtist._conv) return selectedArtist._conv;
    return { id: null, otherUser: selectedArtist, unreadCount: 0, _isDiscovery: true };
  }, [selectedArtist]);

  const defaultCenter: [number, number] = [-27.4705, 153.026];

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
          <MapEventTracker onMoved={handleMapMoved} />
          <ArtistPins
            artists={visibleArtists}
            myArtistIds={myArtistIds}
            onPinClick={handlePinClick}
          />
        </MapContainer>

        {/* ── Top bar: back + title ─────────────────────────── */}
        <div className="absolute top-0 left-0 right-0 z-[500] flex items-center gap-3 px-4 pt-[max(16px,env(safe-area-inset-top))] pb-3 bg-gradient-to-b from-background/95 to-transparent pointer-events-none">
          <button
            onClick={onClose}
            className="pointer-events-auto w-10 h-10 rounded-full bg-card border border-border flex items-center justify-center shadow-lg"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <p className="text-sm font-bold">Discover Artists</p>
            <p className="text-xs text-muted-foreground">{visibleArtists.length} artists in view</p>
          </div>
        </div>

        {/* ── Search bar — shifted down 25px from previous pos ─ */}
        {/* Previous: top-[80px] → now top-[105px] */}
        <div className="absolute top-[105px] left-4 right-4 z-[500]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <input
              value={searchText}
              onChange={e => { setSearchText(e.target.value); setMapBounds(null); setShowSearchArea(false); }}
              placeholder="Search by name, style, suburb..."
              className="w-full h-10 pl-9 pr-9 rounded-full bg-card/95 border border-border shadow-lg text-sm outline-none focus:ring-2 focus:ring-primary/50"
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

        {/* ── Style filter chips — shifted down 25px too ───────── */}
        {/* Previous: top-[130px] → now top-[155px] */}
        <div className="absolute top-[155px] left-0 right-0 z-[500] px-4">
          <div className="flex gap-2 overflow-x-auto no-scrollbar py-1">
            {STYLE_FILTERS.map(filter => (
              <button
                key={filter}
                onClick={() => { setActiveFilter(filter); setMapBounds(null); }}
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

        {/* ── "Search this area" button ────────────────────────── */}
        <AnimatePresence>
          {showSearchArea && !selectedArtist && (
            <motion.div
              className="absolute bottom-[200px] left-1/2 -translate-x-1/2 z-[500]"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
            >
              <button
                onClick={handleSearchThisArea}
                className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary text-white font-semibold text-sm shadow-xl"
              >
                <Search className="w-4 h-4" />
                Search this area
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Legend ───────────────────────────────────────────── */}
        <div className="absolute bottom-[200px] right-4 z-[500] flex flex-col gap-1.5 bg-card/90 border border-border rounded-xl px-3 py-2 shadow-lg">
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

      {/* ── Backdrop — tap to close artist popup ─────────────── */}
      <AnimatePresence>
        {selectedArtist && (
          <motion.div
            className="fixed inset-0 z-[595]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedArtist(null)}
          />
        )}
      </AnimatePresence>

      {/* ── Artist card popup — above bottom nav (pb-[77px]) ───── */}
      <AnimatePresence>
        {popupConv && (
          <motion.div
            className="absolute bottom-0 left-0 right-0 z-[600] px-4 pt-4 bg-background/98 backdrop-blur-xl border-t border-border rounded-t-3xl shadow-2xl"
            style={{ paddingBottom: "calc(77px + max(12px, env(safe-area-inset-bottom)))" }}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 350, damping: 35 }}
          >
            {/* Drag handle */}
            <div className="w-10 h-1 rounded-full bg-border mx-auto mb-4" />

            {popupConv._isDiscovery ? (
              <DiscoveryArtistPopup
                artist={selectedArtist!}
                clientId={user?.id || ""}
                onDismiss={() => setSelectedArtist(null)}
              />
            ) : (
              <div>
                <ClientArtistCard conv={popupConv} onShopToggle={() => {}} />
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

// ── Discovery artist popup (no conversation yet) ─────────────
function DiscoveryArtistPopup({
  artist, clientId, onDismiss,
}: {
  artist: any;
  clientId: string;
  onDismiss: () => void;
}) {
  const utils = trpc.useUtils();
  const [, setLocation] = useLocation();

  const getOrCreate = trpc.conversations.getOrCreate.useMutation({
    onSuccess: (conv) => {
      utils.conversations.list.invalidate();
      onDismiss();
      setLocation(`/chat/${conv.id}`);
    },
  });

  const displayName = artist.displayName || artist.businessName || artist.name || "Artist";
  const avatarUrl = artist.avatar || null;
  const bannerUrl = artist.funnelBannerUrl || null;
  const keywordList = (artist.keywords || "").split(",").map((k: string) => k.trim()).filter(Boolean);

  return (
    <div className="w-full rounded-2xl overflow-hidden bg-[#111] border border-border">
      <div className="relative h-[80px]">
        {bannerUrl
          ? <img src={bannerUrl} alt="" className="w-full h-full object-cover" />
          : <div className="w-full h-full bg-gradient-to-br from-primary/30 to-accent/20" />}
        <div className="absolute inset-0 bg-gradient-to-t from-[#111] to-transparent" />
      </div>

      <div className="relative -mt-6 flex items-end gap-3 px-4 pb-2">
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

      {keywordList.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-4 pb-2">
          {keywordList.slice(0, 4).map((kw: string) => (
            <span key={kw} className="px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-[11px] font-medium">
              {kw}
            </span>
          ))}
        </div>
      )}

      <div className="flex gap-2 px-4 pb-3">
        <button
          onClick={() => clientId && getOrCreate.mutate({ artistId: artist.id, clientId })}
          disabled={getOrCreate.isPending || !clientId}
          className="flex-1 h-10 rounded-xl bg-primary text-white font-semibold text-sm disabled:opacity-50 flex items-center justify-center gap-1"
        >
          💬 {getOrCreate.isPending ? "Connecting..." : "Message"}
        </button>
        {artist.publicSlug && (
          <a
            href={`/${artist.publicSlug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 h-10 rounded-xl bg-secondary text-foreground font-semibold text-sm border border-border flex items-center justify-center gap-1"
          >
            🛍 Shopfront
          </a>
        )}
      </div>
    </div>
  );
}
