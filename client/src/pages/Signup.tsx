import { useState } from "react";
import { useLocation } from "wouter";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label } from "@/components/ui";
import { PageShell } from "@/components/ui/ssot";
import { tokens } from "@/ui/tokens";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2, UserPlus, Mail, User } from "lucide-react";

export default function Signup() {
  const [, setLocation] = useLocation();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState<"artist" | "client">("artist");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const checkEmailMutation = trpc.auth.checkEmailExists.useMutation();

  const registerMutation = trpc.auth.register.useMutation({
    onSuccess: (data) => {
      // Store JWT token in localStorage
      localStorage.setItem("authToken", data.token);

      // Store user info
      localStorage.setItem("user", JSON.stringify(data.user));

      toast.success("Account created successfully!");

      // Redirect to calendar
      setLocation("/calendar");

      setIsLoading(false);
    },
    onError: (error) => {
      // Check if this is an "email exists" error
      if (error.data?.code === "CONFLICT" || error.message.includes("already exists")) {
        // Check if it's a funnel client
        checkEmailMutation.mutate(
          { email },
          {
            onSuccess: (result) => {
              if (result.exists && result.isFunnelClient) {
                // Redirect to set password page
                toast.info("You've already submitted a consultation! Let's set up your password.");
                setLocation(`/set-password?email=${encodeURIComponent(email)}&name=${encodeURIComponent(result.name || name)}`);
              } else if (result.exists) {
                // User has a password, suggest login
                toast.error("An account with this email already exists. Please sign in instead.");
              }
              setIsLoading(false);
            },
            onError: () => {
              toast.error("An account with this email already exists.");
              setIsLoading(false);
            },
          }
        );
      } else {
        toast.error(error.message || "Registration failed. Please try again.");
        setIsLoading(false);
      }
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name || !email || !password || !confirmPassword) {
      toast.error("Please fill in all fields");
      return;
    }

    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setIsLoading(true);

    // First check if email exists and is a funnel client
    checkEmailMutation.mutate(
      { email },
      {
        onSuccess: (result) => {
          if (result.exists && result.isFunnelClient) {
            // Redirect to set password page
            toast.info("You've already submitted a consultation! Let's set up your password.");
            setLocation(`/set-password?email=${encodeURIComponent(email)}&name=${encodeURIComponent(result.name || name)}`);
            setIsLoading(false);
          } else if (result.exists) {
            // User has a password, suggest login
            toast.error("An account with this email already exists. Please sign in instead.");
            setIsLoading(false);
          } else {
            // New user, proceed with registration
            registerMutation.mutate({ name, email, password, role });
          }
        },
        onError: () => {
          // If check fails, try to register anyway
          registerMutation.mutate({ name, email, password, role });
        },
      }
    );
  };

  return (
    <PageShell className="justify-center items-center px-4 py-8 overflow-y-auto mobile-scroll">
      <Card className={cn("w-full max-w-md bg-transparent border-none shadow-none overflow-hidden shrink-0 mt-auto mb-auto")}>
        <CardHeader className="space-y-1 text-center pb-6 border-none">
          <div className="mx-auto w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mb-4 border-2 border-primary/20 shadow-[0_0_15px_rgba(var(--primary-rgb),0.2)]">
            <UserPlus className="w-8 h-8 text-primary" />
          </div>
          <CardTitle className="text-3xl font-bold tracking-tight text-foreground">Create Account</CardTitle>
          <CardDescription className="text-base font-medium">
            Join us to book appointments and connect with artists
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <div className="relative">
                <User className="absolute left-3 top-4 h-5 w-5 text-muted-foreground" />
                <Input
                  id="name"
                  type="text"
                  placeholder="John Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  variant="hero"
                  className="pl-10"
                  disabled={isLoading}
                  required
                />
              </div>
            </div>

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
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  variant="hero"
                  className="pr-10"
                  disabled={isLoading}
                  required
                  minLength={8}
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

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Re-enter your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  variant="hero"
                  className="pr-10"
                  disabled={isLoading}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-4 text-muted-foreground hover:text-foreground outline-none"
                  disabled={isLoading}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-6 w-6" />
                  ) : (
                    <Eye className="h-6 w-6" />
                  )}
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <Label>I am a...</Label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setRole("artist")}
                  className={cn(
                    "p-4 rounded-xl border-2 transition-all outline-none",
                    role === "artist"
                      ? "border-primary bg-primary/10 shadow-[0_0_15px_rgba(var(--primary-rgb),0.15)]"
                      : "border-white/10 bg-white/5 hover:bg-white/10"
                  )}
                  disabled={isLoading}
                >
                  <div className="text-center">
                    <div className="text-2xl mb-1">🎨</div>
                    <div className="font-semibold text-foreground">Artist</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Manage bookings
                    </div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setRole("client")}
                  className={cn(
                    "p-4 rounded-xl border-2 transition-all outline-none",
                    role === "client"
                      ? "border-primary bg-primary/10 shadow-[0_0_15px_rgba(var(--primary-rgb),0.15)]"
                      : "border-white/10 bg-white/5 hover:bg-white/10"
                  )}
                  disabled={isLoading}
                >
                  <div className="text-center">
                    <div className="text-2xl mb-1">👤</div>
                    <div className="font-semibold text-foreground">Client</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Book appointments
                    </div>
                  </div>
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className={cn(tokens.button.hero, "mt-4")}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Creating account...
                </>
              ) : (
                "Create Account"
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
                  Already have an account?
                </span>
              </div>
            </div>

            <Button
              type="button"
              className={cn(tokens.button.secondary, "w-full border border-white/5")}
              onClick={() => setLocation("/login")}
              disabled={isLoading}
            >
              Sign In
            </Button>
          </div>

          <p className="mt-4 text-xs text-center text-muted-foreground">
            By creating an account, you agree to our Terms of Service and Privacy Policy
          </p>
        </CardContent>
      </Card>
    </PageShell>
  );
}
