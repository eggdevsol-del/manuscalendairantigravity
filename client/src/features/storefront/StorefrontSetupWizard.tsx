import { useState } from "react";
import {
  Store,
  Upload,
  Check,
  Loader2,
  Truck,
  Globe,
  ChevronLeft,
  Package,
  AlertTriangle,
  Trash2,
  Plus,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useLocation } from "wouter";

/**
 * Compress an image file client-side before uploading.
 * Resizes to max 1200px on the longest edge and outputs as JPEG at 0.8 quality.
 * This keeps payloads well under the 5MB server limit.
 */
function compressImage(file: File, maxDim = 1200, quality = 0.8): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onload = (e) => {
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const ratio = Math.min(maxDim / width, maxDim / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas context unavailable"));
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function StorefrontSetupWizard({ onClose }: { onClose: () => void }) {
  const [, setLocation] = useLocation();
  const [view, setView] = useState<"dashboard" | "add">("dashboard");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Product Form State
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [inventory, setInventory] = useState("");
  const [fulfillmentType, setFulfillmentType] = useState<"pickup" | "delivery" | "both" | "digital">("pickup");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const uploadMutation = trpc.upload.uploadImage.useMutation();
  const createProductMutation = trpc.storefront.createProduct.useMutation();
  const { data: products, isLoading: productsLoading } = trpc.storefront.getProducts.useQuery();
  const { data: paymentSettings } = trpc.paymentMethodSettings.get.useQuery();
  const utils = trpc.useUtils();

  const hasStripeConnect = !!(paymentSettings as any)?.stripeConnectAccountId;

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setPrice("");
    setInventory("");
    setFulfillmentType("pickup");
    setImageFile(null);
    setImagePreview(null);
  };

  const handleSubmit = async () => {
    if (!title || !price || !inventory) {
      toast.error("Please fill in all required fields.");
      return;
    }

    setIsSubmitting(true);
    try {
      let imageUrl = "";
      if (imageFile) {
        const compressedBase64 = await compressImage(imageFile);
        const uploadRes = await uploadMutation.mutateAsync({
          base64: compressedBase64,
          filename: imageFile.name.replace(/\.[^.]+$/, ".jpg"),
          folder: "products",
        });
        imageUrl = uploadRes.url;
      }

      await createProductMutation.mutateAsync({
        title,
        description,
        priceCents: Math.round(parseFloat(price) * 100),
        inventoryCount: parseInt(inventory, 10),
        fulfillmentType,
        imageUrl,
      });

      toast.success("Product published!");
      utils.storefront.getProducts.invalidate();
      resetForm();
      setView("dashboard");
    } catch (err: any) {
      toast.error(err.message || "Failed to create product");
    } finally {
      setIsSubmitting(false);
    }
  };

  const fulfillmentOptions = [
    { key: "pickup" as const, label: "In-Studio Pickup", icon: Store },
    { key: "delivery" as const, label: "Delivery", icon: Truck },
    { key: "both" as const, label: "Both (Client Chooses)", icon: Globe, span: true },
  ];

  // ── ADD PRODUCT VIEW ──
  if (view === "add") {
    return (
      <div className="w-full h-full flex flex-col overflow-hidden relative">
        <div className="flex items-center gap-3 px-6 pt-6 pb-4 shrink-0 bg-transparent z-20 border-b border-white/5">
          <button onClick={() => setView("dashboard")} className="p-2 -ml-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors">
            <ChevronLeft className="w-5 h-5 text-foreground" />
          </button>
          <h2 className="text-xl font-semibold text-foreground">Add Product</h2>
        </div>
        <div className="flex-1 w-full overflow-y-auto mobile-scroll touch-pan-y relative z-10">
          <div className="pb-[180px] max-w-lg mx-auto space-y-5 px-5 pt-5">
            <div
              className="w-full aspect-[4/3] max-h-48 rounded-xl border-2 border-dashed border-white/15 bg-white/[0.03] flex flex-col items-center justify-center relative overflow-hidden cursor-pointer hover:bg-white/[0.06] transition-colors"
              onClick={() => document.getElementById("sf-product-image")?.click()}
            >
              {imagePreview ? (
                <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
              ) : (
                <>
                  <Upload className="w-7 h-7 text-white/30 mb-2" />
                  <span className="text-xs text-white/40 font-medium">Tap to upload photo</span>
                </>
              )}
              <input id="sf-product-image" type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
            </div>
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/60 mb-1.5 block">Title</label>
              <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Tattoi Aftercare Cream" className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-foreground placeholder:text-white/20 focus:outline-none focus:border-primary/50 text-sm" />
            </div>
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/60 mb-1.5 block">Description</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Describe your product..." rows={3} className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-foreground placeholder:text-white/20 focus:outline-none focus:border-primary/50 resize-none text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/60 mb-1.5 block">Price ($)</label>
                <input type="number" step="0.01" value={price} onChange={e => setPrice(e.target.value)} placeholder="25.00" className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-foreground placeholder:text-white/20 focus:outline-none focus:border-primary/50 text-sm" />
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/60 mb-1.5 block">Stock Count</label>
                <input type="number" value={inventory} onChange={e => setInventory(e.target.value)} placeholder="50" className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-foreground placeholder:text-white/20 focus:outline-none focus:border-primary/50 text-sm" />
              </div>
            </div>
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/60 mb-2 block">Fulfillment Method</label>
              <div className="grid grid-cols-2 gap-2">
                {fulfillmentOptions.map(opt => {
                  const Icon = opt.icon;
                  const isActive = fulfillmentType === opt.key;
                  return (
                    <button key={opt.key} onClick={() => setFulfillmentType(opt.key)} className={`${opt.span ? "col-span-2" : ""} p-3 rounded-xl border flex items-center gap-3 transition-all ${isActive ? "bg-primary/15 border-primary/50" : "bg-white/[0.03] border-white/10 hover:bg-white/[0.06]"}`}>
                      <Icon className={`w-4 h-4 ${isActive ? "text-primary" : "text-white/40"}`} />
                      <span className={`text-xs font-semibold ${isActive ? "text-foreground" : "text-white/60"}`}>{opt.label}</span>
                      {isActive && <Check className="w-3.5 h-3.5 text-primary ml-auto" />}
                    </button>
                  );
                })}
              </div>
            </div>
            <button onClick={handleSubmit} disabled={isSubmitting || !title || !price || !inventory} className="w-full mt-2 py-3.5 bg-primary hover:bg-primary/90 rounded-xl font-bold transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-40 text-primary-foreground text-sm shadow-lg shadow-primary/20">
              {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "Publish Product"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── DASHBOARD VIEW ──
  return (
    <div className="w-full h-full flex flex-col overflow-hidden relative">
      <div className="flex items-center gap-3 px-6 pt-6 pb-4 shrink-0 bg-transparent z-20 border-b border-white/5">
        <button onClick={onClose} className="p-2 -ml-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors">
          <ChevronLeft className="w-5 h-5 text-foreground" />
        </button>
        <h2 className="text-xl font-semibold text-foreground flex-1">Storefront</h2>
        <button onClick={() => setView("add")} className="p-2 rounded-full bg-primary/15 hover:bg-primary/25 transition-colors">
          <Plus className="w-5 h-5 text-primary" />
        </button>
      </div>

      <div className="flex-1 w-full overflow-y-auto mobile-scroll touch-pan-y relative z-10">
        <div className="pb-[180px] max-w-lg mx-auto px-5 pt-5 space-y-5">
          {/* Stripe Connect Warning */}
          {!hasStripeConnect && (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-500">Payouts Not Connected</p>
                <p className="text-xs text-white/50 mt-1">Set up Stripe Connect in Bank Payouts to receive store payments.</p>
                <button onClick={() => { onClose(); setLocation("/bank-payouts"); }} className="mt-2 text-xs font-bold text-amber-500 underline underline-offset-2">
                  Set Up Now →
                </button>
              </div>
            </div>
          )}

          {/* Products List */}
          <div>
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/60 mb-3">
              Products ({products?.length || 0})
            </h3>
            {productsLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="w-5 h-5 animate-spin text-white/20" />
              </div>
            ) : !products || products.length === 0 ? (
              <div className="text-center py-10 bg-white/[0.02] rounded-xl border border-white/5">
                <Package className="w-10 h-10 text-white/10 mx-auto mb-3" />
                <p className="text-sm text-white/40 font-medium">No products yet</p>
                <button onClick={() => setView("add")} className="mt-3 text-xs font-bold text-primary underline underline-offset-2">
                  Add your first product
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {products.map((product: any) => (
                  <div key={product.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/5 hover:bg-white/[0.05] transition-colors">
                    <div className="w-12 h-12 rounded-lg bg-white/5 overflow-hidden shrink-0">
                      {product.imageUrl ? (
                        <img src={product.imageUrl} alt={product.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="w-5 h-5 text-white/15" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{product.title}</p>
                      <p className="text-[11px] text-muted-foreground">
                        ${(product.priceCents / 100).toFixed(2)} · {product.inventoryCount} in stock
                      </p>
                    </div>
                    <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded-full ${product.inventoryCount > 0 ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"}`}>
                      {product.inventoryCount > 0 ? "Active" : "Out"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
