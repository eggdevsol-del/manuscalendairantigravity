/**
 * ArtistProfileTab — Artist's own profile (as clients see it)
 * ──────────────────────────────────────────────────────────
 * Default view when artist taps "Profile" in bottom nav.
 * Shows the same layout clients see (avatar, bio, grid).
 * 
 * Features:
 * - Read-only profile view (mirrors ArtistProfileOverlay)
 * - "Edit Profile" toggle → inline editing
 * - ⚙️ gear icon → navigates to /settings
 * - Empty portfolio → Instagram import prompt
 * - Tap grid image → focus feed view
 */
import React, { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Settings, MapPin, Mail, Phone, Globe, Pencil, Instagram, ImagePlus, Loader2, Camera, Play, Trash2, Check } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { FeedCard, FeedCardData } from "@/features/feed/FeedCard";
import { UserAvatar } from "@/components/ui/ssot";
import { toast } from "sonner";
import { resizeImage } from "@/lib/resizeImage";
import "@/features/client-home/artistProfile.css";

export default function ArtistProfileTab() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [editMode, setEditMode] = useState(false);
  const [feedViewImageId, setFeedViewImageId] = useState<number | null>(null);
  const feedScrollRef = useRef<HTMLDivElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Select mode state
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // File upload state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  // Edit form state
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [slug, setSlug] = useState("");
  const [showEmail, setShowEmail] = useState(true);
  const [showPhone, setShowPhone] = useState(true);
  const [showCity, setShowCity] = useState(true);
  const [showWebsite, setShowWebsite] = useState(false);
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  const utils = trpc.useUtils();

  // Fetch own public profile
  const { data: profile, isLoading } = trpc.feed.getArtistPublicProfile.useQuery(
    { artistId: user?.id || "" },
    { enabled: !!user?.id, staleTime: 30000 }
  );

  // Fetch own settings for edit mode
  const { data: settings } = trpc.artistSettings.get.useQuery(undefined, {
    staleTime: 30000,
  });

  // Fetch own portfolio
  const { data: portfolio = [] } = trpc.portfolio.list.useQuery(undefined, { staleTime: 30000 });

  // Populate edit form when settings load
  useEffect(() => {
    if (settings) {
      setDisplayName(settings.displayName || user?.name || "");
      setBio(user?.bio || "");
      setSlug(settings.publicSlug || "");
      setShowEmail(!!settings.showEmail);
      setShowPhone(!!settings.showPhone);
      setShowCity(!!settings.showCity);
      setShowWebsite(!!settings.showWebsite);
      setWebsiteUrl(settings.websiteUrl || "");
    }
  }, [settings, user]);

  // Save mutations
  const upsertSettings = trpc.artistSettings.upsert.useMutation({
    onSuccess: () => {
      utils.feed.getArtistPublicProfile.invalidate();
      utils.artistSettings.get.invalidate();
    },
  });

  const updateProfile = trpc.auth.updateProfile.useMutation({
    onSuccess: () => {
      utils.feed.getArtistPublicProfile.invalidate();
      utils.auth.me.invalidate();
    },
  });

  // Portfolio mutations
  const uploadImage = trpc.upload.uploadImage.useMutation();
  const createItem = trpc.portfolio.create.useMutation({
    onSuccess: () => {
      utils.portfolio.list.invalidate();
      utils.feed.getArtistPublicProfile.invalidate();
      toast.success("Image added");
    },
    onError: () => toast.error("Failed to upload"),
  });
  const bulkDeleteMutation = trpc.portfolio.bulkDelete.useMutation({
    onSuccess: (data) => {
      utils.portfolio.list.invalidate();
      utils.feed.getArtistPublicProfile.invalidate();
      toast.success(`${data.deletedCount} item${data.deletedCount !== 1 ? "s" : ""} deleted`);
      setSelectedIds(new Set());
      setSelectMode(false);
    },
    onError: () => toast.error("Failed to delete items"),
    onSettled: () => setBulkDeleting(false),
  });

  const handleSave = useCallback(async () => {
    setSavingProfile(true);
    try {
      await Promise.all([
        upsertSettings.mutateAsync({
          displayName,
          publicSlug: slug,
          showEmail: showEmail ? 1 : 0,
          showPhone: showPhone ? 1 : 0,
          showCity: showCity ? 1 : 0,
          showWebsite: showWebsite ? 1 : 0,
          websiteUrl,
        }),
        updateProfile.mutateAsync({ bio }),
      ]);
      toast.success("Profile saved");
      setEditMode(false);
    } catch {
      toast.error("Failed to save");
    } finally {
      setSavingProfile(false);
    }
  }, [displayName, slug, bio, showEmail, showPhone, showCity, showWebsite, websiteUrl, upsertSettings, updateProfile]);

  // Avatar upload
  const handleAvatarUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    try {
      const resized = await resizeImage(file, 400, 400);
      const formData = new FormData();
      formData.append("file", resized);
      formData.append("folder", "avatars");
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const { url } = await res.json();
      await updateProfile.mutateAsync({ avatar: url });
      toast.success("Avatar updated");
    } catch {
      toast.error("Upload failed");
    } finally {
      setUploadingAvatar(false);
      if (avatarInputRef.current) avatarInputRef.current.value = "";
    }
  }, [updateProfile]);

  // File upload handler
  const handleFilePick = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    try {
      for (const file of files.slice(0, 10)) {
        const reader = new FileReader();
        const base64 = await new Promise<string>((res) => {
          reader.onload = () => res(reader.result as string);
          reader.readAsDataURL(file);
        });
        const result = await uploadImage.mutateAsync({
          base64,
          filename: file.name,
          folder: "portfolio",
        });
        if (result.url) {
          await createItem.mutateAsync({ imageUrl: result.url });
        }
      }
    } catch {
      toast.error("One or more images failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [uploadImage, createItem]);

  // Select mode handlers
  const toggleSelect = useCallback((id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(portfolio.map((p: any) => p.id)));
  }, [portfolio]);

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
  };

  const handleBulkDelete = useCallback(() => {
    if (selectedIds.size === 0) return;
    setBulkDeleting(true);
    bulkDeleteMutation.mutate({ ids: Array.from(selectedIds) });
  }, [selectedIds, bulkDeleteMutation]);

  // Feed cards for feed view
  const feedCards: FeedCardData[] = useMemo(() => {
    if (!profile) return [];
    return profile.portfolio.map((item) => ({
      id: item.id,
      artistId: user?.id || "",
      artistName: profile.displayName,
      artistAvatar: profile.avatar,
      artistCity: profile.showCity ? profile.city : null,
      artistSlug: profile.slug,
      keywords: profile.keywords,
      imageUrl: item.imageUrl,
      description: item.description,
      createdAt: null,
      likeCount: 0,
      isLiked: false,
      mediaType: (item as any).mediaType || null,
      videoUrl: (item as any).mediaType === "video" ? `/api/ig-video/${item.id}` : null,
    }));
  }, [profile, user?.id]);

  const reorderedFeedCards = useMemo(() => {
    if (!feedViewImageId) return feedCards;
    const idx = feedCards.findIndex((c) => c.id === feedViewImageId);
    if (idx <= 0) return feedCards;
    return [...feedCards.slice(idx), ...feedCards.slice(0, idx)];
  }, [feedCards, feedViewImageId]);

  const handleLike = useCallback(() => {}, []);
  const handleShare = useCallback(() => {}, []);
  const handleArtistTap = useCallback(() => {}, []);

  useEffect(() => {
    if (feedViewImageId && feedScrollRef.current) {
      feedScrollRef.current.scrollTop = 0;
    }
  }, [feedViewImageId]);

  const inFeedView = feedViewImageId !== null;

  if (isLoading) {
    return (
      <div className="artist-profile-overlay artist-profile-page">
        <div className="artist-profile-loading">
          <Loader2 className="animate-spin" size={32} />
        </div>
      </div>
    );
  }

  return (
    <div className="artist-profile-overlay artist-profile-page">
      {/* Header bar */}
      <div className="artist-profile-header">
        {inFeedView ? (
          <button className="artist-profile-close" onClick={() => setFeedViewImageId(null)}>
            back
          </button>
        ) : (
          <button
            onClick={() => setLocation("/settings")}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--foreground)", padding: 8 }}
            aria-label="Settings"
          >
            <Settings size={22} />
          </button>
        )}
        <span className="artist-profile-header-name">{profile?.displayName || user?.name || "Profile"}</span>
        {inFeedView ? (
          <div style={{ width: 40 }} />
        ) : editMode ? (
          <div style={{ display: "flex", gap: 6 }}>
            <button
              onClick={() => setEditMode(false)}
              style={{ background: "none", border: "1px solid var(--color-border)", borderRadius: 8, padding: "4px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer", color: "var(--foreground)" }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={savingProfile}
              style={{ background: "var(--color-primary)", border: "none", borderRadius: 8, padding: "4px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", color: "var(--color-bg-base)" }}
            >
              {savingProfile ? <Loader2 size={14} className="animate-spin" /> : "Save"}
            </button>
          </div>
        ) : (
          <button
            onClick={() => setEditMode(true)}
            style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "1px solid var(--color-border)", borderRadius: 8, padding: "4px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer", color: "var(--foreground)" }}
          >
            <Pencil size={12} />
            Edit Profile
          </button>
        )}
      </div>

      {/* Content */}
      <AnimatePresence mode="wait" initial={false}>
        {inFeedView ? (
          <motion.div
            key="feed-view"
            className="artist-profile-feed-view"
            ref={feedScrollRef}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            <div className="discover-feed-cards">
              {reorderedFeedCards.map((card, index) => (
                <FeedCard
                  key={`profile-feed-${card.id}-${index}`}
                  card={card}
                  onLike={handleLike}
                  onShare={handleShare}
                  onArtistTap={handleArtistTap}
                  compact
                  focusMode
                />
              ))}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="grid-view"
            className="artist-profile-scroll"
            initial={{ opacity: 1 }}
            animate={{ opacity: 1 }}
          >
            {profile ? (
              <>
                {/* Profile info section */}
                <div className="artist-profile-info">
                  {/* Avatar */}
                  <div style={{ position: "relative", marginBottom: 12 }}>
                    <UserAvatar
                      name={profile.displayName}
                      avatar={profile.avatar}
                      size="2xl"
                      ring
                      className="w-[88px] h-[88px]"
                    />
                    {editMode && (
                      <button
                        onClick={() => avatarInputRef.current?.click()}
                        style={{
                          position: "absolute", bottom: 0, right: -4,
                          width: 28, height: 28, borderRadius: "50%",
                          background: "var(--color-primary)", border: "2px solid var(--color-bg-base)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          cursor: "pointer",
                        }}
                      >
                        {uploadingAvatar ? <Loader2 size={12} className="animate-spin" style={{ color: "var(--color-bg-base)" }} /> : <Camera size={12} style={{ color: "var(--color-bg-base)" }} />}
                      </button>
                    )}
                    <input ref={avatarInputRef} type="file" accept="image/*" hidden onChange={handleAvatarUpload} />
                  </div>

                  {/* Name & handle */}
                  {editMode ? (
                    <>
                      <input
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="Display name"
                        style={{ width: "80%", textAlign: "center", fontSize: 18, fontWeight: 700, background: "var(--color-bg-secondary, rgba(255,255,255,0.06))", border: "1px solid var(--color-border)", borderRadius: 10, padding: "8px 14px", color: "var(--foreground)", marginBottom: 6 }}
                      />
                      <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 8 }}>
                        <span style={{ color: "var(--color-text-secondary)", fontSize: 14 }}>@</span>
                        <input
                          value={slug}
                          onChange={(e) => setSlug(e.target.value.replace(/[^a-z0-9._]/gi, "").toLowerCase())}
                          placeholder="handle"
                          style={{ fontSize: 14, background: "var(--color-bg-secondary, rgba(255,255,255,0.06))", border: "1px solid var(--color-border)", borderRadius: 8, padding: "4px 10px", color: "var(--color-text-secondary)" }}
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <h2 className="artist-profile-name">{profile.displayName}</h2>
                      {profile.slug && <span className="artist-profile-handle">@{profile.slug}</span>}
                    </>
                  )}

                  {/* Bio */}
                  {editMode ? (
                    <textarea
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      placeholder="Tell clients about yourself..."
                      rows={3}
                      style={{ width: "90%", fontSize: 13, background: "var(--color-bg-secondary, rgba(255,255,255,0.06))", border: "1px solid var(--color-border)", borderRadius: 10, padding: "10px 14px", color: "var(--foreground)", resize: "none", marginBottom: 10 }}
                    />
                  ) : (
                    profile.bio && <p className="artist-profile-bio">{profile.bio}</p>
                  )}

                  {/* Contact info (read-only view) / Visibility toggles (edit mode) */}
                  {editMode ? (
                    <div style={{ width: "90%", display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Contact Visibility</span>
                      {[
                        { label: "Show Email", icon: Mail, value: showEmail, set: setShowEmail },
                        { label: "Show Phone", icon: Phone, value: showPhone, set: setShowPhone },
                        { label: "Show City", icon: MapPin, value: showCity, set: setShowCity },
                        { label: "Show Website", icon: Globe, value: showWebsite, set: setShowWebsite },
                      ].map(({ label, icon: Icon, value, set }) => (
                        <label key={label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", background: "var(--color-bg-secondary, rgba(255,255,255,0.06))", borderRadius: 10, cursor: "pointer" }}>
                          <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--foreground)" }}>
                            <Icon size={14} />
                            {label}
                          </span>
                          <input type="checkbox" checked={value} onChange={() => set(!value)} style={{ width: 18, height: 18, accentColor: "var(--color-primary)" }} />
                        </label>
                      ))}
                      {showWebsite && (
                        <input
                          value={websiteUrl}
                          onChange={(e) => setWebsiteUrl(e.target.value)}
                          placeholder="https://your-website.com"
                          style={{ fontSize: 13, background: "var(--color-bg-secondary, rgba(255,255,255,0.06))", border: "1px solid var(--color-border)", borderRadius: 10, padding: "10px 14px", color: "var(--foreground)" }}
                        />
                      )}
                    </div>
                  ) : (
                    <div className="artist-profile-contact">
                      {profile.showCity && profile.city && (
                        <div className="artist-profile-contact-item">
                          <MapPin size={14} />
                          <span>{profile.city}</span>
                        </div>
                      )}
                      {profile.email && (
                        <div className="artist-profile-contact-item">
                          <Mail size={14} />
                          <span>{profile.email}</span>
                        </div>
                      )}
                      {profile.phone && (
                        <div className="artist-profile-contact-item">
                          <Phone size={14} />
                          <span>{profile.phone}</span>
                        </div>
                      )}
                      {profile.website && (
                        <div className="artist-profile-contact-item">
                          <Globe size={14} />
                          <span>{profile.website}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Keywords */}
                  {!editMode && profile.keywords.length > 0 && (
                    <div className="artist-profile-keywords">
                      {profile.keywords.map((kw, i) => (
                        <span key={i} className="artist-profile-keyword">{kw}</span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Portfolio section */}
                {/* Action bar — only in edit mode */}
                {editMode && portfolio.length > 0 && (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px 8px" }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                      {selectMode ? `${selectedIds.size} selected` : `Portfolio (${portfolio.length})`}
                    </span>
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      {selectMode ? (
                        <>
                          <button
                            onClick={exitSelectMode}
                            style={{ background: "transparent", border: "1px solid var(--color-border)", borderRadius: 8, padding: "5px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer", color: "var(--foreground)" }}
                          >
                            Cancel
                          </button>
                          <button
                            onClick={selectAll}
                            style={{ background: "var(--color-bg-secondary, rgba(255,255,255,0.08))", border: "none", borderRadius: 8, padding: "5px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer", color: "var(--foreground)" }}
                          >
                            All
                          </button>
                          <button
                            onClick={handleBulkDelete}
                            disabled={selectedIds.size === 0 || bulkDeleting}
                            style={{ display: "flex", alignItems: "center", gap: 4, background: selectedIds.size > 0 ? "rgba(220,50,50,0.85)" : "rgba(220,50,50,0.4)", color: "white", border: "none", borderRadius: 8, padding: "5px 10px", fontSize: 11, fontWeight: 600, cursor: selectedIds.size > 0 ? "pointer" : "default" }}
                          >
                            {bulkDeleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                            {selectedIds.size > 0 ? `Delete (${selectedIds.size})` : "Delete"}
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => setLocation("/settings?section=instagram")}
                            style={{ display: "flex", alignItems: "center", gap: 4, background: "linear-gradient(135deg, #833AB4, #E1306C, #F77737)", color: "white", border: "none", borderRadius: 8, padding: "5px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}
                          >
                            <Instagram size={12} />
                            Import
                          </button>
                          <button
                            onClick={() => setSelectMode(true)}
                            style={{ background: "var(--color-bg-secondary, rgba(255,255,255,0.08))", border: "none", borderRadius: 8, padding: "5px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer", color: "var(--foreground)" }}
                          >
                            Select
                          </button>
                          <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploading}
                            style={{ display: "flex", alignItems: "center", gap: 4, background: "var(--color-primary)", color: "var(--color-bg-base)", border: "none", borderRadius: 8, padding: "5px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}
                          >
                            {uploading ? <Loader2 size={12} className="animate-spin" /> : <ImagePlus size={12} />}
                            Add
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}
                <input ref={fileInputRef} type="file" accept="image/*" multiple hidden onChange={handleFilePick} />
                {portfolio.length === 0 ? (
                  /* ── Empty state — Instagram import prompt ── */
                  <div style={{
                    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                    padding: "48px 24px", gap: 16, textAlign: "center",
                  }}>
                    <div style={{
                      width: 72, height: 72, borderRadius: "50%",
                      background: "linear-gradient(135deg, rgba(131,58,180,0.15), rgba(225,48,108,0.15), rgba(247,119,55,0.15))",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <Instagram size={32} style={{ color: "#E1306C" }} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: 18, fontWeight: 700, color: "var(--foreground)", marginBottom: 6 }}>
                        Your portfolio is empty
                      </h3>
                      <p style={{ fontSize: 13, color: "var(--color-text-secondary)", lineHeight: 1.5, maxWidth: 280 }}>
                        Import your work from Instagram to get started, or upload photos directly.
                      </p>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%", maxWidth: 260, marginTop: 4 }}>
                      <button
                        onClick={() => setLocation("/settings?section=instagram")}
                        style={{
                          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                          background: "linear-gradient(135deg, #833AB4, #E1306C, #F77737)",
                          color: "white", border: "none", borderRadius: 12, padding: "12px 20px",
                          fontSize: 14, fontWeight: 600, cursor: "pointer",
                        }}
                      >
                        <Instagram size={18} />
                        Import from Instagram
                      </button>
                      <button
                        onClick={() => setLocation("/settings?section=profile")}
                        style={{
                          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                          background: "var(--color-bg-secondary, rgba(255,255,255,0.08))",
                          color: "var(--foreground)", border: "1px solid var(--color-border)", borderRadius: 12, padding: "12px 20px",
                          fontSize: 14, fontWeight: 600, cursor: "pointer",
                        }}
                      >
                        <ImagePlus size={18} />
                        Upload Photos
                      </button>
                    </div>
                  </div>
                ) : (
                  /* ── Portfolio grid — 3 columns ── */
                  <div className="artist-profile-grid">
                    {profile.portfolio.map((item) => (
                      <div
                        key={item.id}
                        className="artist-profile-grid-item"
                        onClick={() => {
                          if (selectMode) {
                            toggleSelect(item.id);
                          } else {
                            setFeedViewImageId(item.id);
                          }
                        }}
                        style={{ position: "relative" }}
                      >
                        <img
                          src={item.imageUrl}
                          alt={item.description || "Portfolio"}
                          loading="lazy"
                          style={selectMode && selectedIds.has(item.id) ? { opacity: 0.5 } : undefined}
                        />
                        {(item as any).mediaType === "video" && (
                          <div style={{ position: "absolute", top: 6, right: 6, background: "rgba(0,0,0,0.5)", borderRadius: 4, padding: "2px 5px", display: "flex", alignItems: "center", gap: 2 }}>
                            <Play size={8} color="white" fill="white" />
                          </div>
                        )}
                        {selectMode && (
                          <div style={{
                            position: "absolute", top: 6, left: 6,
                            width: 22, height: 22, borderRadius: "50%",
                            background: selectedIds.has(item.id) ? "var(--color-primary)" : "rgba(0,0,0,0.4)",
                            border: "2px solid white",
                            display: "flex", alignItems: "center", justifyContent: "center",
                          }}>
                            {selectedIds.has(item.id) && <Check size={12} color="white" strokeWidth={3} />}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="artist-profile-loading">
                <p>Could not load profile</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
