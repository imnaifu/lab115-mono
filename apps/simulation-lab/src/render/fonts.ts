// Fonts are bundled (SIL OFL 1.1, via @fontsource) and loaded explicitly: canvas text does not
// trigger lazy webfont loading, so without this the first frames could silently render in a
// fallback font. Families and roles are defined in src/style/channel.ts (from the design system).
// Only the Latin subsets are loaded; Chinese text falls back to the next family in the stack.

import notoSans400 from "@fontsource/noto-sans-sc/files/noto-sans-sc-latin-400-normal.woff2";
import notoSans500 from "@fontsource/noto-sans-sc/files/noto-sans-sc-latin-500-normal.woff2";
import notoSans700 from "@fontsource/noto-sans-sc/files/noto-sans-sc-latin-700-normal.woff2";
import nunito600 from "@fontsource/nunito/files/nunito-latin-600-normal.woff2";
import nunito700 from "@fontsource/nunito/files/nunito-latin-700-normal.woff2";
import nunito800 from "@fontsource/nunito/files/nunito-latin-800-normal.woff2";

const FACES: [family: string, weight: string, url: string][] = [
  ["Noto Sans SC", "400", notoSans400],
  ["Noto Sans SC", "500", notoSans500],
  ["Noto Sans SC", "700", notoSans700],
  ["Nunito", "600", nunito600],
  ["Nunito", "700", nunito700],
  ["Nunito", "800", nunito800],
];

let loading: Promise<void> | null = null;

export function loadFonts(): Promise<void> {
  loading ??= (async () => {
    const faces = await Promise.all(FACES.map(([family, weight, url]) => new FontFace(family, `url(${url})`, { weight }).load()));
    for (const face of faces) document.fonts.add(face);
    await document.fonts.ready;
  })();
  return loading;
}

/** True once both channel families are usable. */
export function fontsReady(): boolean {
  return document.fonts.check('700 20px "Noto Sans SC"') && document.fonts.check('800 20px "Nunito"');
}
