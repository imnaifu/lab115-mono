import fs from "node:fs";
import path from "node:path";
import { accentColor, type Category } from "@/lib/categories";

/**
 * WHICH TOPIC PICTURES ACTUALLY EXIST, read once per process.
 *
 * THE `<img>` IS NOT RENDERED AT ALL WHEN THERE IS NO FILE, and that is the
 * whole reason this read exists. The first version leaned on `alt=""` to make a
 * missing file degrade silently — which is what `Cover` does for an article
 * cover, and the note there is right about it for a URL on somebody else's CDN.
 * It is not right here: Chrome draws its own broken-image marker in the corner of
 * an `<img>` whose `src` 404s on the SAME ORIGIN, `alt=""` or not, and eight of
 * those on the hub is eight little torn-page icons over eight gradients.
 *
 * A DIRECTORY READ RATHER THAN A CHECK PER TOPIC: one `readdirSync` answers for
 * all eight, and it happens at module load rather than per render.
 *
 * MODULE-LEVEL, SO ADDING A FILE NEEDS A RESTART. That is the right trade here
 * and not a compromise — `public/` is baked into the container image, so a file
 * appearing without a deploy is not a thing that happens in production. In
 * development the dev server reloads this module when the component changes; if
 * a picture is dropped in and does not show, restart.
 */
const TOPIC_IMAGES: ReadonlySet<string> = (() => {
  try {
    return new Set(
      fs
        .readdirSync(path.join(process.cwd(), "public", "topics"))
        .filter((file) => file.endsWith(".webp"))
        .map((file) => file.replace(/\.webp$/, "")),
    );
  } catch {
    // No directory at all is an ordinary state — it means no topic has a
    // picture yet, and every band falls back to its accent gradient.
    return new Set<string>();
  }
})();

/**
 * A topic's picture — and the gradient it falls back to when there is no file.
 *
 * THE GRADIENT IS ALWAYS DRAWN and the photograph is layered on top of it, so a
 * topic with no picture renders as a designed flat colour rather than as an
 * empty box. Unlike `Cover`, the `<img>` is omitted entirely when there is no
 * file rather than left to fail — see `TOPIC_IMAGES` above for why a same-origin
 * 404 cannot be left to degrade quietly.
 *
 * WHICH IS WHY THERE IS NO CONFIG FIELD. A topic's picture is `public/topics/
 * <id>.jpg` by convention — drop the file in and it appears, take it out and the
 * gradient comes back. Adding `image` to `RawCategory` in config.json would mean
 * a required field pointing at a file nothing verifies, and a typo there would
 * render exactly the same as no file at all while looking like a configured
 * value.
 *
 * `alt=""` ON PURPOSE. These are decoration: the topic's name is set directly
 * beside or over this in every caller, so an alt would be the same words read
 * twice. An empty alt is also what stops a browser drawing a broken-image glyph
 * when the file is not there, which is half of the fallback above.
 *
 * THE ACCENT GRADIENT IS NOT A PLACEHOLDER-LOOKING PLACEHOLDER. It is the
 * category's own colour — the one the dot beside its name uses — so a topic with
 * no picture reads as deliberately flat rather than as an image that failed.
 */
/**
 * Whether this topic has a picture — for a caller that has to change something
 * ELSE depending on the answer.
 *
 * THE ONE CALLER IS THE SCRIM. Text over a photograph needs a wash under it to
 * stay readable; text over the accent gradient does not, and putting one there
 * anyway just greys out the colour — which on 技术 (`#3B3563`, the ink colour)
 * turns a deliberate flat band into a muddy one. So the band asks first.
 */
export function hasTopicImage(category: Category): boolean {
  return TOPIC_IMAGES.has(category.id);
}

export function TopicImage({
  category,
  className,
  priority,
}: {
  category: Category;
  /** The box. Aspect ratio and radius belong to the caller: a hub card and a
   *  topic page's band are different shapes of the same picture. */
  className?: string;
  /** True on the one instance that is above the fold — the topic page's band.
   *  The hub's eight cards stay lazy; loading eight photographs eagerly is the
   *  whole first screen spent on decoration. */
  priority?: boolean;
}) {
  const accent = accentColor(category);

  return (
    <div className={`relative overflow-hidden ${className ?? ""}`}>
      <div
        className="absolute inset-0"
        style={{
          background:
            `linear-gradient(135deg, ${accent} 0%, ${accent} 45%, ` +
            `color-mix(in srgb, ${accent} 55%, light-dark(#1d1a33, #f3ede1)) 100%)`,
        }}
      />
      {TOPIC_IMAGES.has(category.id) ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className="absolute inset-0 size-full object-cover"
          src={`/topics/${category.id}.webp`}
          alt=""
          loading={priority ? "eager" : "lazy"}
        />
      ) : null}
    </div>
  );
}
