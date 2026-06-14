/**
 * ClientFeedTab.tsx
 * ─────────────────────────────────────────────────────────
 * Client home feed: Discover Artists + My Artists.
 *
 * Changes:
 * - Outer "Discover Nearby" container is invisible (no card border/bg)
 * - Full width, responsive
 * - Discover artist cards include Message + Storefront buttons
 * - Storefront expands inline (same as ClientArtistCard)
 * - "Request Consultation" mini-form expands inline per card
 * - Floating search pill is transparent outside the pill shape
 */

import { useState, useMemo, useRef } from "react";
import { MessageCircle, MapPin, Search, X, ShoppingBag, ChevronRight, CalendarPlus, Loader2, Package, Check, ImagePlus } from "lucide-react";
import { ClientArtistCard } from "@/features/client-profile/ClientArtistCard";
import { ArtistMapOverlay } from "@/features/client-profile/ArtistMapOverlay";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { AnimatePresence, motion } from "framer-motion";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { CartProvider, useCart } from "@/features/storefront/CartContext";
import { StorefrontProductCard } from "@/features/storefront/StorefrontProductCard";
import { StorefrontCheckoutFAB } from "@/features/storefront/StorefrontCheckoutFAB";
import { PortfolioExpand } from "@/features/client-profile/PortfolioExpand";

const STYLE_FILTERS = [
  "All", "Realism", "Portrait", "Black & Grey", "Colour",
  "Tāmoko", "Traditional", "Neo-Trad", "Geometric",
  "Watercolour", "Fine Line", "Blackwork", "Japanese",
];

const PLACEMENT_OPTIONS = [
  "Arm", "Forearm", "Upper Arm", "Shoulder", "Back",
  "Chest", "Ribs", "Leg", "Thigh", "Calf", "Ankle",
  "Neck", "Hand", "Foot", "Hip", "Wrist", "Other",
];

// ── Inline storefront for Discover cards ────────────────────
function DiscoverStorefront({ artistId, artistSlug }: { artistId: string; artistSlug: string }) {
  const { data: storefront, isLoading } = trpc.storefront.getStorefrontByArtistId.useQuery({ artistId });
  const { setIsCartOpen, totalItems } = useCart();

  if (isLoading) return (
    <div className="flex items-center justify-center p-6">
      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
    </div>
  );

  if (!storefront || storefront.products.length === 0) return (
    <div className="flex flex-col items-center p-6 text-center">
      <Package className="w-7 h-7 text-muted-foreground mb-2" />
      <p className="text-muted-foreground text-sm">No products yet</p>
    </div>
  );

  return (
    <div className="px-4 pb-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-bold text-xs uppercase tracking-wider text-muted-foreground">Storefront</h4>
        {totalItems > 0 && (
          <button
            onClick={() => setIsCartOpen(true)}
            className="text-xs bg-primary text-white px-3 py-1 rounded-full font-bold"
          >
            Checkout ({totalItems})
          </button>
        )}
      </div>
      <div className="flex overflow-x-auto gap-3 pb-2 -mx-4 px-4 mobile-scroll snap-x">
        {storefront.products.map((product: any) => (
          <div key={product.id} className="min-w-[200px] max-w-[200px] snap-start shrink-0">
            <StorefrontProductCard product={product} />
          </div>
        ))}
      </div>
      <StorefrontCheckoutFAB onClose={() => setIsCartOpen(false)} artistSlug={artistSlug} artistId={artistId} />
    </div>
  );
}

// ── Inline consultation request form ────────────────────────
function ConsultationForm({
  artist,
  onClose,
}: {
  artist: any;
  onClose: () => void;
}) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [style, setStyle] = useState("");
  const [placement, setPlacement] = useState("");
  const [description, setDescription] = useState("");
  const [referenceUrls, setReferenceUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadImage = trpc.upload.uploadImage.useMutation();
  const createConsultation = trpc.consultations.create.useMutation({
    onSuccess: () => setDone(true),
  });

  const displayName = artist.displayName || artist.businessName || artist.name || "Artist";

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    try {
      for (const file of files.slice(0, 4)) {
        const reader = new FileReader();
        const base64 = await new Promise<string>(res => {
          reader.onload = () => res(reader.result as string);
          reader.readAsDataURL(file);
        });
        const result = await uploadImage.mutateAsync({
          base64,
          filename: file.name,
          folder: "consultation-refs",
        });
        if (result.url) setReferenceUrls(prev => [...prev, result.url]);
      }
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = () => {
    createConsultation.mutate({
      artistId: artist.id,
      subject: `${style || "Tattoo"} consultation request`,
      description,
      placement,
      style,
      referenceUrls,
    });
  };

  if (done) return (
    <div className="flex flex-col items-center py-6 text-center gap-2">
      <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center mb-1">
        <Check className="w-6 h-6 text-emerald-400" />
      </div>
      <p className="font-bold text-base">Request Sent!</p>
      <p className="text-muted-foreground text-xs">{displayName} will respond shortly.</p>
      <button onClick={onClose} className="mt-2 text-xs text-muted-foreground underline">Close</button>
    </div>
  );

  return (
    <div className="px-4 py-4 space-y-4">
      {/* Step indicator */}
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          {step === 1 ? "1 · Style & Placement" : step === 2 ? "2 · Description & Refs" : "3 · Confirm"}
        </p>
        <div className="flex gap-1.5">
          {[1, 2, 3].map(s => (
            <div key={s} className={`w-2 h-2 rounded-full transition-colors ${s <= step ? "bg-primary" : "bg-border"}`} />
          ))}
        </div>
      </div>

      {/* Step 1 */}
      {step === 1 && (
        <div className="space-y-3">
          <div>
            <p className="text-xs font-semibold mb-2">Style</p>
            <div className="flex flex-wrap gap-2">
              {STYLE_FILTERS.filter(s => s !== "All").map(s => (
                <button
                  key={s}
                  onClick={() => setStyle(s)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                    style === s ? "bg-primary text-white border-primary" : "bg-secondary/50 text-muted-foreground border-border"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold mb-2">Placement</p>
            <div className="flex flex-wrap gap-2">
              {PLACEMENT_OPTIONS.map(p => (
                <button
                  key={p}
                  onClick={() => setPlacement(p)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                    placement === p ? "bg-primary text-white border-primary" : "bg-secondary/50 text-muted-foreground border-border"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={() => setStep(2)}
            disabled={!style || !placement}
            className="w-full h-10 rounded-xl bg-primary text-white font-semibold text-sm disabled:opacity-40"
          >
            Next →
          </button>
        </div>
      )}

      {/* Step 2 */}
      {step === 2 && (
        <div className="space-y-3">
          <div>
            <p className="text-xs font-semibold mb-1.5">Describe your idea</p>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="What are you envisioning? Size, details, inspiration..."
              rows={4}
              className="w-full rounded-xl bg-secondary/50 border border-border p-3 text-sm outline-none focus:ring-2 focus:ring-primary/50 resize-none"
            />
          </div>
          <div>
            <p className="text-xs font-semibold mb-1.5">Reference images <span className="text-muted-foreground font-normal">(optional, max 4)</span></p>
            <div className="flex flex-wrap gap-2">
              {referenceUrls.map((url, i) => (
                <div key={i} className="relative w-16 h-16 rounded-xl overflow-hidden border border-border">
                  <img src={url} alt="" className="w-full h-full object-cover" />
                  <button
                    onClick={() => setReferenceUrls(prev => prev.filter((_, j) => j !== i))}
                    className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/70 flex items-center justify-center"
                  >
                    <X className="w-2.5 h-2.5 text-white" />
                  </button>
                </div>
              ))}
              {referenceUrls.length < 4 && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="w-16 h-16 rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center text-muted-foreground hover:border-primary/50 transition-colors"
                >
                  {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-5 h-5" />}
                </button>
              )}
              <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFileChange} />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setStep(1)} className="flex-1 h-10 rounded-xl border border-border text-sm font-semibold">← Back</button>
            <button onClick={() => setStep(3)} disabled={!description.trim()} className="flex-1 h-10 rounded-xl bg-primary text-white font-semibold text-sm disabled:opacity-40">Next →</button>
          </div>
        </div>
      )}

      {/* Step 3 — Confirm */}
      {step === 3 && (
        <div className="space-y-3">
          <div className="rounded-xl bg-secondary/30 border border-border p-3 space-y-1.5 text-sm">
            <p><span className="text-muted-foreground text-xs">Artist</span><br /><span className="font-semibold">{displayName}</span></p>
            <p><span className="text-muted-foreground text-xs">Style</span><br /><span className="font-semibold">{style}</span></p>
            <p><span className="text-muted-foreground text-xs">Placement</span><br /><span className="font-semibold">{placement}</span></p>
            <p><span className="text-muted-foreground text-xs">Description</span><br /><span className="font-normal text-xs leading-relaxed">{description}</span></p>
            {referenceUrls.length > 0 && (
              <div className="flex gap-2 pt-1">
                {referenceUrls.map((url, i) => (
                  <img key={i} src={url} alt="" className="w-12 h-12 rounded-lg object-cover border border-border" />
                ))}
              </div>
            )}
          </div>
          <p className="text-xs text-muted-foreground">Your profile info (name, phone, DOB) will be shared automatically so {displayName} has everything they need.</p>
          <div className="flex gap-2">
            <button onClick={() => setStep(2)} className="flex-1 h-10 rounded-xl border border-border text-sm font-semibold">← Back</button>
            <button
              onClick={handleSubmit}
              disabled={createConsultation.isPending}
              className="flex-1 h-10 rounded-xl bg-primary text-white font-semibold text-sm disabled:opacity-40"
            >
              {createConsultation.isPending ? "Sending..." : "Send Request ✓"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Discover Artist Card ─────────────────────────────────────
function DiscoverArtistCard({
  artist,
  clientId,
}: {
  artist: any;
  clientId: string;
}) {
  const [, setLocation] = useLocation();
  // null = collapsed | "portfolio" | "storefront" | "consultation"
  const [expanded, setExpanded] = useState<"portfolio" | "storefront" | "consultation" | null>(null);
  const utils = trpc.useUtils();

  const getOrCreate = trpc.conversations.getOrCreate.useMutation({
    onSuccess: (conv) => {
      utils.conversations.list.invalidate();
      setLocation(`/chat/${conv.id}`);
    },
  });

  const displayName = artist.displayName || artist.businessName || artist.name || "Artist";
  const bannerUrl = artist.funnelBannerUrl || null;
  const avatarUrl = artist.avatar || null;
  const location = artist.city || (artist.businessAddress ? artist.businessAddress.split(",")[0] : null);
  const keywordList = (artist.keywords || "").split(",").map((k: string) => k.trim()).filter(Boolean);

  const toggle = (section: "portfolio" | "storefront" | "consultation") =>
    setExpanded(prev => (prev === section ? null : section));

  const handleMessage = () => {
    if (clientId) getOrCreate.mutate({ artistId: artist.id, clientId });
  };

  return (
    <div className="w-full rounded-2xl overflow-hidden bg-[#111] shadow-lg border border-border">
      {/* Tappable card header → toggles portfolio */}
      <button
        className="w-full text-left focus:outline-none"
        onClick={() => toggle("portfolio")}
      >
        {/* Banner */}
        <div className="relative h-[100px] overflow-hidden">
          {bannerUrl
            ? <img src={bannerUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
            : <div className="absolute inset-0 bg-gradient-to-br from-primary/30 via-accent/20 to-primary/10" />}
          <div className="absolute inset-0 bg-gradient-to-t from-[#111] via-black/40 to-transparent" />
        </div>

        {/* Info + action buttons row */}
        <div
          className="relative -mt-7 flex items-end gap-3 px-4 pb-3"
          onClick={e => e.stopPropagation()} // prevent card toggle when tapping buttons
        >
          {/* Avatar (part of the button but we stop propagation on action row) */}
          <div className="w-12 h-12 rounded-full border-2 border-border overflow-hidden bg-secondary/50 shrink-0 shadow-lg">
            {avatarUrl
              ? <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
              : <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary to-accent">
                  <span className="text-white font-bold text-lg">{displayName.charAt(0).toUpperCase()}</span>
                </div>
            }
          </div>
          <div
            className="flex-1 min-w-0 pb-1 cursor-pointer"
            onClick={e => { e.stopPropagation(); toggle("portfolio"); }}
          >
            <p className="text-white font-bold text-base leading-tight truncate drop-shadow-md">{displayName}</p>
            {location && (
              <div className="flex items-center gap-1 mt-0.5">
                <MapPin className="w-3 h-3 text-muted-foreground shrink-0" />
                <p className="text-muted-foreground text-xs truncate">{location}</p>
              </div>
            )}
            {expanded === null && (
              <p className="text-white/30 text-[10px] mt-0.5">Tap to view portfolio</p>
            )}
          </div>
          {/* Action buttons */}
          <div className="flex items-center gap-1.5 pb-1 shrink-0">
            <button
              onClick={() => toggle("storefront")}
              className={`w-9 h-9 rounded-full border flex items-center justify-center transition-all ${
                expanded === "storefront"
                  ? "bg-foreground text-background border-white"
                  : "bg-secondary/50 text-white border-border"
              }`}
            >
              <ShoppingBag className="w-4 h-4" />
            </button>
            <button
              onClick={() => toggle("consultation")}
              className={`w-9 h-9 rounded-full border flex items-center justify-center transition-all ${
                expanded === "consultation"
                  ? "bg-primary text-white border-primary"
                  : "bg-secondary/50 text-white border-border"
              }`}
            >
              <CalendarPlus className="w-4 h-4" />
            </button>
            <button
              onClick={handleMessage}
              disabled={getOrCreate.isPending || !clientId}
              className="w-9 h-9 rounded-full bg-secondary/50 text-white border border-border flex items-center justify-center disabled:opacity-50"
            >
              {getOrCreate.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageCircle className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Keywords */}
        {keywordList.length > 0 && (
          <div
            className="flex flex-wrap gap-1.5 px-4 pb-3"
            onClick={e => e.stopPropagation()}
          >
            {keywordList.slice(0, 4).map((kw: string) => (
              <span key={kw} className="px-2.5 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-[11px] font-medium">
                {kw}
              </span>
            ))}
          </div>
        )}
      </button>

      {/* Expandable sections */}
      <AnimatePresence initial={false}>
        {expanded === "portfolio" && (
          <motion.div
            key="portfolio"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="border-t border-border overflow-hidden"
          >
            <PortfolioExpand
              artistId={artist.id}
              artistName={displayName}
              onMessage={handleMessage}
              showMessageCTA={!!clientId}
            />
          </motion.div>
        )}
        {expanded === "storefront" && (
          <motion.div
            key="storefront"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="border-t border-border overflow-hidden"
          >
            <CartProvider>
              <DiscoverStorefront
                artistId={artist.id}
                artistSlug={artist.publicSlug || ""}
              />
            </CartProvider>
          </motion.div>
        )}
        {expanded === "consultation" && (
          <motion.div
            key="consultation"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="border-t border-border overflow-hidden"
          >
            <ConsultationForm
              artist={artist}
              onClose={() => setExpanded(null)}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}


// ── Main feed tab ────────────────────────────────────────────
interface ClientFeedTabProps {
  conversations: any[];
  setIsShopExpanded: (expanded: boolean) => void;
}

export function ClientFeedTab({ conversations, setIsShopExpanded }: ClientFeedTabProps) {
  const { user } = useAuth();
  const clientId = user?.id || "";

  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");
  const [mapOpen, setMapOpen] = useState(false);

  const { data: allArtists = [], isLoading: loadingArtists } = trpc.auth.listArtists.useQuery();

  // My Artists search filter
  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    const q = searchQuery.toLowerCase();
    return conversations.filter(conv => {
      const a = conv.otherUser;
      if (!a) return false;
      return (
        (a.name || "").toLowerCase().includes(q) ||
        (a.displayName || "").toLowerCase().includes(q) ||
        (a.keywords || "").toLowerCase().includes(q)
      );
    });
  }, [conversations, searchQuery]);

  // Discover artists filter
  const filteredDiscoverArtists = useMemo(() => {
    return (allArtists as any[]).filter(artist => {
      const keywords  = (artist.keywords     || "").toLowerCase();
      const name      = (artist.name          || "").toLowerCase();
      const dispName  = (artist.displayName   || "").toLowerCase();
      const bizName   = (artist.businessName  || "").toLowerCase();
      const email     = (artist.email         || "").toLowerCase();
      const q         = searchQuery.trim().toLowerCase();

      const matchesFilter = activeFilter === "All" || keywords.includes(activeFilter.toLowerCase());
      const matchesSearch = !q ||
        name.includes(q) || dispName.includes(q) ||
        bizName.includes(q) || email.includes(q) || keywords.includes(q);

      return matchesFilter && matchesSearch;
    });
  }, [allArtists, activeFilter, searchQuery]);

  return (
    <>
      {/* Full-screen map overlay */}
      <AnimatePresence>
        {mapOpen && (
          <ArtistMapOverlay
            onClose={() => setMapOpen(false)}
            conversations={conversations}
          />
        )}
      </AnimatePresence>

      <div className="flex flex-col h-full relative">
        <div className="flex-1 overflow-y-auto mobile-scroll px-4 pt-4 pb-[80px] space-y-6">

          {/* ── Discover Nearby — INVISIBLE outer container ─── */}
          {/* No card border/bg — full width, edge-to-edge inside padding */}
          <div>
            {/* Section header */}
            <div className="flex items-center gap-2 mb-3">
              <MapPin className="w-4 h-4 text-primary" />
              <h3 className="font-bold text-base">Discover Artists</h3>
            </div>

            {/* "See Artist Map" CTA */}
            <button
              onClick={() => setMapOpen(true)}
              className="w-full flex items-center justify-between px-4 py-3.5 mb-3 rounded-2xl bg-gradient-to-r from-primary/10 to-accent/10 hover:from-primary/15 hover:to-accent/15 border border-primary/20 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center">
                  <MapPin className="w-4 h-4 text-primary" />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-sm">See Artist Map</p>
                  <p className="text-xs text-muted-foreground">
                    {(allArtists as any[]).filter((a: any) => a.lat && a.lng).length} artists near Brisbane
                  </p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </button>

            {/* Style filter chips */}
            <div className="flex gap-2 overflow-x-auto no-scrollbar mb-3">
              {STYLE_FILTERS.map(filter => (
                <button
                  key={filter}
                  onClick={() => setActiveFilter(filter)}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                    activeFilter === filter
                      ? "bg-primary text-white border-primary shadow-md"
                      : "bg-secondary/50 text-muted-foreground border-border hover:border-primary/50"
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>

            {/* Discover artist cards */}
            <div className="space-y-3">
              {loadingArtists ? (
                <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Finding artists...
                </div>
              ) : filteredDiscoverArtists.length === 0 ? (
                <div className="text-center py-8">
                  <MapPin className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-muted-foreground text-sm">No artists match your search</p>
                </div>
              ) : (
                filteredDiscoverArtists.map((artist: any) => (
                  <DiscoverArtistCard key={artist.id} artist={artist} clientId={clientId} />
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
              placeholder="Search by name, style, suburb..."
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
