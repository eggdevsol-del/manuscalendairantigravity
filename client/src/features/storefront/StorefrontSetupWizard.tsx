import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Store,
  Package,
  Upload,
  ArrowRight,
  ArrowLeft,
  Check,
  Loader2,
  Truck,
  MapPin,
  Globe
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { fileToBase64 } from "@/pages/funnel/funnelImage";

export default function StorefrontSetupWizard({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(1);
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
  const utils = trpc.useUtils();

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

  const handleNext = () => setStep(prev => prev + 1);
  const handleBack = () => setStep(prev => prev - 1);

  const handleSubmit = async () => {
    if (!title || !price || !inventory) {
      toast.error("Please fill in all required fields.");
      return;
    }

    setIsSubmitting(true);
    try {
      let imageUrl = "";
      if (imageFile) {
        const base64 = await fileToBase64(imageFile);
        const uploadRes = await uploadMutation.mutateAsync({
          file: base64,
          filename: imageFile.name,
          contentType: imageFile.type,
          context: "product",
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

      toast.success("Storefront activated and product added!");
      utils.storefront.getProducts.invalidate();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to create product");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] text-white">
      <div className="flex items-center p-4 border-b border-white/10">
        {step > 1 && (
          <button onClick={handleBack} className="p-2 -ml-2 rounded-full hover:bg-white/5 transition-colors">
            <ArrowLeft className="w-5 h-5 text-white/70" />
          </button>
        )}
        <h2 className="text-lg font-bold ml-2">Setup Storefront</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex flex-col gap-6"
            >
              <div className="w-16 h-16 rounded-2xl bg-indigo-500/20 flex items-center justify-center border border-indigo-500/30 mx-auto mt-8 mb-4">
                <Store className="w-8 h-8 text-indigo-400" />
              </div>
              <div className="text-center">
                <h3 className="text-2xl font-bold mb-2">Open Your Shop</h3>
                <p className="text-white/60 leading-relaxed text-sm">
                  Start selling merch, aftercare, and digital products directly from your profile. We handle the payments and inventory for you.
                </p>
              </div>

              <div className="bg-white/5 rounded-xl p-4 border border-white/10 mt-4">
                <h4 className="font-semibold mb-3 flex items-center gap-2 text-sm">
                  <Check className="w-4 h-4 text-emerald-500" /> What you'll need
                </h4>
                <ul className="text-sm text-white/60 space-y-2">
                  <li>• A product photo</li>
                  <li>• Price and inventory count</li>
                  <li>• Shipping or pickup details</li>
                </ul>
              </div>

              <button
                onClick={handleNext}
                className="w-full mt-auto py-3.5 bg-indigo-500 hover:bg-indigo-600 rounded-xl font-bold transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                Let's Go <ArrowRight className="w-4 h-4" />
              </button>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex flex-col gap-5"
            >
              <h3 className="text-xl font-bold">Add First Product</h3>
              
              <div className="space-y-4">
                <div 
                  className="w-full aspect-square max-h-48 rounded-xl border-2 border-dashed border-white/20 bg-white/5 flex flex-col items-center justify-center relative overflow-hidden cursor-pointer hover:bg-white/10 transition-colors"
                  onClick={() => document.getElementById('product-image')?.click()}
                >
                  {imagePreview ? (
                    <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <>
                      <Upload className="w-8 h-8 text-white/40 mb-2" />
                      <span className="text-sm text-white/50 font-medium">Upload Product Photo</span>
                    </>
                  )}
                  <input 
                    id="product-image"
                    type="file" 
                    accept="image/*" 
                    onChange={handleImageChange}
                    className="hidden" 
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-white/50 mb-1.5 block">Title</label>
                  <input
                    type="text"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="e.g. Tattoi Aftercare Cream"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-white/20 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-white/50 mb-1.5 block">Description</label>
                  <textarea
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="Describe your product..."
                    rows={3}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-white/20 focus:outline-none focus:border-indigo-500 resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wider text-white/50 mb-1.5 block">Price ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={price}
                      onChange={e => setPrice(e.target.value)}
                      placeholder="25.00"
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-white/20 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wider text-white/50 mb-1.5 block">Stock Count</label>
                    <input
                      type="number"
                      value={inventory}
                      onChange={e => setInventory(e.target.value)}
                      placeholder="50"
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-white/20 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-white/50 mb-2 block">Fulfillment Method</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setFulfillmentType("pickup")}
                      className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${
                        fulfillmentType === "pickup" 
                          ? "bg-indigo-500/20 border-indigo-500" 
                          : "bg-white/5 border-white/10 hover:bg-white/10"
                      }`}
                    >
                      <Store className={`w-5 h-5 ${fulfillmentType === "pickup" ? "text-indigo-400" : "text-white/50"}`} />
                      <span className="text-xs font-semibold">In-Studio Pickup</span>
                    </button>
                    <button
                      onClick={() => setFulfillmentType("delivery")}
                      className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${
                        fulfillmentType === "delivery" 
                          ? "bg-indigo-500/20 border-indigo-500" 
                          : "bg-white/5 border-white/10 hover:bg-white/10"
                      }`}
                    >
                      <Truck className={`w-5 h-5 ${fulfillmentType === "delivery" ? "text-indigo-400" : "text-white/50"}`} />
                      <span className="text-xs font-semibold">Delivery</span>
                    </button>
                    <button
                      onClick={() => setFulfillmentType("both")}
                      className={`col-span-2 p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${
                        fulfillmentType === "both" 
                          ? "bg-indigo-500/20 border-indigo-500" 
                          : "bg-white/5 border-white/10 hover:bg-white/10"
                      }`}
                    >
                      <Globe className={`w-5 h-5 ${fulfillmentType === "both" ? "text-indigo-400" : "text-white/50"}`} />
                      <span className="text-xs font-semibold">Both (Client Chooses)</span>
                    </button>
                  </div>
                </div>

              </div>

              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="w-full mt-6 py-3.5 bg-indigo-500 hover:bg-indigo-600 rounded-xl font-bold transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "Publish Product"}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
