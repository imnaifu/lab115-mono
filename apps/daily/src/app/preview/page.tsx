import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { displayTitle } from "@/components/ArticleTitle";
import { strings } from "@/lib/i18n";
import { LANGS, type Lang } from "@/lib/lang";
import { ogUrl, posterBase, posterPartUrl } from "@/lib/links";
import { confirmEmail, digestEmail } from "@/lib/mail/render";
import { posterParts } from "@/lib/share";
import { listDates, readDigest, readLatest, shownArticles } from "@/lib/store";
import { summaryFor } from "@/lib/take";
import type { Digest } from "@/lib/types";

/**
 * Everything this app draws that is NOT a page, on one screen — `/preview`.
 *
 * WHAT IT IS FOR. The site you can look at: `npm run dev` and it is in front of
 * you. The things that are not the site cannot be looked at that way — two emails
 * land in an inbox, the share posters are PNGs the share sheet fetches, and the OG
 * card is only ever seen by an unfurler. All of them are drawn from the same
 * palette and the same lockup as the pages, and all of them used to be checked by
 * sending yourself a test mail or reading a base64 string.
 *
 * IT REPLACED A CLI THAT RAN ITS OWN WEB SERVER. `npm run preview` rendered these
 * into `.preview/` and served the directory over `node:http` on another port — a
 * second static server, a second set of URLs, and a copy of every artifact on disk
 * going stale the moment the code moved. A route inside the app has none of that:
 * the dev server is already running, the paths are the app's own, and there is
 * nothing to invalidate because nothing is written down.
 *
 * IT LINKS AT THE REAL ARTIFACT ROUTES rather than rendering its own copies. The
 * posters come from `/share/…` and the OG cards from `/og/…`, which are the URLs
 * the share sheet and the crawlers hit, so what you are looking at is the path
 * that ships — including its caching and its headers. Only the emails get a
 * preview-only route, because an email has no URL anywhere else.
 *
 * DEV ONLY, gated in proxy.ts. See the note there.
 *
 * NOT A TEST, and it asserts nothing. It renders what ships and puts it where you
 * can see it; whether the result is right is a question for your eyes.
 */
export const dynamic = "force-dynamic";

/** Nothing here should ever be indexed, even if it somehow answers in production. */
export const metadata: Metadata = {
  title: "preview",
  robots: { index: false, follow: false },
};

const CARD = "rounded-card bg-paper p-4 no-underline shadow-soft";

/**
 * The two widths every email is shown at, in CSS px.
 *
 * REAL WIDTHS, NOT A SCALED-DOWN COPY. Each pane is an iframe that is actually
 * this wide, so the `width=device-width` viewport in the message head resolves to
 * this number and the layout does what it would do in that client. A transform on
 * one wide frame would show the desktop layout twice, at two sizes — which is the
 * one thing this is meant to catch.
 *
 * 720 because the message's own column is 600 with 16px of padding either side:
 * anything past ~632 adds cream margin and nothing else, so a desktop reading pane
 * is fully described at 720 and the extra 88px shows that the column IS centred
 * rather than filling.
 *
 * 375 because it is the narrowest width still common — the small iPhone — and the
 * narrow case is the one that breaks. The 600px column has to shrink to 343 there,
 * and it is where a fixed `width` on the photograph, a long subject or an unbroken
 * URL would push the message wider than the screen.
 */
const SIZES = [
  { label: "desktop", width: 720 },
  { label: "mobile", width: 375 },
] as const;

/**
 * How tall a pane is, PER KIND OF MESSAGE rather than one number for both.
 *
 * The digest gets enough for the masthead, the plate and the first card; past that
 * you scroll inside it or open it on its own. The confirmation is a panel and a
 * button and it ENDS — given the digest's height it drew 300px of empty page below
 * itself, twice, once per language, which reads as a message with something
 * missing rather than as a short one.
 */
const HEIGHTS = { digest: 820, confirm: 520 } as const;

/** One email at one width, labelled with the width it is being drawn at. */
function Frame({ src, title, size, height }: {
  src: string;
  title: string;
  size: (typeof SIZES)[number];
  height: number;
}) {
  return (
    <div className="shrink-0">
      <div className="pb-1.5 text-xs font-bold text-ink-soft">
        {size.label} · {size.width}px
      </div>
      <iframe
        title={`${title} · ${size.label}`}
        src={src}
        width={size.width}
        height={height}
        className="block rounded-xl border border-line bg-page"
      />
    </div>
  );
}

/** One language's worth of output. */
function Section({ digest, lang }: { digest: Digest; lang: Lang }) {
  const t = strings(lang);
  const edition = digestEmail(digest, lang);
  const confirm = confirmEmail(lang, "#");
  const shown = shownArticles(digest);
  const top = shown[0];
  /* `posterParts` off the take that will be DRAWN, because the two halves
     paginate differently and the English one may not exist for an archived day. */
  const parts = top ? posterParts(summaryFor(top, lang)) : 0;
  const query = `?date=${digest.date}`;

  return (
    <section className="mb-14">
      <h2 className="mb-4 text-xl font-bold text-ink">
        {t.brand} <span className="font-medium text-ink-soft">/{lang}</span>
      </h2>

      {/* A div holding a link, NOT a link holding an iframe. The card was the
          anchor at first, which puts an interactive region inside a link: the
          iframe eats every click over it — so the pane could not be scrolled and
          the card could not be opened, which is both of its jobs. */}
      {[
        {
          file: `/preview/mail/digest/${lang}${query}`,
          label: edition.subject,
          height: HEIGHTS.digest,
        },
        {
          file: `/preview/mail/confirm/${lang}`,
          label: confirm.subject,
          height: HEIGHTS.confirm,
        },
      ].map((mail) => (
        <div key={mail.file} className={`${CARD} mb-5`}>
          <a className="font-bold text-ink" href={mail.file} target="_blank" rel="noreferrer">
            {mail.label}
          </a>
          <div className="pt-0.5 pb-3 text-xs font-medium text-ink-soft">{mail.file}</div>
          {/* The two panes are the same document the route serves, so what renders
              here is what Resend would send — at both widths at once, side by side,
              which is the comparison the message has to survive. They scroll
              sideways together on a narrow window rather than stacking, so the
              mobile pane never ends up under the fold on its own. */}
          <div className="flex gap-4 overflow-x-auto">
            {SIZES.map((size) => (
              <Frame
                key={size.label}
                src={mail.file}
                title={mail.label}
                size={size}
                height={mail.height}
              />
            ))}
          </div>
        </div>
      ))}

      {/* The poster is 3:4 and there can be five or six of them, so they scroll
          sideways rather than wrapping into a grid that pushes the OG card off the
          screen. */}
      {top && parts > 0 ? (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {Array.from({ length: parts }, (_, at) => at + 1).map((part) => {
            const url = posterPartUrl(posterBase(lang, digest.date, top.id), part);
            return (
              <a key={part} className="shrink-0 no-underline" href={url} target="_blank" rel="noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  width={210}
                  height={280}
                  alt=""
                  className="block w-[210px] rounded-xl border border-line"
                />
                <div className="pt-1.5 text-xs font-medium text-ink-soft">
                  {part} / {parts}
                </div>
              </a>
            );
          })}
        </div>
      ) : (
        <div className="text-sm font-medium text-ink-soft">没有可渲染的海报</div>
      )}

      <a className="mt-5 block no-underline" href={ogUrl(lang, "site")} target="_blank" rel="noreferrer">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={ogUrl(lang, "site")}
          width={520}
          height={273}
          alt=""
          className="block w-full max-w-[520px] rounded-xl border border-line"
        />
        <div className="pt-1.5 text-xs font-medium text-ink-soft">
          {ogUrl(lang, "site")} · 1200×630
        </div>
      </a>

      {top ? (
        <p className="pt-3 text-xs font-medium text-ink-soft">
          海报画的是当天第一篇：{displayTitle(top, lang)}
        </p>
      ) : null}
    </section>
  );
}

export default async function PreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  if (process.env.NODE_ENV === "production") notFound();

  const { date } = await searchParams;
  const digest = date ? await readDigest(date) : await readLatest();
  if (!digest) notFound();

  // The most recent fortnight, as a strip of dates to switch between. Enough to
  // reach a day that paginates differently without listing the whole archive.
  const dates = (await listDates()).slice(0, 14);

  return (
    /* Wide enough for the two mail panes side by side — 720 + 375 plus the gap and
       the card's padding — rather than the article measure the sheet started at. */
    <div className="mx-auto max-w-[1220px] px-6 py-10 pb-16">
      <h1 className="text-2xl font-bold text-ink">daily preview</h1>
      <p className="pt-1.5 text-sm font-medium text-ink-mid">
        {digest.date} · 邮件、分享海报、链接预览卡片，全部按线上代码渲染
      </p>

      <div className="flex flex-wrap gap-2 py-6">
        {dates.map((day) => (
          <a
            key={day}
            href={`/preview?date=${day}`}
            className={`rounded-full px-3 py-1 text-xs font-bold no-underline ${
              day === digest.date ? "bg-ink text-paper" : "bg-card text-ink-mid"
            }`}
          >
            {day}
          </a>
        ))}
      </div>

      {LANGS.map((lang) => (
        <Section key={lang} digest={digest} lang={lang} />
      ))}

      <p className="rounded-card bg-card px-4 py-3 text-xs leading-relaxed font-medium text-ink-soft">
        邮件里的 logo 和链接都是指向 <code>daily.lab115.com</code> 的绝对地址 —— 收件箱里没有相对路径可言，所以这两样在预览里走的是线上站点。确认信的 token 是假的，点进去会落在「链接失效」页。这个路径只在 dev 存在，线上 404。
      </p>
    </div>
  );
}
