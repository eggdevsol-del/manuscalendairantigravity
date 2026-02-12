import { useAuth } from "@/_core/hooks/useAuth";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label } from "@/components/ui";
import { ModalShell } from "@/components/ui/overlays/modal-shell";
import { LoadingState } from "@/components/ui/ssot";
import { trpc } from "@/lib/trpc";
import { ChevronLeft, Mail, MessageCircle, Phone, Plus, Search, Trash, User } from "lucide-react";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from "@/components/ui/empty";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { useConversations } from "@/hooks/useConversations";
import { tokens } from "@/ui/tokens";
import { cn } from "@/lib/utils";

export default function Clients() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
  });

  // Use centralized hook (SSOT)
  const { data: conversations, refetch } = useConversations();

  const createConversationMutation = trpc.conversations.getOrCreate.useMutation({
    onSuccess: () => {
      toast.success("Client added successfully");
      setShowAddDialog(false);
      resetForm();
      refetch();
    },
    onError: (error: any) => {
      toast.error("Failed to add client: " + error.message);
    },
  });

  const [clientToDelete, setClientToDelete] = useState<{ id: string; name: string } | null>(null);

  const deleteBookingsMutation = trpc.appointments.deleteAllForClient.useMutation({
    onSuccess: () => {
      toast.success("All bookings deleted for client");
      setClientToDelete(null);
    },
    onError: (error) => {
      toast.error("Failed to delete bookings: " + error.message);
    }
  });

  const handleDeleteClick = (client: { id: string; name: string }) => {
    setClientToDelete(client);
  };

  const confirmDelete = () => {
    if (clientToDelete) {
      deleteBookingsMutation.mutate({ clientId: clientToDelete.id });
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
    toast.error("Clients must sign up through the app first. Share the app link with them!");
    setShowAddDialog(false);
    resetForm();
  };

  // Extract unique clients from conversations
  const clients = conversations?.map((conv: any) => ({
    id: conv.clientId || conv.id,
    name: conv.clientName || conv.otherUser?.name || "Unknown",
    email: conv.otherUser?.email || "",
    phone: conv.otherUser?.phone || "",
    lastMessage: conv.lastMessage,
    conversationId: conv.id,
  })).filter((client: any, index: number, self: any[]) =>
    index === self.findIndex((c: any) => c.id === client.id)
  ) || [];

  const filteredClients = clients.filter((client: any) =>
    client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    client.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return <LoadingState message="Loading..." fullScreen />;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="mobile-header px-4 py-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation("/settings")}
            className="tap-target"
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-2xl font-bold text-foreground">Clients</h1>
        </div>
      </header>

      <main className="flex-1 px-4 py-4 mobile-scroll overflow-y-auto space-y-4">
        {/* Search and Add */}
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search clients..."
              className="pl-9"
            />
          </div>
          <Button
            onClick={() => setShowAddDialog(true)}
            className="tap-target"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add
          </Button>
        </div>

        {/* Stats */}
        <Card className={cn(tokens.card.base, "bg-gradient-to-br from-primary/10 to-accent/10 hover:from-primary/15 hover:to-accent/15")}>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-4xl font-bold text-foreground">
                {clients.length}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Total Clients
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Client List */}
        {filteredClients.length === 0 ? (
          <Card className={cn(tokens.card.base, tokens.card.bg, "p-8")}>
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon" className="w-16 h-16 rounded-full bg-muted">
                  <User className="w-8 h-8" />
                </EmptyMedia>
                <EmptyTitle>No clients yet</EmptyTitle>
                <EmptyDescription>Add your first client to get started</EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button onClick={() => setShowAddDialog(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Client
                </Button>
              </EmptyContent>
            </Empty>
          </Card>
        ) : (
          <div className="space-y-1">
            {filteredClients.map((client: any) => (
              <Card key={client.id} className={cn(tokens.card.base, tokens.card.bg, tokens.card.interactive, "border-0")}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-bold text-lg">
                        {client.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-base truncate">
                          {client.name}
                        </CardTitle>
                        {client.email && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                            <Mail className="w-3 h-3" />
                            <span className="truncate">{client.email}</span>
                          </div>
                        )}
                        {client.phone && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                            <Phone className="w-3 h-3" />
                            <span>{client.phone}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-destructive h-8 w-8 -mr-2 -mt-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteClick({ id: client.id, name: client.name });
                      }}
                      title="Delete all bookings"
                    >
                      <Trash className="w-4 h-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setLocation(`/chat/${client.conversationId}`)}
                    className="w-full"
                  >
                    <MessageCircle className="w-4 h-4 mr-2" />
                    Message
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

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
              {createConversationMutation.isPending ? "Adding..." : "Add Client"}
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
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              placeholder="John Doe"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) =>
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
              onChange={(e) =>
                setFormData({ ...formData, phone: e.target.value })
              }
              placeholder="+1 (555) 123-4567"
            />
          </div>
        </div>
      </ModalShell>

      {/* Delete Confirmation Dialog */}
      <ModalShell
        isOpen={!!clientToDelete}
        onClose={() => setClientToDelete(null)}
        title="Delete Bookings"
        description="Are you sure you want to delete all of this client's bookings? This action cannot be undone."
        overlayName="Delete Bookings"
        overlayId="clients.delete_bookings"
        footer={
          <div className="flex w-full justify-end gap-3">
            <Button variant="outline" onClick={() => setClientToDelete(null)}>No</Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleteBookingsMutation.isPending}
            >
              {deleteBookingsMutation.isPending ? "Deleting..." : "Yes, Delete All"}
            </Button>
          </div>
        }
      >
        <div />
      </ModalShell>
    </div>
  );
}
