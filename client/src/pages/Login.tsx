import { useEffect, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Checkbox,
  Input,
  Label,
} from "@/components/ui";
import { PageShell } from "@/components/ui/ssot";
import { tokens } from "@/ui/tokens";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2, LogIn, Mail } from "lucide-react";
import { APP_VERSION } from "@/lib/version";
import { useGoogleAuthReady } from "@/main";
import { GoogleLoginButton } from "@/components/auth/GoogleLoginButton";

export default function Login() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
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

  const handleGoogleSuccess = async (code: string) => {
    setIsLoading(true);
    try {
      const result = await googleLoginMutation.mutateAsync({ code });

      localStorage.removeItem("authToken");
      localStorage.removeItem("user");
      sessionStorage.removeItem("authToken");
      sessionStorage.removeItem("user");

      const storage = rememberMe ? localStorage : sessionStorage;
      storage.setItem("authToken", result.token);
      storage.setItem("user", JSON.stringify(result.user));

      if (result.isNewUser) {
        toast.success("Account created! Please complete your profile.");
        setLocation("/signup");
      } else {
        toast.success("Welcome back!");
        if (result.user.role === "studio") {
          setLocation("/studio");
        } else {
          setLocation("/calendar");
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
    <PageShell className="justify-center items-center px-4 py-8 overflow-y-auto mobile-scroll">
      <div className="w-full max-w-md shrink-0 mt-auto mb-auto">
        <CardHeader className="space-y-1 text-center pb-6 border-none flex flex-col items-center">
          <h1 className="text-7xl sm:text-8xl font-light text-white tracking-widest mb-2 w-full text-center">
            TATTOI
          </h1>
          <CardDescription className="text-[13px] font-light">
            REVENUE PROTECTION - FOR SERIOUS ARTISTS
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Google Sign-In — only rendered when provider is ready */}
          {isGoogleReady && (
            <GoogleLoginButton
              onSuccess={handleGoogleSuccess}
              onError={() => toast.error("Google sign-in was cancelled or failed.")}
              disabled={isLoading}
            />
          )}

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-white/10" />
            </div>
            <div className="relative flex justify-center text-[10px] font-bold tracking-widest uppercase">
              <span className="bg-background px-4 text-muted-foreground">
                {isGoogleReady ? "Or sign in with email" : "Sign in with email"}
              </span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" style={{ fontWeight: 300 }}>Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-4 h-5 w-5 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  variant="hero"
                  className="pl-10"
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
                  className="pr-10"
                  disabled={isLoading}
                  required
                  style={{ fontWeight: 300 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-4 text-muted-foreground hover:text-foreground outline-none"
                  disabled={isLoading}
                >
                  {showPassword ? (
                    <EyeOff className="h-6 w-6" />
                  ) : (
                    <Eye className="h-6 w-6" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="remember"
                checked={rememberMe}
                onCheckedChange={checked => setRememberMe(checked === true)}
                disabled={isLoading}
              />
              <label
                htmlFor="remember"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                style={{ fontWeight: 300 }}
              >
                Remember me
              </label>
            </div>

            <Button
              type="submit"
              className={cn(tokens.button.hero, "w-full mt-2 h-14 rounded-lg text-base")}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Signing in...
                </>
              ) : (
                "Sign In"
              )}
            </Button>
          </form>

          <div className="mt-8 space-y-4">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-white/10" />
              </div>
              <div className="relative flex justify-center text-[10px] tracking-widest uppercase" style={{ fontWeight: 300 }}>
                <span className="bg-background px-4 text-muted-foreground">
                  Don't have an account?
                </span>
              </div>
            </div>

            <Button
              type="button"
              onClick={() => setLocation("/signup")}
              disabled={isLoading}
              className={cn(
                tokens.button.secondary,
                "w-full border border-white/5 h-14 rounded-lg text-base"
              )}
            >
              Create Account
            </Button>

            <Button
              type="button"
              className={cn(
                tokens.button.hero,
                "w-full h-14 rounded-lg text-base"
              )}
              onClick={() => setLocation("/forgot-password")}
              disabled={isLoading}
            >
              Forgot password?
            </Button>
          </div>

          {/* Version Number */}
          <div className="mt-6 text-center">
            <span className="text-xs text-muted-foreground" style={{ fontWeight: 300 }}>
              v{APP_VERSION}
            </span>
          </div>
        </CardContent>
      </div>
    </PageShell>
  );
}
