import { useAuth } from "@/_core/hooks/useAuth";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Switch, Textarea } from "@/components/ui";
import { ModalShell } from "@/components/ui/overlays/modal-shell";
import { LoadingState, PageShell } from "@/components/ui/ssot";
import { trpc } from "@/lib/trpc";
import { Bell, ChevronLeft, Edit, Plus, Trash2, Send } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { WebPushSettings } from "@/components/WebPushSettings";
import { useWebPush } from "@/hooks/useWebPush";

type TemplateType = "confirmation" | "reminder" | "follow_up" | "promotional" | "birthday" | "aftercare" | "preparation";

export default function NotificationsManagement() {
  const { user, loading } = useAuth();
  const { sendTestPush, isTesting } = useWebPush();
  const [, setLocation] = useLocation();
  const [showDialog, setShowDialog] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<any>(null);
  const [formData, setFormData] = useState({
    templateType: "confirmation" as TemplateType,
    title: "",
    content: "",
    timing: "",
    enabled: true,
  });

  const { data: templates, refetch } = trpc.notifications.list.useQuery(
    undefined,
    {
      enabled: !!user && (user.role === "artist" || user.role === "admin"),
    }
  );

  const createMutation = trpc.notifications.create.useMutation({
    onSuccess: () => {
      toast.success("Template created");
      setShowDialog(false);
      resetForm();
      refetch();
    },
    onError: (error: any) => {
      toast.error("Failed to create template: " + error.message);
    },
  });

  const updateMutation = trpc.notifications.update.useMutation({
    onSuccess: () => {
      toast.success("Template updated");
      setShowDialog(false);
      resetForm();
      refetch();
    },
    onError: (error: any) => {
      toast.error("Failed to save template: " + error.message);
    },
  });

  const deleteMutation = trpc.notifications.delete.useMutation({
    onSuccess: () => {
      toast.success("Template deleted");
      refetch();
    },
    onError: (error: any) => {
      toast.error("Failed to delete template: " + error.message);
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
      templateType: "confirmation",
      title: "",
      content: "",
      timing: "",
      enabled: true,
    });
    setEditingTemplate(null);
  };

  const handleEdit = (template: any) => {
    setEditingTemplate(template);
    setFormData({
      templateType: template.templateType,
      title: template.title,
      content: template.content,
      timing: template.timing || "",
      enabled: template.enabled,
    });
    setShowDialog(true);
  };

  const handleSave = () => {
    if (!formData.title.trim() || !formData.content.trim()) {
      toast.error("Title and content are required");
      return;
    }

    if (editingTemplate) {
      updateMutation.mutate({
        id: editingTemplate.id,
        ...formData,
      });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDelete = (id: number) => {
    if (confirm("Are you sure you want to delete this template?")) {
      deleteMutation.mutate(id);
    }
  };

  const templateTypeLabels: Record<TemplateType, string> = {
    confirmation: "Appointment Confirmation",
    reminder: "Appointment Reminder",
    follow_up: "Follow-up Message",
    promotional: "Promotional Message",
    birthday: "Birthday Greeting",
    aftercare: "Aftercare Instructions",
    preparation: "Appointment Preparation",
  };

  const templateTypeDescriptions: Record<TemplateType, string> = {
    confirmation: "Sent when appointment is booked",
    reminder: "Sent before appointment (set timing below)",
    follow_up: "Sent after appointment (set timing below)",
    promotional: "Manual promotional messages",
    birthday: "Sent on client's birthday",
    aftercare: "Post-appointment care instructions",
    preparation: "Sent before appointment with preparation info",
  };

  if (loading) {
    return <LoadingState message="Loading..." fullScreen />;
  }

  return (
    <PageShell>
      <header className="mobile-header px-4 py-4 shrink-0">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation("/settings")}
            className="tap-target"
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-2xl font-bold text-foreground">Notifications</h1>
        </div>
      </header>

      <main className="flex-1 px-4 py-4 mobile-scroll overflow-y-auto space-y-4">
        <Card className="bg-gradient-to-br from-primary/10 to-accent/10">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Bell className="w-8 h-8 text-primary" />
              <div>
                <p className="font-semibold text-foreground">
                  Notification Templates
                </p>
                <p className="text-sm text-muted-foreground">
                  Customize automated messages for clients
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Web Push Test Controls */}
        <WebPushSettings />

        <Button
          onClick={() => {
            resetForm();
            setShowDialog(true);
          }}
          className="w-full tap-target"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Notification Template
        </Button>

        {templates && templates.length === 0 ? (
          <Card className="p-8">
            <div className="text-center space-y-3">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto">
                <Bell className="w-8 h-8 text-muted-foreground" />
              </div>
              <div>
                <p className="font-semibold text-foreground">
                  No templates yet
                </p>
                <p className="text-sm text-muted-foreground">
                  Create your first notification template
                </p>
              </div>
            </div>
          </Card>
        ) : (
          <div className="space-y-3 pb-20">
            {templates?.map((template: any) => (
              <Card key={template.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <CardTitle className="text-base truncate">
                          {template.title}
                        </CardTitle>
                        <Switch
                          checked={template.enabled}
                          onCheckedChange={(checked) => {
                            updateMutation.mutate({
                              id: template.id,
                              enabled: checked,
                            });
                          }}
                        />
                      </div>
                      <CardDescription className="text-xs">
                        {templateTypeLabels[template.templateType as TemplateType]}
                        {template.timing && (
                          <span className="ml-2">({template.timing})</span>
                        )}
                      </CardDescription>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => sendTestPush({ title: template.title, body: template.content })}
                        disabled={isTesting}
                        className="tap-target h-8 w-8 text-primary"
                        title="Send Test Push"
                      >
                        <Send className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(template)}
                        className="tap-target h-8 w-8"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(template.id)}
                        className="tap-target h-8 w-8 text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {template.content}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* Add/Edit Dialog */}
      <ModalShell
        isOpen={showDialog}
        onClose={() => setShowDialog(false)}
        title={editingTemplate ? "Edit Template" : "New Template"}
        description="Create automated notification messages for clients"
        className="max-w-md max-h-[90vh] overflow-y-auto"
        overlayName="Notification Template"
        overlayId="notifications.template_editor"
        footer={
          <div className="flex w-full gap-2">
            <Button
              onClick={handleSave}
              disabled={createMutation.isPending || updateMutation.isPending}
              className="flex-1"
            >
              {createMutation.isPending || updateMutation.isPending
                ? "Saving..."
                : editingTemplate
                  ? "Update"
                  : "Create"}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setShowDialog(false);
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
            <Label htmlFor="type">Notification Type</Label>
            <Select
              value={formData.templateType}
              onValueChange={(value: TemplateType) =>
                setFormData({ ...formData, templateType: value })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(templateTypeLabels).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {templateTypeDescriptions[formData.templateType]}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
              placeholder="Your Appointment is Confirmed"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="content">Message Content</Label>
            <Textarea
              id="content"
              value={formData.content}
              onChange={(e) =>
                setFormData({ ...formData, content: e.target.value })
              }
              placeholder="Hi {clientName}, your appointment on {date} at {time} is confirmed..."
              rows={5}
            />
            <p className="text-xs text-muted-foreground">
              Use placeholders: {"{clientName}"}, {"{date}"}, {"{time}"}
            </p>
          </div>

          {(formData.templateType === "reminder" ||
            formData.templateType === "follow_up" ||
            formData.templateType === "preparation") && (
              <div className="space-y-2">
                <Label htmlFor="timing">Send Timing</Label>
                <Input
                  id="timing"
                  value={formData.timing}
                  onChange={(e) =>
                    setFormData({ ...formData, timing: e.target.value })
                  }
                  placeholder="1 hour before / 24 hours after"
                />
                <p className="text-xs text-muted-foreground">
                  E.g., "1 hour before", "24 hours after", "2 days before"
                </p>
              </div>
            )}

          <div className="flex items-center justify-between">
            <Label htmlFor="enabled">Enabled</Label>
            <Switch
              id="enabled"
              checked={formData.enabled}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, enabled: checked })
              }
            />
          </div>
        </div>
      </ModalShell>
    </PageShell>
  );
}

