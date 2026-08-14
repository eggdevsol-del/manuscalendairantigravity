import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, MapPin, ExternalLink, Plus, Loader2, Link as LinkIcon, Trash2, Package } from "lucide-react";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { SupplierStorefront } from "./SupplierStorefront";
import { toast } from "sonner";
import { useTooltipTarget } from "@/components/tooltip-tour";
import { DEMO_SUPPLIERS } from "./dashboardDemoData";

// Curated supplier directory
const SUPPLIER_DIRECTORY = [
  { name: "Pro Tattoo Supply", url: "https://protattoosupply.com.au/", category: "General Supply" },
  { name: "Dr Pickles", url: "https://drpickles.com/", category: "Aftercare" },
  { name: "Tatsup", url: "https://www.tatsup.com/", category: "Equipment" },
  { name: "Inkjecta", url: "https://inkjecta.com/", category: "Machines" },
  { name: "Dynamic Color", url: "https://dynamiccolor.com/", category: "Inks" },
  { name: "Bstattoo", url: "https://www.bstattoo.com.au/", category: "General Supply" },
];

interface SuppliersTabProps {
  demoMode?: boolean;
}

export function SuppliersTab({ demoMode = false }: SuppliersTabProps) {
  const [selectedSupplierId, setSelectedSupplierId] = useState<number | null>(null);

  // Tooltip tour targets
  const demoSuppliersAreaRef = useTooltipTarget("demo-suppliers-area");
  const demoSupplierCardRef = useTooltipTarget("demo-supplier-card");

  const { data: dbSuppliers, refetch: refetchSuppliers } = trpc.suppliers.getSuppliers.useQuery();
  const scrapeMutation = trpc.suppliers.scrapeShopifyStore.useMutation({
    onSuccess: (data) => {
      toast.success(`Imported ${data.productCount} products from ${data.name}`);
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
    if (demoMode) return;
    if (window.confirm("Are you sure you want to delete this storefront?")) {
      deleteMutation.mutate({ supplierId: id });
    }
  };

  // In demo mode, inject mock suppliers if user has none
  const displaySuppliers = demoMode && (!dbSuppliers || dbSuppliers.length === 0)
    ? DEMO_SUPPLIERS.map(s => ({
        id: s.id,
        name: s.name,
        websiteUrl: s.url,
        logoUrl: s.logoUrl,
      }))
    : dbSuppliers;

  const hasMySuppliers = displaySuppliers && displaySuppliers.length > 0;

  return (
    <>
      <AnimatePresence>
        {selectedSupplierId && !demoMode && (
          <SupplierStorefront
            supplierId={selectedSupplierId}
            onBack={() => setSelectedSupplierId(null)}
          />
        )}
      </AnimatePresence>

      <div
        className={cn("space-y-8 animate-in fade-in duration-500 pb-40", selectedSupplierId && !demoMode ? "hidden" : "")}
        ref={demoMode ? demoSuppliersAreaRef as any : undefined}
      >
        {/* Search Bar */}
        <div className="relative px-1">
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-muted-foreground" />
          </div>
          <input
            type="text"
            placeholder="Search suppliers..."
            className="w-full bg-secondary/50 border border-border rounded-full py-3.5 pl-12 pr-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all placeholder:text-muted-foreground/70 text-foreground"
            readOnly={demoMode}
          />
        </div>

        {/* Discover Suppliers (Primary Content) */}
        {!demoMode && (
          <section>
            <div className="flex items-center justify-between mb-4 px-1">
              <h2 className="text-xl font-bold tracking-tight">Discover Suppliers</h2>
              <span className="text-xs font-bold text-muted-foreground bg-secondary px-2 py-1 rounded-full">
                AUS / NZ
              </span>
            </div>

            <div className="flex overflow-x-auto hide-scrollbar gap-4 pb-4 -mx-4 px-4" style={{ touchAction: "pan-x", overscrollBehaviorX: "contain" }}>
              {SUPPLIER_DIRECTORY.map((dirSup, idx) => {
                // Check if already imported
                const alreadyImported = dbSuppliers?.some(
                  (s: any) => s.websiteUrl?.includes(dirSup.url.replace(/^https?:\/\//, '').replace(/\/$/, ''))
                );

                return (
                  <motion.div
                    key={dirSup.name}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.08 }}
                    className="shrink-0 w-[220px] bg-card border border-border rounded-[24px] overflow-hidden flex flex-col shadow-sm"
                  >
                    <div className="h-20 bg-gradient-to-br from-secondary/80 to-secondary/20 flex flex-col items-center justify-center border-b border-border px-3">
                      <h3 className="font-black text-sm text-foreground text-center leading-tight">{dirSup.name}</h3>
                      <span className="text-[10px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full mt-1.5">
                        {dirSup.category}
                      </span>
                    </div>
                    <div className="p-3 flex flex-col gap-2">
                      {alreadyImported ? (
                        <div className="w-full py-2 bg-[var(--color-status-success-bg)] text-[var(--color-success)] rounded-xl font-bold text-xs flex justify-center items-center gap-1.5">
                          <Package className="w-3.5 h-3.5" />
                          Imported
                        </div>
                      ) : (
                        <button
                          onClick={() => scrapeMutation.mutate({ storeUrl: dirSup.url })}
                          disabled={scrapeMutation.isPending}
                          className="w-full py-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-xl font-bold text-xs flex justify-center items-center gap-1.5 transition-colors disabled:opacity-50"
                        >
                          {scrapeMutation.isPending ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Plus className="w-3.5 h-3.5" />
                          )}
                          Import Catalog
                        </button>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </section>
        )}

        {/* My Suppliers */}
        {hasMySuppliers && (
          <section>
            <div className="flex items-center justify-between mb-4 px-1">
              <h2 className="text-xl font-bold tracking-tight">My Suppliers</h2>
            </div>

            <div className="flex overflow-x-auto gap-4 pb-4 -mx-6 px-6 hide-scrollbar" style={{ touchAction: "pan-x", overscrollBehaviorX: "contain" }}>
              {displaySuppliers?.map((supplier: any, i: number) => (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  key={supplier.id}
                  ref={demoMode && i === 0 ? demoSupplierCardRef as any : undefined}
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
                      onClick={() => !demoMode && setSelectedSupplierId(supplier.id)}
                      className="w-full py-2.5 bg-secondary/80 hover:bg-secondary rounded-xl font-bold text-sm flex justify-center items-center gap-2 transition-colors border border-border/50 text-foreground"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Browse Storefront
                    </button>
                    {!demoMode && (
                      <button
                        onClick={() => handleDelete(supplier.id)}
                        disabled={deleteMutation.isPending}
                        className="w-full py-2 bg-destructive/10 hover:bg-destructive/20 text-destructive rounded-xl font-bold text-xs flex justify-center items-center gap-1.5 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Remove
                      </button>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </section>
        )}

        {/* Empty state for suppliers when none imported and not demo */}
        {!hasMySuppliers && !demoMode && (
          <div className="flex flex-col items-center justify-center p-8 text-center h-48 bg-secondary/50 rounded-3xl border border-border">
            <Package className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <h2 className="text-lg font-bold mb-1">No Suppliers Yet</h2>
            <p className="text-muted-foreground text-sm">Import a supplier from the directory above to get started.</p>
          </div>
        )}
      </div>
    </>
  );
}
