const fs = require("fs");
const path = require("path");

// Map of Component Name -> File Name (basename)
// This is needed because 'Button' -> 'button.tsx', 'SheetContent' -> 'sheet.tsx'
const componentMap = {
  Button: "button",
  buttonVariants: "button",
  Separator: "separator",
  Label: "label",
  Input: "input",
  Textarea: "textarea",
  Badge: "badge",
  Dialog: "dialog",
  DialogContent: "dialog",
  DialogDescription: "dialog",
  DialogTitle: "dialog",
  DialogFooter: "dialog",
  DialogHeader: "dialog",
  Sheet: "sheet",
  SheetContent: "sheet",
  SheetDescription: "sheet",
  SheetTitle: "sheet",
  SheetHeader: "sheet",
  Skeleton: "skeleton",
  Card: "card",
  toggleVariants: "toggle",
  useDialogComposition: "dialog", // Assuming this lives in dialog or we need to find it.
};

// Check 'useDialogComposition' location
// It was in input.tsx importing from @/components/ui.
// Wait, useDialogComposition might be custom?
// Let's assume standard names for now and handle exceptions manually if needed.

const filesToFix = [
  "f:/booking app/artist-booking-app/client/src/components/ui/alert-dialog.tsx",
  "f:/booking app/artist-booking-app/client/src/components/ui/button-group.tsx",
  "f:/booking app/artist-booking-app/client/src/components/ui/calendar.tsx",
  "f:/booking app/artist-booking-app/client/src/components/ui/carousel.tsx",
  "f:/booking app/artist-booking-app/client/src/components/ui/field.tsx",
  "f:/booking app/artist-booking-app/client/src/components/ui/form.tsx",
  "f:/booking app/artist-booking-app/client/src/components/ui/input-group.tsx",
  "f:/booking app/artist-booking-app/client/src/components/ui/input.tsx",
  "f:/booking app/artist-booking-app/client/src/components/ui/item.tsx",
  "f:/booking app/artist-booking-app/client/src/components/ui/overlays/modal-shell.tsx",
  "f:/booking app/artist-booking-app/client/src/components/ui/pagination.tsx",
  "f:/booking app/artist-booking-app/client/src/components/ui/overlays/sheet-shell.tsx",
  "f:/booking app/artist-booking-app/client/src/components/ui/sidebar.tsx",
  "f:/booking app/artist-booking-app/client/src/components/ui/ssot/TaskCard.tsx",
  "f:/booking app/artist-booking-app/client/src/components/ui/textarea.tsx",
  "f:/booking app/artist-booking-app/client/src/components/ui/toggle-group.tsx",
];

filesToFix.forEach(file => {
  let content = fs.readFileSync(file, "utf8");
  const dir = path.dirname(file);

  // Regex to match: import { ... } from "@/components/ui" or "@/components/ui/"
  const regex = /import\s+\{([^}]+)\}\s+from\s+["']@\/components\/ui["'];?/g;

  let newContent = content.replace(regex, (match, importsBody) => {
    const imports = importsBody
      .split(",")
      .map(s => s.trim())
      .filter(Boolean);

    // Group imports by source file
    const importsByFile = {};

    imports.forEach(imp => {
      let source = componentMap[imp];
      if (!source) {
        // Fallback: try converting PascalCase to kebab-case
        source = imp.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
      }

      if (!importsByFile[source]) importsByFile[source] = [];
      importsByFile[source].push(imp);
    });

    // Construct replacements
    return Object.entries(importsByFile)
      .map(([source, contractImports]) => {
        // Calculate relative path
        let relativePath = `./${source}`;
        // If file is deep (e.g. overlays/modal-shell.tsx), relative path needs to go up?
        // Wait, import is from "@/components/ui".
        // If we are in "client/src/components/ui/overlays/modal-shell.tsx", imports should be "../alert-dialog" etc.

        // Hard to determine relative path generically without knowing destination structure perfectly.
        // BUT:
        // "client/src/components/ui" is the root of these components.
        // "client/src/components/ui/index.ts" exports them.

        // If the file is IN "client/src/components/ui", then "./button" works.
        // If the file is IN "client/src/components/ui/overlays", then "../button" works.

        const uiRoot = path.resolve(
          "f:/booking app/artist-booking-app/client/src/components/ui"
        );
        const targetPath = path.resolve(uiRoot, source);

        let rel = path.relative(dir, targetPath);
        if (!rel.startsWith(".")) rel = "./" + rel;

        return `import { ${contractImports.join(", ")} } from "${rel.replace(/\\/g, "/")}";`;
      })
      .join("\n");
  });

  if (newContent !== content) {
    fs.writeFileSync(file, newContent, "utf8");
    console.log(`Fixed: ${file}`);
  }
});
