/**
 * Regenerate the extension's icons from the site's own mark, so the toolbar
 * icon and the site's favicon cannot drift apart.
 *
 * Source: apps/daily/public/mark.svg (yellow tile, ink 严 strokes). Run again
 * whenever that file changes: `npm run icons`.
 *
 * 16/32/48 are full-bleed — at toolbar size every pixel of tile counts.
 * 128 follows the Chrome Web Store icon guideline: 96×96 artwork centred with
 * 16px of transparent padding, because the store and the install dialog draw
 * it on their own backgrounds.
 */
import { readFileSync, writeFileSync } from "node:fs";
import sharp from "sharp";

const svg = readFileSync(new URL("../../daily/public/mark.svg", import.meta.url), "utf8");
// The store images show the same mark; the copy drops the long maintenance comment.
const bare = svg.replace(/<!--[\s\S]*?-->\s*/g, "");
writeFileSync(new URL("../branding/mark.svg", import.meta.url), bare);

const render = (size) => sharp(Buffer.from(bare), { density: 72 * (size / 64) * 4 }).resize(size, size);

for (const size of [16, 32, 48]) {
  await render(size).png().toFile(`icons/icon${size}.png`);
}

const art = await render(96).png().toBuffer();
await sharp({
  create: { width: 128, height: 128, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
})
  .composite([{ input: art, left: 16, top: 16 }])
  .png()
  .toFile("icons/icon128.png");

console.log("✓ icons/icon{16,32,48,128}.png and branding/mark.svg");
