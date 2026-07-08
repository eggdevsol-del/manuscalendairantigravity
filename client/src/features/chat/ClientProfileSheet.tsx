import { BottomSheet } from "@/components/ui/ssot";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui";
import {
  User,
  Mail,
  Phone,
  Cake,
  BadgeCheck,
  Image as ImageIcon,
  Camera,
  Loader2,
  Calendar,
  X,
  ChevronRight,
  Download,
  Trash,
  Plus,
} from "lucide-react";
import { format } from "date-fns";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { createPortal } from "react-dom";
import { WebPushSettings } from "@/components/WebPushSettings";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getAssetUrl } from "@/lib/assets";
import { Identity } from "../../../../shared/identity";
import { HistoryCard } from "@/features/profile/components/ContentCards";

interface ClientProfileSheetProps {
  isOpen: boolean;
  onClose: () => void;
  clientId?: string | null;
  client?: (Identity & { id: string }) | null | undefined;
}

export function ClientProfileSheet({
  isOpen,
  onClose,
  clientId,
  client: propClient,
}: ClientProfileSheetProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [newNoteText, setNewNoteText] = useState("");
  const utils = trpc.useUtils();

  const targetClientId = clientId || propClient?.id || "";

  // Fetch client profile if we only have clientId, or to ensure we have fresh data
  const { data: fetchedClient, isLoading: clientLoading } =
    trpc.clientProfile.getProfile.useQuery(
      { clientId: targetClientId },
      {
        enabled: isOpen && !!targetClientId,
        staleTime: 30000, // Cache for 30 seconds
      }
    );

  const client = fetchedClient || propClient;

  // Fetch client media
  const { data: mediaData, isLoading: mediaLoading } =
    trpc.conversations.getClientMedia.useQuery(
      { clientId: targetClientId },
      {
        enabled: isOpen && !!targetClientId,
        staleTime: 30000,
      }
    );

  // Fetch client history
  const { data: history, isLoading: historyLoading } =
    trpc.clientProfile.getHistory.useQuery(
      { clientId: targetClientId },
      {
        enabled: isOpen && !!targetClientId,
      }
    );

  // Fetch client upcoming appointments
  const { data: upcoming, isLoading: upcomingLoading } =
    trpc.clientProfile.getUpcoming.useQuery(
      { clientId: targetClientId },
      {
        enabled: isOpen && !!targetClientId,
      }
    );

  // Fetch client consent forms
  const { data: forms, isLoading: formsLoading } =
    trpc.clientProfile.getConsentForms.useQuery(
      { clientId: targetClientId },
      {
        enabled: isOpen && !!targetClientId,
      }
    );

  // Fetch client spend summary (payments info)
  const { data: spend, isLoading: spendLoading } =
    trpc.clientProfile.getSpendSummary.useQuery(
      { clientId: targetClientId },
      {
        enabled: isOpen && !!targetClientId,
      }
    );

  // Fetch client notes
  const { data: notes, isLoading: notesLoading } =
    trpc.clientProfile.getClientNotes.useQuery(
      { clientId: targetClientId },
      {
        enabled: isOpen && !!targetClientId,
      }
    );

  // Notes mutations
  const addNoteMutation = trpc.clientProfile.addClientNote.useMutation({
    onSuccess: () => {
      toast.success("Note added");
      utils.clientProfile.getClientNotes.invalidate({ clientId: targetClientId });
    },
    onError: err => {
      toast.error("Failed to add note: " + err.message);
    },
  });

  const deleteNoteMutation = trpc.clientProfile.deleteClientNote.useMutation({
    onSuccess: () => {
      toast.success("Note deleted");
      utils.clientProfile.getClientNotes.invalidate({ clientId: targetClientId });
    },
    onError: err => {
      toast.error("Failed to delete note: " + err.message);
    },
  });

  const handleAddNote = () => {
    if (!newNoteText.trim()) return;
    addNoteMutation.mutate({
      clientId: targetClientId,
      note: newNoteText,
    });
    setNewNoteText("");
  };

  const handleSaveToDevice = async (imageUrl: string) => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      const filename = imageUrl.split("/").pop() || "photo.jpg";
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
      toast.success("Image saved to device");
    } catch (error) {
      console.error("Save to device failed", error);
      window.open(imageUrl, "_blank");
      toast.info("Image opened in a new tab. Press and hold to save to device.");
    }
  };

  if (!isOpen || !client) return null;

  const hasMedia = mediaData && mediaData.totalCount > 0;
  const allMediaImages = [
    ...(mediaData?.referenceImages || []),
    ...(mediaData?.bodyPlacementImages || []),
  ];

  return (
    <>
      <BottomSheet
        open={isOpen}
        onOpenChange={(o) => !o && onClose()}
        title="Client Profile"
        className="!h-[75dvh] !inset-auto !bottom-0 !inset-x-0 rounded-t-[2rem] bg-background/5 backdrop-blur-md"
      >
        {/* Sticky Header */}
        <div className="shrink-0 pt-6 pb-4 px-6 border-b border-border/50 bg-background/80 backdrop-blur-md flex items-center justify-between z-10 relative">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center overflow-hidden">
              {client.avatar ? (
                <img
                  src={getAssetUrl(client.avatar)}
                  alt={client.name || "Client"}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-white font-bold text-lg">
                  {(client.name || "?")[0].toUpperCase()}
                </span>
              )}
            </div>
            <div>
              <h3 className="font-bold text-lg flex items-center gap-1.5 text-foreground">
                {client.name || "Unknown Client"}
                <BadgeCheck className="w-4 h-4 text-blue-500" />
              </h3>
              <p className="text-xs text-muted-foreground">
                Client Profile
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="w-10 h-10 rounded-full hover:bg-secondary"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Scrollable Body */}
        <ScrollArea className="flex-1 h-[calc(100vh-100px)]">
          <div className="p-6 space-y-6 pb-24">
            {/* Contact Details */}
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="p-4 rounded-xl bg-secondary/30 border border-border/50">
                <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5" /> Email
                </span>
                <p className="text-sm font-semibold text-foreground mt-1 truncate">
                  {client.email || "No email provided"}
                </p>
              </div>
              <div className="p-4 rounded-xl bg-secondary/30 border border-border/50">
                <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5" /> Phone
                </span>
                <p className="text-sm font-semibold text-foreground mt-1">
                  {client.phone || "No phone number"}
                </p>
              </div>
              <div className="p-4 rounded-xl bg-secondary/30 border border-border/50">
                <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" /> Birthday
                </span>
                <p className="text-sm font-semibold text-foreground mt-1">
                  {client.birthday
                    ? format(new Date(client.birthday), "MMMM do, yyyy")
                    : "Not set"}
                </p>
              </div>
            </div>

            {/* Media Strip */}
            {allMediaImages.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-muted-foreground tracking-widest uppercase">Shared Media</h4>
                <div className="flex items-center gap-3 overflow-x-auto no-scrollbar py-1">
                  {allMediaImages.map((img: any, index: number) => (
                    <button
                      key={`media-${index}`}
                      onClick={() => setSelectedImage(img.url)}
                      className="w-20 h-20 rounded-xl overflow-hidden bg-secondary border border-border hover:border-primary/50 transition-colors shrink-0"
                    >
                      <img
                        src={getAssetUrl(img.url)}
                        alt={`Media ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Collapsible Sections */}
            <div className="space-y-1">
              {/* Upcoming Appointments */}
              <CollapsibleSection title="Upcoming Appointments" count={upcoming?.length} defaultExpanded={true}>
                {upcomingLoading ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                ) : !upcoming || upcoming.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-6 bg-secondary/20 rounded-xl border border-border/50">
                    No upcoming appointments scheduled.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {upcoming.map((appt: any) => (
                      <div key={appt.id} className="p-3 rounded-xl border border-border bg-secondary/30 flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-sm text-foreground">{appt.title || appt.serviceName || "Tattoo Sitting"}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {format(new Date(appt.date), "EEE, MMM d, yyyy • h:mm a")}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-primary">${appt.price}</p>
                          <span className="inline-block text-[9px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 capitalize font-bold mt-1">
                            {appt.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CollapsibleSection>

              {/* History */}
              <CollapsibleSection title="Appointment History" count={history?.length}>
                {historyLoading ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                ) : (
                  <HistoryCard history={history || []} />
                )}
              </CollapsibleSection>

              {/* Consent Forms */}
              <CollapsibleSection title="Consent Forms" count={forms?.length}>
                {formsLoading ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                ) : !forms || forms.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-6 bg-secondary/20 rounded-xl border border-border/50">
                    No consent forms on file.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {forms.map((form: any) => (
                      <div key={form.id} className="flex items-center justify-between p-3 rounded-xl border border-border bg-secondary/30">
                        <div>
                          <p className="font-semibold text-sm text-foreground">{form.title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {form.status === "signed"
                              ? `Signed ${format(new Date(form.signedAt || form.updatedAt), "MMM d, yyyy")}`
                              : "Pending signature"}
                          </p>
                        </div>
                        <span className={cn(
                          "text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border",
                          form.status === "signed"
                            ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                            : "bg-orange-500/10 text-orange-500 border-orange-500/20"
                        )}>
                          {form.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CollapsibleSection>

              {/* Payments */}
              <CollapsibleSection title="Payments">
                {spendLoading ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-2">
                      <div className="p-3 bg-secondary/30 rounded-xl text-center border border-border/50">
                        <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-wider">Total spend</span>
                        <p className="text-base font-bold text-foreground mt-1">${spend?.totalSpend || 0}</p>
                      </div>
                      <div className="p-3 bg-secondary/30 rounded-xl text-center border border-border/50">
                        <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-wider">Sittings</span>
                        <p className="text-base font-bold text-foreground mt-1">{spend?.appointmentCount || 0}</p>
                      </div>
                      <div className="p-3 bg-secondary/30 rounded-xl text-center border border-border/50">
                        <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-wider">Max single</span>
                        <p className="text-base font-bold text-foreground mt-1">${spend?.maxSingleSpend || 0}</p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <h5 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Receipts & Invoices</h5>
                      {historyLoading ? (
                        <div className="py-2 text-center text-xs text-muted-foreground">Loading payments...</div>
                      ) : !history || history.filter(item => (item.type === "appointment" || item.type === "store_order") && item.price > 0).length === 0 ? (
                        <p className="text-xs text-muted-foreground/60 text-center py-4 bg-secondary/10 rounded-xl border border-border/30">
                          No payments recorded.
                        </p>
                      ) : (
                        <div className="space-y-1.5">
                          {history
                            .filter(item => (item.type === "appointment" || item.type === "store_order") && item.price > 0)
                            .map((item: any) => (
                              <div key={item.id} className="flex items-center justify-between text-xs p-3 rounded-xl bg-secondary/10 border border-border/50">
                                <div>
                                  <p className="font-semibold text-foreground">{item.title}</p>
                                  <p className="text-[10px] text-muted-foreground mt-0.5">{format(new Date(item.date), "MMM d, yyyy")}</p>
                                </div>
                                <span className="font-bold text-foreground">${item.price.toFixed(2)}</span>
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </CollapsibleSection>

              {/* Notes */}
              <CollapsibleSection title="Notes" count={notes?.length}>
                {notesLoading ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Add Note Input */}
                    <div className="flex gap-2">
                      <Input
                        placeholder="Add a new client note..."
                        value={newNoteText}
                        onChange={e => setNewNoteText(e.target.value)}
                        className="flex-1 h-10 text-sm"
                        onKeyDown={e => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            handleAddNote();
                          }
                        }}
                      />
                      <Button
                        size="sm"
                        onClick={handleAddNote}
                        disabled={!newNoteText.trim() || addNoteMutation.isPending}
                        className="h-10 px-4 shrink-0 bg-primary text-white hover:bg-primary/95"
                      >
                        {addNoteMutation.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          "Add"
                        )}
                      </Button>
                    </div>

                    {/* Notes List */}
                    {!notes || notes.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-6 bg-secondary/20 rounded-xl border border-border/50">
                        No notes on file. Add your first note above.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {notes.map((note: any) => (
                          <div key={note.id} className="p-3 bg-secondary/30 rounded-xl border border-border/50 flex items-start justify-between gap-3 group relative">
                            <div className="flex-1 pr-6">
                              <p className="text-sm whitespace-pre-wrap leading-relaxed text-foreground/90">{note.note}</p>
                              <p className="text-[10px] text-muted-foreground/60 mt-1.5">
                                {format(new Date(note.createdAt), "MMM d, yyyy • h:mm a")}
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="absolute top-2 right-2 h-7 w-7 text-muted-foreground hover:text-destructive rounded-lg hover:bg-destructive/10 shrink-0 md:opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => deleteNoteMutation.mutate({ noteId: note.id })}
                              disabled={deleteNoteMutation.isPending}
                            >
                              {deleteNoteMutation.isPending ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <Trash className="w-3.5 h-3.5" />
                              )}
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </CollapsibleSection>
            </div>

            {/* Web Push Notification Settings */}
            <div className="pt-4 border-t border-border/50">
              <WebPushSettings />
            </div>
          </div>
        </ScrollArea>
      </BottomSheet>

      {/* Image Lightbox - Portal to body to ensure it's above the bottom sheet */}
      {selectedImage &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] bg-background/90 flex items-center justify-center p-4"
            onClick={() => setSelectedImage(null)}
          >
            <div
              className="relative w-[80vw] h-[80vh] flex flex-col items-center justify-center"
              onClick={e => e.stopPropagation()}
            >
              {/* Toolbar */}
              <div className="absolute top-4 right-4 flex items-center gap-3 z-10">
                <button
                  className="p-2.5 rounded-full bg-secondary/80 hover:bg-secondary text-foreground hover:text-primary transition-all active:scale-90"
                  onClick={() => handleSaveToDevice(selectedImage)}
                  title="Save to Device"
                >
                  <Download className="w-5 h-5" />
                </button>
                <button
                  className="p-2.5 rounded-full bg-secondary/80 hover:bg-secondary text-foreground hover:text-primary transition-all active:scale-90"
                  onClick={() => setSelectedImage(null)}
                  title="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Contained Image */}
              <img
                src={getAssetUrl(selectedImage)}
                alt="Full size media"
                className="w-full h-full object-contain rounded-xl shadow-2xl"
              />
            </div>
          </div>,
          document.body
        )}
    </>
  );
}

function CollapsibleSection({
  title,
  count,
  defaultExpanded = false,
  children,
}: {
  title: string;
  count?: number;
  defaultExpanded?: boolean;
  children: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  return (
    <div className="border-b border-border py-4 last:border-b-0">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between text-left font-semibold text-lg text-foreground hover:opacity-80 transition-opacity focus:outline-none py-1"
      >
        <span className="flex items-center gap-2">
          {title}
          {count !== undefined && count > 0 && (
            <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              {count}
            </span>
          )}
        </span>
        <ChevronRight
          className={cn(
            "w-5 h-5 text-muted-foreground transition-transform duration-200",
            expanded && "transform rotate-90"
          )}
        />
      </button>
      <div
        className={cn(
          "grid transition-all duration-200 ease-in-out",
          expanded ? "grid-rows-[1fr] opacity-100 mt-4" : "grid-rows-[0fr] opacity-0 overflow-hidden"
        )}
      >
        <div className="overflow-hidden min-h-0">
          {children}
        </div>
      </div>
    </div>
  );
}
