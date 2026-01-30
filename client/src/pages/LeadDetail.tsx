import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Mail, Phone, Calendar, DollarSign, Palette, MapPin, Clock, MessageCircle, MessageSquare, X } from "lucide-react";
import { LoadingState, PageShell, GlassSheet, PageHeader } from "@/components/ui/ssot";
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
  const lead = leadsData?.leads?.find(l => l.id === leadId);

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
        <GlassSheet className="bg-white/5">
          <div className="p-6 text-center">
            <p className="text-muted-foreground mb-4">This lead could not be found.</p>
            <Button onClick={() => setLocation("/conversations")}>
              Back to Messages
            </Button>
          </div>
        </GlassSheet>
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
      <GlassSheet className="bg-white/5">
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
            <div className="bg-white/10 rounded-2xl p-4 space-y-3">
              <h2 className="text-lg font-semibold text-foreground">{lead.clientName}</h2>
              
              <div className="space-y-2">
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <Mail className="w-4 h-4" />
                  <a href={`mailto:${lead.clientEmail}`} className="hover:text-foreground">
                    {lead.clientEmail}
                  </a>
                </div>
                
                {lead.clientPhone && (
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <Phone className="w-4 h-4" />
                    <a href={`tel:${lead.clientPhone}`} className="hover:text-foreground">
                      {lead.clientPhone}
                    </a>
                  </div>
                )}
                
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <Clock className="w-4 h-4" />
                  <span>Submitted {formatDate(lead.createdAt)}</span>
                </div>
              </div>
            </div>

            {/* Project Details Card */}
            <div className="bg-white/10 rounded-2xl p-4 space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Project Details</h3>
              
              <div className="space-y-3">
                {lead.projectType && (
                  <div className="flex items-start gap-3">
                    <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm text-muted-foreground">Project Type</p>
                      <p className="text-foreground capitalize">{lead.projectType.replace(/-/g, ' ')}</p>
                    </div>
                  </div>
                )}
                
                {lead.projectDescription && (
                  <div className="flex items-start gap-3">
                    <MessageCircle className="w-4 h-4 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm text-muted-foreground">Description</p>
                      <p className="text-foreground">{lead.projectDescription}</p>
                    </div>
                  </div>
                )}
                
                {lead.stylePreferences && lead.stylePreferences.length > 0 && (
                  <div className="flex items-start gap-3">
                    <Palette className="w-4 h-4 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm text-muted-foreground">Style Preferences</p>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {lead.stylePreferences.map((style: string, i: number) => (
                          <span key={i} className="px-2 py-1 bg-white/10 rounded-full text-xs text-foreground">
                            {style}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                
                {lead.budgetLabel && (
                  <div className="flex items-start gap-3">
                    <DollarSign className="w-4 h-4 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm text-muted-foreground">Budget</p>
                      <p className="text-foreground">{lead.budgetLabel}</p>
                    </div>
                  </div>
                )}
                
                {lead.preferredTimeframe && (
                  <div className="flex items-start gap-3">
                    <Calendar className="w-4 h-4 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm text-muted-foreground">Timeframe</p>
                      <p className="text-foreground capitalize">{lead.preferredTimeframe.replace(/-/g, ' ')}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Status Card */}
            <div className="bg-white/10 rounded-2xl p-4 space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Status</h3>
              <div className="flex items-center gap-2">
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  lead.status === 'new' ? 'bg-blue-500/20 text-blue-400' :
                  lead.status === 'contacted' ? 'bg-green-500/20 text-green-400' :
                  lead.status === 'archived' ? 'bg-gray-500/20 text-gray-400' :
                  'bg-purple-500/20 text-purple-400'
                }`}>
                  {lead.status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </span>
              </div>
            </div>

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
      </GlassSheet>
    </PageShell>
  );
}
