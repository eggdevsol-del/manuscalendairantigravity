import { useAuth } from "@/_core/hooks/useAuth";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Switch, Textarea } from "@/components/ui";
import { trpc } from "@/lib/trpc";
import { ChevronLeft, Plus, Save, Trash2, Zap } from "lucide-react";
import { LoadingState } from "@/components/ui/ssot";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

type QuickAction = {
  id?: number;
  label: string;
  actionType: "send_text" | "deposit_info" | "find_availability" | "custom";
  content: string;
  enabled: boolean;
  position: number;
};

const ACTION_TYPES = [
  { value: "send_text", label: "Send Text Message" },
  { value: "deposit_info", label: "Send Deposit Info" },
  { value: "find_availability", label: "Find Next Available Dates" },
  { value: "pricing", label: "Send Pricing Info" },
  { value: "policy_link", label: "Send Policy Link" },
  { value: "custom", label: "Custom Action" },
];

export default function QuickActionsManagement() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const [showAddNew, setShowAddNew] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [formData, setFormData] = useState<QuickAction>({
    label: "",
    actionType: "send_text",
    content: "",
    enabled: true,
    position: 0,
  });

  const { data: quickActions, refetch } = trpc.quickActions.list.useQuery(
    undefined,
    {
      enabled: !!user && (user.role === "artist" || user.role === "admin"),
    }
  );

  const createMutation = trpc.quickActions.create.useMutation({
    onSuccess: () => {
      toast.success("Quick action created");
      resetForm();
      refetch();
    },
    onError: (error: any) => {
      toast.error("Failed to create: " + error.message);
    },
  });

  const updateMutation = trpc.quickActions.update.useMutation({
    onSuccess: () => {
      toast.success("Quick action updated");
      resetForm();
      refetch();
    },
    onError: (error: any) => {
      toast.error("Failed to update: " + error.message);
    },
  });

  const deleteMutation = trpc.quickActions.delete.useMutation({
    onSuccess: () => {
      toast.success("Quick action deleted");
      refetch();
    },
    onError: (error: any) => {
      toast.error("Failed to delete: " + error.message);
    },
  });

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
      label: "",
      actionType: "send_text",
      content: "",
      enabled: true,
      position: quickActions?.length || 0,
    });
    setShowAddNew(false);
    setEditingId(null);
  };

  const handleEdit = (action: any) => {
    setFormData({
      label: action.label,
      actionType: action.actionType,
      content: action.content,
      enabled: action.enabled,
      position: action.position,
    });
    setEditingId(action.id);
    setShowAddNew(true);
  };

  const handleSave = () => {
    if (!formData.label.trim()) {
      toast.error("Label is required");
      return;
    }

    if (editingId) {
      updateMutation.mutate({
        id: editingId,
        ...formData,
      });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDelete = (id: number) => {
    if (confirm("Are you sure you want to delete this quick action?")) {
      deleteMutation.mutate(id);
    }
  };

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
          <h1 className="text-2xl font-bold text-foreground">
            Quick Action Buttons
          </h1>
        </div>
      </header>

      <main className="flex-1 px-4 py-4 mobile-scroll overflow-y-auto space-y-4">
        <Card className="bg-accent/5 border-accent/20">
          <CardHeader>
            <CardTitle className="text-base">About Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Quick action buttons appear at the bottom of chat conversations. You can
              create up to 6 buttons that send predefined messages or perform actions.
            </p>
          </CardContent>
        </Card>

        {!showAddNew && (
          <Button
            onClick={() => setShowAddNew(true)}
            className="w-full"
            disabled={(quickActions?.length || 0) >= 6}
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Quick Action {quickActions?.length ? `(${quickActions.length}/6)` : ""}
          </Button>
        )}

        {showAddNew && (
          <Card className="border-primary">
            <CardHeader>
              <CardTitle className="text-base">
                {editingId ? "Edit" : "New"} Quick Action
              </CardTitle>
              <CardDescription>
                Configure the button label and action
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="label">Button Label *</Label>
                <Input
                  id="label"
                  value={formData.label}
                  onChange={(e) =>
                    setFormData({ ...formData, label: e.target.value })
                  }
                  placeholder="e.g., Deposit Info"
                  maxLength={20}
                />
                <p className="text-xs text-muted-foreground">
                  Keep it short (max 20 characters)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="actionType">Action Type *</Label>
                <Select
                  value={formData.actionType}
                  onValueChange={(value) =>
                    setFormData({ ...formData, actionType: value as any })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ACTION_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="content">Message Content *</Label>
                <Textarea
                  id="content"
                  value={formData.content}
                  onChange={(e) =>
                    setFormData({ ...formData, content: e.target.value })
                  }
                  placeholder="The message that will be sent when this button is clicked..."
                  rows={4}
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg border">
                <div>
                  <Label htmlFor="enabled" className="text-base">
                    Enabled
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Show this button in chats
                  </p>
                </div>
                <Switch
                  id="enabled"
                  checked={formData.enabled}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, enabled: checked })
                  }
                />
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={handleSave}
                  disabled={
                    createMutation.isPending || updateMutation.isPending
                  }
                  className="flex-1"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {editingId ? "Update" : "Create"}
                </Button>
                <Button
                  variant="outline"
                  onClick={resetForm}
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {quickActions && quickActions.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">
              Your Quick Actions
            </h3>
            {quickActions.map((action) => (
              <Card key={action.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <Zap className="w-4 h-4 text-primary" />
                      </div>
                      <div className="flex-1">
                        <CardTitle className="text-base">
                          {action.label}
                        </CardTitle>
                        <CardDescription className="text-sm mt-1">
                          {ACTION_TYPES.find((t) => t.value === action.actionType)
                            ?.label || action.actionType}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs px-2 py-1 rounded-full ${action.enabled
                            ? "bg-accent/20 text-accent"
                            : "bg-muted text-muted-foreground"
                          }`}
                      >
                        {action.enabled ? "Active" : "Disabled"}
                      </span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                    {action.content}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(action)}
                      className="flex-1"
                    >
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(action.id)}
                      className="text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

