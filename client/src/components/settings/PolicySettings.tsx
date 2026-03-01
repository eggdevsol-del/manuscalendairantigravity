import { useAuth } from "@/_core/hooks/useAuth";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui";
import { trpc } from "@/lib/trpc";
import { ChevronLeft, FileText, Shield } from "lucide-react";
import { PageHeader, LoadingState } from "@/components/ui/ssot";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { tokens } from "@/ui/tokens";
import { cn } from "@/lib/utils";

type PolicyType = "deposit" | "design" | "reschedule" | "cancellation";

const policyTypes: {
  type: PolicyType;
  label: string;
  icon: typeof FileText;
}[] = [
    { type: "deposit", label: "Deposit Policy", icon: Shield },
    { type: "design", label: "Design Policy", icon: FileText },
    { type: "reschedule", label: "Reschedule Policy", icon: FileText },
    { type: "cancellation", label: "Cancellation Policy", icon: FileText },
  ];

interface PolicySettingsProps {
  onBack: () => void;
}

export function PolicySettings({ onBack }: PolicySettingsProps) {
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
      <div className="w-full h-full flex flex-col overflow-hidden relative">
        <div className="flex items-center gap-3 px-6 pt-6 pb-4 shrink-0 bg-transparent z-20 border-b border-white/5">
          <button
            onClick={() => setSelectedType(null)}
            className="p-2 -ml-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-foreground" />
          </button>
          <h2 className="text-xl font-semibold text-foreground">
            {policyTypes.find(p => p.type === selectedType)?.label || "Policy"}
          </h2>
        </div>

        <div className="flex-1 w-full overflow-y-auto mobile-scroll touch-pan-y relative z-10">
          <div className="pb-[180px] max-w-lg mx-auto space-y-4 px-4 pt-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <LoadingState message="Loading policy..." />
              </div>
            ) : !policy || !policy.enabled ? (
              <div className="p-8 text-center bg-white/5 border border-white/5 rounded-[4px] flex flex-col items-center justify-center">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                  <FileText className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  Policy Not Available
                </h3>
                <p className="text-muted-foreground text-sm">
                  This policy has not been set up yet.
                </p>
              </div>
            ) : (
              <div className="bg-transparent border-0 space-y-4">
                <div className="mb-4">
                  <h3 className="text-lg font-semibold">{policy.title}</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Last updated:{" "}
                    {new Date(policy.updatedAt!).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <div className="prose prose-sm max-w-none">
                    <p className="whitespace-pre-wrap text-foreground leading-relaxed">
                      {policy.content}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Policy list view
  return (
    <div className="w-full h-full flex flex-col overflow-hidden relative">
      <div className="flex items-center gap-3 px-6 pt-6 pb-4 shrink-0 bg-transparent z-20 border-b border-white/5">
        <button
          onClick={onBack}
          className="p-2 -ml-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors"
        >
          <ChevronLeft className="w-5 h-5 text-foreground" />
        </button>
        <h2 className="text-xl font-semibold text-foreground">Policies</h2>
      </div>

      <div className="flex-1 w-full overflow-y-auto mobile-scroll touch-pan-y relative z-10">
        <div className="pb-[180px] max-w-lg mx-auto space-y-4 px-4 pt-6">
          {!artistId ? (
            <div className="p-8 text-center bg-white/5 border border-white/5 rounded-[4px] flex flex-col items-center justify-center">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                <Shield className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                Select an Artist
              </h3>
              <p className="text-muted-foreground text-sm">
                Policies are specific to each artist. Start a conversation to view
                their policies.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {policyTypes.map(({ type, label, icon: Icon }) => (
                <div
                  key={type}
                  className="bg-transparent hover:bg-white/5 transition-colors cursor-pointer border-b border-white/5 pb-4 pt-4 last:border-0"
                  onClick={() => setSelectedType(type)}
                >
                  <div className="flex items-center justify-between px-2">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <Icon className="w-5 h-5 text-primary" />
                      </div>
                      <h3 className="text-base font-semibold text-foreground">{label}</h3>
                    </div>
                    <ChevronLeft className="w-5 h-5 text-muted-foreground rotate-180" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
