import React, { useState } from "react";
import { ChevronLeft, AlertTriangle, Trash2, ShieldAlert } from "lucide-react";
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

    const wipeAppointments = trpc.appointments.deleteAllForArtist.useMutation({
        onSuccess: () => {
            toast.success("All appointments have been permanently deleted.");
            utils.appointments.invalidate();
            setActiveAction(null);
            setConfirmText("");
        }
    });

    const wipeClients = trpc.conversations.deleteAllClientsForArtist.useMutation({
        onSuccess: () => {
            toast.success("All clients have been permanently deleted.");
            utils.conversations.invalidate();
            setActiveAction(null);
            setConfirmText("");
        }
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
        <div className="w-full h-full flex flex-col overflow-hidden relative bg-black/50">
            <div className="flex items-center gap-3 px-6 pt-6 pb-4 shrink-0 bg-transparent z-20 border-b border-white/5">
                <button onClick={onBack} className="p-2 -ml-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors">
                    <ChevronLeft className="w-5 h-5 text-foreground" />
                </button>
                <h2 className="text-xl font-semibold text-red-500 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5" /> Danger Zone
                </h2>
            </div>

            <div className="flex-1 w-full overflow-y-auto mobile-scroll touch-pan-y relative z-10">
                <div className="pb-[180px] max-w-lg mx-auto space-y-6 px-4 pt-6">

                    <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-[4px] flex items-start gap-3">
                        <ShieldAlert className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                        <div>
                            <p className="text-sm font-semibold text-red-500">Warning: Destructive Actions</p>
                            <p className="text-xs text-red-400 mt-1">Actions taken here are immediate and irreversible.
                                Deleted data cannot be recovered. Proceed with extreme caution.</p>
                        </div>
                    </div>

                    <div className="space-y-4">

                        {/* Delete Appointments */}
                        <div className="p-4 bg-white/5 border border-white/10 rounded-[4px]">
                            <div className="flex items-center justify-between mb-2">
                                <div>
                                    <h3 className="text-foreground font-semibold text-sm">Delete All Appointments</h3>
                                    <p className="text-xs text-muted-foreground mt-0.5">Wipes your calendar. Clients remain.</p>
                                </div>
                                <button
                                    onClick={() => { setActiveAction("appointments"); setConfirmText(""); }}
                                    className="bg-red-500/20 hover:bg-red-500/30 text-red-500 p-2 rounded-[4px] transition-colors"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                            {activeAction === "appointments" && (
                                <div className="mt-4 pt-4 border-t border-white/10 animate-in fade-in slide-in-from-top-2">
                                    <p className="text-xs text-zinc-300 mb-2">Type <strong>DELETE</strong> below to confirm wiping all appointments.</p>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={confirmText}
                                            onChange={(e) => setConfirmText(e.target.value)}
                                            placeholder="DELETE"
                                            className="bg-zinc-900 border border-red-500/50 rounded-[4px] px-3 py-2 text-sm text-foreground w-full outline-none focus:border-red-500 flex-1"
                                        />
                                        <button
                                            onClick={handleExecute}
                                            disabled={confirmText !== "DELETE" || wipeAppointments.isPending}
                                            className="bg-red-500 text-white font-bold text-xs uppercase tracking-wider px-4 rounded-[4px] disabled:opacity-50 transition-all active:scale-95"
                                        >
                                            Confirm
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Delete Clients */}
                        <div className="p-4 bg-white/5 border border-white/10 rounded-[4px]">
                            <div className="flex items-center justify-between mb-2">
                                <div>
                                    <h3 className="text-foreground font-semibold text-sm">Delete All Clients</h3>
                                    <p className="text-xs text-muted-foreground mt-0.5">Removes all client profiles and their appointments.</p>
                                </div>
                                <button
                                    onClick={() => { setActiveAction("clients"); setConfirmText(""); }}
                                    className="bg-red-500/20 hover:bg-red-500/30 text-red-500 p-2 rounded-[4px] transition-colors"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                            {activeAction === "clients" && (
                                <div className="mt-4 pt-4 border-t border-white/10 animate-in fade-in slide-in-from-top-2">
                                    <p className="text-xs text-zinc-300 mb-2">Type <strong>DELETE</strong> below to confirm wiping all clients.</p>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={confirmText}
                                            onChange={(e) => setConfirmText(e.target.value)}
                                            placeholder="DELETE"
                                            className="bg-zinc-900 border border-red-500/50 rounded-[4px] px-3 py-2 text-sm text-foreground w-full outline-none focus:border-red-500 flex-1"
                                        />
                                        <button
                                            onClick={handleExecute}
                                            disabled={confirmText !== "DELETE" || wipeClients.isPending}
                                            className="bg-red-500 text-white font-bold text-xs uppercase tracking-wider px-4 rounded-[4px] disabled:opacity-50 transition-all active:scale-95"
                                        >
                                            Confirm
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Delete Account */}
                        <div className="p-4 bg-red-500/5 border border-red-500/20 rounded-[4px]">
                            <div className="flex items-center justify-between mb-2">
                                <div>
                                    <h3 className="text-red-500 font-semibold text-sm">Delete Account</h3>
                                    <p className="text-xs text-red-400 mt-0.5">Permanently delete your entire account and all data.</p>
                                </div>
                                <button
                                    onClick={() => { setActiveAction("account"); setConfirmText(""); }}
                                    className="bg-red-500 text-white p-2 rounded-[4px] transition-colors"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                            {activeAction === "account" && (
                                <div className="mt-4 pt-4 border-t border-red-500/20 animate-in fade-in slide-in-from-top-2">
                                    <p className="text-xs text-red-400 mb-2">Type <strong>DELETE</strong> below to confirm account deletion.</p>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={confirmText}
                                            onChange={(e) => setConfirmText(e.target.value)}
                                            placeholder="DELETE"
                                            className="bg-zinc-900 border border-red-500/50 rounded-[4px] px-3 py-2 text-sm text-foreground w-full outline-none focus:border-red-500 flex-1"
                                        />
                                        <button
                                            onClick={handleExecute}
                                            disabled={confirmText !== "DELETE" || deleteAccount.isPending}
                                            className="bg-red-500 text-white font-bold text-xs uppercase tracking-wider px-4 rounded-[4px] disabled:opacity-50 transition-all active:scale-95"
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
