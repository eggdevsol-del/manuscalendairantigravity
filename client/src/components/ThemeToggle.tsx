import { Moon, Sun, Crown } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { Button } from "@/components/ui";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  const title =
    theme === "dark" ? "Switch to light mode" :
      theme === "light" ? "Switch to noir mode" :
        "Switch to dark mode";

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      className="rounded-full w-9 h-9 transition-colors hover:bg-accent"
      title={title}
    >
      {theme === "dark" && <Moon className="h-4 w-4 text-[var(--color-status-info-text)]" />}
      {theme === "light" && <Sun className="h-4 w-4 text-[var(--color-status-warning-text)]" />}
      {theme === "noir" && <Crown className="h-4 w-4 text-[var(--color-status-warning-text)]" />}
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}
