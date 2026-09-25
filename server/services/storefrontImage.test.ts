import { expect, it } from "vitest";
import { extractStorefrontImage } from "./storefrontImage";
it("reads featured metadata regardless of attribute order and resolves relative URLs", () => {
 expect(extractStorefrontImage(`<meta content='/hero.jpg?a=1&amp;b=2' property='og:image'>`, 'https://store.example')).toBe('https://store.example/hero.jpg?a=1&b=2');
});
it("falls back to hero images and ignores unsafe URLs", () => {
 expect(extractStorefrontImage(`<meta property="og:image" content="javascript:alert(1)"><img class="hero" data-src="//cdn.example/cover.jpg">`, 'https://store.example')).toBe('https://cdn.example/cover.jpg');
});
it("does not mistake a generic navigation logo for the main image", () => {
 expect(extractStorefrontImage(`<img class="logo" src="/logo.png">`, 'https://store.example')).toBeNull();
});
