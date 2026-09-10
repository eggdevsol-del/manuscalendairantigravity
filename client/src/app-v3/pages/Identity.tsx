import { useId, useState, type ReactNode } from "react";
import { Link, Redirect, useSearch } from "wouter";
import { Eye, EyeOff } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { finishSignIn } from "@/lib/auth-session";
import { useGoogleAuthReady } from "@/lib/google-auth";
import { GoogleLoginButton } from "@/components/auth/GoogleLoginButton";
import {
  Action,
  ActionLink,
  Feedback,
  Panel,
  Screen,
  Status,
} from "../design/primitives";
function IdentityLayout({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Screen
      title={title}
      subtitle={description}
      action={
        <ActionLink href="/signup?role=artist" tone="quiet">
          For artists
        </ActionLink>
      }
    >
      <div className="v3-identity-grid">
        <div className="v3-identity-form">
          <Panel>{children}</Panel>
        </div>
        <aside className="v3-identity-aside">
          <p className="v3-eyebrow">THE BUSINESS OF TATTOOING, SIMPLIFIED</p>
          <h2>
            More time
            <br />
            for your craft.
          </h2>
          <p>
            Enquiries, appointments, conversations and payments. Together, so
            the details take care of less of your day.
          </p>
          <div className="v3-divider" />
          <p className="v3-muted">
            For clients, your booking stays close: your artist, your dates and
            your next step.
          </p>
        </aside>
      </div>
    </Screen>
  );
}
function Password({
  label,
  value,
  onChange,
  fresh = false,
}: {
  label: string;
  value: string;
  onChange: (s: string) => void;
  fresh?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  const id = useId();
  return (
    <div className="v3-password">
      <label htmlFor={id}>{label}</label>
      <div>
        <input
          id={id}
          type={visible ? "text" : "password"}
          required
          minLength={fresh ? 8 : undefined}
          maxLength={128}
          autoComplete={fresh ? "new-password" : "current-password"}
          value={value}
          onChange={e => onChange(e.target.value)}
        />
        <button
          type="button"
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          onClick={() => setVisible(!visible)}
        >
          {visible ? <EyeOff size={20} /> : <Eye size={20} />}
        </button>
      </div>
      {fresh && <small>At least 8 characters.</small>}
    </div>
  );
}
export function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [googleError, setGoogleError] = useState("");
  const login = trpc.auth.login.useMutation({
    onSuccess: data => finishSignIn(data, remember),
  });
  const google = trpc.auth.googleLogin.useMutation({
    onSuccess: data => finishSignIn(data, remember),
  });
  const ready = useGoogleAuthReady();
  const busy = login.isPending || google.isPending;
  const error = login.error?.message || google.error?.message || googleError;
  return (
    <IdentityLayout
      title="Welcome back"
      description="Your work. Your people. Right where you left them."
    >
      {ready && (
        <GoogleLoginButton
          disabled={busy}
          onSuccess={code => google.mutate({ code, role: "client" })}
          onError={() =>
            setGoogleError(
              "Google sign-in could not complete. Try again or use email."
            )
          }
        />
      )}
      <form
        className="v3-form"
        onSubmit={e => {
          e.preventDefault();
          login.mutate({ email: email.trim(), password });
        }}
      >
        <fieldset disabled={busy}>
          <label>
            Email address
            <input
              type="email"
              required
              autoComplete="email"
              autoCapitalize="none"
              value={email}
              onChange={e => {
                login.reset();
                setEmail(e.target.value);
              }}
            />
          </label>
          <Password label="Password" value={password} onChange={setPassword} />
          <ActionLink href="/forgot-password" tone="quiet">
            Forgot password?
          </ActionLink>
          <div className="v3-check-list">
            <label>
              <input
                type="checkbox"
                checked={remember}
                onChange={e => setRemember(e.target.checked)}
              />
              Keep me signed in
            </label>
          </div>
          {error && <p role="alert">{error}</p>}
          <Action type="submit">{busy ? "Signing in…" : "Sign in"}</Action>
        </fieldset>
      </form>
      <p className="v3-muted">
        New to Tattoi?{" "}
        <Link className="v3-text-link" href="/signup">
          Create an account
        </Link>
      </p>
    </IdentityLayout>
  );
}
export function Signup() {
  const params = new URLSearchParams(useSearch());
  const role =
    params.get("role") === "artist"
      ? "artist"
      : ["supplier", "merchant"].includes(params.get("role") || "")
        ? "supplier"
        : "client";
  return <SignupForm key={role} role={role} />;
}
function SignupForm({ role }: { role: "client" | "artist" | "supplier" }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [country, setCountry] = useState<"AU" | "NZ">("AU");
  const [googleError, setGoogleError] = useState("");
  const ready = useGoogleAuthReady();
  const register = trpc.auth.register.useMutation({
    onSuccess: data => finishSignIn(data),
  });
  const merchant = trpc.merchantAuth.register.useMutation({
    onSuccess: data =>
      finishSignIn({ token: data.token, user: { role: "merchant" } }),
  });
  const google = trpc.auth.googleLogin.useMutation({
    onSuccess: data => finishSignIn(data),
  });
  const busy = register.isPending || merchant.isPending || google.isPending;
  const error =
    register.error?.message ||
    merchant.error?.message ||
    google.error?.message ||
    googleError;
  return (
    <IdentityLayout
      title={
        role === "artist"
          ? "Make room for your craft"
          : role === "supplier"
            ? "Supply the craft"
            : "Your booking, together"
      }
      description={
        role === "artist"
          ? "Start with your account. Set up the details as you go."
          : role === "supplier"
            ? "Manage your products, orders and artist customers."
            : "Keep your artist, messages and appointments in one place."
      }
    >
      <nav className="v3-identity-roles" aria-label="Account type">
        {(
          [
            ["client", "Client"],
            ["artist", "Artist"],
            ["supplier", "Supplier"],
          ] as const
        ).map(([value, label]) => (
          <Link
            key={value}
            href={`/signup?role=${value}`}
            aria-current={role === value ? "page" : undefined}
          >
            {label}
          </Link>
        ))}
      </nav>
      {role === "client" && (
        <p className="v3-muted">
          Have your artist’s booking link? You can send your request there first
          and create your password afterwards.
        </p>
      )}
      {ready && role !== "supplier" && (
        <GoogleLoginButton
          disabled={busy}
          onSuccess={code => google.mutate({ code, role })}
          onError={() =>
            setGoogleError(
              "Google sign-up could not complete. You can use email below."
            )
          }
        />
      )}
      <form
        className="v3-form"
        onSubmit={e => {
          e.preventDefault();
          if (role === "supplier")
            merchant.mutate({
              name: name.trim(),
              email: email.trim(),
              password,
              businessName: businessName.trim(),
              country,
            });
          else
            register.mutate({
              name: name.trim(),
              email: email.trim(),
              password,
              role,
            });
        }}
      >
        <fieldset disabled={busy}>
          <label>
            Full name
            <input
              required
              maxLength={100}
              autoComplete="name"
              value={name}
              onChange={e => setName(e.target.value)}
            />
          </label>
          <label>
            Email address
            <input
              required
              type="email"
              autoCapitalize="none"
              autoComplete="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </label>
          {role === "supplier" && (
            <>
              <label>
                Business name
                <input
                  required
                  maxLength={255}
                  autoComplete="organization"
                  value={businessName}
                  onChange={e => setBusinessName(e.target.value)}
                />
              </label>
              <label>
                Business country
                <select
                  aria-label="Business country"
                  value={country}
                  onChange={e => setCountry(e.target.value as typeof country)}
                >
                  <option value="AU">Australia</option>
                  <option value="NZ">New Zealand</option>
                </select>
              </label>
            </>
          )}
          <Password
            label="Create password"
            fresh
            value={password}
            onChange={setPassword}
          />
          {error && <p role="alert">{error}</p>}
          <Action type="submit">
            {busy ? "Creating account…" : "Create account"}
          </Action>
        </fieldset>
      </form>
      <p className="v3-muted">
        Already have an account?{" "}
        <Link className="v3-text-link" href="/login">
          Sign in
        </Link>
      </p>
    </IdentityLayout>
  );
}
export function PasswordRecovery() {
  const params = new URLSearchParams(useSearch());
  const token = params.get("token");
  const [email, setEmail] = useState(params.get("email") || "");
  const [password, setPassword] = useState("");
  const request = trpc.auth.requestPasswordReset.useMutation();
  const reset = trpc.auth.resetPassword.useMutation();
  const done = token ? reset.isSuccess : request.isSuccess;
  const busy = request.isPending || reset.isPending;
  return (
    <IdentityLayout
      title={
        done
          ? token
            ? "Password updated"
            : "Check your inbox"
          : token
            ? "Choose a new password"
            : "Let’s get you back in"
      }
      description={
        done
          ? token
            ? "Your new password is ready to use."
            : "If your email is registered, you’ll receive a reset link."
          : token
            ? "This link can only be used once."
            : "We’ll email you a secure link to reset your password."
      }
    >
      {done ? (
        <>
          <Status tone="success">
            {token ? "Password saved" : "Request received"}
          </Status>
          <ActionLink href="/login" tone="primary">
            Back to sign in
          </ActionLink>
        </>
      ) : (
        <form
          className="v3-form"
          onSubmit={e => {
            e.preventDefault();
            if (token) reset.mutate({ token, newPassword: password });
            else request.mutate({ email: email.trim() });
          }}
        >
          <fieldset disabled={busy}>
            {token ? (
              <Password
                label="New password"
                fresh
                value={password}
                onChange={setPassword}
              />
            ) : (
              <label>
                Email address
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                />
              </label>
            )}
            {(request.error || reset.error) && (
              <p role="alert">{(request.error || reset.error)?.message}</p>
            )}
            <Action type="submit">
              {busy
                ? "Submitting…"
                : token
                  ? "Save new password"
                  : "Send reset link"}
            </Action>
          </fieldset>
          <ActionLink href={token ? "/forgot-password" : "/login"} tone="quiet">
            {token ? "Request a new link" : "Back to sign in"}
          </ActionLink>
        </form>
      )}
    </IdentityLayout>
  );
}
export function MagicLink() {
  const token = new URLSearchParams(useSearch()).get("token");
  const verify = trpc.auth.verifyMagicLink.useMutation({
    onSuccess: data => finishSignIn(data),
  });
  return (
    <IdentityLayout
      title="Your secure sign-in link"
      description="Continue to your Tattoi account."
    >
      {token ? (
        <Action
          disabled={verify.isPending}
          onClick={() => verify.mutate({ token })}
        >
          {verify.isPending ? "Signing in…" : "Continue to my account"}
        </Action>
      ) : (
        <p role="alert">This sign-in link is incomplete.</p>
      )}
      {verify.error && <p role="alert">{verify.error.message}</p>}
      <ActionLink href="/login" tone="quiet">
        Back to sign in
      </ActionLink>
    </IdentityLayout>
  );
}
export function CompleteProfile() {
  const { user, loading, error } = useAuth();
  if (loading)
    return (
      <IdentityLayout title="Your details" description="Loading your account…">
        <Feedback loading />
      </IdentityLayout>
    );
  if (!user) return <Redirect to="/login" />;
  return <CompleteProfileForm key={user.id} user={user} />;
}
function CompleteProfileForm({
  user,
}: {
  user: NonNullable<ReturnType<typeof useAuth>["user"]>;
}) {
  const [name, setName] = useState(user.name || "");
  const [phone, setPhone] = useState(user.phone || "");
  const [birthday, setBirthday] = useState(user.birthday?.slice(0, 10) || "");
  const utils = trpc.useUtils();
  const save = trpc.auth.updateProfile.useMutation({
    onSuccess: async () => {
      await utils.auth.me.invalidate();
      window.location.assign(
        user.role === "client" ? "/bookings" : "/dashboard"
      );
    },
  });
  return (
    <IdentityLayout
      title="A few details"
      description="Help your artist keep your booking details together."
    >
      <form
        className="v3-form"
        onSubmit={e => {
          e.preventDefault();
          save.mutate({
            name: name.trim(),
            phone: phone.trim(),
            birthday: birthday || undefined,
          });
        }}
      >
        <fieldset disabled={save.isPending}>
          <label>
            Full name
            <input
              required
              maxLength={100}
              autoComplete="name"
              value={name}
              onChange={e => setName(e.target.value)}
            />
          </label>
          <label>
            Phone
            <input
              required
              type="tel"
              autoComplete="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
            />
          </label>
          <label>
            Date of birth (optional)
            <input
              type="date"
              value={birthday}
              max={new Date().toISOString().slice(0, 10)}
              onChange={e => setBirthday(e.target.value)}
            />
          </label>
          {save.error && <p role="alert">{save.error.message}</p>}
          <Action type="submit">
            {save.isPending ? "Saving…" : "Save and continue"}
          </Action>
        </fieldset>
      </form>
    </IdentityLayout>
  );
}
