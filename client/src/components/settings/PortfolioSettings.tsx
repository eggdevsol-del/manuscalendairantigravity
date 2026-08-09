/**
 * PortfolioSettings.tsx
 * Artist-side settings panel for uploading and managing portfolio images.
 * Supports multi-select + bulk delete.
 */

import { useRef, useState, useCallback } from "react";
import { ImagePlus, Trash2, Loader2, Images, CheckCircle2, Play } from "lucide-react";
import { PageHeader } from "@/components/ui/ssot";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

interface PortfolioSettingsProps {
  onBack: () => void;
}

export function PortfolioSettings({ onBack }: PortfolioSettingsProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [selectMode, setSelectMode] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const utils = trpc.useUtils();

  const { data: portfolio = [], isLoading } = trpc.portfolio.list.useQuery(undefined, {
    staleTime: 30000,
  });

  const uploadImage = trpc.upload.uploadImage.useMutation();
  const createItem = trpc.portfolio.create.useMutation({
    onSuccess: () => {
      utils.portfolio.list.invalidate();
      toast.success("Image added to portfolio");
    },
    onError: () => toast.error("Failed to upload image"),
  });

  const deleteItem = trpc.portfolio.delete.useMutation({
    onSuccess: () => {
      utils.portfolio.list.invalidate();
      toast.success("Image removed");
    },
    onError: () => toast.error("Failed to remove image"),
    onSettled: () => setDeletingId(null),
  });

  const bulkDeleteMutation = trpc.portfolio.bulkDelete.useMutation({
    onSuccess: (data) => {
      utils.portfolio.list.invalidate();
      toast.success(`${data.deletedCount} item${data.deletedCount !== 1 ? "s" : ""} deleted`);
      setSelectedIds(new Set());
      setSelectMode(false);
    },
    onError: () => toast.error("Failed to delete items"),
    onSettled: () => setBulkDeleting(false),
  });

  const handleFilePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    try {
      for (const file of files.slice(0, 10)) {
        const reader = new FileReader();
        const base64 = await new Promise<string>(res => {
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
      toast.error("One or more images failed to upload");
    } finally {
      setUploading(false);
      // Reset input so the same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDelete = (id: number) => {
    setDeletingId(id);
    deleteItem.reset();
    deleteItem.mutate({ id });
  };

  const toggleSelect = useCallback((id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(portfolio.map((item: any) => item.id)));
  }, [portfolio]);

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return;
    setBulkDeleting(true);
    bulkDeleteMutation.mutate({ ids: Array.from(selectedIds) });
  };

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
  };

  const handleItemTap = (item: any) => {
    if (selectMode) {
      toggleSelect(item.id);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Portfolio"
        subtitle={selectMode
          ? `${selectedIds.size} selected`
          : `${portfolio.length} item${portfolio.length !== 1 ? "s" : ""}`
        }
        onBack={selectMode ? exitSelectMode : onBack}
        rightAction={
          selectMode ? (
            <div className="flex items-center gap-2">
              <button
                onClick={selectAll}
                className="px-3 py-1.5 rounded-full bg-secondary text-foreground text-xs font-semibold"
              >
                All
              </button>
              <button
                onClick={handleBulkDelete}
                disabled={selectedIds.size === 0 || bulkDeleting}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--color-danger)] text-white text-xs font-semibold disabled:opacity-50"
              >
                {bulkDeleting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
                {selectedIds.size > 0 ? `Delete (${selectedIds.size})` : "Delete"}
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              {portfolio.length > 0 && (
                <button
                  onClick={() => setSelectMode(true)}
                  className="px-3 py-1.5 rounded-full bg-secondary text-foreground text-xs font-semibold"
                >
                  Select
                </button>
              )}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-50"
              >
                {uploading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <ImagePlus className="w-3.5 h-3.5" />
                )}
                {uploading ? "Uploading..." : "Add"}
              </button>
            </div>
          )
        }
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleFilePick}
      />


      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : portfolio.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
            <div className="w-16 h-16 rounded-2xl bg-secondary/50 flex items-center justify-center">
              <Images className="w-8 h-8 text-muted-foreground/50" />
            </div>
            <p className="font-semibold text-sm">No portfolio images yet</p>
            <p className="text-xs text-muted-foreground max-w-[200px]">
              Add photos of your work — clients will see these when they tap your artist card.
            </p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="mt-2 px-4 py-2 rounded-xl bg-primary text-white text-sm font-semibold"
            >
              Add Your First Photo
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            <AnimatePresence>
              {portfolio.map((item: any) => {
                const isSelected = selectedIds.has(item.id);
                const isVideo = item.mediaType === "video";
                return (
                  <motion.div
                    key={item.id}
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className={`relative aspect-square rounded-xl overflow-hidden bg-secondary/30 group ${
                      isSelected ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""
                    }`}
                    onClick={() => handleItemTap(item)}
                  >
                    <img
                      src={item.displayUrl || item.imageUrl}
                      alt={item.description || "Portfolio image"}
                      className="w-full h-full object-cover"
                    />

                    {/* Video indicator */}
                    {isVideo && (
                      <div className="absolute top-1.5 right-1.5">
                        <div className="w-6 h-6 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center">
                          <Play className="w-3 h-3 text-white fill-white" />
                        </div>
                      </div>
                    )}

                    {/* Select mode: checkbox overlay */}
                    {selectMode && (
                      <div className="absolute inset-0 bg-black/20 flex items-start justify-start p-2">
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors ${
                            isSelected
                              ? "bg-primary"
                              : "bg-black/30 border-2 border-white/70"
                          }`}
                        >
                          {isSelected && (
                            <CheckCircle2 className="w-5 h-5 text-white" />
                          )}
                        </div>
                      </div>
                    )}

                    {/* Normal mode: delete overlay (hover/tap) */}
                    {!selectMode && (
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }}
                          disabled={deletingId === item.id}
                          className="opacity-0 group-hover:opacity-100 transition-opacity w-9 h-9 rounded-full bg-[var(--color-danger)] flex items-center justify-center shadow-lg"
                        >
                          {deletingId === item.id ? (
                            <Loader2 className="w-4 h-4 text-white animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4 text-white" />
                          )}
                        </button>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {/* Add more tile */}
            {!selectMode && (
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="aspect-square rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center gap-1.5 text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors disabled:opacity-50"
              >
                {uploading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <ImagePlus className="w-5 h-5" />
                    <span className="text-[10px] font-medium">Add</span>
                  </>
                )}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
