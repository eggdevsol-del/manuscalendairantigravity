import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, MapPin, ExternalLink, MessageCircle, Plus, Loader2, Link as LinkIcon, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDashboardTasks } from "@/features/dashboard/useDashboardTasks";
import { trpc } from "@/lib/trpc";
import { SupplierStorefront } from "./SupplierStorefront";
import { toast } from "sonner";

// Mock Data for Phase 1 (Artists)
const MOCK_ARTISTS = [
  {
    id: "a1",
    name: "Sarah Chen",
    style: "Fineline / Floral",
    location: "Sydney, NSW",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=60",
    email: "collab@sarahchen.ink"
  },
  {
    id: "a2",
    name: "Marcus Thorne",
    style: "Traditional",
    location: "Melbourne, VIC",
    avatar: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&auto=format&fit=crop&q=60",
    email: "marcus@thornetattoo.com"
  },
  {
    id: "a3",
    name: "Elena Rodriguez",
    style: "Realism",
    location: "Gold Coast, QLD",
    avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&auto=format&fit=crop&q=60",
    email: "elena.r@studio.com"
  }
];

const MOCK_SUPPLIERS_DIRECTORY = [
  { name: "Pro Tattoo Supply", url: "https://protattoosupply.com.au/" },
  { name: "Dr Pickles", url: "https://drpickles.com/" },
  { name: "Tatsup", url: "https://www.tatsup.com/" },
  { name: "Inkjecta", url: "https://inkjecta.com/" },
  { name: "Dynamic Color", url: "https://dynamiccolor.com/" },
  { name: "Bstattoo", url: "https://www.bstattoo.com.au/" }
];

export function ContactsTab() {
  const { actions } = useDashboardTasks();
  const [selectedSupplierId, setSelectedSupplierId] = useState<number | null>(null);
  const [isScrapeModalOpen, setIsScrapeModalOpen] = useState(false);
  const [scrapeUrl, setScrapeUrl] = useState("");

  const { data: dbSuppliers, refetch: refetchSuppliers } = trpc.suppliers.getSuppliers.useQuery();
  const scrapeMutation = trpc.suppliers.scrapeShopifyStore.useMutation({
    onSuccess: (data) => {
      toast.success(`Imported ${data.productCount} products from ${data.name}`);
      setIsScrapeModalOpen(false);
      setScrapeUrl("");
      refetchSuppliers();
    },
    onError: (err) => {
      toast.error(err.message);
    }
  });

  const deleteMutation = trpc.suppliers.deleteSupplier.useMutation({
    onSuccess: () => {
      toast.success("Storefront deleted");
      refetchSuppliers();
    },
    onError: (err) => {
      toast.error(err.message);
    }
  });

  const handleDelete = (id: number) => {
    if (window.confirm("Are you sure you want to delete this storefront?")) {
      deleteMutation.mutate({ supplierId: id });
    }
  };

  const handleContact = (email: string) => {
    actions.handleComms.email(email);
  };

  const handleImport = () => {
    if (!scrapeUrl) return;
    scrapeMutation.mutate({ storeUrl: scrapeUrl });
  };

  return (
    <>
      <AnimatePresence>
        {selectedSupplierId && (
          <SupplierStorefront 
            supplierId={selectedSupplierId} 
            onBack={() => setSelectedSupplierId(null)} 
          />
        )}
      </AnimatePresence>

      <div className={cn("space-y-8 animate-in fade-in duration-500 pb-20", selectedSupplierId ? "hidden" : "")}>
        
        {/* Search Bar */}
        <div className="relative px-1">
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-muted-foreground" />
          </div>
          <input
            type="text"
            placeholder="Search suppliers and artists..."
            className="w-full bg-secondary/50 border border-border rounded-full py-3.5 pl-12 pr-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all placeholder:text-muted-foreground/70 text-foreground"
          />
        </div>

        {/* Suppliers Matrix */}
        <section>
          <div className="flex items-center justify-between mb-4 px-1">
            <h2 className="text-xl font-bold tracking-tight">Suppliers</h2>
            <button className="text-sm font-semibold text-primary hover:text-primary/80 transition-colors">See all</button>
          </div>
          
          <div className="flex overflow-x-auto gap-4 pb-4 -mx-6 px-6 hide-scrollbar">
            {dbSuppliers?.map((supplier, i) => (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                key={supplier.id}
                className="shrink-0 w-[280px] bg-card border border-border rounded-[24px] overflow-hidden group shadow-sm hover:shadow-md transition-all"
              >
                <div className="h-32 w-full overflow-hidden relative bg-secondary/50 flex items-center justify-center">
                  {supplier.logoUrl ? (
                    <img src={supplier.logoUrl} alt={supplier.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-[var(--color-status-info-bg)] to-purple-500/20 flex items-center justify-center">
                      <span className="text-4xl font-black text-white/30">{supplier.name.charAt(0)}</span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <div className="absolute bottom-3 left-4 text-white">
                    <h3 className="font-bold text-lg leading-tight">{supplier.name}</h3>
                    <p className="text-xs font-medium text-white/80 line-clamp-1">{supplier.websiteUrl}</p>
                  </div>
                </div>
                
                <div className="p-4 space-y-4">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                    <MapPin className="w-3.5 h-3.5" />
                    Online Store
                  </div>
                  
                  <button 
                    onClick={() => setSelectedSupplierId(supplier.id)}
                    className="w-full py-2.5 bg-secondary/80 hover:bg-secondary rounded-xl font-bold text-sm flex justify-center items-center gap-2 transition-colors border border-border/50 text-foreground"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Browse Storefront
                  </button>
                  <button 
                    onClick={() => handleDelete(supplier.id)}
                    disabled={deleteMutation.isPending}
                    className="w-full py-2 bg-destructive/10 hover:bg-destructive/20 text-destructive rounded-xl font-bold text-xs flex justify-center items-center gap-1.5 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete Storefront
                  </button>
                </div>
              </motion.div>
            ))}

            {/* Add Supplier Card */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: (dbSuppliers?.length || 0) * 0.1 }}
              className="shrink-0 w-[280px] bg-secondary/20 border border-dashed border-border rounded-[24px] overflow-hidden flex flex-col items-center justify-center cursor-pointer hover:bg-secondary/40 transition-colors p-6 text-center h-[280px]"
              onClick={() => setIsScrapeModalOpen(true)}
            >
              <div className="w-14 h-14 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-4">
                <Plus className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-lg mb-2">Add Supplier</h3>
              <p className="text-sm text-muted-foreground">Import products instantly from any Shopify or WooCommerce store.</p>
            </motion.div>
          </div>
        </section>

        {/* Discover Suppliers Directory */}
        <div className="pt-2">
          <div className="flex items-center justify-between mb-4 px-1">
            <h2 className="text-xl font-black text-foreground">Discover Suppliers</h2>
            <span className="text-xs font-bold text-muted-foreground bg-secondary px-2 py-1 rounded-full">
              AUS / NZ
            </span>
          </div>
          
          <div className="flex overflow-x-auto hide-scrollbar gap-4 pb-4 -mx-4 px-4">
            {MOCK_SUPPLIERS_DIRECTORY.map((dirSup, idx) => (
              <motion.div
                key={dirSup.name}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.1 }}
                className="shrink-0 w-[240px] bg-card border border-border rounded-[24px] overflow-hidden flex flex-col shadow-sm"
              >
                <div className="h-20 bg-secondary/30 flex items-center justify-center border-b border-border">
                  <h3 className="font-black text-lg text-foreground">{dirSup.name}</h3>
                </div>
                <div className="p-4 flex flex-col gap-2">
                  <p className="text-xs text-muted-foreground text-center line-clamp-1 mb-2">{dirSup.url}</p>
                  <button 
                    onClick={() => scrapeMutation.mutate({ storeUrl: dirSup.url })}
                    disabled={scrapeMutation.isPending}
                    className="w-full py-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-xl font-bold text-xs flex justify-center items-center gap-1.5 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Import Supplier
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Artists Matrix */}
        <section>
          <div className="flex items-center justify-between mb-4 px-1">
            <h2 className="text-xl font-bold tracking-tight">Discover Artists</h2>
            <button className="text-sm font-semibold text-primary hover:text-primary/80 transition-colors">Explore</button>
          </div>
          
          <div className="flex overflow-x-auto snap-x snap-mandatory gap-4 pb-4 -mx-6 px-6 hide-scrollbar">
            {MOCK_ARTISTS.map((artist, i) => (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 + (i * 0.1) }}
                key={artist.id}
                className="snap-start shrink-0 w-[160px] bg-card border border-border rounded-[24px] p-4 flex flex-col items-center text-center group shadow-sm hover:shadow-md transition-all"
              >
                <div className="w-20 h-20 rounded-full p-1 border-2 border-primary/20 group-hover:border-primary/50 transition-colors mb-3">
                  <img src={artist.avatar} alt={artist.name} className="w-full h-full rounded-full object-cover" />
                </div>
                <h3 className="font-bold text-[15px] leading-tight mb-1">{artist.name}</h3>
                <p className="text-[11px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full mb-3">{artist.style}</p>
                
                <div className="mt-auto w-full space-y-2">
                  <div className="flex items-center justify-center gap-1 text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                    <MapPin className="w-3 h-3" />
                    {artist.location.split(',')[0]}
                  </div>
                  <button 
                    onClick={() => handleContact(artist.email)}
                    className="w-full py-2 bg-foreground text-background hover:opacity-90 rounded-xl font-bold text-xs flex justify-center items-center gap-1.5 transition-colors"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    Connect
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </section>

      </div>

      <AnimatePresence>
        {isScrapeModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-background/80 backdrop-blur-md flex flex-col justify-center items-center p-4"
          >
            <motion.div 
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 50, opacity: 0 }}
              className="bg-card border border-border rounded-[32px] p-6 w-full max-w-md mx-auto relative overflow-hidden"
            >
              <button 
                onClick={() => setIsScrapeModalOpen(false)}
                className="absolute top-6 right-6 w-8 h-8 flex items-center justify-center rounded-full bg-secondary/50 hover:bg-secondary"
              >
                <Plus className="w-4 h-4 rotate-45" />
              </button>
              
              <div className="w-12 h-12 rounded-full bg-[var(--color-status-info-bg)] text-[var(--color-status-info-text)] flex items-center justify-center mb-4">
                <LinkIcon className="w-6 h-6" />
              </div>
              
              <h3 className="text-xl font-bold mb-2">Import Store</h3>
              <p className="text-sm text-muted-foreground mb-6">
                Paste the URL of any Shopify or WooCommerce supplier to instantly import their entire catalog.
              </p>
              
              <div className="space-y-4">
                <input 
                  type="url"
                  value={scrapeUrl}
                  onChange={(e) => setScrapeUrl(e.target.value)}
                  placeholder="e.g. https://store.inkvendor.com"
                  className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  disabled={scrapeMutation.isPending}
                />
                
                <button
                  onClick={handleImport}
                  disabled={!scrapeUrl || scrapeMutation.isPending}
                  className="w-full bg-foreground text-background font-bold rounded-xl py-3.5 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {scrapeMutation.isPending ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Importing Catalog...
                    </>
                  ) : (
                    "Import Store"
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
