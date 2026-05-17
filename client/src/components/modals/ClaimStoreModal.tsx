import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  Button,
  Input,
  Label,
} from "@/components/ui";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Loader2, Store } from "lucide-react";

interface ClaimStoreModalProps {
  supplierId: number;
  isOpen: boolean;
  onClose: () => void;
}

export function ClaimStoreModal({
  supplierId,
  isOpen,
  onClose,
}: ClaimStoreModalProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const utils = trpc.useUtils();

  const { mutate: claimStore, isPending } =
    trpc.merchantAuth.claimStorefront.useMutation({
      onSuccess: (data) => {
        toast.success("Store claimed successfully!");
        
        // Store JWT token
        localStorage.setItem("authToken", data.token);
        sessionStorage.setItem("authToken", data.token);
        
        // Force trpc to refetch the user
        utils.auth.me.invalidate();
        
        onClose();
        window.location.href = "/onboarding/merchant";
      },
      onError: error => {
        toast.error(error.message || "Failed to claim store");
      },
    });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Please fill in all fields");
      return;
    }
    claimStore({ supplierId, email, password });
  };

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent className="sm:max-w-[425px] bg-background/95 backdrop-blur-xl border-border">
        <DialogHeader>
          <div className="mx-auto bg-primary/10 p-3 rounded-full mb-4">
            <Store className="w-6 h-6 text-primary" />
          </div>
          <DialogTitle className="text-center text-2xl">
            Claim Your Store
          </DialogTitle>
          <DialogDescription className="text-center">
            Create a merchant account to manage this catalog, set shipping
            zones, and receive payouts.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="email">Business Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@yourbusiness.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="bg-accent/5"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Create Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              className="bg-accent/5"
            />
          </div>

          <Button
            type="submit"
            className="w-full shadow-lg rounded-full mt-4"
            disabled={isPending}
            size="lg"
          >
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Claiming...
              </>
            ) : (
              "Claim Store & Continue"
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
