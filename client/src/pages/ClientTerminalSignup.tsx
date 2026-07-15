/**
 * ClientTerminalSignup — Department of Tattoo Services
 * ──────────────────────────────────────────────────────────
 * CRT-terminal signup flow for CLIENT users.
 * Each field is presented as a typed prompt, confirmed one at a time.
 */
import "./clientTerminalSignup.css";
import "./login.css"; // Reuse CRT base styles
import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { APP_VERSION } from "@/lib/version";
import { useGoogleAuthReady } from "@/lib/google-auth";
import { GoogleLoginButton } from "@/components/auth/GoogleLoginButton";
import { GooglePlacesInput } from "@/components/ui/GooglePlacesInput";

// ── Step definitions ─────────────────────────────────
interface StepDef {
  key: string;
  prompt: string;
  required: boolean;
  type: "text" | "email" | "tel" | "password" | "places";
}

const STEPS: StepDef[] = [
  { key: "name", prompt: "> ENTER YOUR FULL NAME:", required: true, type: "text" },
  { key: "email", prompt: "> ENTER YOUR EMAIL:", required: true, type: "email" },
  { key: "phone", prompt: "> ENTER YOUR PHONE NUMBER:", required: false, type: "tel" },
  { key: "city", prompt: "> ENTER YOUR CITY:", required: false, type: "places" },
  { key: "password", prompt: "> CREATE YOUR PASSWORD:", required: true, type: "password" },
  { key: "confirmPassword", prompt: "> CONFIRM YOUR PASSWORD:", required: true, type: "password" },
];

// ── Typing animation hook ────────────────────────────
function useTypedText(text: string, active: boolean, charDelay = 25) {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!active) {
      setDisplayed("");
      setDone(false);
      return;
    }

    let i = 0;
    let cancelled = false;

    function tick() {
      if (cancelled) return;
      i++;
      if (i > text.length) {
        setDone(true);
        return;
      }
      setDisplayed(text.slice(0, i));
      setTimeout(tick, charDelay);
    }

    tick();
    return () => {
      cancelled = true;
    };
  }, [text, active, charDelay]);

  return { displayed, done };
}

// ── Completed field record ───────────────────────────
interface CompletedField {
  label: string;
  value: string;
  skipped: boolean;
}

// ── Component ────────────────────────────────────────
export default function ClientTerminalSignup() {
  const [, setLocation] = useLocation();

  // Step sequencing
  const [currentStep, setCurrentStep] = useState(0);
  const [stepActive, setStepActive] = useState(true); // controls typing start
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  // Field values
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Completed fields log
  const [completedFields, setCompletedFields] = useState<CompletedField[]>([]);

  // Scroll ref
  const scrollRef = useRef<HTMLDivElement>(null);

  // Live clock (same as Login.tsx)
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Typing animation for current prompt
  const currentStepDef = currentStep < STEPS.length ? STEPS[currentStep] : null;
  const { displayed: typedPrompt, done: typingDone } = useTypedText(
    currentStepDef?.prompt || "",
    stepActive && currentStep < STEPS.length,
    25,
  );

  // Auto-scroll when new content appears
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [completedFields, typedPrompt, typingDone]);

  // ── Field value getter/setter map ──────────────────
  const getFieldValue = useCallback(
    (key: string): string => {
      switch (key) {
        case "name": return name;
        case "email": return email;
        case "phone": return phone;
        case "city": return city;
        case "password": return password;
        case "confirmPassword": return confirmPassword;
        default: return "";
      }
    },
    [name, email, phone, city, password, confirmPassword],
  );

  const setFieldValue = useCallback(
    (key: string, value: string) => {
      switch (key) {
        case "name": setName(value); break;
        case "email": setEmail(value); break;
        case "phone": setPhone(value); break;
        case "city": setCity(value); break;
        case "password": setPassword(value); break;
        case "confirmPassword": setConfirmPassword(value); break;
      }
    },
    [],
  );

  // ── tRPC mutations ────────────────────────────────
  const checkEmailMutation = trpc.auth.checkEmailExists.useMutation();
  const googleLoginMutation = trpc.auth.googleLogin.useMutation();
  const utils = trpc.useUtils();

  const registerMutation = trpc.auth.register.useMutation({
    onSuccess: (data) => {
      const userObj = data.user || {
        id: data.userId,
        role: "client",
        email,
        name,
      };
      localStorage.setItem("authToken", data.token);
      localStorage.setItem("user", JSON.stringify(userObj));
      utils.auth.me.setData(undefined, userObj);
      toast.success("Account created! Welcome to d.o.t.s.");
      window.location.href = "/calendar";
    },
    onError: (err: any) => {
      if (
        err.data?.code === "CONFLICT" ||
        err.message.includes("already exists")
      ) {
        toast.error("An account with this email already exists. Try signing in instead.");
      } else {
        toast.error(err.message || "Registration failed. Please try again.");
      }
      setIsLoading(false);
    },
  });

  // ── Google OAuth ──────────────────────────────────
  const isGoogleReady = useGoogleAuthReady();

  const handleGoogleSuccess = useCallback(
    async (code: string) => {
      setIsLoading(true);
      try {
        const params = new URLSearchParams(window.location.search);
        const referralArtistId = params.get("referralArtistId") || undefined;

        const result = await googleLoginMutation.mutateAsync({
          code,
          role: "client",
          referralArtistId,
        });

        localStorage.setItem("authToken", result.token);
        localStorage.setItem("user", JSON.stringify(result.user));

        if (result.isNewUser) {
          toast.success("Account created via Google! Welcome to d.o.t.s.");
          window.location.href = "/calendar";
        } else {
          toast.success("Welcome back!");
          window.location.href = "/calendar";
        }
      } catch (err: any) {
        toast.error(err?.message || "Google sign-in failed. Please try again.");
      } finally {
        setIsLoading(false);
      }
    },
    [googleLoginMutation],
  );

  // ── Advance to next step (with 1.5 s pause) ───────
  const advanceStep = useCallback(
    (fieldLabel: string, fieldValue: string, skipped: boolean) => {
      setCompletedFields((prev) => [
        ...prev,
        { label: fieldLabel, value: fieldValue, skipped },
      ]);
      setStepActive(false);
      setError("");

      const nextStep = currentStep + 1;

      if (nextStep >= STEPS.length) {
        // All fields collected — submit
        setCurrentStep(nextStep);
        return;
      }

      setTimeout(() => {
        setCurrentStep(nextStep);
        setStepActive(true);
      }, 1500);
    },
    [currentStep],
  );

  // ── Validation ─────────────────────────────────────
  const validateField = useCallback(
    (step: StepDef, value: string): string | null => {
      if (step.required && !value.trim()) {
        return "This field is required.";
      }

      if (step.key === "email") {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value.trim())) {
          return "Please enter a valid email address.";
        }
      }

      if (step.key === "password" && value.length < 8) {
        return "Password must be at least 8 characters.";
      }

      if (step.key === "confirmPassword" && value !== password) {
        return "Passwords do not match.";
      }

      return null;
    },
    [password],
  );

  // ── Confirm handler ────────────────────────────────
  const handleConfirm = useCallback(() => {
    if (!currentStepDef) return;

    const value = getFieldValue(currentStepDef.key);
    const validationError = validateField(currentStepDef, value);

    if (validationError) {
      setError(validationError);
      return;
    }

    // Display label (strip the prompt prefix)
    const displayLabel = currentStepDef.prompt.replace("> ", "").replace(":", "");
    const displayValue =
      currentStepDef.type === "password" ? "••••••••" : value.trim();

    advanceStep(displayLabel, displayValue, false);
  }, [currentStepDef, getFieldValue, validateField, advanceStep]);

  // ── Skip handler (optional fields only) ────────────
  const handleSkip = useCallback(() => {
    if (!currentStepDef || currentStepDef.required) return;

    const displayLabel = currentStepDef.prompt.replace("> ", "").replace(":", "");
    setFieldValue(currentStepDef.key, "");
    advanceStep(displayLabel, "", true);
  }, [currentStepDef, setFieldValue, advanceStep]);

  // ── Submit registration when all steps done ────────
  useEffect(() => {
    if (currentStep < STEPS.length) return;

    setIsLoading(true);
    const params = new URLSearchParams(window.location.search);
    const referralArtistId = params.get("referralArtistId") || undefined;

    checkEmailMutation.mutate(
      { email },
      {
        onSuccess: (result) => {
          if (result.exists && result.isFunnelClient) {
            toast.info(
              "Looks like you've already been in touch with your artist. Let's set up your password.",
            );
            setLocation(
              `/set-password?email=${encodeURIComponent(email)}&name=${encodeURIComponent(result.name || name)}`,
            );
            setIsLoading(false);
          } else if (result.exists) {
            toast.error(
              "An account with this email already exists. Try signing in instead.",
            );
            setIsLoading(false);
          } else {
            registerMutation.mutate({
              name,
              email,
              password,
              role: "client",
              ...(referralArtistId ? { referralArtistId } : {}),
              ...(phone ? { phone } : {}),
              ...(city ? { city } : {}),
              ...(country ? { country } : {}),
            });
          }
        },
        onError: () => {
          // Fallback: try registration directly
          registerMutation.mutate({
            name,
            email,
            password,
            role: "client",
            ...(referralArtistId ? { referralArtistId } : {}),
            ...(phone ? { phone } : {}),
            ...(city ? { city } : {}),
            ...(country ? { country } : {}),
          });
        },
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep]);

  // ── Google Places handler ──────────────────────────
  const handlePlaceSelected = useCallback(
    (place: {
      name: string;
      formatted_address: string;
      address_components: { long_name: string; types: string[] }[];
    }) => {
      const cityComp = place.address_components.find((c) =>
        c.types.includes("locality"),
      );
      const countryComp = place.address_components.find((c) =>
        c.types.includes("country"),
      );
      const selectedCity = cityComp?.long_name || place.name || "";
      setCity(selectedCity);
      if (countryComp) setCountry(countryComp.long_name);
    },
    [],
  );

  // ── Render ─────────────────────────────────────────
  return (
    <div className="login-terminal-root">
      {/* CRT scanline overlay */}
      <div className="login-terminal-scanlines" />

      {/* ── Center: scrollable terminal area ── */}
      <div className="terminal-signup-scroll" ref={scrollRef}>
        {/* Completed fields */}
        {completedFields.map((field, i) => (
          <div key={i} className="terminal-signup-completed">
            <span className="terminal-signup-completed-line">
              {">"} {field.label}: {field.value}
              {field.skipped ? (
                <span className="terminal-signup-completed-skipped">
                  SKIPPED
                </span>
              ) : (
                <span className="terminal-signup-completed-check"> ✓</span>
              )}
            </span>
          </div>
        ))}

        {/* Current step prompt (typing) */}
        {currentStep < STEPS.length && (
          <div className="terminal-signup-step">
            <div className="terminal-signup-prompt">
              {typedPrompt}
              {!typingDone && <span className="terminal-cursor">▌</span>}
            </div>

            {typingDone && currentStepDef && (
              <>
                <div className="terminal-signup-input-row">
                  {currentStepDef.type === "places" ? (
                    <div className="terminal-places-wrapper" style={{ flex: 1 }}>
                      <GooglePlacesInput
                        placeholder=""
                        defaultValue={city}
                        onPlaceSelected={handlePlaceSelected}
                        className="terminal-places-input"
                      />
                    </div>
                  ) : (
                    <input
                      type={currentStepDef.type}
                      value={getFieldValue(currentStepDef.key)}
                      onChange={(e) =>
                        setFieldValue(currentStepDef.key, e.target.value)
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleConfirm();
                      }}
                      className="terminal-signup-input"
                      autoFocus
                    />
                  )}

                  <button
                    type="button"
                    onClick={handleConfirm}
                    className="terminal-signup-confirm"
                  >
                    CONFIRM &gt;
                  </button>

                  {!currentStepDef.required && (
                    <button
                      type="button"
                      onClick={handleSkip}
                      className="terminal-signup-skip"
                    >
                      SKIP &gt;
                    </button>
                  )}
                </div>

                {error && (
                  <div className="terminal-signup-error">{error}</div>
                )}
              </>
            )}
          </div>
        )}

        {/* Final: creating account */}
        {currentStep >= STEPS.length && (
          <div className="terminal-final">
            <div className="terminal-final-line">
              CREATING ACCOUNT...........................{" "}
              {isLoading ? (
                <>
                  <Loader2
                    className="inline-block animate-spin"
                    style={{ width: 14, height: 14, verticalAlign: "middle" }}
                  />{" "}
                  PROCESSING
                </>
              ) : (
                "READY"
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Header: date/time + title (below terminal, same as login) ── */}
      <div className="login-terminal-top">
        <div className="login-terminal-datetime">
          {now.toLocaleDateString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
          {" — "}
          {now.toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })}
        </div>
        <h1 className="login-terminal-title">DEPARTMENT OF TATTOO SERVICES</h1>
        <div className="login-terminal-version">SYSTEM BOOT V{APP_VERSION}</div>
      </div>

      {/* ── Bottom: Google sign-in + link to login ── */}
      <div className="login-terminal-actions">
        {isGoogleReady && (
          <div style={{ width: "100%", maxWidth: 400 }}>
            <GoogleLoginButton
              onSuccess={handleGoogleSuccess}
              onError={() =>
                toast.error("Google sign-in was cancelled or failed.")
              }
              disabled={isLoading}
            />
          </div>
        )}

        <button
          type="button"
          onClick={() => setLocation("/login")}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          style={{ fontWeight: 300 }}
        >
          Already have an account? Sign In
        </button>

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
