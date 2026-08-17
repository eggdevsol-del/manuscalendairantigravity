/**
 * SuppliesSegment — §6.5 Supplies segment
 *
 * Two sections:
 *   MY SUPPLIERS — artist's linked suppliers
 *   FIND SUPPLIERS — curated directory
 *
 * RUNNING LOW skipped — no artist-side stock tracking (see discovery table).
 *
 * Wraps existing SuppliersTab data layer but with new layout.
 */

import React, { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { DT, DType, DRadius, DSpace } from "./dashboardTokens";
import { Search, ExternalLink, Plus, Trash2, Package, ChevronRight } from "lucide-react";
import { SupplierStorefront } from "./SupplierStorefront";
import { AnimatePresence, motion } from "framer-motion";
import { DEMO_SUPPLIERS } from "./dashboardDemoData";
import { useTooltipTarget } from "@/components/tooltip-tour";

// Curated supplier directory
const SUPPLIER_DIRECTORY = [
  { name: "Pro Tattoo Supply", url: "https://protattoosupply.com.au/", category: "General Supply", bannerUrl: "https://protattoosupply.com.au/cdn/shop/files/image.png" },
  { name: "Dr Pickles", url: "https://drpickles.com/", category: "Aftercare", bannerUrl: "https://drpickles.com/cdn/shop/files/DrPickles_Homepage_Desktop_1.jpg" },
  { name: "Tatsup", url: "https://www.tatsup.com/", category: "Equipment", bannerUrl: "https://www.tatsup.com/cdn/shop/files/tatsup-banner.jpg" },
  { name: "Inkjecta", url: "https://inkjecta.com/", category: "Machines", bannerUrl: "https://inkjecta.com/cdn/shop/files/banner.jpg" },
  { name: "Dynamic Color", url: "https://dynamiccolor.com/", category: "Inks", bannerUrl: "https://dynamiccolor.com/cdn/shop/files/hero-banner.jpg" },
  { name: "Bstattoo", url: "https://www.bstattoo.com.au/", category: "General Supply", bannerUrl: "https://www.bstattoo.com.au/cdn/shop/files/banner.jpg" },
];

// ── Section Header ──────────────────────────────────────

function SectionHeader({ label, right }: { label: string; right?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: DSpace[2] }}>
      <span style={{
        fontSize: DType.sectionLabel.fontSize,
        fontWeight: DType.sectionLabel.fontWeight,
        letterSpacing: DType.sectionLabel.letterSpacing,
        color: DT.textTertiary,
        textTransform: "uppercase",
      }}>
        {label}
      </span>
      {right}
    </div>
  );
}

// ── Supplier Row ────────────────────────────────────────

function SupplierRow({
  name, url, logoUrl, onTap, onDelete, isLinked,
}: {
  name: string; url?: string | null; logoUrl?: string | null;
  onTap?: () => void; onDelete?: () => void; isLinked?: boolean;
}) {
  return (
    <div
      style={{
        background: DT.cardSurface,
        borderRadius: DRadius.row,
        border: `1px solid ${DT.hairline}`,
        padding: `${DSpace[4]}px ${DSpace[5]}px`,
        display: "flex",
        alignItems: "center",
        gap: DSpace[4],
        cursor: onTap ? "pointer" : undefined,
        transition: "background .15s",
        minHeight: 44,
      }}
      onClick={onTap}
      onMouseEnter={e => { if (onTap) e.currentTarget.style.background = DT.rowHover; }}
      onMouseLeave={e => e.currentTarget.style.background = DT.cardSurface}
    >
      {/* Logo or placeholder */}
      <div style={{
        width: 36, height: 36, borderRadius: 8, overflow: "hidden",
        background: DT.quietRow, display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0,
      }}>
        {logoUrl ? (
          <img src={logoUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <Package size={16} color={DT.textTertiary} />
        )}
      </div>

      {/* Name */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: DType.rowTitle.fontSize,
          fontWeight: DType.rowTitle.fontWeight,
          color: DT.textPrimary,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}>
          {name}
        </div>
        {url && (
          <div style={{ fontSize: DType.rowMeta.fontSize, color: DT.textTertiary, marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}
          </div>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
        {isLinked && onDelete && (
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: 6,
              color: DT.textTertiary,
              minWidth: 44,
              minHeight: 44,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            aria-label={`Delete ${name}`}
          >
            <Trash2 size={14} />
          </button>
        )}
        {onTap && (
          <ChevronRight size={16} color={DT.textTertiary} />
        )}
      </div>
    </div>
  );
}

// ── Directory Card ──────────────────────────────────────

function DirectoryCard({
  name, url, category, bannerUrl, isAlreadyAdded, onImport, importing,
}: {
  name: string; url: string; category: string; bannerUrl?: string;
  isAlreadyAdded: boolean; onImport: () => void; importing: boolean;
}) {
  return (
    <div style={{
      position: "relative",
      borderRadius: DRadius.row,
      border: `1px solid ${DT.hairline}`,
      padding: `${DSpace[4]}px ${DSpace[5]}px`,
      display: "flex",
      alignItems: "center",
      gap: DSpace[4],
      overflow: "hidden",
      minHeight: 64,
    }}>
      {/* Banner background */}
      {bannerUrl && (
        <div style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `url(${bannerUrl})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          opacity: 0.12,
          zIndex: 0,
        }} />
      )}
      {/* Dark overlay for text readability */}
      <div style={{
        position: "absolute",
        inset: 0,
        background: `linear-gradient(90deg, ${DT.cardSurface} 40%, transparent 100%)`,
        zIndex: 1,
      }} />

      <div style={{ flex: 1, minWidth: 0, position: "relative", zIndex: 2 }}>
        <div style={{ fontSize: DType.rowTitle.fontSize, fontWeight: DType.rowTitle.fontWeight, color: DT.textPrimary }}>
          {name}
        </div>
        <div style={{ fontSize: DType.rowMeta.fontSize, color: DT.textTertiary, marginTop: 1 }}>
          {category}
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, flexShrink: 0, position: "relative", zIndex: 2 }}>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
          style={{
            background: "transparent", border: "none", cursor: "pointer",
            padding: 6, color: DT.textTertiary,
            minWidth: 44, minHeight: 44,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
          aria-label={`Visit ${name}`}
        >
          <ExternalLink size={14} />
        </a>
        {isAlreadyAdded ? (
          <div style={{
            borderRadius: DRadius.button,
            padding: "6px 14px",
            fontSize: DType.exceptionPill.fontSize,
            fontWeight: DType.exceptionPill.fontWeight,
            minHeight: 36,
            display: "flex",
            alignItems: "center",
            color: DT.textTertiary,
            border: `1px solid ${DT.hairline}`,
          }}>
            Added ✓
          </div>
        ) : (
          <button
            onClick={onImport}
            disabled={importing}
            style={{
              background: DT.amber,
              border: "none",
              borderRadius: DRadius.button,
              cursor: "pointer",
              padding: "6px 14px",
              color: DT.amberOnColor,
              fontSize: DType.exceptionPill.fontSize,
              fontWeight: DType.exceptionPill.fontWeight,
              minHeight: 36,
              opacity: importing ? 0.6 : 1,
              whiteSpace: "nowrap",
            }}
          >
            {importing ? "Adding…" : "Add Supplier"}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main Component ──────────────────────────────────────

interface SuppliesSegmentProps {
  demoMode?: boolean;
}

export function SuppliesSegment({ demoMode = false }: SuppliesSegmentProps) {
  const [selectedSupplierId, setSelectedSupplierId] = useState<number | null>(null);

  // Tooltip tour targets
  const demoSuppliersAreaRef = useTooltipTarget("demo-suppliers-area");
  const demoSupplierCardRef = useTooltipTarget("demo-supplier-card");
  const [searchQuery, setSearchQuery] = useState("");
  const [importingUrl, setImportingUrl] = useState<string | null>(null);

  const { data: dbSuppliers, refetch: refetchSuppliers } = trpc.suppliers.getSuppliers.useQuery();
  const scrapeMutation = trpc.suppliers.scrapeShopifyStore.useMutation({
    onSuccess: (data) => {
      toast.success(`Imported ${data.productCount} products from ${data.name}`);
      setImportingUrl(null);
      refetchSuppliers();
    },
    onError: (err) => {
      toast.error(err.message);
      setImportingUrl(null);
    },
  });

  const deleteMutation = trpc.suppliers.deleteSupplier.useMutation({
    onSuccess: () => {
      toast.success("Storefront deleted");
      refetchSuppliers();
    },
    onError: (err) => toast.error(err.message),
  });

  const handleDelete = (id: number) => {
    if (demoMode) return;
    if (window.confirm("Delete this storefront?")) {
      deleteMutation.mutate({ supplierId: id });
    }
  };

  const handleImport = (url: string) => {
    if (demoMode) return;
    setImportingUrl(url);
    scrapeMutation.mutate({ storeUrl: url });
  };

  // Data
  const displaySuppliers = demoMode && (!dbSuppliers || dbSuppliers.length === 0)
    ? DEMO_SUPPLIERS.map(s => ({
        id: s.id,
        name: s.name,
        websiteUrl: s.url,
        logoUrl: s.logoUrl,
      }))
    : dbSuppliers;

  const hasMySuppliers = displaySuppliers && displaySuppliers.length > 0;

  // Filter directory by search
  const filteredDirectory = SUPPLIER_DIRECTORY.filter(s =>
    !searchQuery || s.name.toLowerCase().includes(searchQuery.toLowerCase()) || s.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Supplier storefront pushed
  if (selectedSupplierId && !demoMode) {
    return (
      <SupplierStorefront
        supplierId={selectedSupplierId}
        onBack={() => setSelectedSupplierId(null)}
      />
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: DSpace[7] }}>
      {/* Search */}
      <div style={{ position: "relative" }}>
        <Search size={16} color={DT.textTertiary} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }} />
        <input
          type="text"
          placeholder="Search suppliers…"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          readOnly={demoMode}
          style={{
            width: "100%",
            background: DT.quietRow,
            border: `1px solid ${DT.hairline}`,
            borderRadius: DRadius.pill,
            padding: "12px 16px 12px 40px",
            fontSize: DType.rowBody.fontSize,
            color: DT.textPrimary,
            outline: "none",
          }}
        />
      </div>

      {/* MY SUPPLIERS */}
      <div ref={demoSuppliersAreaRef}>
        <SectionHeader label="MY SUPPLIERS" right={
          hasMySuppliers ? (
            <span style={{ fontSize: DType.sectionCount.fontSize, color: DT.textTertiary }}>
              {displaySuppliers!.length}
            </span>
          ) : undefined
        } />

        {hasMySuppliers ? (
          <div style={{ display: "flex", flexDirection: "column", gap: DSpace[1] }}>
            {displaySuppliers!.map((s: any) => (
              <SupplierRow
                key={s.id}
                name={s.name}
                url={s.websiteUrl}
                logoUrl={s.logoUrl}
                isLinked
                onTap={() => !demoMode && setSelectedSupplierId(s.id)}
                onDelete={() => handleDelete(s.id)}
              />
            ))}
          </div>
        ) : (
          <div style={{
            border: `1px dashed ${DT.hairline}`,
            borderRadius: DRadius.row,
            padding: DSpace[7],
            textAlign: "center",
          }}>
            <div style={{ color: DT.textPrimary, fontSize: DType.rowTitle.fontSize, fontWeight: DType.rowTitle.fontWeight }}>
              No suppliers linked
            </div>
            <div style={{ color: DT.textSecondary, fontSize: DType.rowBody.fontSize, marginTop: 4 }}>
              Add from the directory below
            </div>
          </div>
        )}
      </div>

      {/* FIND SUPPLIERS */}
      <div ref={demoSupplierCardRef}>
        <SectionHeader label="FIND SUPPLIERS" />
        <div style={{ display: "flex", flexDirection: "column", gap: DSpace[1] }}>
          {filteredDirectory.map(s => {
            const alreadyAdded = displaySuppliers?.some((ds: any) => {
              const dsUrl = (ds.websiteUrl || "").replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
              const dirUrl = s.url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
              return dsUrl === dirUrl;
            }) || false;
            return (
              <DirectoryCard
                key={s.url}
                name={s.name}
                url={s.url}
                category={s.category}
                bannerUrl={s.bannerUrl}
                isAlreadyAdded={alreadyAdded}
                onImport={() => handleImport(s.url)}
                importing={importingUrl === s.url}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
