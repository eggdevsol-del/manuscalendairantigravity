import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Mail, Phone, Calendar, DollarSign, Palette, MapPin, Clock, MessageCircle, MessageSquare, X, Image as ImageIcon } from "lucide-react";
import { LoadingState, PageShell, PageHeader, GlassSheet } from "@/components/ui/ssot";
import { Card } from "@/components/ui/card";
import { tokens } from "@/ui/tokens";
import { cn } from "@/lib/utils";
import { useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { toast } from "sonner";

export default function LeadDetail() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const params = useParams<{ id: string }>();
  const leadId = parseInt(params.id || "0");

  // Fetch lead details
  const { data: leadsData, isLoading, refetch } = trpc.funnel.getLeads.useQuery(
    { status: undefined, limit: 100, offset: 0 },
    { enabled: !!user && leadId > 0 }
  );

  // Find the specific lead
  const lead = (leadsData?.leads as any[])?.find(l => l.id === leadId);

  // Update lead status mutation
  const updateStatusMutation = trpc.funnel.updateLeadStatus.useMutation({
    onSuccess: () => {
      refetch();
    },
    onError: (error) => {
      toast.error("Failed to update status: " + error.message);
    }
  });

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      setLocation("/login");
    }
  }, [user, loading, setLocation]);

  if (loading || isLoading) {
    return <LoadingState />;
  }

  if (!lead) {
    return (
      <PageShell>
        <PageHeader title="Lead Not Found" />
        <div className={tokens.contentContainer.base}>
          <div className="p-6 text-center">
            <p className="text-muted-foreground mb-4">This lead could not be found.</p>
            <Button onClick={() => setLocation("/conversations")}>
              Back to Messages
            </Button>
          </div>
        </div>
      </PageShell>
    );
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "N/A";
    return new Date(dateStr).toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleOpenChat = () => {
    // Mark lead as contacted when opening chat
    if (lead.status === 'new') {
      updateStatusMutation.mutate({ leadId: lead.id, status: 'contacted' });
    }

    // Navigate to chat if conversation exists
    if (lead.conversationId) {
      setLocation(`/chat/${lead.conversationId}`);
    } else {
      toast.error("No conversation found for this lead. The client may have submitted before the update.");
    }
  };

  const handleArchive = () => {
    updateStatusMutation.mutate({ leadId: lead.id, status: 'archived' });
  };

  return (
    <PageShell>
      <PageHeader title="Consultation Request" />
      <div className={tokens.contentContainer.base}>
        {/* Back Button */}
        <div className="shrink-0 pt-4 pb-2 px-4 border-b border-white/5">
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground gap-2"
            onClick={() => setLocation("/conversations")}
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Messages
          </Button>
        </div>

        {/* Lead Content */}
        <div className="flex-1 w-full h-full px-4 pt-4 overflow-y-auto mobile-scroll touch-pan-y">
          <div className="pb-32 max-w-lg mx-auto space-y-6">

            {/* Client Info Card */}
            <Card className={cn(tokens.card.base, "hover:bg-white/5")}>
              <h2 className="text-lg font-semibold text-foreground px-4 pt-4">{lead.clientName}</h2>

              <div className="space-y-4 p-4">
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <Mail className="w-4 h-4" />
                  <a href={`mailto:${lead.clientEmail}`} className="hover:text-foreground transition-colors">
                    {lead.clientEmail}
                  </a>
                </div>

                {lead.clientPhone && (
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <Phone className="w-4 h-4" />
                    <a href={`tel:${lead.clientPhone}`} className="hover:text-foreground transition-colors">
                      {lead.clientPhone}
                    </a>
                  </div>
                )}

                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <Clock className="w-4 h-4" />
                  <span>Submitted {formatDate(lead.createdAt)}</span>
                </div>
              </div>
            </Card>

            {/* Project Details Card */}
            <Card className={cn(tokens.card.base, "hover:bg-white/5")}>
              <div className="p-4 border-b border-white/5">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Project Details</h3>
              </div>

              <div className="p-4 space-y-4">
                {lead.projectType && (
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 p-1.5 rounded-full bg-white/5">
                      <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">Project Type</p>
                      <p className="text-foreground capitalize font-medium">{lead.projectType.replace(/-/g, ' ')}</p>
                    </div>
                  </div>
                )}

                {lead.projectDescription && (
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 p-1.5 rounded-full bg-white/5">
                      <MessageCircle className="w-3.5 h-3.5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">Description</p>
                      <p className="text-foreground leading-relaxed text-sm">{lead.projectDescription}</p>
                    </div>
                  </div>
                )}

                {lead.stylePreferences && lead.stylePreferences.length > 0 && (
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 p-1.5 rounded-full bg-white/5">
                      <Palette className="w-3.5 h-3.5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-2">Style Preferences</p>
                      <div className="flex flex-wrap gap-2">
                        {lead.stylePreferences.map((style: string, i: number) => (
                          <span key={i} className="px-2.5 py-1 bg-white/5 border border-white/10 rounded-full text-xs text-foreground font-medium">
                            {style}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {lead.budgetLabel && (
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 p-1.5 rounded-full bg-white/5">
                      <DollarSign className="w-3.5 h-3.5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">Budget</p>
                      <p className="text-foreground font-medium">{lead.budgetLabel}</p>
                    </div>
                  </div>
                )}

                {lead.preferredTimeframe && (
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 p-1.5 rounded-full bg-white/5">
                      <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">Timeframe</p>
                      <p className="text-foreground capitalize font-medium">{lead.preferredTimeframe.replace(/-/g, ' ')}</p>
                    </div>
                  </div>
                )}

                {/* Images */}
                {(lead.referenceImages || lead.bodyPlacementImages) && (
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 p-1.5 rounded-full bg-white/5">
                      <ImageIcon className="w-3.5 h-3.5 text-muted-foreground" />
                    </div>
                    <div className="w-full">
                      <p className="text-xs text-muted-foreground mb-2">Reference & Placement</p>

                      {/* Reference Images */}
                      {lead.referenceImages && (
                        <div className="mb-3">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">References</p>
                          <div className="grid grid-cols-4 gap-2">
                            {(Array.isArray(lead.referenceImages) ? lead.referenceImages : JSON.parse(lead.referenceImages || '[]')).map((img: string, i: number) => (
                              <div key={i} className="aspect-square rounded-md overflow-hidden bg-white/5 border border-white/10 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => window.open(img, '_blank')}>
                                <img src={img} alt="Reference" className="w-full h-full object-cover" />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Placement Images */}
                      {lead.bodyPlacementImages && (
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Placement</p>
                          <div className="grid grid-cols-4 gap-2">
                            {(Array.isArray(lead.bodyPlacementImages) ? lead.bodyPlacementImages : JSON.parse(lead.bodyPlacementImages || '[]')).map((img: string, i: number) => (
                              <div key={i} className="aspect-square rounded-md overflow-hidden bg-white/5 border border-white/10 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => window.open(img, '_blank')}>
                                <img src={img} alt="Placement" className="w-full h-full object-cover" />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </Card>

            {/* Status Card */}
            <Card className={cn(tokens.card.base, "flex items-center justify-between p-4")}>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Status</h3>
              <div className="flex items-center gap-2">
                <span className={cn(
                  "px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide",
                  lead.status === 'new' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                    lead.status === 'contacted' ? 'bg-green-500/10 text-green-400 border border-green-500/20' :
                      lead.status === 'archived' ? 'bg-gray-500/10 text-gray-400 border border-gray-500/20' :
                        'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                )}>
                  {lead.status.replace(/_/g, ' ')}
                </span>
              </div>
            </Card>

            {/* Action Buttons */}
            <div className="space-y-3 pt-4">
              {/* Primary action: Open in Chat */}
              <Button
                className="w-full bg-green-600 hover:bg-green-700"
                onClick={handleOpenChat}
                disabled={updateStatusMutation.isPending}
              >
                <MessageSquare className="w-4 h-4 mr-2" />
                Open in Chat
              </Button>

              <Button
                variant="outline"
                className="w-full"
                onClick={() => window.location.href = `mailto:${lead.clientEmail}?subject=Re: Your consultation request`}
              >
                <Mail className="w-4 h-4 mr-2" />
                Send Email
              </Button>

              {lead.clientPhone && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => window.location.href = `tel:${lead.clientPhone}`}
                >
                  <Phone className="w-4 h-4 mr-2" />
                  Call Client
                </Button>
              )}

              {lead.status !== 'archived' && (
                <Button
                  variant="ghost"
                  className="w-full text-red-400 hover:text-red-300 hover:bg-red-500/10"
                  onClick={handleArchive}
                  disabled={updateStatusMutation.isPending}
                >
                  <X className="w-4 h-4 mr-2" />
                  Archive Lead
                </Button>
              )}
            </div>

          </div>
        </div>
      </div>
    </PageShell>
  );
}
