import { useState, useEffect } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { PageHeader, PageShell } from "@/components/ui/ssot";
import { Button, Card, Input } from "@/components/ui";
import { tokens } from "@/ui/tokens";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { Users, BarChart3, Mail, ShieldAlert, UserPlus, Check, Trash2, Shield, User } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

type TabState = "team" | "analytics";

export default function StudioDashboard() {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState<TabState>("team");
    const [inviteEmail, setInviteEmail] = useState("");
    const [inviteRole, setInviteRole] = useState<'artist' | 'manager'>('artist');

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get("success") === "true") {
            toast.success("Welcome to your new Studio space! Your subscription is active.");
            // Clean up the URL
            window.history.replaceState({}, '', '/studio');
        }
    }, []);

    // Verify Role and Studio existence
    const { data: currentStudio, isLoading: isLoadingStudio } = trpc.studios.getCurrentStudio.useQuery(undefined, {
        enabled: !!user
    });

    const { data: teamMembers, refetch: refetchTeam } = trpc.studios.getStudioMembers.useQuery(
        { studioId: currentStudio?.id! },
        { enabled: !!currentStudio?.id }
    );

    const inviteMutation = trpc.invitations.generateInvite.useMutation({
        onSuccess: () => {
            setInviteEmail("");
            // Could add a toast here
        }
    });

    const removeMutation = trpc.studios.removeMember.useMutation({
        onSuccess: () => {
            refetchTeam();
        }
    });

    if (isLoadingStudio) {
        return (
            <PageShell>
                <PageHeader title="Studio Headquarters" />
                <div className="flex bg-background h-screen w-full items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
            </PageShell>
        );
    }

    // Fallback for Solo Artists who stumble here
    if (!currentStudio || (currentStudio.role !== 'owner' && currentStudio.role !== 'manager')) {
        return (
            <PageShell>
                <PageHeader title="Studio Headquarters" />
                <div className={cn(tokens.contentContainer.base, "pt-12 text-center px-4")}>
                    <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
                        <ShieldAlert className="w-8 h-8 text-red-500" />
                    </div>
                    <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
                    <p className="text-muted-foreground">You must be a Studio Owner or Manager to access this dashboard.</p>
                </div>
            </PageShell>
        );
    }

    const handleInvite = (e: React.FormEvent) => {
        e.preventDefault();
        if (!inviteEmail) return;
        inviteMutation.mutate({
            studioId: currentStudio.id,
            email: inviteEmail,
            role: inviteRole
        });
    };

    const handleRemoveMember = (userId: string) => {
        if (confirm("Are you sure you want to remove this member?")) {
            removeMutation.mutate({
                studioId: currentStudio.id,
                userId: userId
            });
        }
    };

    return (
        <PageShell>
            <PageHeader title={currentStudio.name} />

            {/* Tabs */}
            <div className="sticky top-0 z-10 px-4 pt-4 pb-2 bg-background/80 backdrop-blur-md border-b border-border/10">
                <div className="flex justify-between items-center w-full bg-white/5 rounded-xl p-1 relative border border-white/10">
                    <button
                        onClick={() => setActiveTab("team")}
                        className={cn(
                            "flex-1 relative z-10 py-2.5 text-sm font-semibold transition-colors flex items-center justify-center gap-2",
                            activeTab === "team" ? "text-primary-foreground" : "text-muted-foreground hover:text-white"
                        )}
                    >
                        <Users className="w-4 h-4" />
                        Team
                        {activeTab === "team" && (
                            <motion.div
                                layoutId="studio_tab_indicator"
                                className="absolute inset-0 bg-primary/30 border border-primary/50 shadow-[0_0_15px_rgba(var(--primary-rgb),0.3)] rounded-lg -z-10"
                                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                            />
                        )}
                    </button>

                    <button
                        onClick={() => setActiveTab("analytics")}
                        className={cn(
                            "flex-1 relative z-10 py-2.5 text-sm font-semibold transition-colors flex items-center justify-center gap-2",
                            activeTab === "analytics" ? "text-primary-foreground" : "text-muted-foreground hover:text-white"
                        )}
                    >
                        <BarChart3 className="w-4 h-4" />
                        Analytics
                        {activeTab === "analytics" && (
                            <motion.div
                                layoutId="studio_tab_indicator"
                                className="absolute inset-0 bg-primary/30 border border-primary/50 shadow-[0_0_15px_rgba(var(--primary-rgb),0.3)] rounded-lg -z-10"
                                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                            />
                        )}
                    </button>
                </div>
            </div>

            <div className={cn(tokens.contentContainer.base, "pb-24 pt-4 px-4")}>
                <AnimatePresence mode="wait">
                    {activeTab === "team" && (
                        <motion.div
                            key="team-tab"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.3 }}
                            className="space-y-6"
                        >
                            {/* Invite Section */}
                            <Card className="p-4 bg-gradient-to-br from-white/10 to-transparent border-white/20">
                                <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
                                    <UserPlus className="w-5 h-5 text-primary" />
                                    Invite Artist
                                </h3>
                                <form onSubmit={handleInvite} className="flex flex-col gap-3">
                                    <Input
                                        placeholder="Artist Email"
                                        value={inviteEmail}
                                        onChange={(e) => setInviteEmail(e.target.value)}
                                        className="w-full bg-black/20"
                                        type="email"
                                        required
                                    />
                                    <div className="flex gap-2">
                                        <select
                                            className="bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm text-foreground flex-1 focus:outline-none focus:ring-1 focus:ring-primary"
                                            value={inviteRole}
                                            onChange={(e) => setInviteRole(e.target.value as any)}
                                        >
                                            <option value="artist">Artist</option>
                                            <option value="manager">Manager</option>
                                        </select>
                                        <Button
                                            type="submit"
                                            disabled={inviteMutation.isPending || !inviteEmail}
                                            className="flex-shrink-0"
                                        >
                                            {inviteMutation.isPending ? "Sending..." : "Send Invite"}
                                        </Button>
                                    </div>
                                    {inviteMutation.isSuccess && (
                                        <p className="text-xs text-green-400 mt-1 flex items-center gap-1">
                                            <Check className="w-3 h-3" /> Invite link generated successfully!
                                        </p>
                                    )}
                                </form>
                            </Card>

                            {/* Team List */}
                            <div>
                                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 pl-1">
                                    Active Members ({teamMembers?.length || 0})
                                </h3>
                                <div className="space-y-3">
                                    {teamMembers?.map((member: any) => (
                                        <div key={member.id} className="p-4 rounded-xl bg-white/5 border border-white/5 flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-white/10 overflow-hidden flex items-center justify-center">
                                                    {member.user.avatar ? (
                                                        <img src={member.user.avatar} alt={member.user.name || "Member"} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <User className="w-5 h-5 text-muted-foreground" />
                                                    )}
                                                </div>
                                                <div>
                                                    <p className="font-medium text-foreground">{member.user.name}</p>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        <span className="text-xs text-muted-foreground">{member.user.email}</span>
                                                        {member.role === 'owner' && <span className="px-1.5 py-0.5 rounded-sm bg-amber-500/20 text-amber-500 text-[10px] font-bold uppercase">Owner</span>}
                                                        {member.role === 'manager' && <span className="px-1.5 py-0.5 rounded-sm bg-blue-500/20 text-blue-500 text-[10px] font-bold uppercase">Manager</span>}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Only allow removing if not self, and logged in user is owner/manager */}
                                            {member.user.id !== user?.id && currentStudio.role === 'owner' && (
                                                <button
                                                    onClick={() => handleRemoveMember(member.user.id)}
                                                    className="p-2 text-muted-foreground hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {activeTab === "analytics" && (
                        <motion.div
                            key="analytics-tab"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.3 }}
                            className="space-y-6"
                        >
                            <Card className="p-8 bg-gradient-to-br from-white/10 to-transparent border-white/20 text-center flex flex-col items-center justify-center min-h-[300px]">
                                <BarChart3 className="w-12 h-12 text-muted-foreground mb-4 opacity-50" />
                                <h3 className="text-xl font-semibold mb-2">Studio Analytics</h3>
                                <p className="text-muted-foreground max-w-sm text-sm">
                                    Track total studio revenue, member-specific performance, and global retention metrics across all your artists.
                                    <br /><br />
                                    <span className="text-primary font-medium">Coming soon in Phase 2.</span>
                                </p>
                            </Card>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

        </PageShell>
    );
}
