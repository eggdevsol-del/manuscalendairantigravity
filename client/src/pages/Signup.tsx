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
import {
  Eye,
  EyeOff,
  Loader2,
  UserPlus,
  Mail,
  User,
  Phone,
  CalendarDays,
  MapPin,
  Globe,
} from "lucide-react";
import { useGoogleLogin } from "@react-oauth/google";

type Step = "form" | "complete-profile";

export default function Signup() {
  const [, setLocation] = useLocation();

  // Form step (form = normal signup, complete-profile = after Google OAuth)
  const [step, setStep] = useState<Step>("form");

  // User fields
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [birthday, setBirthday] = useState("");
  const [gender, setGender] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Referral artist ID from SMS invite link (?ref=user_xxx)
  const [referralArtistId] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("ref") || undefined;
  });

  // Google OAuth state — stored so we can update profile after completion
  const [googleToken, setGoogleToken] = useState<string | null>(null);

  const checkEmailMutation = trpc.auth.checkEmailExists.useMutation();
  const updateProfileMutation = trpc.auth.updateProfile.useMutation();
  const googleLoginMutation = trpc.auth.googleLogin.useMutation();

  const registerMutation = trpc.auth.register.useMutation({
    onSuccess: data => {
      localStorage.setItem("authToken", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      toast.success("Account created! Welcome to CalendAIr.");
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

  // --- Google Sign-In ---
  const googleLogin = useGoogleLogin({
    onSuccess: async tokenResponse => {
      setIsLoading(true);
      try {
        // Exchange access token for ID token info
        const userInfoRes = await fetch(
          "https://www.googleapis.com/oauth2/v3/userinfo",
          {
            headers: {
              Authorization: `Bearer ${tokenResponse.access_token}`,
            },
          }
        );
        const userInfo = await userInfoRes.json();

        // Use access token as credential for our backend
        // Our backend will verify via Google tokeninfo
        const result = await googleLoginMutation.mutateAsync({
          credential: tokenResponse.access_token,
        });

        // Store auth immediately so profile update works
        localStorage.setItem("authToken", result.token);
        localStorage.setItem("user", JSON.stringify(result.user));
        setGoogleToken(result.token);

        if (result.isNewUser) {
          // Pre-fill name from Google
          setName(userInfo.name || result.user.name || "");
          setEmail(userInfo.email || result.user.email || "");
          setStep("complete-profile");
          toast.success("Google account linked! Please complete your profile.");
        } else {
          // Existing user — go straight into the app
          toast.success("Welcome back!");
          setLocation("/calendar");
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

  // --- Email/Password Submit ---
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
              ...(gender ? { gender: gender as any } : {}),
              ...(city ? { city } : {}),
              ...(country ? { country } : {}),
              ...(referralArtistId ? { referralArtistId } : {}),
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
            ...(gender ? { gender: gender as any } : {}),
            ...(city ? { city } : {}),
            ...(country ? { country } : {}),
            ...(referralArtistId ? { referralArtistId } : {}),
          });
        },
      }
    );
  };

  // --- Complete Profile (Post-Google) ---
  const handleCompleteProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await updateProfileMutation.mutateAsync({
        ...(phone ? { phone } : {}),
        ...(birthday ? { birthday } : {}),
        ...(city ? { city } : {}),
        ...(name ? { name } : {}),
      });

      toast.success("Profile complete! Let's get started.");
      setLocation("/calendar");
    } catch (err: any) {
      toast.error(err?.message || "Failed to update profile. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // ------- STEP: COMPLETE PROFILE (post-Google OAuth) -------
  if (step === "complete-profile") {
    return (
      <PageShell className="justify-center items-center px-4 py-8 overflow-y-auto mobile-scroll">
        <div className="w-full max-w-md shrink-0 mt-auto mb-auto">
          <CardHeader className="space-y-1 text-center pb-6 border-none">
            <div className="mx-auto w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mb-4 border-2 border-primary/20 shadow-[0_0_15px_rgba(var(--primary-rgb),0.2)]">
              <UserPlus className="w-8 h-8 text-primary" />
            </div>
            <CardTitle className="text-2xl font-bold tracking-tight text-foreground">
              Complete Your Profile
            </CardTitle>
            <CardDescription className="text-sm font-medium">
              A few more details so your artist can keep in touch
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCompleteProfile} className="space-y-4">
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
                  For appointment reminders via SMS
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

              {/* Gender */}
              <div className="space-y-2">
                <Label>Gender</Label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: "male", label: "Male" },
                    { value: "female", label: "Female" },
                    { value: "other", label: "Other" },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setGender(opt.value)}
                      className={cn(
                        "py-2.5 px-3 rounded-xl border-2 text-sm font-medium transition-all outline-none",
                        gender === opt.value
                          ? "border-primary bg-primary/10 text-primary shadow-[0_0_10px_rgba(var(--primary-rgb),0.15)]"
                          : "border-white/10 bg-white/5 text-foreground hover:bg-white/10"
                      )}
                      disabled={isLoading}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* City & Country */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-4 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="city"
                      type="text"
                      placeholder="Auckland"
                      value={city}
                      onChange={e => setCity(e.target.value)}
                      variant="hero"
                      className="pl-9"
                      disabled={isLoading}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="country">Country</Label>
                  <div className="relative">
                    <Globe className="absolute left-3 top-4 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="country"
                      type="text"
                      placeholder="New Zealand"
                      value={country}
                      onChange={e => setCountry(e.target.value)}
                      variant="hero"
                      className="pl-9"
                      disabled={isLoading}
                    />
                  </div>
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
                    Saving...
                  </>
                ) : (
                  "Continue"
                )}
              </Button>

              <button
                type="button"
                onClick={() => setLocation("/calendar")}
                className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors mt-2"
              >
                Skip for now
              </button>
            </form>
          </CardContent>
        </div>
      </PageShell>
    );
  }

  // ------- STEP: MAIN SIGNUP FORM -------
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
          {/* Google Sign-In */}
          <Button
            type="button"
            variant="outline"
            className="w-full mb-6 h-12 rounded-xl border-white/10 bg-white/5 hover:bg-white/10 text-foreground font-medium flex items-center justify-center gap-3 transition-all"
            onClick={() => googleLogin()}
            disabled={isLoading}
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
                Or sign up with email
              </span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Full Name */}
            <div className="space-y-2">
              <Label htmlFor="name">
                Full Name <span className="text-red-400">*</span>
              </Label>
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
              <Label htmlFor="email">
                Email <span className="text-red-400">*</span>
              </Label>
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

            {/* Gender */}
            <div className="space-y-2">
              <Label>Gender</Label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: "male", label: "Male" },
                  { value: "female", label: "Female" },
                  { value: "other", label: "Other" },
                ].map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setGender(opt.value)}
                    className={cn(
                      "py-2.5 px-3 rounded-xl border-2 text-sm font-medium transition-all outline-none",
                      gender === opt.value
                        ? "border-primary bg-primary/10 text-primary shadow-[0_0_10px_rgba(var(--primary-rgb),0.15)]"
                        : "border-white/10 bg-white/5 text-foreground hover:bg-white/10"
                    )}
                    disabled={isLoading}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* City & Country */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-4 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="city"
                    type="text"
                    placeholder="Auckland"
                    value={city}
                    onChange={e => setCity(e.target.value)}
                    variant="hero"
                    className="pl-9"
                    disabled={isLoading}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="country">Country</Label>
                <div className="relative">
                  <Globe className="absolute left-3 top-4 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="country"
                    type="text"
                    placeholder="New Zealand"
                    value={country}
                    onChange={e => setCountry(e.target.value)}
                    variant="hero"
                    className="pl-9"
                    disabled={isLoading}
                  />
                </div>
              </div>
            </div>

            {/* Password */}
            <div className="space-y-2">
              <Label htmlFor="password">
                Password <span className="text-red-400">*</span>
              </Label>
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
              <Label htmlFor="confirmPassword">
                Confirm Password <span className="text-red-400">*</span>
              </Label>
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
