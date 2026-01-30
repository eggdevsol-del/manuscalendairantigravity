import { useAuth } from "@/_core/hooks/useAuth";
<<<<<<< HEAD
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label, ModalShell, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Textarea } from "@/components/ui";
=======
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ModalShell } from "@/components/ui/overlays/modal-shell";
import { LoadingState, PageShell, GlassSheet, PageHeader } from "@/components/ui/ssot";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
>>>>>>> f67b805f30b6e59529d357c59fa5a255ab93fc80
import { trpc } from "@/lib/trpc";
import { Calendar, ChevronRight, Clock, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function Consultations() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const [showNewDialog, setShowNewDialog] = useState(false);

  // Form state
  const [selectedArtistId, setSelectedArtistId] = useState("");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [preferredDate, setPreferredDate] = useState("");

  // Get list of artists for selection
  const { data: artists = [] } = trpc.auth.listArtists.useQuery();

  const { data: consultations, isLoading, refetch } = trpc.consultations.list.useQuery(undefined, {
    enabled: !!user,
  });

  const createConsultationMutation = trpc.consultations.create.useMutation({
    onSuccess: () => {
      toast.success("Consultation request submitted successfully");
      setShowNewDialog(false);
      setSelectedArtistId("");
      setSubject("");
      setDescription("");
      setPreferredDate("");
      refetch();
    },
    onError: (error: any) => {
      toast.error("Failed to submit consultation: " + error.message);
    },
  });

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      setLocation("/login");
    }
  }, [loading, user, setLocation]);

  const handleSubmit = () => {
    if (!selectedArtistId || !subject || !description) {
      toast.error("Please fill in all required fields");
      return;
    }

    createConsultationMutation.mutate({
      artistId: selectedArtistId,
      subject,
      description,
      preferredDate: preferredDate || undefined,
    });
  };

  if (loading || !user) {
    return <LoadingState message="Loading..." fullScreen />;
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.4)]";
      case "responded":
        return "bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.4)]";
      case "scheduled":
        return "bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.4)]";
      case "completed":
        return "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.4)]";
      case "cancelled":
        return "bg-slate-500";
      default:
        return "bg-slate-500";
    }
  };

  const getStatusText = (status: string) => {
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  return (
    <PageShell>
      {/* 1. Page Header - Left aligned, no icons */}
      <PageHeader title="Consultations" />

      {/* 2. Top Context Area (Stats/Info) */}
      <div className="px-6 pt-4 pb-8 z-10 shrink-0 flex flex-col justify-center h-[20vh] opacity-80">
        <p className="text-4xl font-light text-foreground/90 tracking-tight">Requests</p>
        <p className="text-muted-foreground text-lg font-medium mt-1">
          Manage your bookings
        </p>
      </div>

      {/* 3. Sheet Container */}
      <GlassSheet className="bg-white/5">

        {/* Sheet Header: Filter/Sort could go here */}
        <div className="shrink-0 pt-6 pb-2 px-6 border-b border-white/5">
          <h2 className="text-xs font-bold text-muted-foreground tracking-widest uppercase">
            Your History ({consultations?.length || 0})
          </h2>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 w-full h-full px-4 pt-4 overflow-y-auto mobile-scroll touch-pan-y">
          <div className="pb-32 max-w-lg mx-auto space-y-3">
            {isLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-muted-foreground">Loading consultations...</p>
              </div>
            ) : consultations && consultations.length > 0 ? (
              consultations.map((consultation) => (
                <Card
                  key={consultation.id}
                  className="overflow-hidden cursor-pointer group border-0 bg-white/5 hover:bg-white/10 rounded-[2rem] transition-all duration-300 relative"
                  onClick={() => {
                    if (consultation.conversationId) {
                      setLocation(`/chat/${consultation.conversationId}`);
                    } else {
                      setLocation("/conversations");
                    }
                  }}
                >
                  <div className="absolute inset-0 rounded-[2rem] bg-gradient-to-r from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

                  <div className="p-5 relative z-10">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="text-lg font-bold text-foreground group-hover:text-primary transition-colors">{consultation.subject}</h3>
                        <p className="text-sm text-muted-foreground mt-0.5">
                          with {consultation.artist?.name || consultation.artist?.email || "Artist"}
                        </p>
                      </div>
                      <div className={cn("w-3 h-3 rounded-full mt-1.5", getStatusColor(consultation.status))} />
                    </div>

                    <p className="text-sm text-white/60 line-clamp-2 leading-relaxed mb-4">
                      {consultation.description}
                    </p>

                    <div className="flex items-center gap-4 text-xs font-medium text-white/40 group-hover:text-white/60 transition-colors">
                      {consultation.preferredDate && (
                        <div className="flex items-center gap-1.5 bg-white/5 px-2 py-1 rounded-md">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>{new Date(consultation.preferredDate).toLocaleDateString()}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{consultation.createdAt ? new Date(consultation.createdAt).toLocaleDateString() : 'N/A'}</span>
                      </div>
                    </div>
                  </div>
                </Card>
              ))
            ) : (
              <div className="text-center py-12 px-6">
                <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4">
                  <Calendar className="w-8 h-8 text-muted-foreground opacity-50" />
                </div>
                <h3 className="text-lg font-semibold mb-2">No Consultations Yet</h3>
                <p className="text-muted-foreground mb-6 max-w-xs mx-auto text-sm">
                  Request a consultation with an artist to start planning your next tattoo.
                </p>
                <Button onClick={() => setShowNewDialog(true)} size="lg" className="rounded-full px-8 shadow-lg shadow-primary/20">
                  Start Request
                </Button>
              </div>
            )}
          </div>
        </div>
      </GlassSheet>

      <ModalShell
        isOpen={showNewDialog}
        onClose={() => setShowNewDialog(false)}
        title="Request Consultation"
        description="Select an artist and request a consultation appointment"
        className="max-w-md"
        overlayName="Request Consultation"
        overlayId="consultations.new_request"
        footer={
          <div className="flex w-full gap-2">
            <Button
              variant="outline"
              className="flex-1 bg-transparent border-white/10 hover:bg-white/5"
              onClick={() => setShowNewDialog(false)}
            >
              Cancel
            </Button>
            <Button
              className="flex-1 shadow-lg shadow-primary/20"
              onClick={handleSubmit}
              disabled={createConsultationMutation.isPending}
            >
              {createConsultationMutation.isPending ? "Submitting..." : "Submit Request"}
            </Button>
          </div>
        }
      >
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="artist">Select Artist *</Label>
            <Select value={selectedArtistId} onValueChange={setSelectedArtistId}>
              <SelectTrigger className="bg-white/5 border-white/10 h-11">
                <SelectValue placeholder="Choose an artist" />
              </SelectTrigger>
              <SelectContent>
                {artists.map((artist) => (
                  <SelectItem key={artist.id} value={artist.id}>
                    {artist.name || artist.email}
                    {artist.instagramUsername && ` (@${artist.instagramUsername})`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="subject">Subject *</Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g., Custom tattoo design"
              className="bg-white/5 border-white/10 h-11"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description *</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what you'd like to discuss..."
              rows={5}
              className="bg-white/5 border-white/10 min-h-[120px]"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="preferred-date">Preferred Date (Optional)</Label>
            <Input
              id="preferred-date"
              type="date"
              value={preferredDate}
              onChange={(e) => setPreferredDate(e.target.value)}
              className="bg-white/5 border-white/10 h-11"
            />
          </div>
        </div>
      </ModalShell>
    </PageShell>
  );
}
