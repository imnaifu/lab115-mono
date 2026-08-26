import { strings } from "@/lib/i18n";
import type { Lang } from "@/lib/lang";
import { captionFor } from "@/lib/take";
import type { DailyPhoto } from "@/lib/types";

/**
 * The day's photograph: one plate above the sections, photo over caption.
 *
 * A `<figure>` rather than a div, because that is exactly what this is: an image
 * and the sentence that says what it shows. The caption is not decoration to be
 * hidden from assistive tech, which is also why the `<img>` carries `alt=""` —
 * the words are right there in the same figure, and an alt repeating them would
 * be read twice. (`Cover` does the same thing for the same reason.)
 *
 * IT KEEPS THE CARD SHELL BUT IS NOT BUILT LIKE A CARD. An article card is a row
 * — 80px square on the left, headline and prose beside it — and the first version
 * of this component copied that exactly, which made the page open on something a
 * reader could not tell apart from its own first article. Here the photo spans
 * the shell's full width and bleeds to its edges with the words underneath: the
 * same material as everything else on the page, unmistakably not an entry in it.
 *
 * NOT `Cover`: that one derives a gradient from an article id and prints a source
 * name over it, and this photo has neither.
 *
 * NO LAZY LOADING, unlike the covers. This one is above the fold by
 * construction; deferring the only image on the first screen is how a page ends
 * up drawing itself twice.
 */
export function PhotoCard({
  photo,
  lang,
}: {
  photo: DailyPhoto;
  lang: Lang;
}) {
  const t = strings(lang);

  return (
    <figure className="overflow-hidden rounded-card bg-card shadow-soft">
      {/*
        NOTHING IS EVER CROPPED. The photo keeps its own aspect ratio, and a tall
        one is made SMALLER rather than trimmed.

        Any fixed ratio would crop, and what it crops is part of a juried
        photograph. Measured over 14 consecutive days the pictures of the day ran
        6996×2516, 3271×3271, 3919×6064 and most things in between, so one
        `aspect-[16/9]` would cut a different limb off the composition every
        morning — on 08-26's lithograph it takes off the engraved title block
        along the bottom.

        `max-h-[520px]` IS A CEILING ON THE PLATE, NOT A CROP. 2 of those 14 days
        were portrait at h/w ~ 1.5, which at this column width is an ~850px image:
        the masthead scrolls away and the first screen becomes the photo and
        nothing else. With `w-auto max-w-full` the two constraints resolve
        themselves — a landscape or square photo (86% of them) is bounded by the
        width and bleeds edge to edge, while a tall one hits the height first and
        shrinks proportionally, centred, with the card's own ground either side.
        No `object-cover` anywhere, so no pixel is thrown away.

        A FIXED px RATHER THAN A vh: the ceiling exists so the plate cannot push
        the day's first article off the screen, and it should be the same plate on
        a phone in portrait, the same phone in landscape, and a desktop window —
        `70vh` would have meant a 200px-tall photo in one of those and an 800px one
        in another, off the same file.

        `width`/`height` stay stated so the browser reserves the right box before
        the bytes land.
      */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="mx-auto block h-auto max-h-[520px] w-auto max-w-full"
        src={photo.src}
        width={photo.width}
        height={photo.height}
        alt=""
      />
      <figcaption className="px-5 py-4">
        {/* THE SAME WEIGHT AND SIZE AS A TAKE'S THESIS — `text-base font-medium`,
            see SIZE.card.thesis in Summary.tsx. Both are the one sentence that
            opens a block and both sit a half step above the prose around them, so
            reading as the same kind of line is correct. `font-medium` is 500,
            which is a real face in both families (the Google Fonts link in
            layout.tsx loads it); asking for a weight that is not loaded gets a
            faked one. */}
        <p className="text-base leading-relaxed font-medium text-ink">
          {captionFor(photo, lang)}
        </p>
        {/*
          THE CREDIT IS A LICENCE CONDITION, NOT A COURTESY. Most pictures of the
          day are CC BY-SA and report `AttributionRequired: true`: the artist, the
          source and the licence all have to be visible, and where there is a deed
          it has to be reachable.

          Hence two destinations rather than one line of text — the Commons file
          page, which holds the file's history and full licence notice, and the
          licence deed itself. `lib/photo.ts` refuses outright any photo missing
          the artist, the licence name, the file page or the image, so the only
          branch left below is the public-domain one.
        */}
        {/* NOT TRUNCATED, however long it runs. The 08-26 lithograph credits four
            people — "Thomas Goldsworthy Dutton / Edward Duncan / George Pechell
            Mends / Adam Cuerden" — and wrapping is the correct outcome: an
            ellipsis in a credit is a licence condition half met.

            WHICH IS WHY IT IS 11px AND NOT `text-xs`. At the caption's size those
            two lines read as an equal half of the plate — the obligation shouting
            as loud as the sentence a reader is actually here for. One step down
            with `leading-snug` keeps it complete and legible while putting it back
            underneath. */}
        <p className="mt-2 text-[11px] leading-snug text-ink-soft">
          <a
            className="hover:text-ink-mid"
            href={photo.filePage}
            target="_blank"
            rel="noopener noreferrer"
          >
            {photo.artist} · {t.photoSource}
          </a>
          {" · "}
          {/* PLAIN TEXT WHEN THERE IS NOTHING TO LINK. Public-domain files carry
              no licence deed, so `license.url` is absent on them and an empty
              href would be a link to this page. The name still prints: "Public
              domain" is information a reader acts on. */}
          {photo.license.url ? (
            <a
              className="hover:text-ink-mid"
              href={photo.license.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              {photo.license.name}
            </a>
          ) : (
            photo.license.name
          )}
        </p>
      </figcaption>
    </figure>
  );
}
