/**
 * InstagramImportSettings.tsx — Instagram portfolio import UI
 * 
 * Located in Settings. Three states:
 * 1. Connect: Enter username
 * 2. Progress: Live import progress  
 * 3. Complete: Results summary
 */

import React, { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button, Card, Input } from "@/components/ui";
import { PageHeader } from "@/components/ui/ssot";
import { tokens } from "@/ui/tokens";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Instagram,
  ArrowLeft,
  Check,
  Loader2,
  AlertCircle,
  Image,
  Video,
  LayoutGrid,
  RefreshCw,
} from "lucide-react";

interface Props {
  onBack: () => void;
}

export function InstagramImportSettings({ onBack }: Props) {
  const [username, setUsername] = useState("");
  const [importId, setImportId] = useState<number | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifiedUser, setVerifiedUser] = useState<any>(null);
  const [showConnectForm, setShowConnectForm] = useState(false);

  // Check for existing import
  const latestImport = trpc.instagram.getLatestImport.useQuery();

  // Poll import status when import is in progress
  const importStatus = trpc.instagram.getImportStatus.useQuery(
    { importId: importId! },
    {
      enabled: !!importId,
      refetchInterval: (query) => {
        const st = (query.state.data as any)?.status;
        return st === "in_progress" ? 2000 : false;
      },
    }
  );

  const verifyMutation = trpc.instagram.verifyUsername.useQuery(
    { username: username.replace(/^@/, "") },
    { enabled: isVerifying }
  );

  const startImportMutation = trpc.instagram.startImport.useMutation({
    onSuccess: (data) => {
      setImportId(data.importId);
      setShowConnectForm(false);
      if (data.alreadyRunning) {
        toast.info("Import already in progress");
      }
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  // Auto-resume existing in-progress import
  useEffect(() => {
    if (latestImport.data?.status === "in_progress") {
      setImportId(latestImport.data.id);
    }
  }, [latestImport.data]);

  // Handle verify response
  useEffect(() => {
    if (verifyMutation.data && isVerifying) {
      setIsVerifying(false);
      if (verifyMutation.data.success) {
        setVerifiedUser(verifyMutation.data.userInfo);
      } else {
        toast.error(verifyMutation.data.error || "Could not find account");
      }
    }
  }, [verifyMutation.data, isVerifying]);

  const handleVerify = () => {
    if (!username.trim()) {
      toast.error("Enter a username");
      return;
    }
    setIsVerifying(true);
    setVerifiedUser(null);
  };

  const handleStartImport = () => {
    if (!verifiedUser) return;
    startImportMutation.mutate({ username: username.replace(/^@/, "") });
  };

  const status = importStatus.data || (latestImport.data?.status !== "in_progress" ? latestImport.data : null);
  const isImporting = importId && status?.status === "in_progress";
  const isComplete = status?.status === "completed" && !showConnectForm;
  const isFailed = status?.status === "failed" && !showConnectForm;

  const progress = status
    ? Math.min(100, Math.round(((status.totalProcessed || 0) / Math.max(status.totalDiscovered || 1, 1)) * 100))
    : 0;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 pb-4 border-b border-border/30"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 16px)" }}
      >
        <button onClick={onBack} className="p-2 rounded-xl hover:bg-secondary/50 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-gradient-to-br from-[#833AB4] via-[#E1306C] to-[#F77737]">
            <Instagram className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="font-semibold">Instagram Import</h2>
            <p className="text-xs text-muted-foreground">Import your portfolio from Instagram</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto mobile-scroll px-4 pt-6 pb-32">
        <div className="max-w-lg mx-auto space-y-6">

          {/* ═══ IMPORTING STATE ═══ */}
          {isImporting && (
            <div className="space-y-6">
              <Card className={cn(tokens.card.base, tokens.card.bg, "p-6")}>
                <div className="text-center space-y-4">
                  <div className="inline-flex p-4 rounded-full bg-gradient-to-br from-[#833AB4]/20 via-[#E1306C]/20 to-[#F77737]/20">
                    <Loader2 className="w-8 h-8 text-[#E1306C] animate-spin" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">Importing Portfolio</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      @{status?.instagramUsername}
                    </p>
                  </div>

                  {/* Progress bar */}
                  <div className="space-y-2">
                    <div className="w-full bg-secondary rounded-full h-3 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#833AB4] via-[#E1306C] to-[#F77737] transition-all duration-500"
                        style={{ width: `${Math.max(progress, 5)}%` }}
                      />
                    </div>
                    <p className="text-sm font-medium">
                      {status?.totalProcessed || 0} of {status?.totalDiscovered || "..."} posts — {progress}%
                    </p>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-3 pt-2">
                    <div className="text-center p-3 rounded-xl bg-secondary/50">
                      <p className="text-lg font-bold text-[var(--color-status-success-text)]">
                        {status?.totalAdded || 0}
                      </p>
                      <p className="text-xs text-muted-foreground">Added</p>
                    </div>
                    <div className="text-center p-3 rounded-xl bg-secondary/50">
                      <p className="text-lg font-bold text-muted-foreground">
                        {status?.totalSkipped || 0}
                      </p>
                      <p className="text-xs text-muted-foreground">Skipped</p>
                    </div>
                    <div className="text-center p-3 rounded-xl bg-secondary/50">
                      <p className="text-lg font-bold text-[var(--color-status-danger-text)]">
                        {status?.totalFailed || 0}
                      </p>
                      <p className="text-xs text-muted-foreground">Failed</p>
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {/* ═══ COMPLETE STATE ═══ */}
          {(isComplete || isFailed) && !importId && (
            <div className="space-y-6">
              <Card className={cn(tokens.card.base, tokens.card.bg, "p-6")}>
                <div className="text-center space-y-4">
                  <div className={cn(
                    "inline-flex p-4 rounded-full",
                    isComplete ? "bg-[var(--color-status-success-bg)]" : "bg-[var(--color-status-danger-bg)]"
                  )}>
                    {isComplete ? (
                      <Check className="w-8 h-8 text-[var(--color-status-success-text)]" />
                    ) : (
                      <AlertCircle className="w-8 h-8 text-[var(--color-status-danger-text)]" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">
                      {isComplete ? "Import Complete" : "Import Failed"}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      @{status?.instagramUsername}
                    </p>
                  </div>

                  {isComplete && (
                    <div className="grid grid-cols-3 gap-3 pt-2">
                      <div className="text-center p-3 rounded-xl bg-secondary/50">
                        <p className="text-lg font-bold text-[var(--color-status-success-text)]">
                          {status?.totalAdded || 0}
                        </p>
                        <p className="text-xs text-muted-foreground">Added</p>
                      </div>
                      <div className="text-center p-3 rounded-xl bg-secondary/50">
                        <p className="text-lg font-bold text-muted-foreground">
                          {status?.totalSkipped || 0}
                        </p>
                        <p className="text-xs text-muted-foreground">Skipped</p>
                      </div>
                      <div className="text-center p-3 rounded-xl bg-secondary/50">
                        <p className="text-lg font-bold text-[var(--color-status-danger-text)]">
                          {status?.totalFailed || 0}
                        </p>
                        <p className="text-xs text-muted-foreground">Failed</p>
                      </div>
                    </div>
                  )}

                  {isFailed && (
                    <p className="text-sm text-[var(--color-status-danger-text)]">
                      {status?.errorMessage || "An error occurred during import"}
                    </p>
                  )}
                </div>
              </Card>

              {/* Re-import button */}
              <Button
                className="w-full"
                variant="outline"
                onClick={() => {
                  setVerifiedUser(null);
                  setImportId(null);
                  setShowConnectForm(true);
                  setUsername(status?.instagramUsername || "");
                }}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Import Again
              </Button>
            </div>
          )}

          {/* ═══ CONNECT STATE ═══ */}
          {!isImporting && !((isComplete || isFailed) && !importId) && (
            <div className="space-y-6">
              {/* Info */}
              <Card className={cn(tokens.card.base, tokens.card.bg, "p-6")}>
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-2xl bg-gradient-to-br from-[#833AB4]/20 via-[#E1306C]/20 to-[#F77737]/20">
                      <Instagram className="w-6 h-6 text-[#E1306C]" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Connect Instagram</h3>
                      <p className="text-xs text-muted-foreground">
                        Import your tattoo portfolio automatically
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Image className="w-4 h-4 text-[#833AB4]" />
                      <span>Photos imported as portfolio items</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Video className="w-4 h-4 text-[#E1306C]" />
                      <span>Reels streamed from Instagram</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <LayoutGrid className="w-4 h-4 text-[#F77737]" />
                      <span>Carousels preserved with all slides</span>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Username input */}
              <Card className={cn(tokens.card.base, tokens.card.bg, "p-6")}>
                <div className="space-y-4">
                  <label className="text-sm font-medium">Instagram Username</label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">@</span>
                      <Input
                        value={username}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                          setUsername(e.target.value.replace(/^@/, ""));
                          setVerifiedUser(null);
                        }}
                        placeholder="yourusername"
                        className="pl-8"
                      />
                    </div>
                    <Button
                      onClick={handleVerify}
                      disabled={!username.trim() || verifyMutation.isLoading}
                      variant="outline"
                    >
                      {verifyMutation.isLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        "Verify"
                      )}
                    </Button>
                  </div>

                  {/* Verified user preview */}
                  {verifiedUser && (
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-[var(--color-status-success-bg)] border border-[var(--color-status-success-text)]/20">
                      {verifiedUser.profilePicUrl && (
                        <img
                          src={verifiedUser.profilePicUrl}
                          alt={verifiedUser.username}
                          className="w-10 h-10 rounded-full"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">
                          {verifiedUser.fullName || verifiedUser.username}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {verifiedUser.mediaCount} posts · {verifiedUser.followerCount} followers
                        </p>
                      </div>
                      <Check className="w-5 h-5 text-[var(--color-status-success-text)] shrink-0" />
                    </div>
                  )}
                </div>
              </Card>

              {/* Start import button */}
              {verifiedUser && (
                <Button
                  className="w-full bg-gradient-to-r from-[#833AB4] via-[#E1306C] to-[#F77737] text-white hover:opacity-90 transition-opacity"
                  onClick={handleStartImport}
                  disabled={startImportMutation.isPending}
                >
                  {startImportMutation.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Instagram className="w-4 h-4 mr-2" />
                  )}
                  Import {verifiedUser.mediaCount} Posts
                </Button>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
