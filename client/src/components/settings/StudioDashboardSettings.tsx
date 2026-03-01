import { useState, useEffect } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { PageHeader, PageShell } from "@/components/ui/ssot";
import { Button, Card, Input } from "@/components/ui";
import { tokens } from "@/ui/tokens";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import {
  Users,
  BarChart3,
  Mail,
  ShieldAlert,
  UserPlus,
  Trash2,
  User,
  Settings as SettingsIcon,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useLocation } from "wouter";

type TabState = "team" | "invite" | "analytics" | "settings";

interface StudioDashboardSettingsProps {
  onBack: () => void;
}

export function StudioDashboardSettings({ onBack }: StudioDashboardSettingsProps) {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<TabState>("team");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"artist" | "manager">("artist");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("success") === "true") {
      toast.success(
        "Welcome to your new Studio space! Your subscription is active."
      );
      // Clean up the URL
      window.history.replaceState({}, "", "/studio");
    }
  }, []);

  // Verify Role and Studio existence
  const { data: currentStudio, isLoading: isLoadingStudio } =
    trpc.studios.getCurrentStudio.useQuery(undefined, {
      enabled: !!user,
    });

  const { data: teamMembers, refetch: refetchTeam } =
    trpc.studios.getStudioMembers.useQuery(
      { studioId: currentStudio?.id! },
      { enabled: !!currentStudio?.id }
    );

  const inviteMutation = trpc.studios.inviteArtist.useMutation({
    onSuccess: () => {
      setInviteEmail("");
      toast.success("Invitation sent successfully!");
      refetchTeam();
      // Automatically switch back to team tab to see the pending invite
      setActiveTab("team");
    },
    onError: err => {
      toast.error(err.message);
    },
  });

  const removeMutation = trpc.studios.removeMember.useMutation({
    onSuccess: () => {
      refetchTeam();
    },
  });

  if (isLoadingStudio) {
    return (
      <div className="w-full h-full flex flex-col bg-background relative isolate">
        <PageHeader title="Studio Headquarters" onBack={onBack} />
        <div className="flex bg-background h-screen w-full items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  // Fallback for Solo Artists who stumble here
  if (
    !currentStudio ||
    (currentStudio.role !== "owner" && currentStudio.role !== "manager")
  ) {
    return (
      <div className="w-full h-full flex flex-col bg-background relative isolate">
        <PageHeader title="Studio Headquarters" onBack={onBack} />
        <div
          className={cn(tokens.contentContainer.base, "pt-12 text-center px-4")}
        >
          <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
          <p className="text-muted-foreground">
            You must be a Studio Owner or Manager to access this dashboard.
          </p>
        </div>
      </div>
    );
  }

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) return;
    inviteMutation.mutate({
      studioId: currentStudio.id,
      artistEmail: inviteEmail,
      role: inviteRole,
    });
  };

  const handleRemoveMember = (userId: string) => {
    if (confirm("Are you sure you want to remove this member?")) {
      removeMutation.mutate({
        studioId: currentStudio.id,
        userId: userId,
      });
    }
  };

  const activeMembers = teamMembers?.filter(m => m.status === "active") || [];
  const pendingMembers =
    teamMembers?.filter(m => m.status === "pending_invite") || [];

  return (
    <div className="w-full h-full flex flex-col bg-background relative isolate">
      <PageHeader title={currentStudio.name} onBack={onBack} />

      {/* Desktop Horizontal Layout Optimized Tabs */}
      <div className="sticky top-0 z-10 px-4 pt-4 pb-2 bg-background/80 backdrop-blur-md border-b border-border/10">
        <div className="flex justify-between items-center w-full max-w-4xl mx-auto bg-white/5 rounded-xl p-1 relative border border-white/10 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab("team")}
            className={cn(
              "flex-1 min-w-[100px] relative z-10 py-2.5 text-sm font-semibold transition-colors flex items-center justify-center gap-2",
              activeTab === "team"
                ? "text-primary-foreground"
                : "text-muted-foreground hover:text-white"
            )}
          >
            <Users className="w-4 h-4 hidden sm:block" />
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
            onClick={() => setActiveTab("invite")}
            className={cn(
              "flex-1 min-w-[100px] relative z-10 py-2.5 text-sm font-semibold transition-colors flex items-center justify-center gap-2",
              activeTab === "invite"
                ? "text-primary-foreground"
                : "text-muted-foreground hover:text-white"
            )}
          >
            <UserPlus className="w-4 h-4 hidden sm:block" />
            Invite
            {activeTab === "invite" && (
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
              "flex-1 min-w-[100px] relative z-10 py-2.5 text-sm font-semibold transition-colors flex items-center justify-center gap-2",
              activeTab === "analytics"
                ? "text-primary-foreground"
                : "text-muted-foreground hover:text-white"
            )}
          >
            <BarChart3 className="w-4 h-4 hidden sm:block" />
            Analytics
            {activeTab === "analytics" && (
              <motion.div
                layoutId="studio_tab_indicator"
                className="absolute inset-0 bg-primary/30 border border-primary/50 shadow-[0_0_15px_rgba(var(--primary-rgb),0.3)] rounded-lg -z-10"
                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
              />
            )}
          </button>

          <button
            onClick={() => setActiveTab("settings")}
            className={cn(
              "flex-1 min-w-[100px] relative z-10 py-2.5 text-sm font-semibold transition-colors flex items-center justify-center gap-2",
              activeTab === "settings"
                ? "text-primary-foreground"
                : "text-muted-foreground hover:text-white"
            )}
          >
            <SettingsIcon className="w-4 h-4 hidden sm:block" />
            Settings
            {activeTab === "settings" && (
              <motion.div
                layoutId="studio_tab_indicator"
                className="absolute inset-0 bg-primary/30 border border-primary/50 shadow-[0_0_15px_rgba(var(--primary-rgb),0.3)] rounded-lg -z-10"
                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
              />
            )}
          </button>
        </div>
      </div>

      <div
        className={cn(
          tokens.contentContainer.base,
          "pb-24 pt-8 px-4 max-w-4xl mx-auto"
        )}
      >
        <AnimatePresence mode="wait">
          {activeTab === "team" && (
            <motion.div
              key="team-tab"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="space-y-8"
            >
              {/* Intro for Studio Accounts */}
              {teamMembers && teamMembers.length <= 1 && (
                <Card className="p-6 bg-primary/10 border-primary/30">
                  <h3 className="text-xl font-bold mb-2">
                    Welcome to your Studio!
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    Your studio account is currently set up as an owner/manager
                    hub. To start taking bookings, you should invite your
                    personal Artist profile under the "Invite" tab.
                  </p>
                  <Button onClick={() => setActiveTab("invite")} variant="hero">
                    Invite Artist
                  </Button>
                </Card>
              )}

              {/* Team List */}
              <div className="space-y-6">
                {/* Active Members */}
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4 pl-1 flex items-center gap-2">
                    <Users className="w-4 h-4" /> Active Members (
                    {activeMembers.length})
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {activeMembers.map((member: any) => (
                      <div
                        key={member.id}
                        className="p-4 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between hover:bg-white/10 transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-full bg-white/10 overflow-hidden flex items-center justify-center border border-white/20">
                            {member.user.avatar ? (
                              <img
                                src={member.user.avatar}
                                alt={member.user.name || "Member"}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <User className="w-6 h-6 text-muted-foreground" />
                            )}
                          </div>
                          <div>
                            <p className="font-semibold text-lg text-foreground">
                              {member.user.name}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-sm text-muted-foreground">
                                {member.user.email}
                              </span>
                              {member.role === "owner" && (
                                <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-500 text-[10px] font-bold uppercase tracking-wider">
                                  Owner
                                </span>
                              )}
                              {member.role === "manager" && (
                                <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-500 text-[10px] font-bold uppercase tracking-wider">
                                  Manager
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Only allow removing if not self, and logged in user is owner/manager */}
                        {member.user.id !== user?.id &&
                          currentStudio.role === "owner" && (
                            <button
                              onClick={() => handleRemoveMember(member.user.id)}
                              className="p-2.5 text-muted-foreground hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          )}
                      </div>
                    ))}
                    {activeMembers.length === 0 && (
                      <p className="text-sm text-muted-foreground italic px-2">
                        No active members found.
                      </p>
                    )}
                  </div>
                </div>

                {/* Pending Invites */}
                {pendingMembers.length > 0 && (
                  <div className="pt-4">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4 pl-1 flex items-center gap-2">
                      <Mail className="w-4 h-4" /> Pending Invites (
                      {pendingMembers.length})
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {pendingMembers.map((member: any) => (
                        <div
                          key={member.id}
                          className="p-4 rounded-xl bg-white/5 border border-white/5 border-dashed flex items-center justify-between opacity-70"
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full bg-white/5 border-2 border-dashed border-white/20 flex items-center justify-center">
                              <Mail className="w-5 h-5 text-muted-foreground" />
                            </div>
                            <div>
                              <p className="font-semibold text-lg text-foreground">
                                {member.user.name || member.user.email}
                              </p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-sm text-muted-foreground">
                                  Pending • Invited as {member.role}
                                </span>
                              </div>
                            </div>
                          </div>

                          {currentStudio.role === "owner" && (
                            <button
                              onClick={() => handleRemoveMember(member.user.id)}
                              className="p-2 text-muted-foreground hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                              title="Cancel Invite"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === "invite" && (
            <motion.div
              key="invite-tab"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="max-w-2xl mx-auto space-y-6"
            >
              <Card className="p-8 bg-gradient-to-br from-white/10 to-transparent border-white/20 shadow-xl">
                <div className="mb-8 text-center">
                  <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4">
                    <UserPlus className="w-8 h-8 text-primary" />
                  </div>
                  <h3 className="text-2xl font-bold mb-2">Invite to Studio</h3>
                  <p className="text-muted-foreground">
                    Add artists and managers to your studio space. They will
                    receive an email invitation to join.
                  </p>
                </div>
                <form onSubmit={handleInvite} className="flex flex-col gap-6">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                        User Email
                      </label>
                      <Input
                        placeholder="artist@example.com"
                        value={inviteEmail}
                        onChange={e => setInviteEmail(e.target.value)}
                        className="w-full bg-black/30 border-white/20 py-6 text-lg"
                        type="email"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                        Role
                      </label>
                      <select
                        className="w-full bg-black/30 border border-white/20 rounded-xl px-4 py-3 text-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                        value={inviteRole}
                        onChange={e => setInviteRole(e.target.value as any)}
                      >
                        <option value="artist">
                          Artist (Takes bookings & manages clients)
                        </option>
                        <option value="manager">
                          Manager (Admin access to studio)
                        </option>
                      </select>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={inviteMutation.isPending || !inviteEmail}
                    className="w-full py-6 text-lg mt-4 shadow-lg shadow-primary/20"
                    variant="hero"
                  >
                    {inviteMutation.isPending
                      ? "Sending Invitation..."
                      : "Send Invitation"}
                  </Button>
                </form>
              </Card>
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
              <Card className="p-12 bg-gradient-to-br from-white/10 to-transparent border-white/20 text-center flex flex-col items-center justify-center min-h-[400px]">
                <div className="p-6 rounded-full bg-white/5 border border-white/10 mb-6">
                  <BarChart3 className="w-16 h-16 text-muted-foreground opacity-70" />
                </div>
                <h3 className="text-3xl font-bold mb-4 tracking-tight">
                  Studio Analytics
                </h3>
                <p className="text-muted-foreground text-lg max-w-md mx-auto mb-8 leading-relaxed">
                  Track total studio revenue, member-specific performance, and
                  global retention metrics across all your artists.
                </p>
                <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/20 text-primary font-bold text-sm tracking-widest uppercase">
                  Coming Soon
                </span>
              </Card>
            </motion.div>
          )}

          {activeTab === "settings" && (
            <motion.div
              key="settings-tab"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              <Card className="p-8 bg-gradient-to-br from-white/10 to-transparent border-white/20 flex flex-col items-center justify-center min-h-[400px] text-center">
                <div className="p-6 rounded-full bg-white/5 border border-white/10 mb-6">
                  <SettingsIcon className="w-16 h-16 text-muted-foreground opacity-70" />
                </div>
                <h3 className="text-3xl font-bold mb-4 tracking-tight">
                  Studio Setup
                </h3>
                <p className="text-muted-foreground text-lg max-w-md mx-auto mb-8 leading-relaxed">
                  Manage your studio's billing, global policies, and booking
                  details.
                </p>
                <Button
                  onClick={onBack}
                  variant="hero"
                  className="px-8"
                >
                  Open Settings
                </Button>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
