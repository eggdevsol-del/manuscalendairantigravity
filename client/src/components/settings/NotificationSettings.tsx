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
    Textarea,
} from "@/components/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/safe-select";
import { SafeSwitch as Switch } from "@/components/ui/safe-switch";
import { ModalShell } from "@/components/ui/overlays/modal-shell";
import { LoadingState, PageHeader } from "@/components/ui/ssot";
import { trpc } from "@/lib/trpc";
import { Bell, Edit, Plus, Trash2, Send, ChevronLeft, Zap, Star, Moon } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { WebPushSettings } from "@/components/WebPushSettings";
import { useWebPush } from "@/hooks/useWebPush";
import { tokens } from "@/ui/tokens";

type TemplateType =
    | "confirmation"
    | "reminder"
    | "follow_up"
    | "promotional"
    | "birthday"
    | "aftercare"
    | "preparation";

interface NotificationSettingsProps {
    onBack: () => void;
}

export function NotificationSettings({ onBack }: NotificationSettingsProps) {
    const { user, loading } = useAuth();
    const { sendTestPush, isTesting } = useWebPush();
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

    // Client selection state for push test
    const [pushDialog, setPushDialog] = useState<{
        isOpen: boolean;
        template: any | null;
    }>({
        isOpen: false,
        template: null,
    });

    const { data: clients } = trpc.conversations.getClients.useQuery(undefined, {
        enabled: !!user && (user.role === "artist" || user.role === "admin"),
    });

    const handleTestClick = (template: any) => {
        setPushDialog({ isOpen: true, template });
    };

    const handleSendPushToClient = async (clientId: string) => {
        if (!pushDialog.template) return;

        await sendTestPush({
            targetUserId: clientId,
            title: pushDialog.template.title,
            body: pushDialog.template.content,
        });

        // Don't close immediately if you want to send to multiple, but typically we close
        // setPushDialog({ isOpen: false, template: null });
    };

    // ── Automation Settings ──
    const { data: artistSettings } = trpc.artistSettings.get.useQuery(undefined, {
        enabled: !!user && (user.role === "artist" || user.role === "admin"),
    });
    const upsertSettings = trpc.artistSettings.upsert.useMutation({
        onSuccess: () => toast.success("Settings saved"),
        onError: (e: any) => toast.error("Failed to save: " + e.message),
    });

    const [notificationMode, setNotificationMode] = useState<"manual" | "automatic">("manual");
    const [googlePlaceId, setGooglePlaceId] = useState("");
    const [quietHoursEnabled, setQuietHoursEnabled] = useState(false);
    const [quietHoursStart, setQuietHoursStart] = useState(21);
    const [quietHoursEnd, setQuietHoursEnd] = useState(7);

    useEffect(() => {
        if (artistSettings) {
            setNotificationMode(artistSettings.notificationMode || "manual");
            setGooglePlaceId(artistSettings.googlePlaceId || "");
            setQuietHoursEnabled(!!artistSettings.quietHoursEnabled);
            setQuietHoursStart(artistSettings.quietHoursStart ?? 21);
            setQuietHoursEnd(artistSettings.quietHoursEnd ?? 7);
        }
    }, [artistSettings]);

    const saveAutomationSettings = (overrides: Record<string, any> = {}) => {
        upsertSettings.mutate({
            notificationMode,
            googlePlaceId: googlePlaceId || undefined,
            quietHoursEnabled: quietHoursEnabled ? 1 : 0,
            quietHoursStart,
            quietHoursEnd,
            ...overrides,
        });
    };

    if (loading) {
        return <LoadingState message="Loading..." fullScreen />;
    }

    return (
        <div className="w-full h-full flex flex-col overflow-hidden relative">
            <PageHeader title="Notifications" onBack={onBack} />

            {/* 2. Scroll Container */}
            <div className="flex-1 w-full overflow-y-auto mobile-scroll touch-pan-y relative z-10">
                <div className="pb-[180px] max-w-lg mx-auto space-y-4 px-4 pt-6">
                    <div className="mb-2">
                        <p className="text-muted-foreground text-sm font-medium">
                            Automated client messaging
                        </p>
                    </div>

                    {/* ── Automation Mode ── */}
                    <Card>
                        <CardHeader className="pb-3">
                            <div className="flex items-center gap-2">
                                <Zap className="w-4 h-4 text-primary" />
                                <CardTitle className="text-base">Automation Mode</CardTitle>
                            </div>
                            <CardDescription className="text-xs">
                                Choose how notifications are sent to clients
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    onClick={() => {
                                        setNotificationMode("manual");
                                        saveAutomationSettings({ notificationMode: "manual" });
                                    }}
                                    className={cn(
                                        "p-3 rounded-lg border text-left transition-all",
                                        notificationMode === "manual"
                                            ? "border-primary bg-primary/10 text-primary"
                                            : "border-border text-muted-foreground hover:border-primary/50"
                                    )}
                                >
                                    <p className="font-medium text-sm">Manual</p>
                                    <p className="text-xs mt-1 opacity-70">Use dashboard to send</p>
                                </button>
                                <button
                                    onClick={() => {
                                        setNotificationMode("automatic");
                                        saveAutomationSettings({ notificationMode: "automatic" });
                                    }}
                                    className={cn(
                                        "p-3 rounded-lg border text-left transition-all",
                                        notificationMode === "automatic"
                                            ? "border-primary bg-primary/10 text-primary"
                                            : "border-border text-muted-foreground hover:border-primary/50"
                                    )}
                                >
                                    <p className="font-medium text-sm">Automatic</p>
                                    <p className="text-xs mt-1 opacity-70">Send via email/SMS</p>
                                </button>
                            </div>
                        </CardContent>
                    </Card>

                    {/* ── Google Review Link ── */}
                    <Card>
                        <CardHeader className="pb-3">
                            <div className="flex items-center gap-2">
                                <Star className="w-4 h-4 text-yellow-500" />
                                <CardTitle className="text-base">Google Review Link</CardTitle>
                            </div>
                            <CardDescription className="text-xs">
                                Automatically include your Google review link in thank-you messages
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                <Label className="text-xs">Google Place ID</Label>
                                <Input
                                    value={googlePlaceId}
                                    onChange={(e) => setGooglePlaceId(e.target.value)}
                                    placeholder="ChIJ..."
                                    className="h-10"
                                    onBlur={() => saveAutomationSettings()}
                                />
                                <p className="text-xs text-muted-foreground">
                                    Find yours at{" "}
                                    <a
                                        href="https://developers.google.com/maps/documentation/places/web-service/place-id"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-primary underline"
                                    >
                                        Google Place ID Finder
                                    </a>
                                </p>
                            </div>
                        </CardContent>
                    </Card>

                    {/* ── Quiet Hours ── */}
                    <Card>
                        <CardHeader className="pb-3">
                            <div className="flex items-center gap-2">
                                <Moon className="w-4 h-4 text-indigo-400" />
                                <CardTitle className="text-base">Quiet Hours</CardTitle>
                            </div>
                            <CardDescription className="text-xs">
                                Pause automated notifications during set hours
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="flex items-center justify-between">
                                <Label className="text-sm">Enable quiet hours</Label>
                                <Switch
                                    checked={quietHoursEnabled}
                                    onCheckedChange={(checked) => {
                                        setQuietHoursEnabled(checked);
                                        saveAutomationSettings({ quietHoursEnabled: checked ? 1 : 0 });
                                    }}
                                />
                            </div>
                            {quietHoursEnabled && (
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <Label className="text-xs">Start</Label>
                                        <Select
                                            value={String(quietHoursStart)}
                                            onValueChange={(v) => {
                                                const val = Number(v);
                                                setQuietHoursStart(val);
                                                saveAutomationSettings({ quietHoursStart: val });
                                            }}
                                        >
                                            <SelectTrigger className="h-10 mt-1">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {Array.from({ length: 24 }, (_, i) => (
                                                    <SelectItem key={i} value={String(i)}>
                                                        {i === 0 ? "12:00 AM" : i < 12 ? `${i}:00 AM` : i === 12 ? "12:00 PM" : `${i - 12}:00 PM`}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div>
                                        <Label className="text-xs">End</Label>
                                        <Select
                                            value={String(quietHoursEnd)}
                                            onValueChange={(v) => {
                                                const val = Number(v);
                                                setQuietHoursEnd(val);
                                                saveAutomationSettings({ quietHoursEnd: val });
                                            }}
                                        >
                                            <SelectTrigger className="h-10 mt-1">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {Array.from({ length: 24 }, (_, i) => (
                                                    <SelectItem key={i} value={String(i)}>
                                                        {i === 0 ? "12:00 AM" : i < 12 ? `${i}:00 AM` : i === 12 ? "12:00 PM" : `${i - 12}:00 PM`}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Web Push Test Controls */}
                    <WebPushSettings />

                    <Button
                        onClick={() => {
                            resetForm();
                            setShowDialog(true);
                        }}
                        className="w-full tap-target shadow-lg shadow-primary/20 bg-primary hover:bg-primary/90 text-primary-foreground h-14 text-base font-semibold"
                    >
                        <Plus className="w-5 h-5 mr-2" />
                        Add Notification Template
                    </Button>

                    {templates && templates.length === 0 ? (
                        <div className="p-8 bg-secondary/50 border border-border rounded-md">
                            <div className="text-center space-y-3">
                                <div className="w-16 h-16 rounded-full bg-secondary/50 flex items-center justify-center mx-auto">
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
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {templates?.map((template: any) => (
                                <div key={template.id} className="bg-transparent border-b border-border pb-4 pt-4 last:border-0 overflow-hidden">
                                    <div className="flex items-start justify-between gap-3 mb-3">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <h3 className="text-base font-semibold text-foreground truncate">
                                                    {template.title}
                                                </h3>
                                                <Switch
                                                    checked={template.enabled}
                                                    onCheckedChange={checked => {
                                                        updateMutation.mutate({
                                                            id: template.id,
                                                            enabled: checked,
                                                        });
                                                    }}
                                                />
                                            </div>
                                            <p className="text-xs text-muted-foreground">
                                                {templateTypeLabels[template.templateType as TemplateType]}
                                                {template.timing && (
                                                    <span className="ml-1 opacity-70">({template.timing})</span>
                                                )}
                                            </p>
                                        </div>
                                        <div className="flex bg-secondary/50 rounded-md border border-border">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => handleTestClick(template)}
                                                disabled={isTesting}
                                                className="tap-target h-10 w-10 text-primary hover:bg-secondary/50 rounded-none rounded-l-lg border-r border-border"
                                                title="Send Test Push"
                                            >
                                                <Send className="w-4 h-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => handleEdit(template)}
                                                className="tap-target h-10 w-10 hover:bg-secondary/50 rounded-none border-r border-border text-muted-foreground"
                                            >
                                                <Edit className="w-4 h-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => handleDelete(template.id)}
                                                className="tap-target h-10 w-10 text-destructive hover:bg-destructive/20 hover:text-[var(--color-status-danger-text)] rounded-none rounded-r-lg"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </div>
                                    <div className="p-4 bg-secondary/50 rounded-md border border-border">
                                        <p className="text-sm text-muted-foreground line-clamp-3 leading-relaxed">
                                            {template.content}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

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
                    <div className="flex w-full gap-2 pt-2">
                        <Button
                            variant="outline"
                            onClick={() => {
                                setShowDialog(false);
                                resetForm();
                            }}
                            className="flex-1 bg-transparent border-border hover:bg-secondary/50"
                        >
                            Cancel
                        </Button>
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
                    </div>
                }
            >
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="type">Notification Type</Label>
                        <Select
                            value={formData.templateType}
                            onValueChange={(value: string) =>
                                setFormData({ ...formData, templateType: value as TemplateType })
                            }
                        >
                            <SelectTrigger className="bg-secondary/50 border-border">
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
                            onChange={e =>
                                setFormData({ ...formData, title: e.target.value })
                            }
                            placeholder="Your Appointment is Confirmed"
                            className="bg-secondary/50 border-border"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="content">Message Content</Label>
                        <Textarea
                            id="content"
                            value={formData.content}
                            onChange={e =>
                                setFormData({ ...formData, content: e.target.value })
                            }
                            placeholder="Hi {clientName}, your appointment on {date} at {time} is confirmed..."
                            rows={5}
                            className="bg-secondary/50 border-border font-sans leading-relaxed"
                        />
                        <p className="text-xs text-muted-foreground px-1">
                            Placeholders: <code className="bg-secondary/50 px-1 py-0.5 rounded text-[10px] mx-0.5">{"{clientName}"}</code>, <code className="bg-secondary/50 px-1 py-0.5 rounded text-[10px] mx-0.5">{"{date}"}</code>, <code className="bg-secondary/50 px-1 py-0.5 rounded text-[10px] mx-0.5">{"{time}"}</code>
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
                                    onChange={e =>
                                        setFormData({ ...formData, timing: e.target.value })
                                    }
                                    placeholder="1 hour before / 24 hours after"
                                    className="bg-secondary/50 border-border"
                                />
                                <p className="text-xs text-muted-foreground">
                                    E.g., "1 hour before", "24 hours after", "2 days before"
                                </p>
                            </div>
                        )}

                    <div className="flex items-center justify-between pt-2 border-t border-border mt-6">
                        <Label htmlFor="enabled">Template Enabled</Label>
                        <Switch
                            id="enabled"
                            checked={formData.enabled}
                            onCheckedChange={checked =>
                                setFormData({ ...formData, enabled: checked })
                            }
                        />
                    </div>
                </div>
            </ModalShell>

            {/* Push Target Selection Dialog */}
            <ModalShell
                isOpen={pushDialog.isOpen}
                onClose={() => setPushDialog({ isOpen: false, template: null })}
                title="Send Test Push"
                description="Select a client to send this notification to"
                className="max-w-md max-h-[80vh] overflow-y-auto"
                overlayName="Push Target Selection"
                overlayId="notifications.push_target"
            >
                <div className="py-4 space-y-2">
                    <Button
                        variant="outline"
                        className="w-full justify-start font-normal h-auto py-3 bg-secondary/50 border-border hover:bg-secondary/50"
                        onClick={() => handleSendPushToClient(user?.id || "")}
                    >
                        <div className="flex flex-col items-start gap-1">
                            <span className="font-medium text-foreground">Myself (Artist)</span>
                            <span className="text-xs text-muted-foreground">
                                Test on this device
                            </span>
                        </div>
                    </Button>

                    <div className="h-px bg-secondary/50 my-4" />
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3 px-1">
                        My Clients
                    </p>

                    {!clients?.length ? (
                        <p className="text-sm text-muted-foreground px-1">No clients found.</p>
                    ) : (
                        <div className="space-y-2">
                            {clients.map(client => client && (
                                <Button
                                    key={client.id}
                                    variant="ghost"
                                    className="w-full justify-start h-auto py-3 px-4 bg-secondary/50 hover:bg-secondary/50 border border-transparent hover:border-border transition-all"
                                    onClick={() => handleSendPushToClient(client.id)}
                                >
                                    <div className="flex-1 text-left">
                                        <div className="flex items-center justify-between">
                                            <div className="font-medium text-foreground">{client.name}</div>
                                        </div>
                                        <div className="text-xs text-muted-foreground mt-0.5">
                                            {client.email}
                                        </div>
                                    </div>
                                </Button>
                            ))}
                        </div>
                    )}
                </div>
            </ModalShell>
        </div >
    );
}
