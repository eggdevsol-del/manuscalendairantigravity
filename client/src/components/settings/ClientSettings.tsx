import { useAuth } from "@/_core/hooks/useAuth";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
} from "@/components/ui";
import { ModalShell } from "@/components/ui/overlays/modal-shell";
import { PageHeader, LoadingState } from "@/components/ui/ssot";
import { trpc } from "@/lib/trpc";
import {
  ChevronLeft,
  Clock,
  Mail,
  MessageCircle,
  Phone,
  Plus,
  Search,
  Trash,
  User,
  Filter,
  CheckSquare,
  Square,
  Send
} from "lucide-react";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@/components/ui/empty";
import { useEffect, useState, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { useConversations } from "@/hooks/useConversations";
import { tokens } from "@/ui/tokens";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/safe-select";
import { Textarea } from "@/components/ui/textarea";

interface ClientSettingsProps {
  onBack: () => void;
}

export function ClientSettings({ onBack }: ClientSettingsProps) {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showBulkMessage, setShowBulkMessage] = useState(false);
  const [bulkMessage, setBulkMessage] = useState("");

  // Advanced Filter States
  const [showFilters, setShowFilters] = useState(false);
  const [locationFilter, setLocationFilter] = useState("");
  const [debouncedLocation, setDebouncedLocation] = useState("");
  const locationDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const [minTlv, setMinTlv] = useState<number | "">("");
  const [maxTlv, setMaxTlv] = useState<number | "">("");
  const [minSittings, setMinSittings] = useState<number | "">("");
  const [birthMonth, setBirthMonth] = useState<string>("all");

  // Debounce location filter to avoid refetch on every keystroke
  const handleLocationChange = useCallback((value: string) => {
    setLocationFilter(value);
    if (locationDebounceRef.current) clearTimeout(locationDebounceRef.current);
    locationDebounceRef.current = setTimeout(() => {
      setDebouncedLocation(value);
    }, 500);
  }, []);

  const [selectedClients, setSelectedClients] = useState<Set<string>>(new Set());

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
  });

  // Fetch demographic clients instead of basic conversations
  const { data: demographicClients, refetch, isFetching } = trpc.conversations.getClients.useQuery({
    location: debouncedLocation || undefined,
    minTlv: minTlv !== "" ? Number(minTlv) : undefined,
    maxTlv: maxTlv !== "" ? Number(maxTlv) : undefined,
    minSittings: minSittings !== "" ? Number(minSittings) : undefined,
    birthMonth: birthMonth !== "all" ? Number(birthMonth) : undefined,
  }, {
    enabled: !!user && (user.role === "artist" || user.role === "admin"),
  });

  const createConversationMutation = trpc.conversations.getOrCreate.useMutation(
    {
      onSuccess: () => {
        toast.success("Client added successfully");
        setShowAddDialog(false);
        resetForm();
        refetch();
      },
      onError: (error: any) => {
        toast.error("Failed to add client: " + error.message);
      },
    }
  );

  const bulkMessageMutation = trpc.conversations.bulkMessageClients.useMutation({
    onSuccess: (data) => {
      toast.success(`Broadcasting... generated ${data.count} independent conversations.`);
      setShowBulkMessage(false);
      setBulkMessage("");
      setSelectedClients(new Set());
    },
    onError: (error) => {
      toast.error("Broadcast failed: " + error.message);
    }
  });

  const [clientToDelete, setClientToDelete] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const [deleteMode, setDeleteMode] = useState<"appointments" | "profile">("appointments");

  const deleteBookingsMutation =
    trpc.appointments.deleteAllForClient.useMutation({
      onSuccess: () => {
        toast.success(deleteMode === "profile" ? "Client and all bookings permanently deleted" : "All bookings deleted for client");
        setClientToDelete(null);
        setDeleteMode("appointments");
        refetch(); // Ensure UI client list syncs the deletion of the profile
      },
      onError: error => {
        toast.error("Failed to delete bookings: " + error.message);
      },
    });

  const handleDeleteClick = (client: { id: string; name: string }) => {
    setClientToDelete(client);
    setDeleteMode("appointments");
  };

  const confirmDelete = () => {
    if (clientToDelete) {
      deleteBookingsMutation.mutate({
        clientId: clientToDelete.id,
        deleteProfile: deleteMode === "profile"
      });
    }
  };

  useEffect(() => {
    if (!loading && !user) {
      setLocation("/");
    }
    if (!loading && user && user.role !== "artist" && user.role !== "admin") {
      setLocation("/conversations");
    }
  }, [user, loading, setLocation]);

  const resetForm = () => {
    setFormData({
      name: "",
      email: "",
      phone: "",
    });
  };

  const handleAddClient = () => {
    if (!formData.name.trim() || !formData.email.trim()) {
      toast.error("Name and email are required");
      return;
    }

    // For now, we need a client ID. In production, this would create a user first.
    // As a workaround, we'll show a message that clients need to sign up first
    toast.error(
      "Clients must sign up through the app first. Share the app link with them!"
    );
    setShowAddDialog(false);
    resetForm();
  };

  // Handle Selection Toggling
  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedClients);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedClients(newSet);
  };

  const toggleSelectAll = () => {
    if (selectedClients.size === filteredClients.length && filteredClients.length > 0) {
      setSelectedClients(new Set());
    } else {
      setSelectedClients(new Set(filteredClients.map((c: any) => c.id)));
    }
  };

  // Hydrate client array natively safely 
  const clients = demographicClients || [];

  const filteredClients = clients.filter(
    (client: any) =>
      client.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      client.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading || isFetching && clients.length === 0) {
    return <LoadingState message="Loading..." fullScreen />;
  }

  return (
    <div className="w-full h-full flex flex-col overflow-hidden relative">
      <div className="flex items-center gap-3 px-6 pt-6 pb-4 shrink-0 bg-transparent z-20 border-b border-white/5">
        <button
          onClick={onBack}
          className="p-2 -ml-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors"
        >
          <ChevronLeft className="w-5 h-5 text-foreground" />
        </button>
        <h2 className="text-xl font-semibold text-foreground">Clients</h2>
      </div>

      <div className="flex-1 w-full overflow-y-auto mobile-scroll touch-pan-y relative z-10">
        <div className="pb-[180px] max-w-lg mx-auto space-y-6 px-4 pt-6">
          {/* Search and Add */}
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search clients..."
                className="pl-9"
              />
            </div>
            <Button variant={showFilters ? "secondary" : "outline"} onClick={() => setShowFilters(!showFilters)} className="tap-target px-3">
              <Filter className="w-4 h-4" />
            </Button>
            <Button onClick={() => setShowAddDialog(true)} className="tap-target">
              <Plus className="w-4 h-4 mr-2 hidden sm:block" />
              Add
            </Button>
          </div>

          {/* Advanced Filter Drawer */}
          {showFilters && (
            <div className="bg-white/5 border border-white/5 rounded-[4px] p-4 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5 ">
                  <Label className="text-xs text-muted-foreground">Location</Label>
                  <Input
                    placeholder="City or Country"
                    value={locationFilter}
                    onChange={(e) => handleLocationChange(e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Min TLV ($)</Label>
                  <Input
                    type="number"
                    placeholder="e.g 500"
                    value={minTlv}
                    onChange={(e) => setMinTlv(e.target.value === "" ? "" : Number(e.target.value))}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Min Completed Sittings</Label>
                  <Input
                    type="number"
                    placeholder="e.g 3"
                    value={minSittings}
                    onChange={(e) => setMinSittings(e.target.value === "" ? "" : Number(e.target.value))}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1.5 flex flex-col col-span-2">
                  <Label className="text-xs text-muted-foreground">Birth Month</Label>
                  <Select value={birthMonth} onValueChange={setBirthMonth}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="All Months" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Any Month</SelectItem>
                      <SelectItem value="1">January</SelectItem>
                      <SelectItem value="2">February</SelectItem>
                      <SelectItem value="3">March</SelectItem>
                      <SelectItem value="4">April</SelectItem>
                      <SelectItem value="5">May</SelectItem>
                      <SelectItem value="6">June</SelectItem>
                      <SelectItem value="7">July</SelectItem>
                      <SelectItem value="8">August</SelectItem>
                      <SelectItem value="9">September</SelectItem>
                      <SelectItem value="10">October</SelectItem>
                      <SelectItem value="11">November</SelectItem>
                      <SelectItem value="12">December</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          {/* Stats Header */}
          <div className="bg-gradient-to-br from-primary/10 to-accent/10 hover:from-primary/15 hover:to-accent/15 rounded-[4px] p-6 text-center border border-white/5">
            <p className="text-4xl font-bold text-foreground">
              {clients.length}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Total Clients
            </p>
          </div>

          {/* Client List */}
          {filteredClients.length === 0 ? (
            <div className="p-8 text-center bg-white/5 rounded-[4px] border border-white/5 flex flex-col items-center justify-center">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <User className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="font-semibold text-lg text-foreground mb-1">No clients yet</h3>
              <p className="text-sm text-muted-foreground mb-6">Add your first client to get started</p>
              <Button onClick={() => setShowAddDialog(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add Client
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between px-2 mb-2">
                <Button variant="ghost" size="sm" onClick={toggleSelectAll} className="h-8 text-xs font-semibold px-2 hover:bg-white/5">
                  {selectedClients.size === filteredClients.length && filteredClients.length > 0 ? (
                    <CheckSquare className="w-4 h-4 mr-2" />
                  ) : (
                    <Square className="w-4 h-4 mr-2" />
                  )}
                  Select All
                </Button>
                <div className="text-xs text-muted-foreground">
                  {filteredClients.length} Match{filteredClients.length !== 1 ? 'es' : ''}
                </div>
              </div>

              {filteredClients.map((client: any) => (
                <div
                  key={client.id}
                  onClick={() => toggleSelection(client.id)}
                  className={cn(
                    "bg-transparent hover:bg-white/5 transition-colors border-b border-white/5 pb-4 pt-3 px-2 rounded-[4px] last:border-0 cursor-pointer",
                    selectedClients.has(client.id) && "bg-primary/5 hover:bg-primary/10 border-primary/20"
                  )}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3 flex-1">

                      {/* Checkbox Overlay Indicator */}
                      <div className="flex items-center justify-center shrink-0">
                        <Checkbox checked={selectedClients.has(client.id)} />
                      </div>

                      <div className="w-10 h-10 shrink-0 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-bold text-sm">
                        {client.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0 pr-2">
                        <h4 className="text-base font-semibold text-foreground truncate">
                          {client.name}
                        </h4>
                        <div className="flex flex-col sm:flex-row gap-1 sm:gap-4 mt-1">
                          {client.phone && (
                            <div className="flex items-center text-xs text-muted-foreground shrink-0 mr-3">
                              <Phone className="w-3 h-3 mr-1" />
                              {client.phone}
                            </div>
                          )}
                          {client.email && (
                            <div className="flex items-center text-xs text-muted-foreground shrink-0 truncate">
                              <Mail className="w-3 h-3 mr-1" />
                              {client.email}
                            </div>
                          )}
                          {client.tlv !== undefined && (
                            <div className="flex items-center text-[11px] text-primary/80 font-semibold uppercase tracking-wider shrink-0">
                              TLV: ${client.tlv.toFixed(0)}
                            </div>
                          )}
                          {client.sittings !== undefined && client.sittings > 0 && (
                            <div className="flex items-center text-[11px] text-muted-foreground uppercase tracking-wider shrink-0">
                              {client.sittings} Sitting{client.sittings !== 1 ? 's' : ''}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-destructive h-8 w-8 -mr-2 -mt-2"
                      onClick={e => {
                        e.stopPropagation();
                        handleDeleteClick({ id: client.id, name: client.name });
                      }}
                      title="Delete all bookings"
                    >
                      <Trash className="w-4 h-4" />
                    </Button>
                  </div>
                  {clientToDelete?.id === client.id ? (
                    <div className="mt-4 p-4 bg-destructive/5 border border-destructive/20 rounded-xl space-y-4 lg:ml-[60px]">
                      <h4 className="font-semibold text-destructive flex items-center">
                        <Trash className="w-4 h-4 mr-2" />
                        Wipe Client Data
                      </h4>

                      <div className="space-y-3">
                        <label className="flex items-start gap-3 p-3 rounded-lg border border-white/10 bg-white/5 cursor-pointer hover:bg-white/10 transition-colors">
                          <input
                            type="radio"
                            name={`del-${client.id}`}
                            checked={deleteMode === "appointments"}
                            onChange={() => setDeleteMode("appointments")}
                            className="mt-1"
                          />
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-foreground">Appointments Only</p>
                            <p className="text-xs text-muted-foreground mt-1 leading-snug">Deletes all historical and future bookings, but keeps the client's profile and chat history intact.</p>
                          </div>
                        </label>

                        <label className="flex items-start gap-3 p-3 rounded-lg border border-destructive/30 bg-destructive/10 cursor-pointer hover:bg-destructive/20 transition-colors">
                          <input
                            type="radio"
                            name={`del-${client.id}`}
                            checked={deleteMode === "profile"}
                            onChange={() => setDeleteMode("profile")}
                            className="mt-1"
                          />
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-destructive">Delete Client & Appointments</p>
                            <p className="text-xs text-muted-foreground mt-1 leading-snug">Permanently wipes their entire profile, chat history, and all associated bookings from your database.</p>
                          </div>
                        </label>
                      </div>

                      <div className="flex justify-end gap-3 pt-2">
                        <Button variant="outline" size="sm" onClick={() => setClientToDelete(null)}>Cancel</Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={confirmDelete}
                          disabled={deleteBookingsMutation.isPending}
                        >
                          {deleteBookingsMutation.isPending ? "Confirming..." : "Confirm Deletion"}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3 lg:pl-[60px]">
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setLocation(`/chat/${client.conversationId}`)}
                          className="w-full"
                        >
                          <MessageCircle className="w-4 h-4 mr-2" />
                          Chat
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setLocation(`/profile?tab=history&clientId=${client.id}`)}
                          className="w-full"
                        >
                          <Clock className="w-4 h-4 mr-2" />
                          History
                        </Button>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setLocation(`/profile?clientId=${client.id}`)}
                        className="w-full mt-2 text-xs opacity-70"
                      >
                        View Full Profile
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
          }
        </div >
      </div >

      {/* Bulk Action Dock */}
      {
        selectedClients.size > 0 && (
          <div className="absolute bottom-0 left-0 right-0 z-40 bg-zinc-900 border-t border-white/10 shadow-2xl p-4 animate-in slide-in-from-bottom-full duration-300">
            <div className="max-w-lg mx-auto flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                  <span className="text-primary font-bold text-sm">{selectedClients.size}</span>
                </div>
                <span className="text-sm font-semibold">Selected</span>
              </div>
              <Button onClick={() => setShowBulkMessage(true)} className="flex-1 max-w-[200px]">
                <Send className="w-4 h-4 mr-2" />
                Message Segment
              </Button>
            </div>
          </div>
        )
      }

      {/* Bulk Message Modal Overlay */}
      <ModalShell
        isOpen={showBulkMessage}
        onClose={() => setShowBulkMessage(false)}
        title={`Message ${selectedClients.size} Clients`}
        description="This will send an individual direct message to each selected profile simulating 1-to-1 conversation organically."
        className="max-w-md"
        overlayName="Bulk Message"
        overlayId="clients.bulk_message"
        footer={
          <div className="flex w-full gap-2">
            <Button
              onClick={() => {
                if (bulkMessage.trim().length === 0) {
                  toast.error("Message content cannot be empty.");
                  return;
                }
                bulkMessageMutation.mutate({
                  clientIds: Array.from(selectedClients),
                  messageContent: bulkMessage
                });
              }}
              disabled={bulkMessageMutation.isPending}
              className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {bulkMessageMutation.isPending ? "Broadcasting..." : "Broadcast Message"}
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowBulkMessage(false)}
              className="flex-1"
            >
              Cancel
            </Button>
          </div>
        }
      >
        <div className="py-2">
          <Textarea
            className="min-h-[160px] text-base"
            placeholder="Type your broadcast message here...&#10;&#10;E.g., Hey! I'll be in London next week and have a few last-minute spots opening up."
            value={bulkMessage}
            onChange={e => setBulkMessage(e.target.value)}
          />
        </div>
      </ModalShell>

      {/* Add Client Dialog */}
      <ModalShell
        isOpen={showAddDialog}
        onClose={() => setShowAddDialog(false)}
        title="Add New Client"
        description="Create a new client profile and start a conversation"
        className="max-w-md"
        overlayName="Add Client"
        overlayId="clients.add_client"
        footer={
          <div className="flex w-full gap-2">
            <Button
              onClick={handleAddClient}
              disabled={createConversationMutation.isPending}
              className="flex-1"
            >
              {createConversationMutation.isPending
                ? "Adding..."
                : "Add Client"}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setShowAddDialog(false);
                resetForm();
              }}
              className="flex-1"
            >
              Cancel
            </Button>
          </div>
        }
      >
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Full Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              placeholder="John Doe"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={e =>
                setFormData({ ...formData, email: e.target.value })
              }
              placeholder="john@example.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number</Label>
            <Input
              id="phone"
              type="tel"
              value={formData.phone}
              onChange={e =>
                setFormData({ ...formData, phone: e.target.value })
              }
              placeholder="+1 (555) 123-4567"
            />
          </div>
        </div>
      </ModalShell>
    </div >
  );
}
