/**
 * FunnelSettings Component
 *
 * Allows artists to customize their public booking funnel link.
 * Follows SSOT UI patterns.
 */

import { useState, useEffect } from "react";
import { LoadingState } from "./ui/ssot";
import { ImageUpload } from "@/components/ui";
import {
  Link2,
  Copy,
  Check,
  Share2,
  Eye,
  EyeOff,
  ExternalLink,
  AlertCircle,
  ChevronLeft
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

interface FunnelSettingsProps {
  onBack: () => void;
}

export function FunnelSettings({ onBack }: FunnelSettingsProps) {
  const [slug, setSlug] = useState("");
  const [originalSlug, setOriginalSlug] = useState("");
  const [funnelEnabled, setFunnelEnabled] = useState(true);
  const [funnelTheme, setFunnelTheme] = useState<"light" | "dark">("light");
  const [funnelBannerUrl, setFunnelBannerUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [slugError, setSlugError] = useState<string | null>(null);
  const [isCheckingSlug, setIsCheckingSlug] = useState(false);

  const {
    data: settings,
    isLoading,
    refetch,
  } = trpc.funnel.getFunnelSettings.useQuery();
  const updateSettings = trpc.funnel.updateFunnelSettings.useMutation({
    onSuccess: () => {
      toast.success("Funnel settings updated");
      refetch();
    },
    onError: error => {
      toast.error(error.message || "Failed to update settings");
    },
  });

  const checkSlugAvailability = trpc.funnel.checkSlugAvailability.useQuery(
    { slug },
    {
      enabled: false, // Manual trigger only
    }
  );

  useEffect(() => {
    if (settings) {
      const currentSlug = settings.publicSlug || "";
      setSlug(currentSlug);
      setOriginalSlug(currentSlug);
      setFunnelEnabled(!!settings.funnelEnabled);
      setFunnelTheme(settings.funnelTheme as "light" | "dark" || "light");
      setFunnelBannerUrl(settings.funnelBannerUrl || null);
    }
  }, [settings]);

  // Validate slug format
  const validateSlug = (value: string): string | null => {
    if (!value) return "Slug is required";
    if (value.length < 3) return "Slug must be at least 3 characters";
    if (value.length > 50) return "Slug must be 50 characters or less";
    if (!/^[a-z0-9-]+$/.test(value))
      return "Only lowercase letters, numbers, and hyphens allowed";
    if (value.startsWith("-") || value.endsWith("-"))
      return "Slug cannot start or end with a hyphen";
    return null;
  };

  const handleSlugChange = (value: string) => {
    const normalized = value.toLowerCase().replace(/[^a-z0-9-]/g, "");
    setSlug(normalized);
    setSlugError(validateSlug(normalized));
  };

  const handleCheckSlug = async () => {
    if (slug === originalSlug) {
      setSlugError(null);
      return;
    }

    const validationError = validateSlug(slug);
    if (validationError) {
      setSlugError(validationError);
      return;
    }

    setIsCheckingSlug(true);
    try {
      const result = await checkSlugAvailability.refetch();
      if (!result.data?.available) {
        setSlugError("This slug is already taken");
      } else {
        setSlugError(null);
        toast.success("Slug is available!");
      }
    } catch (error) {
      setSlugError("Failed to check availability");
    } finally {
      setIsCheckingSlug(false);
    }
  };

  const handleSave = async () => {
    if (slugError) {
      toast.error("Please fix the slug error before saving");
      return;
    }

    await updateSettings.mutateAsync({
      publicSlug: slug,
      funnelEnabled,
      funnelTheme,
      funnelBannerUrl,
    });
  };

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
  const funnelUrl = `${baseUrl}/start/${slug}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(funnelUrl);
      setCopied(true);
      toast.success("Link copied!");
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error("Failed to copy link");
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Book with me",
          text: "Request a consultation for your next tattoo!",
          url: funnelUrl,
        });
      } catch (error) {
        // User cancelled
      }
    } else {
      handleCopy();
    }
  };

  const handlePreview = () => {
    window.open(funnelUrl, "_blank");
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
      {/* 1. Page Header - Floating style */}
      <div className="flex items-center gap-3 px-6 pt-6 pb-4 shrink-0 bg-transparent z-20 border-b border-white/5">
        <button
          onClick={onBack}
          className="p-2 -ml-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors"
        >
          <ChevronLeft className="w-5 h-5 text-foreground" />
        </button>
        <h2 className="text-xl font-semibold text-foreground">Booking Link</h2>
      </div>

      {/* 2. Scroll Container */}
      <div className="flex-1 w-full overflow-y-auto mobile-scroll touch-pan-y relative z-10">
        <div className="pb-[180px] max-w-lg mx-auto space-y-6 px-4 pt-6">
          {/* Enable/Disable Toggle */}
          <div className="bg-white/5 rounded-2xl p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {funnelEnabled ? (
                  <Eye className="w-5 h-5 text-green-400" />
                ) : (
                  <EyeOff className="w-5 h-5 text-white/40" />
                )}
                <div>
                  <p className="text-white font-medium">Public Booking Link</p>
                  <p className="text-white/60 text-sm">
                    {funnelEnabled
                      ? "Clients can request consultations"
                      : "Link is disabled"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setFunnelEnabled(!funnelEnabled)}
                className={`w-12 h-7 rounded-full transition-colors relative ${funnelEnabled ? "bg-[#7C5CFC]" : "bg-white/20"
                  }`}
              >
                <div
                  className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-transform ${funnelEnabled ? "left-6" : "left-1"
                    }`}
                />
              </button>
            </div>
          </div>

          {/* Your Link */}
          <div>
            <h3 className="text-white font-medium mb-3 flex items-center gap-2">
              <Link2 className="w-4 h-4" />
              Your Link
            </h3>

            <div className="bg-white/5 rounded-2xl p-4 space-y-4">
              {/* Slug Input */}
              <div>
                <label className="text-white/60 text-sm mb-2 block">
                  Custom URL Slug
                </label>
                <div className="flex gap-2">
                  <div className="flex-1 flex items-center bg-white/10 rounded-xl overflow-hidden">
                    <span className="text-white/40 text-sm pl-3 pr-1">
                      /start/
                    </span>
                    <input
                      type="text"
                      value={slug}
                      onChange={e => handleSlugChange(e.target.value)}
                      onBlur={handleCheckSlug}
                      placeholder="yourname"
                      className="flex-1 bg-transparent border-0 py-3 pr-3 text-white placeholder:text-white/30 focus:outline-none"
                    />
                  </div>
                </div>
                {slugError && (
                  <p className="text-red-400 text-sm mt-2 flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" />
                    {slugError}
                  </p>
                )}
                {isCheckingSlug && (
                  <p className="text-white/60 text-sm mt-2">
                    Checking availability...
                  </p>
                )}
              </div>

              {/* Full URL Display */}
              {slug && !slugError && (
                <div className="bg-white/5 rounded-xl p-3">
                  <p className="text-white/60 text-xs mb-1">Your booking link:</p>
                  <p className="text-white font-mono text-sm break-all">
                    {funnelUrl}
                  </p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-2">
                <button
                  onClick={handleCopy}
                  disabled={!slug || !!slugError}
                  className="flex-1 bg-white/10 text-white py-3 rounded-xl font-medium flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {copied ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                  {copied ? "Copied!" : "Copy"}
                </button>
                <button
                  onClick={handleShare}
                  disabled={!slug || !!slugError}
                  className="flex-1 bg-white/10 text-white py-3 rounded-xl font-medium flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Share2 className="w-4 h-4" />
                  Share
                </button>
                <button
                  onClick={handlePreview}
                  disabled={!slug || !!slugError}
                  className="bg-white/10 text-white p-3 rounded-xl disabled:opacity-50"
                >
                  <ExternalLink className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          {/* Funnel Theme Toggle */}
          <div>
            <h3 className="text-white font-medium mb-3">Booking Link Theme</h3>
            <div className="bg-white/5 rounded-2xl p-2 flex gap-2">
              <button
                onClick={() => setFunnelTheme("light")}
                className={`flex-1 py-3 px-4 rounded-xl font-medium transition-colors ${funnelTheme === "light"
                  ? "bg-white text-black"
                  : "text-white/60 hover:text-white hover:bg-white/5"
                  }`}
              >
                Light Theme
              </button>
              <button
                onClick={() => setFunnelTheme("dark")}
                className={`flex-1 py-3 px-4 rounded-xl font-medium transition-colors ${funnelTheme === "dark"
                  ? "bg-[#1E1E1E] text-white border border-white/10"
                  : "text-white/60 hover:text-white hover:bg-white/5"
                  }`}
              >
                Dark Theme
              </button>
            </div>
          </div>

          {/* Banner Image Upload */}
          <div>
            <h3 className="text-white font-medium mb-3">Header Banner Image</h3>
            <div className="bg-white/5 rounded-2xl p-4">
              <ImageUpload
                value={funnelBannerUrl || ""}
                onChange={(url: string) => setFunnelBannerUrl(url)}
                onRemove={() => setFunnelBannerUrl(null)}
                label="Upload Banner (16:9 recommended)"
                className="w-full aspect-[21/9] rounded-xl overflow-hidden"
              />
              <p className="text-white/40 text-xs mt-3">
                This image will appear at the top of your booking link and smoothly fade into the background.
              </p>
            </div>
          </div>

          {/* Tips */}
          <div className="bg-[#7C5CFC]/10 rounded-2xl p-4">
            <h4 className="text-[#7C5CFC] font-medium mb-2">
              Tips for your link
            </h4>
            <ul className="text-white/70 text-sm space-y-2">
              <li>• Add it to your Instagram bio</li>
              <li>• Share it in your TikTok profile</li>
              <li>• Include it in your email signature</li>
              <li>• Use it when replying to DM inquiries</li>
            </ul>
          </div>

          {/* Save Button */}
          <div className="pt-4">
            <button
              onClick={handleSave}
              disabled={updateSettings.isPending || !!slugError}
              className="w-full bg-[#7C5CFC] text-white py-4 rounded-2xl font-medium disabled:opacity-50"
            >
              {updateSettings.isPending ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

export default FunnelSettings;
