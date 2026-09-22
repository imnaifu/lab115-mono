import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { PageShell } from "@/components/PageShell";
import { Footer, Masthead, PAD, SECTION } from "@/components/Shell";
import { MAIL_FROM, SITE } from "@/lib/config";
import { strings } from "@/lib/i18n";
import { DEFAULT_LANG, href, isLang } from "@/lib/lang";
import { ABOUT_PATH } from "@/lib/links";
import { alternatesFor, JsonLd, ogCardFor, publisher } from "@/lib/seo";

export const dynamic = "force-dynamic";

/**
 * `/about` — the one page on this site that is entirely ours.
 *
 * WHY IT EARNS A URL on a site that is otherwise summaries of other people's
 * writing: that is exactly why. A daily pile of somebody else's headlines with
 * no page saying who assembled it, by what rule, and what is deliberately thrown
 * away reads as an aggregator with no author — which is both untrue and the
 * thing Google's scaled-content policy is looking for. This page is the answer,
 * and it is the second piece of prose on this site that was written rather than
 * borrowed (`sourcesLead` is the other, and that section is switched off).
 *
 * NOT `force-static` even though nothing here reads the archive: every page
 * under `[lang]` is dynamic because the root layout reads `headers()` for the
 * language the proxy resolved. See the note in app/layout.tsx.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const pageLang = isLang(lang) ? lang : DEFAULT_LANG;
  const t = strings(pageLang);
  const title = `${t.aboutTitle} · ${t.brand}`;
  /* The first paragraph, which is the one that says what this is. `aboutLead` is
     four words of positioning — right over the heading, useless in a result. */
  const description = t.aboutBody[0];

  return {
    title,
    description,
    alternates: alternatesFor(pageLang, ABOUT_PATH),
    openGraph: {
      type: "website",
      title,
      description,
      url: `${SITE}${href(pageLang, ABOUT_PATH)}`,
      siteName: t.brand,
      images: ogCardFor(pageLang, "site"),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ogCardFor(pageLang, "site").map((image) => image.url),
    },
  };
}

/** The reply-to address, which is the one a person should use. `MAIL_FROM` is
 *  `daily.lab115.com <daily@lab115.com>` — a display name and an address — and
 *  only the address belongs on a page. */
const CONTACT = MAIL_FROM.match(/<([^>]+)>/)?.[1] ?? MAIL_FROM;

/**
 * Whether the address is published at all. HIDDEN FOR NOW, by request.
 *
 * SAME SHAPE AS `SOURCE_PAGES_LIVE` in lib/sources, and for the same reason: a
 * section that is coming back should be one boolean away, not a block that was
 * deleted and has to be rebuilt from a diff. Flip this to `true` and both halves
 * return together.
 *
 * IT GATES TWO THINGS, AND THAT IS THE WHOLE POINT OF THE FLAG. The visible
 * 「联系我们」 block is the obvious one; the other is `email` on the `Organization`
 * in the JSON-LD above. Hiding the block while still publishing the address as
 * structured data would not be hiding it — it would be hiding it from the reader
 * and handing it to every crawler that parses the page, which is the opposite of
 * what anybody asking for this could mean.
 *
 * `t.aboutContact` STAYS in lib/i18n rather than going with the block: it is one
 * short string in two languages, and deleting it would make bringing this back a
 * copywriting job instead of a one-character edit.
 */
const CONTACT_LIVE = false;

export default async function AboutPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const t = strings(lang);
  const url = `${SITE}${href(lang, ABOUT_PATH)}`;

  return (
    <PageShell lang={lang} path={ABOUT_PATH}>
      {/**
       * `AboutPage`, and `mainEntity` IS THE ORGANIZATION — which is the whole
       * structured-data point of this URL. Every other page on this site
       * REFERENCES `publisher` by `@id`; this is the page that describes the
       * thing that id names, so a crawler assembling an entity for 每日严选 has
       * somewhere to assemble it from.
       */}
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "AboutPage",
          "@id": url,
          url,
          name: `${t.aboutTitle} · ${t.brand}`,
          description: t.aboutBody[0],
          inLanguage: lang === "zh" ? "zh-CN" : "en-US",
          isPartOf: { "@id": `${SITE}${href(lang, "/")}#site` },
          mainEntity: {
            ...publisher(t.brand),
            description: t.aboutBody[0],
            /* Spread rather than a `?:` so the key is ABSENT when hidden — an
               `email: undefined` would survive into `JSON.stringify` as nothing
               at all here, but the pattern is the one to copy: a field that is
               off should not exist. See `CONTACT_LIVE`. */
            ...(CONTACT_LIVE ? { email: CONTACT } : {}),
          },
        }}
      />

      <Masthead title={t.aboutTitle} lead={t.aboutLead} />

      <section className={`${PAD} flex max-w-prose flex-col gap-4`}>
        {t.aboutBody.map((paragraph, at) => (
          /* `**…**` is written into the strings and is NOT markdown — nothing
             here parses it. It is left visible on purpose: these sentences are
             also the page's `<meta name="description">` and the copy a person
             edits, and a second syntax to strip would be a second thing that can
             be got wrong. If emphasis is ever wanted it belongs in the markup. */
          <p className="text-base leading-[1.85] font-semibold text-ink-mid" key={at}>
            {paragraph.replace(/\*\*/g, "")}
          </p>
        ))}
      </section>

      {/* THE THREE PILLARS, and they are the only place this page makes a claim
          in fewer than a sentence. Each is a promise the rest of the site has to
          keep — see `sourcesLead` and the publish floor — rather than a slogan. */}
      <section className={`${SECTION} ${PAD} grid gap-4 sm:grid-cols-3`}>
        {t.aboutPillars.map(([heading, body]) => (
          <div
            className="rounded-card border border-line px-5 py-4"
            key={heading}
          >
            <h2 className="text-base font-bold text-ink">{heading}</h2>
            <p className="mt-1.5 text-sm leading-relaxed font-semibold text-ink-mid">
              {body}
            </p>
          </div>
        ))}
      </section>

      {CONTACT_LIVE ? (
        <section className={`${SECTION} ${PAD}`}>
          <h2 className="text-sm font-bold text-ink-soft">{t.aboutContact}</h2>
          {/* PLAIN, UNOBFUSCATED. The crawlers obfuscation was invented for are
              long gone; what it reliably stops is a person trying to get in
              touch, which is the only outcome this block wants. */}
          <a
            className="mt-1.5 inline-block text-base font-bold text-ink transition-colors hover:text-orange"
            href={`mailto:${CONTACT}`}
          >
            {CONTACT}
          </a>
        </section>
      ) : null}

      <Footer year={String(new Date().getUTCFullYear())} lang={lang} />
    </PageShell>
  );
}
