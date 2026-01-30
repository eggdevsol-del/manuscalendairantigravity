<<<<<<< HEAD
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input } from "@/components/ui";
import { Check, Copy, Share2 } from "lucide-react";
import { useState } from "react";
=======
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Check, Copy, ExternalLink, Link2, Loader2, Share2 } from "lucide-react";
import { useEffect, useState } from "react";
>>>>>>> f67b805f30b6e59529d357c59fa5a255ab93fc80
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useDebounce } from "@/hooks/useDebounce";

interface ArtistLinkProps {
  artistId: string;
  artistName: string;
}

export default function ArtistLink({ artistId, artistName }: ArtistLinkProps) {
  const [copied, setCopied] = useState(false);
  const [slug, setSlug] = useState("");
  const [isEnabled, setIsEnabled] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  
  const debouncedSlug = useDebounce(slug, 500);
  
  // Fetch current funnel settings
  const { data: settings, isLoading } = trpc.funnel.getFunnelSettings.useQuery();
  
  // Check slug availability
  const { data: slugCheck, isLoading: checkingSlug } = trpc.funnel.checkSlugAvailability.useQuery(
    { slug: debouncedSlug },
    { 
      enabled: debouncedSlug.length >= 3 && debouncedSlug !== settings?.publicSlug,
    }
  );
  
  // Update settings mutation
  const updateSettings = trpc.funnel.updateFunnelSettings.useMutation({
    onSuccess: () => {
      toast.success("Booking link updated!");
      setIsEditing(false);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update settings");
    },
  });
  
  // Initialize state from settings
  useEffect(() => {
    if (settings) {
      setSlug(settings.publicSlug || "");
      setIsEnabled(settings.funnelEnabled || false);
    }
  }, [settings]);
  
  // Generate the booking link
  const baseUrl = window.location.origin;
  const bookingLink = slug ? `${baseUrl}/start/${slug}` : null;
  
  const handleCopy = async () => {
    if (!bookingLink) return;
    try {
      await navigator.clipboard.writeText(bookingLink);
      setCopied(true);
      toast.success("Link copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error("Failed to copy link");
    }
  };

  const handleShare = async () => {
    if (!bookingLink) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Book with ${artistName}`,
          text: `Start your tattoo consultation with me!`,
          url: bookingLink,
        });
      } catch (error) {
        // User cancelled share
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
      funnelEnabled: isEnabled,
    });
  };
  
  const handleToggleEnabled = (enabled: boolean) => {
    setIsEnabled(enabled);
    if (settings?.publicSlug) {
      updateSettings.mutate({
        funnelEnabled: enabled,
      });
    }
  };
  
  const slugIsValid = slug.length >= 3 && (slugCheck?.available || slug === settings?.publicSlug);
  const slugIsTaken = slug.length >= 3 && slug !== settings?.publicSlug && slugCheck?.available === false;
  const hasChanges = slug !== (settings?.publicSlug || "");

  if (isLoading) {
    return (
      <Card className="border-0 bg-white/5 rounded-2xl">
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 bg-white/5 rounded-2xl">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-purple-500/20 text-purple-400">
              <Link2 className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-base">Booking Link</CardTitle>
              <CardDescription className="text-sm">
                Share to receive consultation requests
              </CardDescription>
            </div>
          </div>
          <Switch
            checked={isEnabled}
            onCheckedChange={handleToggleEnabled}
            disabled={!settings?.publicSlug}
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Slug Input */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Your custom URL</Label>
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center bg-muted/50 rounded-lg overflow-hidden">
              <span className="px-3 py-2 text-sm text-muted-foreground bg-muted/30 border-r border-border/50 whitespace-nowrap">
                /start/
              </span>
              <Input
                value={slug}
                onChange={(e) => {
                  setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""));
                  setIsEditing(true);
                }}
                placeholder="your-name"
                className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
              />
            </div>
          </div>
          
          {/* Slug status */}
          <div className="h-5">
            {checkingSlug && debouncedSlug.length >= 3 && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" />
                Checking availability...
              </p>
            )}
            {!checkingSlug && slugIsTaken && (
              <p className="text-xs text-red-400">This URL is already taken</p>
            )}
            {!checkingSlug && slugIsValid && hasChanges && (
              <p className="text-xs text-green-400 flex items-center gap-1">
                <Check className="w-3 h-3" />
                Available!
              </p>
            )}
            {slug.length > 0 && slug.length < 3 && (
              <p className="text-xs text-amber-400">URL must be at least 3 characters</p>
            )}
          </div>
        </div>
        
        {/* Save button when editing */}
        {hasChanges && (
          <Button
            onClick={handleSave}
            disabled={!slugIsValid || updateSettings.isPending}
            className="w-full"
          >
            {updateSettings.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : null}
            Save URL
          </Button>
        )}
        
        {/* Share section - only show when slug is set and enabled */}
        {bookingLink && settings?.publicSlug && (
          <>
            <div className="border-t border-border/30 pt-4 space-y-3">
              <div className="flex gap-2">
                <Input
                  value={bookingLink}
                  readOnly
                  className="bg-muted/30 font-mono text-xs"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleCopy}
                  className="shrink-0"
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-green-600" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </Button>
              </div>
              
              <div className="flex gap-2">
                <Button
                  variant="default"
                  className="flex-1"
                  onClick={handleShare}
                >
                  <Share2 className="w-4 h-4 mr-2" />
                  Share Link
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => window.open(bookingLink, "_blank")}
                >
                  <ExternalLink className="w-4 h-4" />
                </Button>
              </div>
            </div>
            
            {!isEnabled && (
              <p className="text-xs text-amber-400 text-center">
                Your booking link is currently disabled
              </p>
            )}
          </>
        )}
        
        {!settings?.publicSlug && (
          <p className="text-xs text-muted-foreground text-center">
            Set your custom URL above to start receiving consultation requests
          </p>
        )}
      </CardContent>
    </Card>
  );
}
