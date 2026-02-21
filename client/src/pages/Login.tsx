import { useEffect, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Checkbox, Input, Label } from "@/components/ui";
import { PageShell } from "@/components/ui/ssot";
import { tokens } from "@/ui/tokens";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2, LogIn, Mail } from "lucide-react";
import { APP_VERSION } from "@/lib/version";

export default function Login() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const { user, loading: authLoading } = useAuth();

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: (data) => {
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

      // Redirect based on onboarding status
      if (!data.user.hasCompletedOnboarding) {
        setLocation("/complete-profile");
      } else {
        setLocation("/calendar");
      }

      setIsLoading(false);
    },
    onError: (error) => {
      toast.error(error.message || "Login failed. Please try again.");
      setIsLoading(false);
    },
  });

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
    <PageShell className="justify-center items-center px-4">
      <div className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center pb-6 border-none">
          <div className="mx-auto w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mb-4 border-2 border-primary/20 shadow-[0_0_15px_rgba(var(--primary-rgb),0.2)]">
            <LogIn className="w-8 h-8 text-primary" />
          </div>
          <CardTitle className="text-3xl font-bold tracking-tight text-foreground">Welcome Back</CardTitle>
          <CardDescription className="text-base font-medium">
            Sign in to your account to continue
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-4 h-5 w-5 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  variant="hero"
                  className="pl-10"
                  disabled={isLoading}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  variant="hero"
                  className="pr-10"
                  disabled={isLoading}
                  required
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
                onCheckedChange={(checked) => setRememberMe(checked === true)}
                disabled={isLoading}
              />
              <label
                htmlFor="remember"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
              >
                Remember me
              </label>
            </div>

            <Button
              type="submit"
              className={cn(tokens.button.hero, "mt-2")}
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
              <div className="relative flex justify-center text-[10px] font-bold tracking-widest uppercase">
                <span className="bg-background px-4 text-muted-foreground">
                  Don't have an account?
                </span>
              </div>
            </div>

            <Button
              type="button"
              className={cn(tokens.button.secondary, "w-full border border-white/5")}
              onClick={() => setLocation("/signup")}
              disabled={isLoading}
            >
              Create Account
            </Button>

            <Button
              type="button"
              className={cn(tokens.button.ghost, "w-full text-muted-foreground")}
              onClick={() => setLocation("/forgot-password")}
              disabled={isLoading}
            >
              Forgot password?
            </Button>
          </div>

          {/* Version Number */}
          <div className="mt-6 text-center">
            <span className="text-xs text-muted-foreground font-medium">v{APP_VERSION}</span>
          </div>
        </CardContent>
      </div>
    </PageShell>
  );
}

