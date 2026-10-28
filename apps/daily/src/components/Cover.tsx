import { sourceOf } from "@/lib/sources";
import { TopicIcon, topicFill } from "./TopicIcon";

/**
 * Cover size is a prop, not a descendant selector.
 *
 * It used to come from `.hero .cover` / `.card .cover` — the parent reaching in
 * to size its child, which utilities cannot express. The hero cover is a full
 * width band on a phone and a book spine beside the text on a wider screen.
 *
 * The CARD cover is a SQUARE, and one size at every width.
 *
 * It was 88×120 (120 past `sm:`), sized for when it stood beside the whole card.
 * Beside the headline block alone — 52px for a one-line title, 80px for two —
 * that left 40–68px of empty column under the title. Matching the text block
 * exactly, via `self-stretch` and no height, closed the gap but made the box a
 * landscape sliver: at 88×52 a wide source banner center-crops to a ~169px slice
 * of the original and catches whatever letters sit beside the logo, which looked
 * worse than the gap did.
 *
 * A SQUARE is the forgiving crop for the logos and hero shots these actually are,
 * which is the part of that reasoning that still holds. The SIZE has moved up
 * since: 80px was chosen to sit within a line of the header block beside it, and
 * measured against today's rows that block is 78px — so the cover was matching a
 * text column rather than being a picture. These are the only images in a list of
 * summaries, and at 80px a photograph in one is a thumbnail of a thumbnail.
 *
 * 96px on a row and 112/144 on the article page. Both now run proud of the text
 * beside them (78px and 96px measured), which the `items-center` on those rows
 * absorbs as air above and below the headline — the same mechanism the note in
 * ArticleCards describes for a one-line title.
 */
const SIZE = {
  /**
   * The article page's cover, and a square on the left for the same reason the
   * card's is.
   *
   * It was `h-42 w-full sm:h-50 sm:w-36` — a full-width band on a phone, a book
   * spine to the RIGHT of the text above `sm`, and hidden outright below it. That
   * made the one page devoted to a single article the one place whose layout did
   * not match the list it was reached from. Bigger than a row's, because the
   * headline beside it is `text-3xl` rather than `text-lg` and this is the page
   * about that one piece — it can afford the picture the size it is worth.
   */
  hero: "size-28 sm:size-36",
  /**
   * THE ROW'S THUMBNAIL. 80px on a phone, 96px from `sm:` up — and the step is
   * arithmetic rather than taste.
   *
   * A 393px phone leaves 361px inside the page gutter. The row spends 24 on the
   * position, 12 on the chevron and three 14px gaps, so at a flat 96 the text
   * column gets 175px — under ten Chinese characters a line at the headline's
   * 18px, which turns a 14-character headline into two lines and the English
   * original under it into three. At 80 the column gets 191px, which is where a
   * headline starts fitting in two lines rather than three.
   *
   * It was a flat `size-24`, and before that 80px at every width for a
   * different reason (see the note above: it was matching a text block rather
   * than being a picture). 96px is right beside a two-line headline on a wide
   * row; the phone is where it has to give the words back.
   */
  card: "size-20 sm:size-24",
  /**
   * THE ARTICLE PAGE'S HERO BAND — full column width, 16:9.
   *
   * `hero` above is the 112/144px square this replaced, and the square was
   * chosen on the argument that the article page should match the list it was
   * reached from. That argument is inverted now: the list is a row of
   * navigation with a 96px thumbnail on the right, and the article page is the
   * one place the picture is the piece's own rather than an identifying mark. A
   * page devoted to one article can afford the image the size it is worth, and
   * a 144px square beside a 30px headline was a thumbnail of a thumbnail.
   *
   * 16:9 RATHER THAN A HEIGHT. These are other people's article covers, at
   * whatever ratio their CMS produced, so the box has to be the constant and
   * `object-cover` the crop. 16:9 is what a lede image is on nearly every
   * publication, and it is shallow enough that it does not push the prose off a
   * phone screen: at 361px wide it is 203px tall, against the 320px a 3:2 band
   * would take.
   *
   * `hero` stays defined. Nothing renders it today, and it is the shape to go
   * back to if the band ever proves to cost more than it is worth.
   */
  banner: "aspect-video w-full",
} as const;

/**
 * The placeholder's icon, sized for the box that holds it — about two fifths
 * of the box, the share the design system gives the drawing in a well.
 */
const ICON = {
  hero: "size-12 sm:size-14",
  card: "size-8 sm:size-10",
  banner: "size-16 sm:size-24",
} as const;

/**
 * The placeholder is ALWAYS rendered, with the photo layered on top when there
 * is one. That way a cover that 404s or times out — XDA's CDN does both
 * intermittently — degrades to a designed placeholder instead of an empty box,
 * with no client-side JS involved.
 *
 * THE PLACEHOLDER IS THE TOPIC'S WELL: its pastel, with its line icon in the
 * middle (see TopicIcon). It was a gradient in the source's accent with the
 * source's name set on it; the Sokosoko restyle draws an article without a
 * picture the way the design system draws one — an icon on a light fill. The
 * source is still named in the meta row beside every cover. `category` is
 * optional only so a caller that has no article to hand still gets a box; it
 * falls back to a plain well and the bookmark.
 *
 * The <img> is `alt=""` on purpose: it is decorative (the headline sits right
 * beside it), and an empty alt is also what stops browsers drawing a
 * broken-image glyph on failure.
 */
export function Cover({
  sourceId,
  image,
  variant,
  category,
}: {
  sourceId: string;
  image: string | null;
  variant: keyof typeof SIZE;
  category?: string;
}) {
  const source = sourceOf(sourceId);

  /**
   * THE BANNER SHOWS THE WHOLE PICTURE, and it is the one variant that does.
   *
   * Every other box here is a FIXED SHAPE with `object-cover`, which crops —
   * correct for a thumbnail, whose job is to be recognisable at 80px in a
   * column of eight. The article page's lede is not that: it is the piece's own
   * photograph, at the top of the one page devoted to it, and cropping a third
   * of it away to make it 16:9 is throwing away the part the photographer
   * framed for.
   *
   * SO THE HEIGHT IS FIXED AND THE WIDTH FOLLOWS THE RATIO. The `<img>` is in
   * normal flow rather than absolutely positioned, with `h-…` and `w-auto`, so
   * the browser derives the width from the file's own aspect ratio: a panorama
   * comes out wide, a portrait comes out narrow, and neither is cut. Fixing the
   * HEIGHT rather than the width is what keeps a column of article pages
   * rhythmically the same — a fixed width would let a tall photograph push the
   * prose most of a screen down.
   *
   * `h-48 sm:h-80` (192/320px) AND THE PHONE NUMBER IS THE BINDING ONE. At
   * 361px of column a 16:9 picture is 203px tall before it is wider than the
   * page, so 192 leaves it room; 320px on a wide screen is 569px of an 880px
   * column, which is a lede rather than a band.
   *
   * `max-w-full` + `object-contain` FOR THE ONE CASE THAT ESCAPES that sum: a
   * picture wider than 16:9 still hits the column edge, and there it letterboxes
   * inside the box instead of overflowing or being cropped. It is the fallback,
   * not the mechanism.
   *
   * `mx-auto` BECAUSE THE WIDTH IS THE FILE\'S. Every other block on this page
   * fills the column, so it has a left edge and the gutter puts it there; this
   * one is as wide as the photograph happens to be, and a picture narrower than
   * its column that hugs the left reads as a layout that failed rather than as a
   * deliberate measure. Centred is what a plate in a book does.
   *
   * NO `shadow-cover` AND NO WELL HERE, because there is no box to shade: the
   * element is the picture. A shadow around an image whose width is unknown
   * until it loads would also move when it does.
   */
  if (variant === "banner") {
    if (image) {
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className="mx-auto h-48 w-auto max-w-full rounded-card object-contain sm:h-80"
          src={image}
          alt=""
          loading="lazy"
        />
      );
    }
    /* NO FILE: the topic's well, and it keeps the 16:9 box because there is no
       picture to take a ratio from. The band is wide enough to name the source
       too, which the small wells leave to the meta row. */
    return (
      <div
        className={`relative flex flex-none items-center justify-center overflow-hidden rounded-card text-ink-fixed ${topicFill(category)} ${SIZE.banner}`}
      >
        <TopicIcon id={category} className={ICON.banner} />
        <span className="absolute bottom-4 left-4 text-base font-bold">
          {source.name}
        </span>
      </div>
    );
  }

  return (
    <div
      className={`relative flex flex-none items-center justify-center overflow-hidden rounded-card text-ink-fixed ${topicFill(category)} ${SIZE[variant]}`}
    >
      <TopicIcon id={category} className={ICON[variant]} />
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className="absolute inset-0 size-full object-cover"
          src={image}
          alt=""
          loading="lazy"
        />
      ) : null}
    </div>
  );
}
