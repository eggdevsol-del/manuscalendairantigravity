import { useState } from "react";
import { Link } from "wouter";
import { Eye, EyeOff, Loader2, ArrowRight } from "lucide-react";
import { Button, Input, Label } from "@/components/ui";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { GoogleLoginButton } from "@/components/auth/GoogleLoginButton";
import { useGoogleAuthReady } from "@/lib/google-auth";
import { finishSignIn } from "@/lib/auth-session";
import { trpc } from "@/lib/trpc";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [remember, setRemember] = useState(true);
  const [googleError, setGoogleError] = useState("");
  const login = trpc.auth.login.useMutation({
    onSuccess: data => finishSignIn(data, remember),
  });
  const google = trpc.auth.googleLogin.useMutation({
    onSuccess: data => finishSignIn(data, remember),
  });
  const googleReady = useGoogleAuthReady();
  const busy = login.isPending || google.isPending;
  const error = login.error?.message || google.error?.message || googleError;
  return (
    <AuthLayout
      title="Welcome back"
      description="Sign in to pick up where you left off."
    >
      {googleReady && (
        <>
          <GoogleLoginButton
            onSuccess={code => google.mutate({ code, role: "client" })}
            onError={() =>
              setGoogleError(
                "Google sign-in could not complete. Try again or use email."
              )
            }
            disabled={busy}
          />
          <div className="flex items-center gap-3 mb-6 text-xs text-muted-foreground">
            <span className="h-px bg-border flex-1" />
            or use your email
            <span className="h-px bg-border flex-1" />
          </div>
        </>
      )}
      <form
        onSubmit={e => {
          e.preventDefault();
          login.mutate({ email: email.trim(), password });
        }}
        className="space-y-5"
      >
        <div className="space-y-2">
          <Label htmlFor="email">Email address</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="h-12 rounded-xl"
            placeholder="you@example.com"
          />
        </div>
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <Label htmlFor="password">Password</Label>
            <Link
              href="/forgot-password"
              className="text-sm underline underline-offset-4 py-2"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Input
              id="password"
              name="password"
              type={visible ? "text" : "password"}
              autoComplete="current-password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="h-12 rounded-xl pr-12"
            />
            <button
              type="button"
              aria-label={visible ? "Hide password" : "Show password"}
              aria-pressed={visible}
              onClick={() => setVisible(!visible)}
              className="absolute right-0 top-0 h-12 w-12 flex items-center justify-center"
            >
              {visible ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
        <label className="flex items-center gap-3 min-h-11 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={remember}
            onChange={e => setRemember(e.target.checked)}
            className="h-4 w-4 accent-[var(--primary)]"
          />
          Keep me signed in
        </label>
        {error && (
          <p
            role="alert"
            className="text-sm text-destructive bg-destructive/10 p-3 rounded-xl"
          >
            {error}
          </p>
        )}
        <Button
          type="submit"
          disabled={busy}
          className="w-full h-12 rounded-xl font-semibold"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              Sign in <ArrowRight className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>
      </form>
      <p className="text-sm text-muted-foreground text-center mt-7">
        New here?{" "}
        <Link
          href="/signup?role=client"
          className="text-foreground font-semibold underline underline-offset-4"
        >
          Create an account
        </Link>
      </p>
    </AuthLayout>
  );
}
