import { useState } from "react";
import { Link, useSearch } from "wouter";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { Button, Input, Label } from "@/components/ui";
import { trpc } from "@/lib/trpc";
import { CheckCircle2, Loader2 } from "lucide-react";
export default function PasswordRecovery() {
  const params = new URLSearchParams(useSearch());
  const token = params.get("token");
  const [email, setEmail] = useState(params.get("email") || "");
  const [password, setPassword] = useState("");
  const request = trpc.auth.requestPasswordReset.useMutation();
  const reset = trpc.auth.resetPassword.useMutation();
  const done = token ? reset.isSuccess : request.isSuccess;
  const busy = request.isPending || reset.isPending;
  return (
    <AuthLayout
      title={
        done
          ? token
            ? "Password updated"
            : "Check your inbox"
          : token
            ? "Choose a new password"
            : "Let's get you back in"
      }
      description={
        done
          ? token
            ? "You can now sign in with your new password."
            : "If your email is registered, you'll receive a reset link. It expires in 15 minutes."
          : token
            ? "Use at least 8 characters. This link can only be used once."
            : "Enter your email and we'll send you a secure reset link."
      }
    >
      {done ? (
        <div className="space-y-5">
          <CheckCircle2 className="h-10 w-10 text-foreground" />
          <Link
            href="/login"
            className="block py-3 text-center rounded-xl bg-primary text-primary-foreground font-semibold"
          >
            Back to sign in
          </Link>
        </div>
      ) : (
        <form
          className="space-y-5"
          onSubmit={e => {
            e.preventDefault();
            token
              ? reset.mutate({ token, newPassword: password })
              : request.mutate({ email });
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="recovery">
              {token ? "New password" : "Email address"}
            </Label>
            <Input
              id="recovery"
              type={token ? "password" : "email"}
              autoComplete={token ? "new-password" : "email"}
              required
              minLength={token ? 8 : undefined}
              maxLength={token ? 128 : undefined}
              value={token ? password : email}
              onChange={e =>
                token ? setPassword(e.target.value) : setEmail(e.target.value)
              }
              className="h-12 rounded-xl"
            />
          </div>
          {(request.error || reset.error) && (
            <p role="alert" className="text-sm text-destructive">
              {request.error?.message || reset.error?.message}
            </p>
          )}
          <Button className="w-full h-12 rounded-xl" disabled={busy}>
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : token ? (
              "Save new password"
            ) : (
              "Send reset link"
            )}
          </Button>
          <Link
            href={token ? "/forgot-password" : "/login"}
            className="block text-sm text-center underline underline-offset-4 py-2"
          >
            {token ? "Request a new link" : "Back to sign in"}
          </Link>
        </form>
      )}
    </AuthLayout>
  );
}
