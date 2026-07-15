import "./login.css";
import { useEffect, useState, useRef, useCallback } from "react";
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

// ── Terminal sections ────────────────────────────────
// Each section renders one at a time, centered, typed line by line.
const SECTIONS: { header: string; lines: string[] }[] = [
  {
    header: "[ DESIGN OPERATIONS ]",
    lines: [
      "Designs due this week.......................... 5",
      "Designs completed.............................. 0",
      "Hours until first appointment................. 12",
      "Opening Procreate.............................. PENDING",
    ],
  },
  {
    header: "[ ARTIST VITALS ]",
    lines: [
      "Checking artist blood supply................... DETECTED",
      "Water content.................................. MINIMAL",
      "Caffeine content............................... HIGH",
      "Nicotine content............................... PRESENT",
      "Cortisol dependency............................ CONFIRMED",
    ],
  },
  {
    header: "[ DIGITAL ASSET MANAGEMENT ]",
    lines: [
      "Checking device storage........................ 28,416 IMAGES",
      "Tattoo photos detected......................... 15,482",
      "Tattoo photos edited........................... 63",
      "Tattoo photos posted........................... 3",
      "Available storage.............................. 241 MB",
    ],
  },
  {
    header: "[ PROJECT & BOOKING MANAGEMENT ]",
    lines: [
      "Checking current projects...................... 23",
      "Projects booked until completion............... 2",
      "Empty days next month.......................... 14",
      "Slow season detected........................... YES",
      "Books permanently open......................... YES",
    ],
  },
  {
    header: "[ ARTIST PRICING & SACRIFICE ]",
    lines: [
      "Checking artist pricing........................ COMPLETE",
      "Years tattooing................................ 12",
      "Price increase in last 3 years................. $0",
      "Free extras detected........................... 37",
      '"Don\'t worry about it bro" incidents............ 19',
      "Time away from children........................ 900 HOURS",
      "Refunding design time taken from family......... NON-REFUNDABLE",
    ],
  },
  {
    header: "[ SOCIAL MEDIA COMPLIANCE ]",
    lines: [
      "Analysing artist Instagram..................... COMPLETE",
      "Tattoo ability................................. 99%",
      "Organic reach.................................. 256",
      "Dancing videos posted.......................... 0",
      "Personal trauma shared......................... 0",
      "Trade knowledge given away for free............ 0",
      "Algorithm cooperation.......................... NIL",
    ],
  },
  {
    header: "[ OCCUPATIONAL RECOGNITION ]",
    lines: [
      "Checking occupation status..................... NOT A REAL JOB",
      "Checking government tax status................. VERY REAL JOB",
      "Tax payable.................................... $84,217",
    ],
  },
  {
    header: "[ CLIENT ATTENDANCE & REVENUE ]",
    lines: [
      "Checking missed appointments................... 13",
      "Revenue lost................................... $15,600",
      'Deposit policy................................. "I TRUST THEM"',
    ],
  },
  {
    header: "[ LONG-TERM ARTIST VIABILITY ]",
    lines: [
      "Checking retirement plan....................... NOT FOUND",
      "Checking lower back............................ DAMAGED",
      "Mike Tyson lower back damage level............. SPINAL",
      "Checking tattoo expertise...................... EXCEPTIONAL",
      "Current financial plan......................... TATTOO MORE",
    ],
  },
  {
    header: "[ ALTERNATIVE REVENUE CONTINGENCY ]",
    lines: [
      "Loading OnlyFans backup revenue model........... READY",
    ],
  },
];

// ── Typing engine hook ───────────────────────────────
// Types out an array of lines one character at a time, returns visible lines.
function useTypedLines(
  lines: string[],
  active: boolean,
  charDelay = 12,
  lineDelay = 80,
) {
  const [visibleLines, setVisibleLines] = useState<string[]>([]);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!active) {
      setVisibleLines([]);
      setDone(false);
      return;
    }

    let cancelled = false;
    let lineIdx = 0;
    let charIdx = 0;
    const result: string[] = [];

    function tick() {
      if (cancelled) return;

      if (lineIdx >= lines.length) {
        setDone(true);
        return;
      }

      const currentLine = lines[lineIdx];
      charIdx++;

      if (charIdx > currentLine.length) {
        // Line complete — move to next
        lineIdx++;
        charIdx = 0;
        setTimeout(tick, lineDelay);
        return;
      }

      result[lineIdx] = currentLine.slice(0, charIdx);
      setVisibleLines([...result]);
      setTimeout(tick, charDelay);
    }

    tick();
    return () => { cancelled = true; };
  }, [lines, active, charDelay, lineDelay]);

  return { visibleLines, done };
}

// ── Section display component ────────────────────────
function TerminalSection({
  section,
  active,
  onComplete,
}: {
  section: { header: string; lines: string[] };
  active: boolean;
  onComplete: () => void;
}) {
  const { visibleLines, done } = useTypedLines(section.lines, active, 10, 60);

  useEffect(() => {
    if (done) {
      const t = setTimeout(onComplete, 1000);
      return () => clearTimeout(t);
    }
  }, [done, onComplete]);

  if (!active) return null;

  return (
    <div className="terminal-section">
      <div className="terminal-section-header">{section.header}</div>
      <div className="terminal-section-lines">
        {visibleLines.map((line, i) => (
          <div key={i} className="terminal-section-line">
            {line}
            {i === visibleLines.length - 1 && !done && (
              <span className="terminal-cursor">▌</span>
            )}
          </div>
        ))}
      </div>
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
  const { user, loading: authLoading } = useAuth();
  const utils = trpc.useUtils();

  // Terminal sequence state
  const [currentSection, setCurrentSection] = useState(0);
  const [sequenceComplete, setSequenceComplete] = useState(false);

  const handleSectionComplete = useCallback(() => {
    setCurrentSection((prev) => {
      const next = prev + 1;
      if (next >= SECTIONS.length) {
        setSequenceComplete(true);
        return prev;
      }
      return next;
    });
  }, []);

  // Live clock
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

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
      {/* CRT scanline overlay */}
      <div className="login-terminal-scanlines" />

      {/* ── Top: date/time + title ── */}
      <div className="login-terminal-top">
        <div className="login-terminal-datetime">
          {now.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          {" — "}
          {now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
        </div>
        <h1 className="login-terminal-title">DEPARTMENT OF TATTOO SERVICES</h1>
        <div className="login-terminal-version">SYSTEM BOOT V{APP_VERSION}</div>
      </div>

      {/* ── Center: cycling sections ── */}
      <div className="login-terminal-center">
        {!sequenceComplete ? (
          SECTIONS.map((section, i) => (
            <TerminalSection
              key={i}
              section={section}
              active={i === currentSection}
              onComplete={handleSectionComplete}
            />
          ))
        ) : (
          <div className="terminal-final">
            <div className="terminal-final-line">
              INITIALISING D.O.T.S........................... READY
            </div>
          </div>
        )}
      </div>

      {/* ── Bottom: auth buttons (always visible) ── */}
      <div className="login-terminal-actions">
        {showOtherMethods && (
          <div style={{ width: "100%", maxWidth: 400, marginBottom: 8 }}>
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
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
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
                      <label htmlFor="remember" className="text-sm leading-none cursor-pointer text-muted-foreground" style={{ fontWeight: 300 }}>
                        Remember me
                      </label>
                    </div>
                    <button type="button" onClick={() => setLocation("/forgot-password")} className="text-sm text-muted-foreground hover:text-foreground transition-colors" style={{ fontWeight: 300 }}>
                      Forgot password?
                    </button>
                  </div>

                  <Button type="submit" className={cn(tokens.button.auth, "w-full h-12 rounded-full")} disabled={isLoading}>
                    {isLoading ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Signing in...</>) : "Sign In"}
                  </Button>
                </form>

                <div className="flex justify-center gap-1 text-sm text-muted-foreground" style={{ fontWeight: 300 }}>
                  <span>Don't have an account?</span>
                  <button onClick={() => setLocation("/signup?role=client")} className="text-primary font-medium hover:underline">
                    Sign up
                  </button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {isGoogleReady && (
          <div style={{ width: "100%", maxWidth: 400 }}>
            <GoogleLoginButton
              onSuccess={handleGoogleSuccess}
              onError={() => toast.error("Google sign-in was cancelled or failed.")}
              disabled={isLoading}
            />
          </div>
        )}

        <button
          onClick={() => setShowOtherMethods(!showOtherMethods)}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          style={{ fontWeight: 300 }}
        >
          {showOtherMethods ? "Hide other options" : "Other sign-in options"}
        </button>

        <span className="text-xs text-muted-foreground/50" style={{ fontWeight: 300 }}>
          v{APP_VERSION}
        </span>
      </div>
    </div>
  );
}
