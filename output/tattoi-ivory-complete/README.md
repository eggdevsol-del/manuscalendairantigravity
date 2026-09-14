# Tattoi — Ivory implementation review

Open `index.html` for the searchable screen library and nine guided click-through journeys. Screenshots render actual app components using isolated sample data. The source implementation is in the accompanying Tattoi workspace; this collection is its review package. The latest cohesion audit standardises full-width subheaders and repairs verified interaction defects. See `audit/AUDIT.md` for the audit report.

- `DESIGN-SYSTEM.md`: foundations, interaction rules and implementation notes.
- `COVERAGE.md`: captured pages, nested flow states and verification scope.
- `screens/`: individual iPhone-sized PNGs and scroll sections.
- `screen-manifest.json` and `walkthroughs.json`: machine-readable review coverage.
- `implementation.patch`: source changes, including the new Ivory stylesheet.

The gallery links captured screens and offers ordered walkthroughs; it does not execute forms or payments. iPhone status chrome and safe areas are simulated for presentation. Sample people, money, dates and artwork are illustrative. Nothing has been deployed.

## Artwork provenance

Mode: built-in image generation. `assets/botanical.png` is generated sample artwork used by the isolated preview fixture only. It is not substituted for real user content in the application.

Prompt: Create one photorealistic portrait editorial photograph for Tattoi Ivory native iPhone tattoo app. Close view of an adult person's inner forearm bearing an exquisite healed fine-line botanical tattoo, graceful olive branches and small wildflowers in black ink, authentic fine subtle linework. Arm diagonally across frame with light natural skin texture, oatmeal linen clothing visible at edge, softly blurred warm grey tattoo studio background. Warm diffuse daylight, quiet premium gallery feeling, filmic restrained contrast, not orange. Tattoo and forearm occupy central two thirds with breathing room above. No face, no text, no logos, no UI, no needles, no wounds. Vertical portrait composition.
