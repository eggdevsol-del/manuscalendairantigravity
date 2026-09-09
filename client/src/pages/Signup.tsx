import { useState, useEffect } from "react";
import { Link, useSearch } from "wouter";
import { Loader2, ArrowRight } from "lucide-react";
import { Button, Input, Label } from "@/components/ui";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { GoogleLoginButton } from "@/components/auth/GoogleLoginButton";
import { useGoogleAuthReady } from "@/lib/google-auth";
import { finishSignIn } from "@/lib/auth-session";
import { trpc } from "@/lib/trpc";
import SupplierSignup from "./SupplierSignup";

export default function Signup() {
  const search = useSearch();
  const initialRole = new URLSearchParams(search).get("role");
  const [role, setRole] = useState<"client" | "artist">(
    initialRole === "artist" ? "artist" : "client"
  );
  useEffect(() => {
    setRole(initialRole === "artist" ? "artist" : "client");
  }, [initialRole]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [googleError, setGoogleError] = useState("");
  const ready = useGoogleAuthReady();
  const register = trpc.auth.register.useMutation({
    onSuccess: data => finishSignIn(data),
  });
  const google = trpc.auth.googleLogin.useMutation({
    onSuccess: data => finishSignIn(data),
  });
  const busy = register.isPending || google.isPending;
  if (initialRole === "supplier") return <SupplierSignup />;
  return (
    <AuthLayout
      title={
        role === "artist"
          ? "Make more room for your craft"
          : "Start your tattoo journey"
      }
      description={
        role === "artist"
          ? "Bring your enquiries, bookings and clients together. Set up the details as you go."
          : "Save the work you love and connect with your next artist."
      }
    >
      <fieldset className="mb-6">
        <legend className="text-sm font-medium mb-2">I'm here to</legend>
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              ["client", "Find an artist"],
              ["artist", "Manage my work"],
            ] as const
          ).map(([value, label]) => (
            <label
              key={value}
              className={`flex gap-2 items-center justify-center border rounded-xl p-3 text-sm cursor-pointer ${role === value ? "border-primary bg-primary/10" : "border-border"}`}
            >
              <input
                type="radio"
                name="role"
                checked={role === value}
                onChange={() => setRole(value)}
                className="accent-[var(--primary)]"
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
      {ready && (
        <GoogleLoginButton
          onSuccess={code => google.mutate({ code, role })}
          onError={() =>
            setGoogleError(
              "Google sign-up could not complete. You can use email below."
            )
          }
          disabled={busy}
        />
      )}
      <form
        className="space-y-4"
        onSubmit={e => {
          e.preventDefault();
          register.mutate({
            name: name.trim(),
            email: email.trim(),
            password,
            role,
          });
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="name">Full name</Label>
          <Input
            id="name"
            autoComplete="name"
            required
            value={name}
            onChange={e => setName(e.target.value)}
            className="h-12 rounded-xl"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email address</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="h-12 rounded-xl"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Create a password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            maxLength={128}
            required
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="h-12 rounded-xl"
            aria-describedby="password-hint"
          />
          <p id="password-hint" className="text-xs text-muted-foreground">
            At least 8 characters. A longer passphrase is easier to remember.
          </p>
        </div>
        {(register.error || google.error || googleError) && (
          <p role="alert" className="text-sm text-destructive">
            {register.error?.message || google.error?.message || googleError}
          </p>
        )}
        <Button
          disabled={busy}
          type="submit"
          className="w-full h-12 rounded-xl font-semibold"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              Create account <ArrowRight className="h-4 w-4 ml-2" />
            </>
          )}
        </Button>
      </form>
      <p className="text-sm text-center mt-6 text-muted-foreground">
        Already have an account?{" "}
        <Link
          href="/login"
          className="text-foreground underline underline-offset-4"
        >
          Sign in
        </Link>
      </p>
      <p className="text-xs text-center mt-4 text-muted-foreground">
        <Link
          href="/signup?role=supplier"
          className="underline underline-offset-4"
        >
          Register a supplier business
        </Link>
      </p>
    </AuthLayout>
  );
}
