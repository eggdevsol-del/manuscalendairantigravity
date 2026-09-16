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
    <header className={cn("app-safe-header original-ivory-header", className)}>
      <div className="original-ivory-brand-row">
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
          <span className="original-ivory-wordmark">tattoi</span>
        )}
        {rightAction ??
          (user && (
            <Link
              href={
                artist
                  ? "/artist-profile"
                  : user.role === "merchant"
                    ? "/settings"
                    : "/profile"
              }
              className="original-ivory-avatar"
              aria-label={artist ? "Your profile" : "Your profile"}
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
      {subtitle && <p className="original-ivory-subtitle">{subtitle}</p>}
    </header>
  );
}
