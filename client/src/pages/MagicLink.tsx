import { Link, useSearch } from "wouter";
import { trpc } from "@/lib/trpc";
import { finishSignIn } from "@/lib/auth-session";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { Button } from "@/components/ui";
export default function MagicLink() {
  const token = new URLSearchParams(useSearch()).get("token");
  const verify = trpc.auth.verifyMagicLink.useMutation({
    onSuccess: data => finishSignIn(data),
  });
  return (
    <AuthLayout
      title="Sign in securely"
      description="Use your email link to continue to your account."
    >
      {token ? (
        <Button
          className="w-full h-12"
          disabled={verify.isPending}
          onClick={() => verify.mutate({ token })}
        >
          {verify.isPending ? "Signing in…" : "Continue to my account"}
        </Button>
      ) : (
        <p role="alert">This sign-in link is incomplete.</p>
      )}
      {verify.error && (
        <p role="alert" className="mt-4 text-destructive">
          {verify.error.message}
        </p>
      )}
      <Link href="/login" className="block mt-5 underline text-center">
        Back to sign in
      </Link>
    </AuthLayout>
  );
}
