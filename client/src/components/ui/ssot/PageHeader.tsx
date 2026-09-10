/** Canonical page hierarchy and safe-area ownership for every role. */
import { cn } from "@/lib/utils";
import { ChevronLeft, UserRound } from "lucide-react";
import { Button } from "../button";
import { useAuth } from "@/_core/hooks/useAuth";
import { Link } from "wouter";
import { type ReactNode } from "react";
interface PageHeaderProps {
  title: string;
  subtitle?: string;
  className?: string;
  onBack?: () => void;
  rightAction?: ReactNode;
}
export function PageHeader({
  title,
  subtitle,
  className,
  onBack,
  rightAction,
}: PageHeaderProps) {
  const { user } = useAuth();
  const artist = user?.role === "artist" || user?.role === "admin";
  return (
    <header className={cn("app-safe-header workspace-header", className)}>
      <div className="workspace-brand-row">
        {onBack ? (
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            aria-label="Back"
          >
            <ChevronLeft />
          </Button>
        ) : (
          <span className="workspace-wordmark">TATTOI</span>
        )}
        {rightAction ??
          (user && (
            <Link
              href={
                artist
                  ? "/business"
                  : user.role === "merchant"
                    ? "/settings"
                    : "/profile"
              }
              className="workspace-avatar"
              aria-label={artist ? "Business and profile" : "Your profile"}
            >
              {user.avatar ? (
                <img src={user.avatar} alt="" />
              ) : (
                <UserRound size={21} />
              )}
            </Link>
          ))}
      </div>
      <h1>{title}</h1>
      {subtitle && <p className="workspace-subtitle">{subtitle}</p>}
    </header>
  );
}
