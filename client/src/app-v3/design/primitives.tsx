import { useId, type ReactNode, type ButtonHTMLAttributes } from "react";
import { Link } from "wouter";
import { ArrowLeft, ChevronRight, Search, UserRound } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";

/** V3 presentation primitives. Domain operations belong to data hooks, never here. */
export function Screen({
  title,
  subtitle,
  back,
  action,
  children,
  wide = false,
}: {
  title: string;
  subtitle?: ReactNode;
  back?: string;
  action?: ReactNode;
  children: ReactNode;
  wide?: boolean;
}) {
  const { user } = useAuth();
  return (
    <div className={`v3-screen ${wide ? "v3-screen-wide" : ""}`}>
      <header className={back ? "v3-header v3-header-with-back" : "v3-header"}>
        <div className="v3-masthead">
          {back ? (
            <Link className="v3-icon-button" aria-label="Back" href={back}>
              <ArrowLeft size={22} />
            </Link>
          ) : (
            <Link
              href={user?.role === "client" ? "/bookings" : "/dashboard"}
              className="v3-wordmark"
            >
              TATTOI
            </Link>
          )}
          {action || (
            <Link
              className="v3-avatar"
              href={
                user?.role === "client"
                  ? "/profile"
                  : user?.role === "merchant"
                    ? "/settings"
                    : "/business"
              }
              aria-label="Business and profile"
            >
              {user?.avatar ? (
                <img src={user.avatar} alt="" />
              ) : (
                <UserRound size={22} />
              )}
            </Link>
          )}
        </div>
        <h1>{title}</h1>
        {subtitle && <p className="v3-subtitle">{subtitle}</p>}
      </header>
      <main className="v3-scroll">
        <div className="v3-content">{children}</div>
      </main>
    </div>
  );
}
export function Action({
  tone = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: "primary" | "secondary" | "quiet" | "danger";
}) {
  return (
    <button
      type="button"
      {...props}
      className={`v3-action v3-action-${tone} ${className}`}
    />
  );
}
export function ActionLink({
  href,
  children,
  tone = "secondary",
}: {
  href: string;
  children: ReactNode;
  tone?: "primary" | "secondary" | "quiet";
}) {
  return (
    <Link href={href} className={`v3-action v3-action-${tone}`}>
      {children}
    </Link>
  );
}
export function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="v3-section">
      <div className="v3-section-heading">
        <h2>{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
export function Panel({
  children,
  tone = "plain",
}: {
  children: ReactNode;
  tone?: "plain" | "attention";
}) {
  return <div className={`v3-panel v3-panel-${tone}`}>{children}</div>;
}
export function Status({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger";
}) {
  return (
    <span className="v3-status" data-tone={tone}>
      {children}
    </span>
  );
}
export function Avatar({
  name,
  src,
}: {
  name?: string | null;
  src?: string | null;
}) {
  return (
    <span className="v3-avatar">
      {src ? (
        <img src={src} alt="" />
      ) : (
        name
          ?.trim()
          .split(/\s+/)
          .slice(0, 2)
          .map(n => n[0])
          .join("") || <UserRound size={20} />
      )}
    </span>
  );
}
export function Row({
  title,
  detail,
  icon,
  href,
  onClick,
  trailing,
}: {
  title: ReactNode;
  detail?: ReactNode;
  icon?: ReactNode;
  href?: string;
  onClick?: () => void;
  trailing?: ReactNode;
}) {
  const content = (
    <>
      {icon && <span className="v3-row-icon">{icon}</span>}
      <span className="v3-row-copy">
        <strong>{title}</strong>
        {detail && <span>{detail}</span>}
      </span>
      {trailing || ((href || onClick) && <ChevronRight size={18} />)}
    </>
  );
  return href ? (
    <Link className="v3-row" href={href}>
      {content}
    </Link>
  ) : onClick ? (
    <button className="v3-row" type="button" onClick={onClick}>
      {content}
    </button>
  ) : (
    <div className="v3-row">{content}</div>
  );
}
export function SearchField({
  value,
  onChange,
  label = "Search",
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
}) {
  const id = useId();
  return (
    <div className="v3-search">
      <Search size={19} />
      <label className="sr-only" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        type="search"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder || label}
      />
    </div>
  );
}
export function Tabs<T extends string>({
  items,
  value,
  onChange,
  label,
}: {
  items: readonly T[];
  value: T;
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div className="v3-tabs" role="tablist" aria-label={label}>
      {items.map((item, index) => (
        <button
          key={item}
          role="tab"
          aria-selected={item === value}
          tabIndex={item === value ? 0 : -1}
          onClick={() => onChange(item)}
          onKeyDown={e => {
            const next =
              e.key === "ArrowRight"
                ? (index + 1) % items.length
                : e.key === "ArrowLeft"
                  ? (index + items.length - 1) % items.length
                  : e.key === "Home"
                    ? 0
                    : e.key === "End"
                      ? items.length - 1
                      : null;
            if (next !== null) {
              e.preventDefault();
              onChange(items[next]);
              (
                e.currentTarget.parentElement?.children[next] as HTMLElement
              )?.focus();
            }
          }}
        >
          {item}
        </button>
      ))}
    </div>
  );
}
export function Feedback({
  loading,
  error,
  empty,
  onRetry,
}: {
  loading?: boolean;
  error?: unknown;
  empty?: string;
  onRetry?: () => void;
}) {
  if (loading)
    return (
      <div className="v3-feedback" role="status">
        Loading…
      </div>
    );
  if (error)
    return (
      <div className="v3-feedback" role="alert">
        <h2>Something didn’t load</h2>
        <p>Your information hasn’t been changed. Please try again.</p>
        {onRetry && (
          <Action tone="secondary" onClick={onRetry}>
            Try again
          </Action>
        )}
      </div>
    );
  if (empty)
    return (
      <div className="v3-feedback">
        <p>{empty}</p>
      </div>
    );
  return null;
}
