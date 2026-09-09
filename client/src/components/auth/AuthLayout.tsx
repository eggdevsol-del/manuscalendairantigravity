import type { ReactNode, CSSProperties } from "react";
import { Link } from "wouter";
import {
  ArrowUpRight,
  CalendarDays,
  MessageCircle,
  Sparkles,
} from "lucide-react";

export function AuthLayout({
  children,
  title,
  description,
}: {
  children: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <main
      className="fixed inset-0 overflow-y-auto bg-background text-foreground px-5 py-7 sm:px-10 lg:px-16"
      style={
        {
          "--muted-foreground":
            "color-mix(in srgb, var(--foreground) 70%, transparent)",
          paddingTop: "max(28px, env(safe-area-inset-top))",
          paddingBottom: "max(28px, env(safe-area-inset-bottom))",
        } as CSSProperties
      }
    >
      <header className="max-w-6xl mx-auto flex items-center justify-between gap-4">
        <Link
          href="/"
          className="text-2xl font-bold tracking-tight flex items-center gap-2"
          aria-label="Tattoi home"
        >
          <span className="w-3 h-3 rounded-full bg-primary" />
          tattoi<span className="text-primary">.</span>
        </Link>
        <Link
          href="/signup?role=artist"
          className="text-sm font-medium flex items-center gap-2 min-h-11"
        >
          For artists <ArrowUpRight className="h-4 w-4" />
        </Link>
      </header>
      <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-6 lg:gap-24 items-center py-6 sm:py-12 lg:py-20">
        <section className="hidden lg:block space-y-6">
          <p className="text-xs tracking-widest uppercase text-muted-foreground">
            Good tattoos begin with a connection
          </p>
          <h1 className="text-4xl sm:text-6xl font-semibold tracking-tight leading-[1.06] max-w-lg">
            Your next tattoo.
            <br />
            <span className="text-muted-foreground">All in one place.</span>
          </h1>
          <p className="text-base sm:text-lg leading-relaxed text-muted-foreground max-w-md">
            Find your artist. Shape your idea. Keep every conversation, session
            and payment together.
          </p>
          <div className="hidden lg:block border-t border-border pt-8 space-y-5">
            {[
              {
                icon: Sparkles,
                title: "Find your people",
                text: "Discover work and artists that feel right for you.",
              },
              {
                icon: MessageCircle,
                title: "Make it yours",
                text: "Share ideas and plan the details with your artist.",
              },
              {
                icon: CalendarDays,
                title: "Enjoy the journey",
                text: "From the first session to the final healed piece.",
              },
            ].map(({ icon: Icon, title, text }) => (
              <div key={title} className="flex gap-4">
                <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold">{title}</h2>
                  <p className="text-sm text-muted-foreground mt-1">{text}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
        <section
          aria-labelledby="auth-title"
          className="bg-card border border-border rounded-3xl p-6 sm:p-9 shadow-sm"
        >
          <h2 id="auth-title" className="text-2xl font-semibold tracking-tight">
            {title}
          </h2>
          <p className="text-muted-foreground text-sm mt-2 mb-7 leading-relaxed">
            {description}
          </p>
          {children}
        </section>
      </div>
      <footer className="max-w-6xl mx-auto text-xs text-muted-foreground border-t border-border pt-5">
        Tattoi · Department of Tattoo Services
      </footer>
    </main>
  );
}
