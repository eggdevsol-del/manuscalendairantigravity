import { useAuth } from "@/_core/hooks/useAuth";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label, Switch, Textarea } from "@/components/ui";
import { trpc } from "@/lib/trpc";
import { ChevronLeft, FileText, Save } from "lucide-react";
import { LoadingState } from "@/components/ui/ssot";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

type PolicyType = "deposit" | "design" | "reschedule" | "cancellation";

const policyDefaults = {
  deposit: {
    title: "Deposit Policy",
    content: "A non-refundable deposit of 50% is required to secure your appointment. The deposit will be applied to your final balance.",
  },
  design: {
    title: "Design Policy",
    content: "Custom designs are created specifically for you. Minor revisions are included. Additional design changes may incur extra fees.",
  },
  reschedule: {
    title: "Reschedule Policy",
    content: "Appointments can be rescheduled with at least 48 hours notice. Last-minute reschedules may result in deposit forfeiture.",
  },
  cancellation: {
    title: "Cancellation Policy",
    content: "Cancellations must be made at least 48 hours in advance for a full refund. Cancellations within 48 hours will forfeit the deposit.",
  },
};

export default function PolicyManagement() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const [selectedType, setSelectedType] = useState<PolicyType | null>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [enabled, setEnabled] = useState(true);

  const { data: policies, refetch } = trpc.policies.list.useQuery(undefined, {
    enabled: !!user && (user.role === "artist" || user.role === "admin"),
  });

  const upsertPolicyMutation = trpc.policies.upsert.useMutation({
    onSuccess: () => {
      toast.success("Policy saved successfully");
      refetch();
      setSelectedType(null);
    },
    onError: (error) => {
      toast.error("Failed to save policy: " + error.message);
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

  useEffect(() => {
    if (selectedType && policies) {
      const existingPolicy = policies.find((p) => p.policyType === selectedType);
      if (existingPolicy) {
        setTitle(existingPolicy.title);
        setContent(existingPolicy.content);
        setEnabled(existingPolicy.enabled ?? true);
      } else {
        const defaults = policyDefaults[selectedType];
        setTitle(defaults.title);
        setContent(defaults.content);
        setEnabled(true);
      }
    }
  }, [selectedType, policies]);

  const handleSave = () => {
    if (!selectedType) return;

    if (!title.trim() || !content.trim()) {
      toast.error("Please fill in all fields");
      return;
    }

    upsertPolicyMutation.mutate({
      policyType: selectedType,
      title,
      content,
      enabled,
    });
  };

  if (loading) {
    return <LoadingState message="Loading..." fullScreen />;
  }

  // Policy editor view
  if (selectedType) {
    return (
      <div className="min-h-screen flex flex-col">
        <header className="mobile-header px-4 py-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSelectedType(null)}
              className="tap-target"
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-2xl font-bold text-foreground">
              Edit {policyDefaults[selectedType].title}
            </h1>
          </div>
        </header>

        <main className="flex-1 px-4 py-4 mobile-scroll overflow-y-auto">
          <Card>
            <CardHeader>
              <CardTitle>Policy Details</CardTitle>
              <CardDescription>
                Customize this policy to match your business requirements
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Policy Title</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Enter policy title"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="content">Policy Content</Label>
                <Textarea
                  id="content"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Enter policy details..."
                  rows={10}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  This will be displayed to clients when they view your policies
                </p>
              </div>

              <div className="flex items-center justify-between p-4 rounded-lg border">
                <div className="space-y-0.5">
                  <Label htmlFor="enabled" className="text-base">
                    Enable Policy
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Make this policy visible to clients
                  </p>
                </div>
                <Switch
                  id="enabled"
                  checked={enabled}
                  onCheckedChange={setEnabled}
                />
              </div>

              <Button
                onClick={handleSave}
                disabled={upsertPolicyMutation.isPending}
                className="w-full"
                size="lg"
              >
                <Save className="w-4 h-4 mr-2" />
                {upsertPolicyMutation.isPending ? "Saving..." : "Save Policy"}
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  // Policy list view
  const policyTypesList: PolicyType[] = ["deposit", "design", "reschedule", "cancellation"];

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
          <h1 className="text-2xl font-bold text-foreground">Manage Policies</h1>
        </div>
      </header>

      <main className="flex-1 px-4 py-4 mobile-scroll overflow-y-auto">
        <div className="space-y-3">
          {policyTypesList.map((type) => {
            const policy = policies?.find((p) => p.policyType === type);
            const defaults = policyDefaults[type];

            return (
              <Card
                key={type}
                className="cursor-pointer hover:bg-accent/5 transition-colors"
                onClick={() => setSelectedType(type)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <FileText className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <CardTitle className="text-base">
                          {policy?.title || defaults.title}
                        </CardTitle>
                        <CardDescription className="text-sm mt-1">
                          {policy
                            ? policy.enabled
                              ? "Active"
                              : "Disabled"
                            : "Not configured"}
                        </CardDescription>
                      </div>
                    </div>
                    <ChevronLeft className="w-5 h-5 text-muted-foreground rotate-180" />
                  </div>
                </CardHeader>
              </Card>
            );
          })}
        </div>

        <Card className="mt-6 bg-accent/5 border-accent/20">
          <CardHeader>
            <CardTitle className="text-base">About Policies</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Policies help set clear expectations with your clients. They will be able to view
              these policies from their app before booking appointments.
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

