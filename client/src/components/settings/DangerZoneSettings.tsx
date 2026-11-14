import React, { useState } from "react";
import { AlertTriangle, Trash2, ShieldAlert } from "lucide-react";
import { PageHeader } from "@/components/ui/ssot";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";

interface DangerZoneSettingsProps {
    onBack: () => void;
}

export function DangerZoneSettings({ onBack }: DangerZoneSettingsProps) {
    const { logout } = useAuth();

    // Toggles for confirmation inputs
    const [activeAction, setActiveAction] = useState<"clients" | "appointments" | "account" | null>(null);
    const [confirmText, setConfirmText] = useState("");

    const utils = trpc.useUtils();

    // The server refuses while sittings are coming up or money is involved, and says why.
    const showRefusal = (error: { message: string }) => {
        toast.error(error.message || "Nothing was deleted. Please try again.", { duration: 12000, style: { whiteSpace: "pre-line" } });
    };
    const keptNote = (kept: number) =>
        kept > 0 ? ` ${kept} with signed forms, deposits or records ${kept === 1 ? "was" : "were"} kept.` : "";

    const wipeAppointments = trpc.appointments.deleteAllForArtist.useMutation({
        onSuccess: (data) => {
            toast.success(`${data.deletedAppointments} unpaid appointment${data.deletedAppointments === 1 ? "" : "s"} permanently deleted.${keptNote(data.keptAppointments)}`);
            utils.appointments.invalidate();
            setActiveAction(null);
            setConfirmText("");
        },
        onError: showRefusal
    });

    const wipeClients = trpc.conversations.deleteAllClientsForArtist.useMutation({
        onSuccess: (data) => {
            toast.success(`${data.removedClients} client${data.removedClients === 1 ? "" : "s"} removed from your list and ${data.deletedAppointments} unpaid appointment${data.deletedAppointments === 1 ? "" : "s"} deleted.${keptNote(data.keptAppointments)}${data.keptClients > 0 ? ` ${data.keptClients} client${data.keptClients === 1 ? " stays" : "s stay"} in your list because of those records.` : ""}`);
            utils.conversations.invalidate();
            utils.appointments.invalidate();
            setActiveAction(null);
            setConfirmText("");
        },
        onError: showRefusal
    });

    const deleteAccount = trpc.auth.deleteAccount.useMutation({
        onSuccess: async () => {
            toast.success("Your account has been permanently deleted.");
            await logout();
            window.location.href = "/";
        }
    });

    const handleExecute = () => {
        if (confirmText !== "DELETE") {
            toast.error("You must type exactly 'DELETE' to confirm.");
            return;
        }

        if (activeAction === "appointments") {
            wipeAppointments.mutate();
        } else if (activeAction === "clients") {
            wipeClients.mutate();
        } else if (activeAction === "account") {
            deleteAccount.mutate();
        }
    };

    return (
        <div className="w-full h-full flex flex-col overflow-hidden relative bg-background/80">
            <PageHeader title="Danger Zone" onBack={onBack} />

            <div className="flex-1 w-full overflow-y-auto mobile-scroll touch-pan-y relative z-10">
                <div className="pb-[180px] max-w-lg mx-auto space-y-6 px-4 pt-6">

                    <div className="p-4 bg-[var(--color-status-danger-bg)] border border-[var(--color-status-danger-border)] rounded-md flex items-start gap-3">
                        <ShieldAlert className="w-5 h-5 text-[var(--color-status-danger-text)] shrink-0 mt-0.5" />
                        <div>
                            <p className="text-sm font-semibold text-[var(--color-status-danger-text)]">Warning: Destructive Actions</p>
                            <p className="text-xs text-[var(--color-status-danger-text)] mt-1">Actions taken here are immediate and irreversible.
                                Deleted data cannot be recovered. Proceed with extreme caution.</p>
                        </div>
                    </div>

                    <div className="space-y-4">

                        {/* Delete Appointments */}
                        <div className="p-4 bg-secondary/50 border border-border rounded-md">
                            <div className="flex items-center justify-between mb-2">
                                <div>
                                    <h3 className="text-foreground font-semibold text-sm">Delete Unpaid Appointments</h3>
                                    <p className="text-xs text-muted-foreground mt-0.5">Deletes your unpaid appointments. Clients remain. Not available while you have upcoming sittings, open payment requests, deposits in progress or paid bookings. Sittings with signed forms are always kept.</p>
                                </div>
                                <button
                                    onClick={() => { setActiveAction("appointments"); setConfirmText(""); }}
                                    className="bg-[var(--color-status-danger-bg)] hover:bg-[var(--color-status-danger-bg)] text-[var(--color-status-danger-text)] p-2 rounded-md transition-colors"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                            {activeAction === "appointments" && (
                                <div className="mt-4 pt-4 border-t border-border animate-in fade-in slide-in-from-top-2">
                                    <p className="text-xs text-muted-foreground mb-2">Type <strong>DELETE</strong> below to confirm deleting your unpaid appointments.</p>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={confirmText}
                                            onChange={(e) => setConfirmText(e.target.value)}
                                            placeholder="DELETE"
                                            className="bg-background border border-[var(--color-status-danger-border)] rounded-md px-3 py-2 text-sm text-foreground w-full outline-none focus:border-red-500 flex-1"
                                        />
                                        <button
                                            onClick={handleExecute}
                                            disabled={confirmText !== "DELETE" || wipeAppointments.isPending}
                                            className="bg-[var(--color-danger)] text-white font-bold text-xs uppercase tracking-wider px-4 rounded-md disabled:opacity-50 transition-all active:scale-95"
                                        >
                                            Confirm
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Delete Clients */}
                        <div className="p-4 bg-secondary/50 border border-border rounded-md">
                            <div className="flex items-center justify-between mb-2">
                                <div>
                                    <h3 className="text-foreground font-semibold text-sm">Remove All Clients</h3>
                                    <p className="text-xs text-muted-foreground mt-0.5">Removes clients from your list with your chats, notes and unpaid appointments. Their own Tattoi accounts are not deleted. Not available while you have upcoming sittings, open payment requests, deposits in progress or paid bookings. Signed forms are always kept.</p>
                                </div>
                                <button
                                    onClick={() => { setActiveAction("clients"); setConfirmText(""); }}
                                    className="bg-[var(--color-status-danger-bg)] hover:bg-[var(--color-status-danger-bg)] text-[var(--color-status-danger-text)] p-2 rounded-md transition-colors"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                            {activeAction === "clients" && (
                                <div className="mt-4 pt-4 border-t border-border animate-in fade-in slide-in-from-top-2">
                                    <p className="text-xs text-muted-foreground mb-2">Type <strong>DELETE</strong> below to confirm removing your clients.</p>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={confirmText}
                                            onChange={(e) => setConfirmText(e.target.value)}
                                            placeholder="DELETE"
                                            className="bg-background border border-[var(--color-status-danger-border)] rounded-md px-3 py-2 text-sm text-foreground w-full outline-none focus:border-red-500 flex-1"
                                        />
                                        <button
                                            onClick={handleExecute}
                                            disabled={confirmText !== "DELETE" || wipeClients.isPending}
                                            className="bg-[var(--color-danger)] text-white font-bold text-xs uppercase tracking-wider px-4 rounded-md disabled:opacity-50 transition-all active:scale-95"
                                        >
                                            Confirm
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Delete Account */}
                        <div className="p-4 bg-[var(--color-status-danger-bg)] border border-[var(--color-status-danger-border)] rounded-md">
                            <div className="flex items-center justify-between mb-2">
                                <div>
                                    <h3 className="text-[var(--color-status-danger-text)] font-semibold text-sm">Delete Account</h3>
                                    <p className="text-xs text-[var(--color-status-danger-text)] mt-0.5">Permanently delete your entire account and all data.</p>
                                </div>
                                <button
                                    onClick={() => { setActiveAction("account"); setConfirmText(""); }}
                                    className="bg-[var(--color-danger)] text-white p-2 rounded-md transition-colors"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                            {activeAction === "account" && (
                                <div className="mt-4 pt-4 border-t border-[var(--color-status-danger-border)] animate-in fade-in slide-in-from-top-2">
                                    <p className="text-xs text-[var(--color-status-danger-text)] mb-2">Type <strong>DELETE</strong> below to confirm account deletion.</p>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={confirmText}
                                            onChange={(e) => setConfirmText(e.target.value)}
                                            placeholder="DELETE"
                                            className="bg-background border border-[var(--color-status-danger-border)] rounded-md px-3 py-2 text-sm text-foreground w-full outline-none focus:border-red-500 flex-1"
                                        />
                                        <button
                                            onClick={handleExecute}
                                            disabled={confirmText !== "DELETE" || deleteAccount.isPending}
                                            className="bg-[var(--color-danger)] text-white font-bold text-xs uppercase tracking-wider px-4 rounded-md disabled:opacity-50 transition-all active:scale-95"
                                        >
                                            Execute
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
}
