/**
 * ProfileSettings — Artist profile editor (replaces PortfolioSettings)
 * ─────────────────────────────────────────────────────────────────────
 * Shows the artist's profile exactly as clients see it, but editable.
 * - Editable: avatar, display name, handle, bio, contact toggles
 * - Drag-and-drop portfolio grid with delete + add
 * - WYSIWYG: matches ArtistProfileOverlay layout
 */
import { useRef, useState, useCallback, useEffect } from "react";
import {
  ImagePlus, Trash2, Loader2, GripVertical,
  Camera, Mail, Phone, MapPin, Globe,
} from "lucide-react";
import { PageHeader } from "@/components/ui/ssot";
import { UserAvatar } from "@/components/ui/ssot/UserAvatar";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import "../../features/client-home/artistProfile.css";

interface ProfileSettingsProps {
  onBack: () => void;
}

function SortablePortfolioItem({
  item,
  onDelete,
  deletingId,
}: {
  item: { id: number; imageUrl: string; description: string | null };
  onDelete: (id: number) => void;
  deletingId: number | null;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : 1,
    position: "relative" as const,
    aspectRatio: "1",
    overflow: "hidden" as const,
  };

  return (
    <div ref={setNodeRef} style={style} className="artist-profile-grid-item">
      <img
        src={item.imageUrl}
        alt={item.description || "Portfolio"}
        loading="lazy"
      />
      <div
        {...attributes}
        {...listeners}
        style={{
          position: "absolute",
          top: 4,
          left: 4,
          width: 24,
          height: 24,
          borderRadius: "50%",
          background: "rgba(0,0,0,0.6)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "grab",
          touchAction: "none",
        }}
      >
        <GripVertical size={12} color="white" />
      </div>
      <button
        onClick={() => onDelete(item.id)}
        disabled={deletingId === item.id}
        style={{
          position: "absolute",
          top: 4,
          right: 4,
          width: 24,
          height: 24,
          borderRadius: "50%",
          background: "rgba(220,50,50,0.85)",
          border: "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
        }}
      >
        {deletingId === item.id ? (
          <Loader2 size={12} color="white" className="animate-spin" />
        ) : (
          <Trash2 size={12} color="white" />
        )}
      </button>
    </div>
  );
}

export function ProfileSettings({ onBack }: ProfileSettingsProps) {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);

  const utils = trpc.useUtils();

  const { data: portfolio = [], isLoading: portfolioLoading } =
    trpc.portfolio.list.useQuery(undefined, { staleTime: 30000 });

  const { data: settings } = trpc.artistSettings.get.useQuery(undefined, {
    staleTime: 30000,
  });

  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [slug, setSlug] = useState("");
  const [showEmail, setShowEmail] = useState(true);
  const [showPhone, setShowPhone] = useState(true);
  const [showCity, setShowCity] = useState(true);
  const [showWebsite, setShowWebsite] = useState(false);
  const [websiteUrl, setWebsiteUrl] = useState("");

  useEffect(() => {
    if (settings) {
      setDisplayName(settings.displayName || user?.name || "");
      setBio((user as any)?.bio || "");
      setSlug(settings.publicSlug || "");
      setShowEmail((settings as any).showEmail ?? true);
      setShowPhone((settings as any).showPhone ?? true);
      setShowCity((settings as any).showCity ?? true);
      setShowWebsite((settings as any).showWebsite ?? false);
      setWebsiteUrl((settings as any).websiteUrl || "");
    }
  }, [settings, user]);

  const uploadImage = trpc.upload.uploadImage.useMutation();
  const updateProfile = trpc.auth.updateProfile.useMutation({
    onSuccess: () => utils.auth.me.invalidate(),
  });
  const createItem = trpc.portfolio.create.useMutation({
    onSuccess: () => {
      utils.portfolio.list.invalidate();
      toast.success("Image added");
    },
    onError: () => toast.error("Failed to upload"),
  });
  const deleteItem = trpc.portfolio.delete.useMutation({
    onSuccess: () => {
      utils.portfolio.list.invalidate();
      toast.success("Image removed");
    },
    onError: () => toast.error("Failed to remove"),
    onSettled: () => setDeletingId(null),
  });
  const reorderMutation = trpc.portfolio.reorder.useMutation({
    onSuccess: () => utils.portfolio.list.invalidate(),
  });
  const upsertSettings = trpc.artistSettings.upsert.useMutation({
    onSuccess: () => {
      utils.artistSettings.get.invalidate();
      toast.success("Profile saved");
      setSavingProfile(false);
    },
    onError: () => {
      toast.error("Failed to save");
      setSavingProfile(false);
    },
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = portfolio.findIndex((p: any) => p.id === active.id);
      const newIndex = portfolio.findIndex((p: any) => p.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;

      const reordered = [...portfolio];
      const [moved] = reordered.splice(oldIndex, 1);
      reordered.splice(newIndex, 0, moved);

      const items = reordered.map((item: any, i: number) => ({
        id: item.id,
        sortOrder: i,
      }));

      reorderMutation.mutate({ items });
    },
    [portfolio, reorderMutation]
  );

  const handleFilePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
  };

  const handleDelete = (id: number) => {
    setDeletingId(id);
    deleteItem.reset();
    deleteItem.mutate({ id });
  };

  const handleSaveProfile = () => {
    setSavingProfile(true);
    upsertSettings.mutate({
      displayName,
      publicSlug: slug,
      showEmail: showEmail ? 1 : 0,
      showPhone: showPhone ? 1 : 0,
      showCity: showCity ? 1 : 0,
      showWebsite: showWebsite ? 1 : 0,
      websiteUrl,
    });
  };

  const portfolioIds = portfolio.map((p: any) => p.id);

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Profile"
        subtitle="Edit how clients see you"
        onBack={onBack}
        rightAction={
          <button
            onClick={handleSaveProfile}
            disabled={savingProfile}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-50"
          >
            {savingProfile ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
            Save
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto">
        <div className="artist-profile-info">
          {/* Avatar */}
          <div
            className="artist-profile-avatar-large"
            style={{ cursor: "pointer", position: "relative", display: "flex", justifyContent: "center", alignItems: "center", margin: "0 auto" }}
            onClick={() => avatarInputRef.current?.click()}
          >
            <UserAvatar name={user?.name} avatar={user?.avatar} size="xl" />
            <div
              style={{
                position: "absolute",
                bottom: 0,
                right: 0,
                width: 24,
                height: 24,
                borderRadius: "50%",
                background: "var(--color-primary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {uploadingAvatar ? (
                <Loader2 size={12} color="var(--color-bg-base)" className="animate-spin" />
              ) : (
                <Camera size={12} color="var(--color-bg-base)" />
              )}
            </div>
          </div>
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            hidden
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const inputEl = e.target;
              setUploadingAvatar(true);
              try {
                const reader = new FileReader();
                reader.onload = async () => {
                  try {
                    const base64 = reader.result as string;
                    const result = await uploadImage.mutateAsync({
                      base64,
                      filename: file.name,
                      folder: "avatars",
                    });
                    if (result.url) {
                      await updateProfile.mutateAsync({ avatar: result.url });
                      toast.success("Profile photo updated!");
                    }
                  } catch (err: any) {
                    toast.error(err.message || "Upload failed");
                  } finally {
                    setUploadingAvatar(false);
                    inputEl.value = "";
                  }
                };
                reader.readAsDataURL(file);
              } catch {
                setUploadingAvatar(false);
                inputEl.value = "";
              }
            }}
          />

          {/* Name */}
          <input
            className="booking-form-input"
            style={{ textAlign: "center", fontSize: 18, fontWeight: 700, maxWidth: 280, marginTop: 8 }}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Display Name"
          />

          {/* Handle */}
          <div style={{ display: "flex", alignItems: "center", gap: 2, marginTop: 4 }}>
            <span style={{ color: "var(--color-text-secondary)", fontSize: 13 }}>@</span>
            <input
              className="booking-form-input"
              style={{ fontSize: 13, padding: "4px 8px", width: 160 }}
              value={slug}
              onChange={(e) => setSlug(e.target.value.replace(/[^a-z0-9_-]/gi, "").toLowerCase())}
              placeholder="handle"
            />
          </div>

          {/* Bio */}
          <textarea
            className="booking-form-input"
            style={{ marginTop: 10, width: "100%", maxWidth: 320, minHeight: 60, fontSize: 13, textAlign: "center", resize: "none", fontFamily: "inherit" }}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Write a short bio..."
          />

          {/* Contact toggles */}
          <div style={{ marginTop: 16, width: "100%", maxWidth: 320, display: "flex", flexDirection: "column", gap: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Contact visibility
            </span>
            {([
              { label: "Email", icon: Mail, value: showEmail, set: setShowEmail },
              { label: "Phone", icon: Phone, value: showPhone, set: setShowPhone },
              { label: "City", icon: MapPin, value: showCity, set: setShowCity },
              { label: "Website", icon: Globe, value: showWebsite, set: setShowWebsite },
            ] as const).map(({ label, icon: Icon, value, set }) => (
              <label
                key={label}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "8px 12px", borderRadius: 10, background: "rgba(255,255,255,0.04)", cursor: "pointer",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Icon size={14} color="var(--color-text-secondary)" />
                  <span style={{ fontSize: 13, color: "var(--foreground)" }}>Show {label}</span>
                </div>
                <input type="checkbox" checked={!!value} onChange={(e) => set(e.target.checked)} style={{ accentColor: "var(--color-primary)" }} />
              </label>
            ))}
            {showWebsite && (
              <input
                className="booking-form-input"
                style={{ fontSize: 13, marginTop: 4 }}
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                placeholder="https://yourwebsite.com"
              />
            )}
          </div>
        </div>

        {/* Portfolio grid */}
        <div style={{ padding: "0 2px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px 8px" }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Portfolio ({portfolio.length})
            </span>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              style={{ display: "flex", alignItems: "center", gap: 4, background: "var(--color-primary)", color: "var(--color-bg-base)", border: "none", borderRadius: 8, padding: "5px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}
            >
              {uploading ? <Loader2 size={12} className="animate-spin" /> : <ImagePlus size={12} />}
              Add
            </button>
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" multiple hidden onChange={handleFilePick} />

          {portfolioLoading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
              <Loader2 className="animate-spin" size={24} />
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={portfolioIds} strategy={rectSortingStrategy}>
                <div className="artist-profile-grid">
                  {portfolio.map((item: any) => (
                    <SortablePortfolioItem key={item.id} item={item} onDelete={handleDelete} deletingId={deletingId} />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>
      </div>
    </div>
  );
}
