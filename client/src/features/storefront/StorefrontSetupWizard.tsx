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
  Plus,
  CalendarDays,
  Video,
  MapPin,
  Users,
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

type WizardView = "dashboard" | "add_product" | "edit_product" | "add_seminar";

export default function StorefrontSetupWizard({ onClose }: { onClose: () => void }) {
  const [, setLocation] = useLocation();
  const [view, setView] = useState<WizardView>("dashboard");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);

  // Product Form State
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [shippingCost, setShippingCost] = useState("");
  const [inventory, setInventory] = useState("");
  const [fulfillmentType, setFulfillmentType] = useState<"pickup" | "delivery" | "both" | "digital">("pickup");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // Seminar Form State
  const [semTitle, setSemTitle] = useState("");
  const [semDescription, setSemDescription] = useState("");
  const [semPrice, setSemPrice] = useState("");
  const [semCapacity, setSemCapacity] = useState("");
  const [semDate, setSemDate] = useState("");
  const [semType, setSemType] = useState<"in_person" | "virtual">("in_person");
  const [semLocation, setSemLocation] = useState("");

  const uploadMutation = trpc.upload.uploadImage.useMutation();
  const createProductMutation = trpc.storefront.createProduct.useMutation();
  const updateProductMutation = trpc.storefront.updateProduct.useMutation();
  const createSeminarMutation = trpc.storefront.createSeminar.useMutation();
  const { data: products, isLoading: productsLoading } = trpc.storefront.getProducts.useQuery();
  const { data: seminars, isLoading: seminarsLoading } = trpc.storefront.getSeminars.useQuery();
  const { data: artistSettings } = trpc.artistSettings.get.useQuery();
  const utils = trpc.useUtils();

  const hasStripeConnect = !!(artistSettings as any)?.stripeConnectAccountId;

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

  const resetProductForm = () => {
    setTitle(""); setDescription(""); setPrice(""); setShippingCost(""); setInventory("");
    setFulfillmentType("pickup"); setImageFile(null); setImagePreview(null); setSelectedProductId(null);
  };

  const resetSeminarForm = () => {
    setSemTitle(""); setSemDescription(""); setSemPrice(""); setSemCapacity("");
    setSemDate(""); setSemType("in_person"); setSemLocation("");
  };

  const handleProductSubmit = async () => {
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
      
      const payload = {
        title,
        description,
        priceCents: Math.round(parseFloat(price) * 100),
        shippingCents: shippingCost ? Math.round(parseFloat(shippingCost) * 100) : 0,
        inventoryCount: parseInt(inventory, 10),
        fulfillmentType,
        ...(imageUrl ? { imageUrl } : {}),
      };

      if (view === "edit_product" && selectedProductId) {
        await updateProductMutation.mutateAsync({
          id: selectedProductId,
          ...payload
        });
        toast.success("Product updated!");
      } else {
        await createProductMutation.mutateAsync(payload);
        toast.success("Product published!");
      }

      utils.storefront.getProducts.invalidate();
      resetProductForm();
      setView("dashboard");
    } catch (err: any) {
      toast.error(err.message || "Failed to save product");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSeminarSubmit = async () => {
    if (!semTitle || !semPrice || !semCapacity || !semDate) {
      toast.error("Please fill in all required fields.");
      return;
    }
    setIsSubmitting(true);
    try {
      await createSeminarMutation.mutateAsync({
        title: semTitle,
        description: semDescription,
        type: semType,
        date: new Date(semDate).toISOString(),
        locationUrl: semLocation || undefined,
        capacity: parseInt(semCapacity, 10),
        priceCents: Math.round(parseFloat(semPrice) * 100),
      });
      toast.success("Seminar created!");
      utils.storefront.getSeminars.invalidate();
      resetSeminarForm();
      setView("dashboard");
    } catch (err: any) {
      toast.error(err.message || "Failed to create seminar");
    } finally {
      setIsSubmitting(false);
    }
  };

  const fulfillmentOptions = [
    { key: "pickup" as const, label: "In-Studio Pickup", icon: Store },
    { key: "delivery" as const, label: "Delivery", icon: Truck },
    { key: "both" as const, label: "Both (Client Chooses)", icon: Globe, span: true },
  ];

  // ── Shared header component ──
  const Header = ({ title: headerTitle, onBack }: { title: string; onBack: () => void }) => (
    <div className="flex items-center gap-3 px-6 pt-6 pb-4 shrink-0 bg-transparent z-20 border-b border-border">
      <button onClick={onBack} className="p-2 -ml-2 rounded-full bg-secondary/50 hover:bg-secondary/50 transition-colors">
        <ChevronLeft className="w-5 h-5 text-foreground" />
      </button>
      <h2 className="text-xl font-semibold text-foreground">{headerTitle}</h2>
    </div>
  );

  // ── ADD SEMINAR VIEW ──
  if (view === "add_seminar") {
    return (
      <div className="w-full h-full flex flex-col overflow-hidden relative">
        <Header title="Add Seminar" onBack={() => setView("dashboard")} />
        <div className="flex-1 w-full overflow-y-auto mobile-scroll touch-pan-y relative z-10">
          <div className="pb-[180px] max-w-lg mx-auto space-y-5 px-5 pt-5">
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/60 mb-1.5 block">Title</label>
              <input type="text" value={semTitle} onChange={e => setSemTitle(e.target.value)} placeholder="e.g. Mastering Realism Shading" className="w-full bg-secondary/50 border border-border rounded-lg px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 text-sm" />
            </div>
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/60 mb-1.5 block">Description</label>
              <textarea value={semDescription} onChange={e => setSemDescription(e.target.value)} placeholder="What attendees will learn..." rows={3} className="w-full bg-secondary/50 border border-border rounded-lg px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 resize-none text-sm" />
            </div>
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/60 mb-2 block">Type</label>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setSemType("in_person")} className={`p-3 rounded-xl border flex items-center gap-3 transition-all ${semType === "in_person" ? "bg-primary/15 border-primary/50" : "bg-secondary/50 border-border hover:bg-secondary/50"}`}>
                  <MapPin className={`w-4 h-4 ${semType === "in_person" ? "text-primary" : "text-muted-foreground"}`} />
                  <span className={`text-xs font-semibold ${semType === "in_person" ? "text-foreground" : "text-muted-foreground"}`}>In Person</span>
                  {semType === "in_person" && <Check className="w-3.5 h-3.5 text-primary ml-auto" />}
                </button>
                <button onClick={() => setSemType("virtual")} className={`p-3 rounded-xl border flex items-center gap-3 transition-all ${semType === "virtual" ? "bg-primary/15 border-primary/50" : "bg-secondary/50 border-border hover:bg-secondary/50"}`}>
                  <Video className={`w-4 h-4 ${semType === "virtual" ? "text-primary" : "text-muted-foreground"}`} />
                  <span className={`text-xs font-semibold ${semType === "virtual" ? "text-foreground" : "text-muted-foreground"}`}>Virtual</span>
                  {semType === "virtual" && <Check className="w-3.5 h-3.5 text-primary ml-auto" />}
                </button>
              </div>
            </div>
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/60 mb-1.5 block">Date & Time</label>
              <input type="datetime-local" value={semDate} onChange={e => setSemDate(e.target.value)} className="w-full bg-secondary/50 border border-border rounded-lg px-4 py-3 text-foreground focus:outline-none focus:border-primary/50 text-sm" />
            </div>
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/60 mb-1.5 block">{semType === "virtual" ? "Meeting Link" : "Venue Address"}</label>
              <input type="text" value={semLocation} onChange={e => setSemLocation(e.target.value)} placeholder={semType === "virtual" ? "https://zoom.us/j/..." : "123 Ink Street, Melbourne"} className="w-full bg-secondary/50 border border-border rounded-lg px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/60 mb-1.5 block">Price ($)</label>
                <input type="number" step="0.01" value={semPrice} onChange={e => setSemPrice(e.target.value)} placeholder="150.00" className="w-full bg-secondary/50 border border-border rounded-lg px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 text-sm" />
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/60 mb-1.5 block">Capacity</label>
                <input type="number" value={semCapacity} onChange={e => setSemCapacity(e.target.value)} placeholder="20" className="w-full bg-secondary/50 border border-border rounded-lg px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 text-sm" />
              </div>
            </div>
            <button onClick={handleSeminarSubmit} disabled={isSubmitting || !semTitle || !semPrice || !semCapacity || !semDate} className="w-full mt-2 py-3.5 bg-primary hover:bg-primary/90 rounded-xl font-bold transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-40 text-primary-foreground text-sm shadow-lg shadow-primary/20">
              {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "Publish Seminar"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── ADD / EDIT PRODUCT VIEW ──
  if (view === "add_product" || view === "edit_product") {
    return (
      <div className="w-full h-full flex flex-col overflow-hidden relative">
        <Header title={view === "edit_product" ? "Edit Product" : "Add Product"} onBack={() => { resetProductForm(); setView("dashboard"); }} />
        <div className="flex-1 w-full overflow-y-auto mobile-scroll touch-pan-y relative z-10">
          <div className="pb-[180px] max-w-lg mx-auto space-y-5 px-5 pt-5">
            <div
              className="w-full aspect-[4/3] max-h-48 rounded-xl border-2 border-dashed border-border bg-secondary/50 flex flex-col items-center justify-center relative overflow-hidden cursor-pointer hover:bg-secondary/50 transition-colors"
              onClick={() => document.getElementById("sf-product-image")?.click()}
            >
              {imagePreview ? (
                <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
              ) : (
                <>
                  <Upload className="w-7 h-7 text-muted-foreground mb-2" />
                  <span className="text-xs text-muted-foreground font-medium">Tap to upload photo</span>
                </>
              )}
              <input id="sf-product-image" type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
            </div>
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/60 mb-1.5 block">Title</label>
              <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Tattoi Aftercare Cream" className="w-full bg-secondary/50 border border-border rounded-lg px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 text-sm" />
            </div>
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/60 mb-1.5 block">Description</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Describe your product..." rows={3} className="w-full bg-secondary/50 border border-border rounded-lg px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 resize-none text-sm" />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/60 mb-1.5 block">Price ($)</label>
                <input type="number" step="0.01" value={price} onChange={e => setPrice(e.target.value)} placeholder="25.00" className="w-full bg-secondary/50 border border-border rounded-lg px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 text-sm" />
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/60 mb-1.5 block">Shipping ($)</label>
                <input type="number" step="0.01" value={shippingCost} onChange={e => setShippingCost(e.target.value)} placeholder="0.00" className="w-full bg-secondary/50 border border-border rounded-lg px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 text-sm" />
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/60 mb-1.5 block">Stock</label>
                <input type="number" value={inventory} onChange={e => setInventory(e.target.value)} placeholder="50" className="w-full bg-secondary/50 border border-border rounded-lg px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 text-sm" />
              </div>
            </div>
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/60 mb-2 block">Fulfillment Method</label>
              <div className="grid grid-cols-2 gap-2">
                {fulfillmentOptions.map(opt => {
                  const Icon = opt.icon;
                  const isActive = fulfillmentType === opt.key;
                  return (
                    <button key={opt.key} onClick={() => setFulfillmentType(opt.key)} className={`${opt.span ? "col-span-2" : ""} p-3 rounded-xl border flex items-center gap-3 transition-all ${isActive ? "bg-primary/15 border-primary/50" : "bg-secondary/50 border-border hover:bg-secondary/50"}`}>
                      <Icon className={`w-4 h-4 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                      <span className={`text-xs font-semibold ${isActive ? "text-foreground" : "text-muted-foreground"}`}>{opt.label}</span>
                      {isActive && <Check className="w-3.5 h-3.5 text-primary ml-auto" />}
                    </button>
                  );
                })}
              </div>
            </div>
            <button onClick={handleProductSubmit} disabled={isSubmitting || !title || !price || !inventory} className="w-full mt-2 py-3.5 bg-primary hover:bg-primary/90 rounded-xl font-bold transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-40 text-primary-foreground text-sm shadow-lg shadow-primary/20">
              {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : view === "edit_product" ? "Save Changes" : "Publish Product"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── DASHBOARD VIEW ──
  return (
    <div className="w-full h-full flex flex-col overflow-hidden relative">
      <div className="flex items-center gap-3 px-6 pt-6 pb-4 shrink-0 bg-transparent z-20 border-b border-border">
        <button onClick={onClose} className="p-2 -ml-2 rounded-full bg-secondary/50 hover:bg-secondary/50 transition-colors">
          <ChevronLeft className="w-5 h-5 text-foreground" />
        </button>
        <h2 className="text-xl font-semibold text-foreground flex-1">Storefront</h2>
      </div>

      <div className="flex-1 w-full overflow-y-auto mobile-scroll touch-pan-y relative z-10">
        <div className="pb-[180px] max-w-lg mx-auto px-5 pt-5 space-y-5">
          {/* Stripe Connect Warning */}
          {!hasStripeConnect && (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-500">Payouts Not Connected</p>
                <p className="text-xs text-muted-foreground mt-1">Set up Stripe Connect in Bank Payouts to receive store payments.</p>
                <button onClick={() => { onClose(); setLocation("/bank-payouts"); }} className="mt-2 text-xs font-bold text-amber-500 underline underline-offset-2">
                  Set Up Now →
                </button>
              </div>
            </div>
          )}

          {/* Products Section */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/60">
                Products ({products?.length || 0})
              </h3>
              <button onClick={() => setView("add_product")} className="p-1.5 rounded-full bg-primary/15 hover:bg-primary/25 transition-colors">
                <Plus className="w-4 h-4 text-primary" />
              </button>
            </div>
            {productsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : !products || products.length === 0 ? (
              <div className="text-center py-8 bg-secondary/50 rounded-xl border border-border">
                <Package className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground font-medium">No products yet</p>
                <button onClick={() => setView("add_product")} className="mt-2 text-xs font-bold text-primary underline underline-offset-2">
                  Add your first product
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {products.map((product: any) => (
                  <div 
                    key={product.id} 
                    onClick={() => {
                      setSelectedProductId(product.id);
                      setTitle(product.title);
                      setDescription(product.description || "");
                      setPrice((product.priceCents / 100).toString());
                      setShippingCost(product.shippingCents ? (product.shippingCents / 100).toString() : "0");
                      setInventory(product.inventoryCount.toString());
                      setFulfillmentType(product.fulfillmentType);
                      setImagePreview(product.imageUrl || null);
                      setView("edit_product");
                    }}
                    className="flex items-center gap-3 p-3 rounded-xl bg-secondary/50 border border-border hover:bg-secondary/50 transition-colors cursor-pointer"
                  >
                    <div className="w-12 h-12 rounded-lg bg-secondary/50 overflow-hidden shrink-0">
                      {product.imageUrl ? (
                        <img src={product.imageUrl} alt={product.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="w-5 h-5 text-muted-foreground" />
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

          {/* Seminars Section */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/60">
                Seminars ({seminars?.length || 0})
              </h3>
              <button onClick={() => setView("add_seminar")} className="p-1.5 rounded-full bg-primary/15 hover:bg-primary/25 transition-colors">
                <Plus className="w-4 h-4 text-primary" />
              </button>
            </div>
            {seminarsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : !seminars || seminars.length === 0 ? (
              <div className="text-center py-8 bg-secondary/50 rounded-xl border border-border">
                <CalendarDays className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground font-medium">No seminars yet</p>
                <button onClick={() => setView("add_seminar")} className="mt-2 text-xs font-bold text-primary underline underline-offset-2">
                  Create your first seminar
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {(seminars as any[]).map((seminar: any) => {
                  const spotsLeft = seminar.capacity - (seminar.ticketsSold || 0);
                  const eventDate = new Date(seminar.date);
                  return (
                    <div key={seminar.id} className="flex items-center gap-3 p-3 rounded-xl bg-secondary/50 border border-border hover:bg-secondary/50 transition-colors">
                      <div className="w-12 h-12 rounded-lg bg-secondary/50 overflow-hidden shrink-0 flex items-center justify-center">
                        {seminar.type === "virtual" ? (
                          <Video className="w-5 h-5 text-purple-400/50" />
                        ) : (
                          <MapPin className="w-5 h-5 text-blue-400/50" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{seminar.title}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {eventDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })} · ${(seminar.priceCents / 100).toFixed(2)} · {spotsLeft} spots
                        </p>
                      </div>
                      <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded-full ${spotsLeft > 0 ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"}`}>
                        {spotsLeft > 0 ? "Live" : "Full"}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
