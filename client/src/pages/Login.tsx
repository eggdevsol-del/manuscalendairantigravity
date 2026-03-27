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
import { useGoogleLogin } from "@react-oauth/google";

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

  // --- Google Sign-In (Auth Code flow — secret stays on backend) ---
  const googleLoginMutation = trpc.auth.googleLogin.useMutation();

  const googleLogin = useGoogleLogin({
    flow: "auth-code",
    onSuccess: async codeResponse => {
      setIsLoading(true);
      try {
        const result = await googleLoginMutation.mutateAsync({
          code: codeResponse.code,
        });

        // Clear legacy/other storage first
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
    },
    onError: () => {
      toast.error("Google sign-in was cancelled or failed.");
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
        <CardHeader className="space-y-1 text-center pb-6 border-none flex flex-col items-center">
          <h1 className="text-8xl font-light text-white tracking-widest mb-2" style={{ width: '326.0625px', transform: 'translate(2px, 4px)' }}>
            TATTOI
          </h1>
          <CardDescription className="text-base" style={{ fontSize: '13px', fontWeight: 300 }}>
            REVENUE PROTECTION - FOR SERIOUS ARTISTS
          </CardDescription>
        </CardHeader>
        <CardContent style={{ transform: 'translate(0px, -2px)' }}>
          {/* Google Sign-In */}
          <Button
            type="button"
            variant="outline"
            className="w-full mb-6 h-12 rounded-xl border-white/10 bg-white/5 hover:bg-white/10 text-foreground font-medium flex items-center justify-center gap-3 transition-all"
            onClick={() => googleLogin()}
            disabled={isLoading}
            style={{ borderRadius: '6px' }}
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Continue with Google
          </Button>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-white/10" />
            </div>
            <div className="relative flex justify-center text-[10px] font-bold tracking-widest uppercase">
              <span className="bg-background px-4 text-muted-foreground">
                Or sign in with email
              </span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4" style={{ transform: 'translate(1px, 3px)' }}>
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
              className={cn(tokens.button.hero, "mt-2")}
              disabled={isLoading}
              style={{ borderRadius: '6px', width: '310px', height: '56px' }}
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
              className={cn(
                tokens.button.secondary,
                "w-full border border-white/5"
              )}
              onClick={() => setLocation("/signup")}
              disabled={isLoading}
              style={{ borderRadius: '6px' }}
            >
              Create Account
            </Button>

            <Button
              type="button"
              className={cn(
                tokens.button.ghost,
                "w-full text-muted-foreground"
              )}
              onClick={() => setLocation("/forgot-password")}
              disabled={isLoading}
              style={{ borderRadius: '6px', color: '#ffffff', zIndex: 999 }}
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
