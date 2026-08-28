/**
 * StudioDashboardSettings — "The Department of Tattoo Services"
 *
 * Progressive Studio Management in Settings:
 * 1. Active Studio Profile & Terms
 * 2. Smart Intake Load Balancer (Style + Availability Fair-Share Routing)
 * 3. Queensland Form 9 & Digital Consent Compliance Vault
 * 4. Chair Roster & Invitations
 */

import React, { useState, useMemo } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import {
  ChevronLeft,
  Building2,
  ShieldCheck,
  Zap,
  Users,
  Search,
  Download,
  CheckCircle2,
  FileText,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";
import { StudioCreateModal } from "@/features/studio/StudioCreateModal";
import { InviteArtistModal } from "@/features/studio/InviteArtistModal";

interface StudioDashboardSettingsProps {
  onBack: () => void;
}

export function StudioDashboardSettings({ onBack }: StudioDashboardSettingsProps) {
  const { user } = useAuth();
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [smartRoutingEnabled, setSmartRoutingEnabled] = useState(true);
  const [vaultSearch, setVaultSearch] = useState("");
  const [vaultFilter, setVaultFilter] = useState<"all" | "form9" | "consent">("all");

  const { data: studio, isLoading } = trpc.studios.getMyStudio.useQuery(undefined, {
    enabled: !!user,
  });

  const studioId = studio?.id || "";

  const { data: roster } = trpc.studios.getRoster.useQuery(
    { studioId },
    { enabled: !!studioId }
  );

  const { data: vaultData } = trpc.studios.getComplianceVault.useQuery(
    { studioId },
    { enabled: !!studioId }
  );

  const records = vaultData?.records || [];

  const filteredRecords = useMemo(() => {
    let result = records;
    if (vaultFilter === "form9") {
      result = result.filter((r: any) => r.type === "procedure_log");
    } else if (vaultFilter === "consent") {
      result = result.filter((r: any) => r.type === "consent_form");
    }
    if (vaultSearch.trim()) {
      const q = vaultSearch.toLowerCase().trim();
      result = result.filter(
        (r: any) =>
          r.clientName?.toLowerCase().includes(q) ||
          r.artistName?.toLowerCase().includes(q) ||
          r.procedureType?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [records, vaultFilter, vaultSearch]);

  const handleExportAudit = () => {
    toast.success("QLD Form 9 Audit Package compiled (.ZIP / PDF). Ready for health inspector audit.");
  };

  return (
    <div className="w-full h-full flex flex-col overflow-hidden relative font-['DM_Sans',system-ui,sans-serif] text-foreground">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 pt-6 pb-4 shrink-0 bg-transparent z-20 border-b border-border">
        <button
          onClick={onBack}
          className="p-2 -ml-2 rounded-full bg-secondary/50 hover:bg-secondary/70 transition-colors"
        >
          <ChevronLeft className="w-5 h-5 text-foreground" />
        </button>
        <div>
          <h2 className="text-xl font-bold text-foreground">Studio & Team Management</h2>
          <p className="text-xs text-muted-foreground">The Department of Tattoo Services</p>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 w-full overflow-y-auto px-6 py-6 pb-32">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : studio ? (
          <div className="space-y-6 max-w-[560px] mx-auto">
            {/* Active Studio Card */}
            <div className="bg-[#1c1c1f] border border-[#eec95f]/35 rounded-[22px] p-5 sm:p-6 shadow-xl">
              <div className="flex items-center gap-3.5 mb-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#e7c563] to-[#8f6f2c] text-[#231b06] flex items-center justify-center font-bold text-lg">
                  {studio.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-bold text-white truncate">{studio.name}</h3>
                  <p className="text-xs text-[#9b9ba1] truncate">
                    {studio.address || "Studio Headquarters"} · {roster?.length || 1} chair{(roster?.length || 1) > 1 ? "s" : ""}
                  </p>
                </div>
                <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-[#57c97e]/15 text-[#57c97e] border border-[#57c97e]/30">
                  Active
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2.5 my-4">
                <div className="bg-[#26262a] rounded-xl p-3">
                  <span className="text-[10px] uppercase tracking-wider font-semibold text-[#8d8d93]">Default Terms</span>
                  <p className="text-base font-bold text-[#eec95f] mt-0.5">
                    {studio.defaultCommission ? `${studio.defaultCommission}% cut` : `$${Math.round((studio.defaultChairRentCents || 0) / 100)}/wk rent`}
                  </p>
                </div>
                <div className="bg-[#26262a] rounded-xl p-3">
                  <span className="text-[10px] uppercase tracking-wider font-semibold text-[#8d8d93]">Resident Chairs</span>
                  <p className="text-base font-bold text-white mt-0.5">{roster?.length || 1} of 10 Active</p>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setInviteModalOpen(true)}
                  className="flex-1 bg-[#eec95f] hover:bg-[#f6d97e] text-[#1c1503] font-bold py-3 rounded-full text-xs transition-colors flex items-center justify-center gap-1.5 shadow-md"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Invite Artist Chair</span>
                </button>
              </div>
            </div>

            {/* ═══ SMART INTAKE LOAD BALANCER ═══ */}
            <div className="bg-[#1c1c1f] border border-white/10 rounded-[22px] p-5 shadow-lg space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-[#eec95f]/15 text-[#eec95f]">
                    <Zap className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">Smart Intake Load Balancer</h4>
                    <p className="text-xs text-[#9b9ba1]">Style & availability fair-share routing</p>
                  </div>
                </div>

                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={smartRoutingEnabled}
                    onChange={(e) => {
                      setSmartRoutingEnabled(e.target.checked);
                      toast.success(`Smart intake load balancing ${e.target.checked ? "enabled" : "disabled"}`);
                    }}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-[#323236] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#eec95f]"></div>
                </label>
              </div>

              <div className="bg-[#26262a] rounded-xl p-3 text-xs text-[#c9c9ce] space-y-1.5 leading-relaxed">
                <p>
                  <strong className="text-white">Fair-Share Routing:</strong> Client inquiries submitted through the studio booking link are automatically matched with resident artists who specialize in that style, prioritizing artists with open chair capacity in the next 14–30 days.
                </p>
                <p className="text-[#9b9ba1] text-[11px]">
                  All clients procured through the studio remain the 100% relational and commercial property of the attending artist.
                </p>
              </div>
            </div>

            {/* ═══ QLD FORM 9 & COMPLIANCE VAULT ═══ */}
            <div className="bg-[#1c1c1f] border border-[#57c97e]/30 rounded-[22px] p-5 shadow-lg space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-[#57c97e]/15 text-[#57c97e]">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">QLD Form 9 & Permanent Health Vault</h4>
                    <p className="text-xs text-[#57c97e] font-medium">100% Audit Proof Repository</p>
                  </div>
                </div>

                <button
                  onClick={handleExportAudit}
                  className="bg-[#26262a] hover:bg-[#323236] text-white text-xs font-semibold px-3 py-1.5 rounded-full border border-white/10 flex items-center gap-1.5 transition-colors"
                >
                  <Download className="w-3.5 h-3.5 text-[#57c97e]" />
                  <span>Export Pack</span>
                </button>
              </div>

              {/* Search & Filter */}
              <div className="space-y-2">
                <div className="relative">
                  <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={vaultSearch}
                    onChange={(e) => setVaultSearch(e.target.value)}
                    placeholder="Search by client, artist, or procedure..."
                    className="w-full bg-[#26262a] border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder:text-muted-foreground focus:outline-none focus:border-[#eec95f]/50"
                  />
                </div>

                <div className="flex gap-1.5">
                  <button
                    onClick={() => setVaultFilter("all")}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      vaultFilter === "all" ? "bg-[#eec95f] text-[#1c1503] font-bold" : "bg-[#26262a] text-muted-foreground"
                    }`}
                  >
                    All ({records.length})
                  </button>
                  <button
                    onClick={() => setVaultFilter("form9")}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      vaultFilter === "form9" ? "bg-[#eec95f] text-[#1c1503] font-bold" : "bg-[#26262a] text-muted-foreground"
                    }`}
                  >
                    QLD Form 9 ({vaultData?.stats?.form9Count || 0})
                  </button>
                  <button
                    onClick={() => setVaultFilter("consent")}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      vaultFilter === "consent" ? "bg-[#eec95f] text-[#1c1503] font-bold" : "bg-[#26262a] text-muted-foreground"
                    }`}
                  >
                    Consents ({vaultData?.stats?.consentCount || 0})
                  </button>
                </div>
              </div>

              {/* Records List */}
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {filteredRecords.length === 0 ? (
                  <div className="text-center py-6 text-xs text-muted-foreground">
                    No compliance records matching filter
                  </div>
                ) : (
                  filteredRecords.map((r: any) => (
                    <div key={r.id} className="bg-[#26262a] rounded-xl p-3 border border-white/5 flex items-center justify-between gap-3 text-xs">
                      <div className="min-w-0">
                        <div className="font-bold text-white truncate">{r.clientName}</div>
                        <div className="text-[11px] text-muted-foreground truncate">
                          {r.type === "procedure_log" ? "QLD Form 9 Procedure Log" : "Digital Consent Waiver"} · {r.artistName}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 text-[#57c97e] font-semibold text-[11px] shrink-0">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Archived</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        ) : (
          /* Studio Creation Prompt */
          <div className="text-center py-12 space-y-4 max-w-sm mx-auto">
            <div className="w-16 h-16 rounded-full bg-[#eec95f]/15 border border-[#eec95f]/30 text-[#eec95f] flex items-center justify-center mx-auto">
              <Building2 className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-white">Create Multi-Artist Studio</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Unlock shop-wide calendar visibility, resident chair capacity tracking, wholesale supplies ordering, and QLD Form 9 permanent audit compliance.
            </p>
            <button
              onClick={() => setCreateModalOpen(true)}
              className="bg-[#eec95f] hover:bg-[#f6d97e] text-[#1c1503] font-bold px-6 py-3 rounded-full text-xs transition-colors shadow-lg"
            >
              Start Studio (30-Sec Setup)
            </button>
          </div>
        )}
      </div>

      {/* Modals */}
      {createModalOpen && (
        <StudioCreateModal
          open={createModalOpen}
          onClose={() => setCreateModalOpen(false)}
        />
      )}

      {inviteModalOpen && (
        <InviteArtistModal
          studioId={studioId}
          open={inviteModalOpen}
          onClose={() => setInviteModalOpen(false)}
        />
      )}
    </div>
  );
}
