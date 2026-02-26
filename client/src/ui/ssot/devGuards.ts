/**
 * Developer Guardrails
 * --------------------
 * Prevents inline styling creep by warning in development if forbidden
 * Tailwind classes are used in SSOT components.
 */

export function guardStyleProps(componentName: string, className?: string) {
  if (import.meta.env.PROD || !className) return;

  const forbiddenPatterns = [
    "bg-",
    "backdrop-",
    "blur-",
    "rounded-",
    "shadow-", // Core SSOT properties
  ];

  // Whitelist some harmless bg/text utilities if needed, but strict mode = none.
  // We'll catch basics.

  const violations = forbiddenPatterns.filter(pattern =>
    className.split(" ").some(cls => cls.startsWith(pattern))
  );

  if (violations.length > 0) {
    console.warn(
      `%c[SSOT Violation] %c${componentName} received forbidden classes: ${violations.join(", ")}. \n` +
        `These styles must be defined in @/ui/tokens.ts only.`,
      "color: #ff4444; font-weight: bold;",
      "color: inherit;"
    );
  }
}
