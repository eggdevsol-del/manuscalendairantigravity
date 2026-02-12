import { useAuth } from "@/_core/hooks/useAuth";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui";
import { trpc } from "@/lib/trpc";
import { ChevronLeft, FileText, Shield } from "lucide-react";
import { LoadingState } from "@/components/ui/ssot";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { tokens } from "@/ui/tokens";
import { cn } from "@/lib/utils";

type PolicyType = "deposit" | "design" | "reschedule" | "cancellation";

const policyTypes: { type: PolicyType; label: string; icon: typeof FileText }[] = [
  { type: "deposit", label: "Deposit Policy", icon: Shield },
  { type: "design", label: "Design Policy", icon: FileText },
  { type: "reschedule", label: "Reschedule Policy", icon: FileText },
  { type: "cancellation", label: "Cancellation Policy", icon: FileText },
];

export default function Policies() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const [selectedType, setSelectedType] = useState<PolicyType | null>(null);
  const [artistId, setArtistId] = useState<string>("");

  useEffect(() => {
    if (!loading && !user) {
      setLocation("/");
    }
  }, [user, loading, setLocation]);

  // For now, we'll use a placeholder artist ID
  // In a real app, this would come from the conversation or artist profile
  useEffect(() => {
    if (user?.role === "artist") {
      setArtistId(user.id);
    }
  }, [user]);

  const { data: policy, isLoading } = trpc.policies.getByType.useQuery(
    {
      artistId: artistId,
      policyType: selectedType!,
    },
    {
      enabled: !!artistId && !!selectedType,
    }
  );

  if (loading) {
    return <LoadingState message="Loading..." fullScreen />;
  }

  // Policy detail view
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
              {policyTypes.find((p) => p.type === selectedType)?.label}
            </h1>
          </div>
        </header>

        <main className="flex-1 px-4 py-4 mobile-scroll overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <LoadingState message="Loading policy..." />
            </div>
          ) : !policy || !policy.enabled ? (
            <Card className={cn(tokens.card.base, tokens.card.bg, "p-8 text-center")}>
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                <FileText className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                Policy Not Available
              </h3>
              <p className="text-muted-foreground text-sm">
                This policy has not been set up yet.
              </p>
            </Card>
          ) : (
            <Card className={cn(tokens.card.base, tokens.card.bg, "border-0")}>
              <CardHeader>
                <CardTitle>{policy.title}</CardTitle>
                <CardDescription>
                  Last updated: {new Date(policy.updatedAt!).toLocaleDateString()}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm max-w-none">
                  <p className="whitespace-pre-wrap text-foreground leading-relaxed">
                    {policy.content}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </main>
      </div>
    );
  }

  // Policy list view
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
          <h1 className="text-2xl font-bold text-foreground">Policies</h1>
        </div>
      </header>

      <main className="flex-1 px-4 py-4 mobile-scroll overflow-y-auto">
        {!artistId ? (
          <Card className={cn(tokens.card.base, tokens.card.bg, "p-8 text-center")}>
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
              <Shield className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">
              Select an Artist
            </h3>
            <p className="text-muted-foreground text-sm">
              Policies are specific to each artist. Start a conversation to view their policies.
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {policyTypes.map(({ type, label, icon: Icon }) => (
              <Card
                key={type}
                className={cn(tokens.card.base, tokens.card.bg, tokens.card.interactive, "border-0")}
                onClick={() => setSelectedType(type)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <Icon className="w-5 h-5 text-primary" />
                      </div>
                      <CardTitle className="text-base">{label}</CardTitle>
                    </div>
                    <ChevronLeft className="w-5 h-5 text-muted-foreground rotate-180" />
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

