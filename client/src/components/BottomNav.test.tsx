import { render, screen } from "@testing-library/react";
import BottomNav from "./BottomNav";
import { vi, describe, it, expect, beforeEach } from "vitest";

// Mocks
vi.mock("wouter", () => ({
  Link: ({ children, href }: any) => <a href={href}>{children}</a>,
  useLocation: vi.fn(() => ["/", vi.fn()]),
}));

vi.mock("@/lib/selectors/conversation.selectors", () => ({
  useTotalUnreadCount: vi.fn(() => 0),
}));

vi.mock("@/contexts/BottomNavContext", () => ({
  useBottomNav: vi.fn(() => ({
    navItems: [
      {
        id: "home",
        label: "Home",
        path: "/",
        icon: () => <span data-testid="icon-home" />,
      },
      {
        id: "messages",
        label: "Messages",
        path: "/messages",
        icon: () => <span data-testid="icon-messages" />,
      },
    ],
  })),
}));

// Avoid issue with framer-motion and jsdom
vi.mock("framer-motion", () => ({
  motion: {
    nav: ({ children, className }: any) => (
      <nav className={className}>{children}</nav>
    ),
    div: ({ children, className }: any) => (
      <div className={className}>{children}</div>
    ),
  },
}));

// Import mocks to manipulate them
import { useLocation } from "wouter";
import { useTotalUnreadCount } from "@/lib/selectors/conversation.selectors";

describe("BottomNav", () => {
  beforeEach(() => {
    (useLocation as any).mockReturnValue(["/", vi.fn()]);
    (useTotalUnreadCount as any).mockReturnValue(0);
  });

  it("renders navigation items", () => {
    render(<BottomNav />);
    expect(screen.getByText("Home")).toBeInTheDocument();
    expect(screen.getByText("Messages")).toBeInTheDocument();
  });

  it("shows unread count badge on messages", () => {
    (useTotalUnreadCount as any).mockReturnValue(5);
    render(<BottomNav />);
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("shows 9+ for high unread count", () => {
    (useTotalUnreadCount as any).mockReturnValue(15);
    render(<BottomNav />);
    expect(screen.getByText("9+")).toBeInTheDocument();
  });

  it("hides badge when count is 0", () => {
    (useTotalUnreadCount as any).mockReturnValue(0);
    render(<BottomNav />);
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });
});
