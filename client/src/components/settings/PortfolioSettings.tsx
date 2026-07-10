/**
 * PortfolioSettings.tsx
 * Artist-side settings panel for uploading and managing portfolio images.
 * Wired into CentralNavFAB under Settings → Portfolio.
 */

import { useRef, useState } from "react";
import { ImagePlus, Trash2, Loader2, Images } from "lucide-react";
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
    deleteItem.mutate({ id });
  };

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Portfolio"
        subtitle={`${portfolio.length} image${portfolio.length !== 1 ? "s" : ""} uploaded`}
        onBack={onBack}
        rightAction={
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
            {uploading ? "Uploading..." : "Add Photos"}
          </button>
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
              {portfolio.map((item: any) => (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="relative aspect-square rounded-xl overflow-hidden bg-secondary/30 group"
                >
                  <img
                    src={item.imageUrl}
                    alt={item.description || "Portfolio image"}
                    className="w-full h-full object-cover"
                  />
                  {/* Delete overlay */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                    <button
                      onClick={() => handleDelete(item.id)}
                      disabled={deletingId === item.id}
                      className="opacity-0 group-hover:opacity-100 transition-opacity w-9 h-9 rounded-full bg-red-500/90 flex items-center justify-center shadow-lg"
                    >
                      {deletingId === item.id ? (
                        <Loader2 className="w-4 h-4 text-white animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4 text-white" />
                      )}
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Add more tile */}
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
          </div>
        )}
      </div>
    </div>
  );
}
