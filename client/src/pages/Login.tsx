import { useEffect, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import {
  Button,
  Card,
  CardContent,
  Checkbox,
  Input,
  Label,
} from "@/components/ui";
import { tokens } from "@/ui/tokens";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2, Mail } from "lucide-react";
import { APP_VERSION } from "@/lib/version";
import { useGoogleAuthReady } from "@/lib/google-auth";
import { GoogleLoginButton } from "@/components/auth/GoogleLoginButton";

export default function Login() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [showOtherMethods, setShowOtherMethods] = useState(false);
  const { user, loading: authLoading } = useAuth();

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: data => {
      // Clear legacy/other storage first to avoid conflicts
      localStorage.removeItem("authToken");
      localStorage.removeItem("user");
      sessionStorage.removeItem("authToken");
      sessionStorage.removeItem("user");

      const storage = rememberMe ? localStorage : sessionStorage;

      // Store JWT token
      storage.setItem("authToken", data.token);

      // Store user info
      storage.setItem("user", JSON.stringify(data.user));

      toast.success("Welcome back!");

      // Redirect based on role
      if (data.user.role === "studio") {
        setLocation("/studio");
      } else if (data.user.role === "merchant") {
        setLocation("/dashboard");
      } else {
        setLocation("/calendar");
      }

      setIsLoading(false);
    },
    onError: error => {
      toast.error(error.message || "Login failed. Please try again.");
      setIsLoading(false);
    },
  });

  // --- Google Sign-In ---
  const isGoogleReady = useGoogleAuthReady();
  const googleLoginMutation = trpc.auth.googleLogin.useMutation();
  const utils = trpc.useUtils();

  const handleGoogleSuccess = async (code: string) => {
    setIsLoading(true);
    try {
      const result = await googleLoginMutation.mutateAsync({
        code,
        // Any new user created here is assumed to be an artist.
        // Existing users (clients or artists) will simply log in, ignoring this flag.
        role: "artist",
      });

      localStorage.removeItem("authToken");
      localStorage.removeItem("user");
      sessionStorage.removeItem("authToken");
      sessionStorage.removeItem("user");

      const storage = rememberMe ? localStorage : sessionStorage;
      storage.setItem("authToken", result.token);
      storage.setItem("user", JSON.stringify(result.user));

      // Invalidate the auth.me cache so the new token is used
      await utils.auth.me.invalidate();

      if (result.isNewUser) {
        toast.success("Welcome to Tattoi! Let's get you set up.");
        window.location.href = "/calendar";
      } else {
        toast.success("Welcome back!");
        if (result.user.role === "studio") {
          window.location.href = "/studio";
        } else {
          window.location.href = "/calendar";
        }
      }
    } catch (err: any) {
      toast.error(err?.message || "Google sign-in failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password) {
      toast.error("Please fill in all fields");
      return;
    }

    setIsLoading(true);
    loginMutation.mutate({ email, password });
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        background: "#ffffff",
      }}
    >
      {/* Background image — fills the screen, logo centered upper area */}
      <div
        style={{
          flex: 1,
          backgroundImage: "url(/tattoi-login-bg.png)",
          backgroundSize: "contain",
          backgroundPosition: "center 30%",
          backgroundRepeat: "no-repeat",
        }}
      />

      {/* Bottom action area — pinned to bottom */}
      <div
        style={{
          padding: "0 32px",
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 40px)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 12,
        }}
      >
        {/* Other methods panel — slides in when toggled */}
        {showOtherMethods && (
          <div
            style={{
              width: "100%",
              maxWidth: 400,
              marginBottom: 8,
            }}
          >
            <Card className="border-0 shadow-none bg-transparent p-0">
              <CardContent className="p-0 space-y-4">
                <form onSubmit={handleSubmit} className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="email" style={{ fontWeight: 300 }}>Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="you@example.com"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        variant="hero"
                        className="pl-10 h-11"
                        disabled={isLoading}
                        required
                        style={{ fontWeight: 300 }}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password" style={{ fontWeight: 300 }}>Password</Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        variant="hero"
                        className="pr-10 h-11"
                        disabled={isLoading}
                        required
                        style={{ fontWeight: 300 }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-3.5 text-muted-foreground hover:text-foreground outline-none"
                        disabled={isLoading}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="remember"
                        checked={rememberMe}
                        onCheckedChange={checked => setRememberMe(checked === true)}
                        disabled={isLoading}
                      />
                      <label
                        htmlFor="remember"
                        className="text-sm leading-none cursor-pointer text-muted-foreground"
                        style={{ fontWeight: 300 }}
                      >
                        Remember me
                      </label>
                    </div>
                    <button
                      type="button"
                      onClick={() => setLocation("/forgot-password")}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                      style={{ fontWeight: 300 }}
                    >
                      Forgot password?
                    </button>
                  </div>

                  <Button
                    type="submit"
                    className={cn(tokens.button.auth, "w-full h-12 rounded-full")}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Signing in...
                      </>
                    ) : (
                      "Sign In"
                    )}
                  </Button>
                </form>

                <div className="flex justify-center gap-1 text-sm text-muted-foreground" style={{ fontWeight: 300 }}>
                  <span>Don't have an account?</span>
                  <button
                    onClick={() => setLocation("/signup?role=client")}
                    className="text-primary font-medium hover:underline"
                  >
                    Sign up
                  </button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Google Sign-In — primary CTA */}
        {isGoogleReady && (
          <div style={{ width: "100%", maxWidth: 400 }}>
            <GoogleLoginButton
              onSuccess={handleGoogleSuccess}
              onError={() => toast.error("Google sign-in was cancelled or failed.")}
              disabled={isLoading}
            />
          </div>
        )}

        {/* Other sign-in options toggle */}
        <button
          onClick={() => setShowOtherMethods(!showOtherMethods)}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          style={{ fontWeight: 300 }}
        >
          {showOtherMethods ? "Hide other options" : "Other sign-in options"}
        </button>

        {/* Version */}
        <span
          className="text-xs text-muted-foreground/50"
          style={{ fontWeight: 300 }}
        >
          v{APP_VERSION}
        </span>
      </div>
    </div>
  );
}
