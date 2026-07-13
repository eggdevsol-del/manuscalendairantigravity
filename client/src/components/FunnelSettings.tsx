/**
 * FunnelSettings Component
 *
 * Booking Link settings page — focused on the Link in Bio booking URL.
 * Follows SSOT UI patterns.
 */

import { useState, useEffect, useRef } from "react";
import { LoadingState, PageHeader } from "./ui/ssot";
import {
  Copy,
  Check,
  Share2,
  ExternalLink,
  AlertCircle,
  Instagram,
  Loader2,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useDebounce } from "@/hooks/useDebounce";

interface FunnelSettingsProps {
  onBack: () => void;
}

export function FunnelSettings({ onBack }: FunnelSettingsProps) {
  const [slug, setSlug] = useState("");
  const [copied, setCopied] = useState(false);

  const debouncedSlug = useDebounce(slug, 500);

  const {
    data: settings,
    isLoading,
    refetch,
  } = trpc.funnel.getFunnelSettings.useQuery();

  const { data: slugCheck, isLoading: checkingSlug } =
    trpc.funnel.checkSlugAvailability.useQuery(
      { slug: debouncedSlug },
      {
        enabled:
          debouncedSlug.length >= 3 && debouncedSlug !== settings?.publicSlug,
      }
    );

  const updateSettings = trpc.funnel.updateFunnelSettings.useMutation({
    onSuccess: () => {
      toast.success("Booking link saved!");
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to save");
    },
  });

  const initializedRef = useRef(false);
  useEffect(() => {
    if (settings && !initializedRef.current) {
      initializedRef.current = true;
      setSlug(settings.publicSlug || "");
    }
  }, [settings]);

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
  const bookingUrl = slug ? `${baseUrl}/book/${slug}` : null;

  const slugIsValid =
    slug.length >= 3 && (slugCheck?.available || slug === settings?.publicSlug);
  const slugIsTaken =
    slug.length >= 3 &&
    slug !== settings?.publicSlug &&
    slugCheck?.available === false;
  const hasChanges = slug !== (settings?.publicSlug || "");

  const handleCopy = async () => {
    if (!bookingUrl) return;
    try {
      await navigator.clipboard.writeText(bookingUrl);
      setCopied(true);
      toast.success("Booking link copied!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };

  const handleShare = async () => {
    if (!bookingUrl) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Book with me",
          text: "Book your tattoo consultation!",
          url: bookingUrl,
        });
      } catch {
        // User cancelled
      }
    } else {
      handleCopy();
    }
  };

  const handleSave = () => {
    if (slug.length < 3) {
      toast.error("URL must be at least 3 characters");
      return;
    }
    updateSettings.mutate({
      publicSlug: slug,
      funnelEnabled: true,
    });
  };

  if (isLoading) {
    return (
      <div className="w-full h-full flex flex-col overflow-hidden relative">
        <div className="flex items-center justify-center h-full">
          <LoadingState />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col overflow-hidden relative">
      <PageHeader title="Booking Link" onBack={onBack} />

      <div className="flex-1 w-full overflow-y-auto mobile-scroll touch-pan-y relative z-10">
        <div className="pb-[180px] max-w-lg mx-auto space-y-6 px-4 pt-6">

          {/* ═══ LINK IN BIO — Primary Card ═══ */}
          <div className="bg-secondary/50 rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 flex items-center justify-center">
                <Instagram className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-foreground font-semibold">Link in Bio</p>
                <p className="text-muted-foreground text-sm">
                  Your direct booking link for Instagram
                </p>
              </div>
            </div>

            {/* Slug Input */}
            <div>
              <label className="text-muted-foreground text-xs font-medium mb-1.5 block">
                Custom URL
              </label>
              <div className="flex items-center bg-secondary/50 rounded-xl overflow-hidden border border-border/50 focus-within:border-primary/50 transition-colors">
                <span className="text-muted-foreground text-sm pl-3 pr-0.5 whitespace-nowrap">
                  /book/
                </span>
                <input
                  type="text"
                  value={slug}
                  onChange={(e) =>
                    setSlug(
                      e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "")
                    )
                  }
                  placeholder="yourname"
                  className="flex-1 bg-transparent border-0 py-3 pr-3 text-foreground placeholder:text-muted-foreground focus:outline-none"
                />
              </div>

              {/* Slug status */}
              <div className="h-5 mt-1.5">
                {checkingSlug && debouncedSlug.length >= 3 && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Checking availability...
                  </p>
                )}
                {!checkingSlug && slugIsTaken && (
                  <p className="text-xs text-[var(--color-status-danger-text)] flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    This URL is already taken
                  </p>
                )}
                {!checkingSlug && slugIsValid && hasChanges && (
                  <p className="text-xs text-[var(--color-success)] flex items-center gap-1">
                    <Check className="w-3 h-3" />
                    Available!
                  </p>
                )}
                {slug.length > 0 && slug.length < 3 && (
                  <p className="text-xs text-[var(--color-status-warning-text)]">
                    Must be at least 3 characters
                  </p>
                )}
              </div>
            </div>

            {/* Save button when slug changed */}
            {hasChanges && (
              <button
                onClick={handleSave}
                disabled={!slugIsValid || updateSettings.isPending}
                className="w-full bg-primary text-primary-foreground py-3 rounded-xl font-medium disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {updateSettings.isPending && (
                  <Loader2 className="w-4 h-4 animate-spin" />
                )}
                {updateSettings.isPending ? "Saving..." : "Save URL"}
              </button>
            )}

            {/* Booking URL display + copy */}
            {bookingUrl && settings?.publicSlug && (
              <>
                <div className="border-t border-border/30 pt-4 space-y-3">
                  <div className="bg-secondary/50 rounded-xl p-3">
                    <p className="text-muted-foreground text-[10px] uppercase tracking-wider font-bold mb-1">
                      Your booking link
                    </p>
                    <p className="text-foreground font-mono text-sm break-all">
                      {bookingUrl}
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={handleCopy}
                      className="flex-1 bg-primary text-primary-foreground py-3 rounded-xl font-medium flex items-center justify-center gap-2"
                    >
                      {copied ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                      {copied ? "Copied!" : "Copy Link"}
                    </button>
                    <button
                      onClick={handleShare}
                      className="bg-secondary/50 text-foreground p-3 rounded-xl"
                    >
                      <Share2 className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => window.open(bookingUrl, "_blank")}
                      className="bg-secondary/50 text-foreground p-3 rounded-xl"
                    >
                      <ExternalLink className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Tips */}
          <div className="bg-primary/10 rounded-2xl p-4">
            <h4 className="text-primary font-medium mb-2">
              How to use your booking link
            </h4>
            <ul className="text-muted-foreground text-sm space-y-2">
              <li>• Paste it in your Instagram bio</li>
              <li>• Share it in your TikTok profile</li>
              <li>• Include it in your email signature</li>
              <li>• Use it when replying to DM inquiries</li>
            </ul>
            <p className="text-muted-foreground/70 text-xs mt-3">
              Clients who visit your link can submit a booking request without
              needing to sign in first. Their account is created automatically
              after submitting.
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}

export default FunnelSettings;
