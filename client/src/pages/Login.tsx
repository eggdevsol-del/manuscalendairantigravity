import "./login.css";
import { useEffect, useState, useRef } from "react";
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

// ── Terminal boot sequence lines ─────────────────────────────
const BOOT_LINES = [
  { text: "> DEPARTMENT OF TATTOO SERVICES", delay: 0, style: "title" },
  { text: `> SYSTEM BOOT v${typeof APP_VERSION === "string" ? APP_VERSION : "2.7"}`, delay: 400, style: "dim" },
  { text: `> ${new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })} — ${new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`, delay: 800, style: "dim" },
  { text: "> ", delay: 1200, style: "blank" },
  { text: "> Loading client database.............. OK", delay: 1400, style: "normal" },
  { text: "> Synchronising appointment schedule... OK", delay: 1800, style: "normal" },
  { text: "> Checking needle inventory............ OK", delay: 2200, style: "normal" },
  { text: "> Verifying ink supply chain........... ADEQUATE", delay: 2600, style: "normal" },
  { text: "> Calibrating tattoo precision AI...... 99.97%", delay: 3000, style: "normal" },
  { text: "> Running background checks on artists. CLASSIFIED", delay: 3400, style: "warning" },
  { text: "> Humour module....................... LOADED (USE WITH CAUTION)", delay: 3800, style: "warning" },
  { text: "> ", delay: 4200, style: "blank" },
  { text: "> All systems nominal.", delay: 4400, style: "success" },
  { text: "> ", delay: 4800, style: "blank" },
];

// Final static text after animation
const FINAL_TITLE = "Department of Tattoo Services";
const FINAL_READY = "ready";

// ── Typing animation hook ────────────────────────────────────
function useTypingAnimation(text: string, startDelay: number, charDelay = 30) {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    let charIndex = 0;
    let startTimer: ReturnType<typeof setTimeout>;
    let charTimer: ReturnType<typeof setInterval>;

    startTimer = setTimeout(() => {
      charTimer = setInterval(() => {
        charIndex++;
        setDisplayed(text.slice(0, charIndex));
        if (charIndex >= text.length) {
          clearInterval(charTimer);
          setDone(true);
        }
      }, charDelay);
    }, startDelay);

    return () => {
      clearTimeout(startTimer);
      clearInterval(charTimer);
    };
  }, [text, startDelay, charDelay]);

  return { displayed, done };
}

// ── Terminal line component ──────────────────────────────────
function TerminalLine({ text, delay, style }: { text: string; delay: number; style: string }) {
  const { displayed, done } = useTypingAnimation(text, delay, 18);

  const colorClass =
    style === "title" ? "terminal-line-title" :
    style === "success" ? "terminal-line-success" :
    style === "warning" ? "terminal-line-warning" :
    style === "dim" ? "terminal-line-dim" :
    "terminal-line-normal";

  return (
    <div className={`terminal-line ${colorClass}`}>
      {displayed}
      {!done && <span className="terminal-cursor">▌</span>}
    </div>
  );
}

export default function Login() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [showOtherMethods, setShowOtherMethods] = useState(false);
  const [bootComplete, setBootComplete] = useState(false);
  const { user, loading: authLoading } = useAuth();
  const utils = trpc.useUtils();
  const terminalRef = useRef<HTMLDivElement>(null);

  // Final title typing (starts after boot sequence)
  const titleStart = 5200;
  const { displayed: titleText, done: titleDone } = useTypingAnimation(FINAL_TITLE, titleStart, 40);
  const { displayed: readyText, done: readyDone } = useTypingAnimation(FINAL_READY, titleStart + FINAL_TITLE.length * 40 + 400, 80);

  // Mark boot as complete once "ready" is done typing
  useEffect(() => {
    if (readyDone) {
      const t = setTimeout(() => setBootComplete(true), 600);
      return () => clearTimeout(t);
    }
  }, [readyDone]);

  // Auto-scroll terminal during boot
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  });

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: data => {
      localStorage.removeItem("authToken");
      localStorage.removeItem("user");
      sessionStorage.removeItem("authToken");
      sessionStorage.removeItem("user");

      const storage = rememberMe ? localStorage : sessionStorage;
      storage.setItem("authToken", data.token);
      storage.setItem("user", JSON.stringify(data.user));

      toast.success("Welcome back!");

      if (data.user.role === "studio") {
        window.location.href = "/studio";
      } else if (data.user.role === "merchant") {
        window.location.href = "/dashboard";
      } else {
        window.location.href = "/calendar";
      }
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
      const result = await googleLoginMutation.mutateAsync({
        code,
        role: "artist",
      });

      localStorage.removeItem("authToken");
      localStorage.removeItem("user");
      sessionStorage.removeItem("authToken");
      sessionStorage.removeItem("user");

      const storage = rememberMe ? localStorage : sessionStorage;
      storage.setItem("authToken", result.token);
      storage.setItem("user", JSON.stringify(result.user));

      await utils.auth.me.invalidate();

      if (result.isNewUser) {
        toast.success("Welcome to d.o.t.s! Let's get you set up.");
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
    <div className="login-terminal-root">
      {/* ── Terminal background ── */}
      <div className="login-terminal-bg" ref={terminalRef}>
        {/* CRT scanline overlay */}
        <div className="login-terminal-scanlines" />

        {/* Boot sequence lines */}
        <div className="login-terminal-output">
          {BOOT_LINES.map((line, i) => (
            <TerminalLine key={i} text={line.text} delay={line.delay} style={line.style} />
          ))}
        </div>

        {/* Final branding — typed then static */}
        <div className={`login-terminal-brand ${bootComplete ? "brand-complete" : ""}`}>
          {titleText && (
            <h1 className="login-terminal-brand-title">
              {titleText}
              {!titleDone && <span className="terminal-cursor">▌</span>}
            </h1>
          )}
          {readyText && (
            <span className="login-terminal-brand-ready">
              {readyText}
              {!readyDone && <span className="terminal-cursor">▌</span>}
            </span>
          )}
        </div>
      </div>

      {/* ── Bottom action area — same layout as before ── */}
      <div className="login-terminal-actions">
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
