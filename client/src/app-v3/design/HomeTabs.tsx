import { Link, useLocation } from "wouter";
export function HomeTabs() {
  const [path] = useLocation();
  return (
    <nav className="v3-home-tabs" aria-label="Home sections">
      {[
        ["Today", "/dashboard"],
        ["Clients", "/clients"],
        ["Supplies", "/supplies"],
      ].map(([title, href]) => (
        <Link
          key={href}
          href={href}
          aria-current={path === href ? "page" : undefined}
        >
          {title}
        </Link>
      ))}
    </nav>
  );
}
