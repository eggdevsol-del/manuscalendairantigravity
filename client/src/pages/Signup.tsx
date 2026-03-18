import { useState } from "react";
import { useLocation } from "wouter";
import {
  Button,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
} from "@/components/ui";
import { PageShell } from "@/components/ui/ssot";
import { tokens } from "@/ui/tokens";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2, UserPlus, Mail, User, Phone, CalendarDays } from "lucide-react";

export default function Signup() {
  const [, setLocation] = useLocation();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [birthday, setBirthday] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const checkEmailMutation = trpc.auth.checkEmailExists.useMutation();

  const registerMutation = trpc.auth.register.useMutation({
    onSuccess: data => {
      localStorage.setItem("authToken", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      toast.success("Account created! Welcome to TATTOI.");
      setLocation("/calendar");
      setIsLoading(false);
    },
    onError: error => {
      if (
        error.data?.code === "CONFLICT" ||
        error.message.includes("already exists")
      ) {
        checkEmailMutation.mutate(
          { email },
          {
            onSuccess: result => {
              if (result.exists && result.isFunnelClient) {
                toast.info(
                  "Looks like you've already been in touch with your artist. Let's set up your password."
                );
                setLocation(
                  `/set-password?email=${encodeURIComponent(email)}&name=${encodeURIComponent(result.name || name)}`
                );
              } else if (result.exists) {
                toast.error(
                  "An account with this email already exists. Try signing in instead."
                );
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
      toast.error("Please fill in all required fields");
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

    checkEmailMutation.mutate(
      { email },
      {
        onSuccess: result => {
          if (result.exists && result.isFunnelClient) {
            toast.info(
              "Looks like you've already been in touch with your artist. Let's set up your password."
            );
            setLocation(
              `/set-password?email=${encodeURIComponent(email)}&name=${encodeURIComponent(result.name || name)}`
            );
            setIsLoading(false);
          } else if (result.exists) {
            toast.error(
              "An account with this email already exists. Try signing in instead."
            );
            setIsLoading(false);
          } else {
            registerMutation.mutate({
              name,
              email,
              password,
              role: "client",
              ...(phone ? { phone } : {}),
              ...(birthday ? { birthday } : {}),
            });
          }
        },
        onError: () => {
          registerMutation.mutate({
            name,
            email,
            password,
            role: "client",
            ...(phone ? { phone } : {}),
            ...(birthday ? { birthday } : {}),
          });
        },
      }
    );
  };

  return (
    <PageShell className="justify-center items-center px-4 py-8 overflow-y-auto mobile-scroll">
      <div className="w-full max-w-md shrink-0 mt-auto mb-auto">
        <CardHeader className="space-y-1 text-center pb-6 border-none">
          <div className="mx-auto w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mb-4 border-2 border-primary/20 shadow-[0_0_15px_rgba(var(--primary-rgb),0.2)]">
            <UserPlus className="w-8 h-8 text-primary" />
          </div>
          <CardTitle className="text-3xl font-bold tracking-tight text-foreground">
            Create Account
          </CardTitle>
          <CardDescription className="text-base font-medium">
            Sign up to book appointments and stay connected with your artist
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Full Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Full Name <span className="text-red-400">*</span></Label>
              <div className="relative">
                <User className="absolute left-3 top-4 h-5 w-5 text-muted-foreground" />
                <Input
                  id="name"
                  type="text"
                  placeholder="John Doe"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  variant="hero"
                  className="pl-10"
                  disabled={isLoading}
                  required
                />
              </div>
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email">Email <span className="text-red-400">*</span></Label>
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
                />
              </div>
            </div>

            {/* Phone */}
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-4 h-5 w-5 text-muted-foreground" />
                <Input
                  id="phone"
                  type="tel"
                  placeholder="04XX XXX XXX"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  variant="hero"
                  className="pl-10"
                  disabled={isLoading}
                />
              </div>
              <p className="text-[11px] text-muted-foreground/70">
                So your artist can send you appointment reminders
              </p>
            </div>

            {/* Birthday */}
            <div className="space-y-2">
              <Label htmlFor="birthday">Date of Birth</Label>
              <div className="relative">
                <CalendarDays className="absolute left-3 top-4 h-5 w-5 text-muted-foreground" />
                <Input
                  id="birthday"
                  type="date"
                  value={birthday}
                  onChange={e => setBirthday(e.target.value)}
                  variant="hero"
                  className="pl-10"
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-2">
              <Label htmlFor="password">Password <span className="text-red-400">*</span></Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
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

            {/* Confirm Password */}
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password <span className="text-red-400">*</span></Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Re-enter your password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
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
              className={cn(
                tokens.button.secondary,
                "w-full border border-white/5"
              )}
              onClick={() => setLocation("/login")}
              disabled={isLoading}
            >
              Sign In
            </Button>
          </div>

          <p className="mt-4 text-xs text-center text-muted-foreground">
            By creating an account, you agree to our Terms of Service and
            Privacy Policy
          </p>
        </CardContent>
      </div>
    </PageShell>
  );
}
