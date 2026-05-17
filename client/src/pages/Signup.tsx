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
import { GooglePlacesInput } from "@/components/ui/GooglePlacesInput";
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
  MapPin,
  Globe,
  Store,
} from "lucide-react";
import { useGoogleAuthReady } from "@/main";
import { GoogleLoginButton } from "@/components/auth/GoogleLoginButton";

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
  const [businessName, setBusinessName] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  
  const currentParams = new URLSearchParams(window.location.search);
  const isClientRole = currentParams.get("role") === "client";
  
  const [accountType, setAccountType] = useState<"artist" | "supplier">(isClientRole ? "artist" : "artist");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);



  // Google OAuth state — stored so we can update profile after completion
  const [googleToken, setGoogleToken] = useState<string | null>(null);

  const checkEmailMutation = trpc.auth.checkEmailExists.useMutation();
  const updateProfileMutation = trpc.auth.updateProfile.useMutation();
  const googleLoginMutation = trpc.auth.googleLogin.useMutation();

  const handleSignupSuccess = (data: any) => {
    localStorage.setItem("authToken", data.token);
    localStorage.setItem("user", JSON.stringify(data.user || { id: data.userId, role: accountType }));
    toast.success("Account created! Welcome to CalendAIr.");
    setLocation(accountType === "supplier" ? "/dashboard" : "/calendar");
    setIsLoading(false);
  };

  const merchantRegisterMutation = trpc.merchantAuth.register.useMutation({
    onSuccess: handleSignupSuccess,
    onError: (error) => handleSignupError(error),
  });

  const registerMutation = trpc.auth.register.useMutation({
    onSuccess: handleSignupSuccess,
    onError: (error) => handleSignupError(error),
  });

  const handleSignupError = (error: any) => {
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
  const isGoogleReady = useGoogleAuthReady();

  const handleGoogleSuccess = async (code: string) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams(window.location.search);
      const urlRole = params.get("role") as "artist" | "client" | null;
      const referralArtistId = params.get("referralArtistId") || undefined;
      
      const result = await googleLoginMutation.mutateAsync({
        code,
        role: urlRole || "artist",
        referralArtistId,
      });

      // Store auth immediately so profile update works
      localStorage.setItem("authToken", result.token);
      localStorage.setItem("user", JSON.stringify(result.user));
      setGoogleToken(result.token);

      if (result.isNewUser) {
        setName(result.user.name || "");
        setEmail(result.user.email || "");
        setStep("complete-profile");
        toast.success("Google account linked! Please complete your profile.");
      } else {
        toast.success("Welcome back!");
        window.location.href = "/calendar";
      }
    } catch (err: any) {
      toast.error(err?.message || "Google sign-in failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

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

    const params = new URLSearchParams(window.location.search);
    const urlRole = params.get("role") as "artist" | "client" | null;
    const referralArtistId = params.get("referralArtistId") || undefined;

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
            if (accountType === "supplier") {
              merchantRegisterMutation.mutate({
                name,
                email,
                password,
                businessName,
                country: (country === "New Zealand" || country === "NZ") ? "NZ" : "AU",
                websiteUrl,
              });
            } else {
              registerMutation.mutate({
                name,
                email,
                password,
                role: isClientRole ? "client" : "artist",
                ...(referralArtistId ? { referralArtistId } : {}),
                ...(phone ? { phone } : {}),
                ...(birthday ? { birthday } : {}),
                ...(gender ? { gender: gender as any } : {}),
                ...(city ? { city } : {}),
                ...(country ? { country } : {}),
              });
            }
          }
        },
        onError: () => {
          if (accountType === "supplier") {
            merchantRegisterMutation.mutate({
              name,
              email,
              password,
              businessName,
              country: (country === "New Zealand" || country === "NZ") ? "NZ" : "AU",
              websiteUrl,
            });
          } else {
            registerMutation.mutate({
              name,
              email,
              password,
              role: isClientRole ? "client" : "artist",
              ...(referralArtistId ? { referralArtistId } : {}),
              ...(phone ? { phone } : {}),
              ...(birthday ? { birthday } : {}),
              ...(gender ? { gender: gender as any } : {}),
              ...(city ? { city } : {}),
              ...(country ? { country } : {}),
              ...(referralArtistId ? { referralArtistId } : {}),
            });
          }
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
                          : "border-border bg-secondary/50 text-foreground hover:bg-secondary/50"
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
                  <GooglePlacesInput
                    placeholder="Search city..."
                    defaultValue={city}
                    onPlaceSelected={(place) => {
                      const cityComp = place.address_components.find(c => c.types.includes("locality"));
                      const countryComp = place.address_components.find(c => c.types.includes("country"));
                      setCity(cityComp?.long_name || place.name || "");
                      if (countryComp) setCountry(countryComp.long_name);
                    }}
                    className="bg-secondary/50 border-border h-[52px] rounded-xl pl-3"
                  />
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
    <PageShell className="items-center px-4 py-8 !overflow-y-auto mobile-scroll">
      <div className="w-full max-w-md shrink-0">
        <CardHeader className="space-y-1 text-center pb-6 border-none">
          <div className="mx-auto w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mb-4 border-2 border-primary/20 shadow-[0_0_15px_rgba(var(--primary-rgb),0.2)]">
            <UserPlus className="w-8 h-8 text-primary" />
          </div>
          <CardTitle className="text-3xl font-bold tracking-tight text-foreground">
            {isClientRole ? "Create Tattoi Account" : "Create Artist Account"}
          </CardTitle>
          <CardDescription className="text-base font-medium">
            {isClientRole 
              ? "Sign up to track your orders and chat with your artist"
              : "Set up your booking link and start managing clients"}
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
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-[10px] font-bold tracking-widest uppercase">
              <span className="bg-background px-4 text-muted-foreground">
                {isGoogleReady ? "Or sign up with email" : "Sign up with email"}
              </span>
            </div>
          </div>

          {!isClientRole && (
            <div className="flex bg-secondary/50 p-1 rounded-xl mb-6">
              <button
                type="button"
                className={cn(
                  "flex-1 py-2 text-sm font-bold rounded-lg transition-all",
                  accountType === "artist" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
                onClick={() => setAccountType("artist")}
              >
                Tattoo Artist
              </button>
              <button
                type="button"
                className={cn(
                  "flex-1 py-2 text-sm font-bold rounded-lg transition-all",
                  accountType === "supplier" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
                onClick={() => setAccountType("supplier")}
              >
                Supplier / Brand
              </button>
            </div>
          )}

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

            {accountType === "supplier" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="businessName">
                    Business Name <span className="text-red-400">*</span>
                  </Label>
                  <div className="relative">
                    <Store className="absolute left-3 top-4 h-5 w-5 text-muted-foreground" />
                    <Input
                      id="businessName"
                      type="text"
                      placeholder="My Supply Co."
                      value={businessName}
                      onChange={e => setBusinessName(e.target.value)}
                      variant="hero"
                      className="pl-10"
                      disabled={isLoading}
                      required
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="websiteUrl">
                    Store Website URL <span className="text-red-400">*</span>
                  </Label>
                  <div className="relative">
                    <Globe className="absolute left-3 top-4 h-5 w-5 text-muted-foreground" />
                    <Input
                      id="websiteUrl"
                      type="url"
                      placeholder="https://mysupply.co"
                      value={websiteUrl}
                      onChange={e => setWebsiteUrl(e.target.value)}
                      variant="hero"
                      className="pl-10"
                      disabled={isLoading}
                      required
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground/70">
                    We'll use this to automatically build your Tattoi storefront!
                  </p>
                </div>
              </>
            )}

            {accountType === "artist" && (
              <>
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
                            : "border-border bg-secondary/50 text-foreground hover:bg-secondary/50"
                        )}
                        disabled={isLoading}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* City & Country */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <GooglePlacesInput
                  placeholder="Search city..."
                  defaultValue={city}
                  onPlaceSelected={(place) => {
                    const cityComp = place.address_components.find(c => c.types.includes("locality"));
                    const countryComp = place.address_components.find(c => c.types.includes("country"));
                    setCity(cityComp?.long_name || place.name || "");
                    if (countryComp) setCountry(countryComp.long_name);
                  }}
                  className="bg-secondary/50 border-border h-[52px] rounded-xl pl-3"
                />
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
                <span className="w-full border-t border-border" />
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
                "w-full border border-border"
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
