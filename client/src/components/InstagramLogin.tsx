import { Button, Input, Label } from "@/components/ui";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

interface InstagramLoginProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function InstagramLogin({
  open,
  onOpenChange,
}: InstagramLoginProps) {
  const [username, setUsername] = useState("");
  const [, setLocation] = useLocation();

  const linkInstagramMutation = trpc.auth.linkInstagram.useMutation({
    onSuccess: () => {
      toast.success("Instagram account linked successfully!");
      onOpenChange(false);
      // Redirect to role selection for new users
      setLocation("/role-selection");
    },
    onError: (error: any) => {
      toast.error("Failed to link Instagram: " + error.message);
    },
  });

  const handleSubmit = () => {
    if (!username.trim()) {
      toast.error("Please enter your Instagram username");
      return;
    }

    linkInstagramMutation.mutate({
      instagramUsername: username.trim(),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-center mb-4">
            <svg
              className="w-16 h-16"
              viewBox="0 0 24 24"
              fill="url(#instagram-gradient)"
            >
              <defs>
                <linearGradient
                  id="instagram-gradient"
                  x1="0%"
                  y1="0%"
                  x2="100%"
                  y2="100%"
                >
                  <stop offset="0%" style={{ stopColor: "#f09433" }} />
                  <stop offset="25%" style={{ stopColor: "#e6683c" }} />
                  <stop offset="50%" style={{ stopColor: "#dc2743" }} />
                  <stop offset="75%" style={{ stopColor: "#cc2366" }} />
                  <stop offset="100%" style={{ stopColor: "#bc1888" }} />
                </linearGradient>
              </defs>
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
            </svg>
          </div>
          <DialogTitle className="text-center text-2xl">
            Connect with Instagram
          </DialogTitle>
          <DialogDescription className="text-center">
            Link your Instagram account to get started
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="instagram-username">Instagram Username</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                @
              </span>
              <Input
                id="instagram-username"
                value={username}
                onChange={e => setUsername(e.target.value.replace("@", ""))}
                placeholder="yourusername"
                className="pl-8"
                onKeyDown={e => {
                  if (e.key === "Enter") {
                    handleSubmit();
                  }
                }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Enter your Instagram username to link your account
            </p>
          </div>

          <Button
            onClick={handleSubmit}
            disabled={linkInstagramMutation.isPending}
            className="w-full h-12 text-lg font-semibold"
            style={{
              background:
                "linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)",
            }}
          >
            {linkInstagramMutation.isPending ? "Connecting..." : "Continue"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
