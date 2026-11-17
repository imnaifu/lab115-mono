import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { PageShell } from "@/components/PageShell";
import { Footer, HEADING, Masthead, PAD, SECTION } from "@/components/Shell";
import { strings } from "@/lib/i18n";
import { DEFAULT_LANG, isLang } from "@/lib/lang";
import { EXTENSION_PATH } from "@/lib/links";
import { alternatesFor } from "@/lib/seo";

export const dynamic = "force-dynamic";

/**
 * `/extension` — the Chrome extension (apps/daily-ext): what it does, the
 * permissions it asks for, and its privacy policy. The store listing's
 * privacy-policy field points here.
 *
 * `noindex, follow` and absent from the sitemap: see `EXTENSION_PATH`.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const pageLang = isLang(lang) ? lang : DEFAULT_LANG;
  const t = strings(pageLang);
  return {
    title: `${t.extTitle} · ${t.brand}`,
    description: t.extBody[0],
    alternates: alternatesFor(pageLang, EXTENSION_PATH),
    robots: { index: false, follow: true },
  };
}

export default async function ExtensionPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const t = strings(lang);

  return (
    <PageShell lang={lang} path={EXTENSION_PATH}>
      <Masthead title={t.extTitle} lead={t.extLead} />

      <section className={`${PAD} flex max-w-prose flex-col gap-4`}>
        {t.extBody.map((paragraph, at) => (
          <p className="text-base leading-[1.85] font-normal text-ink-mid" key={at}>
            {paragraph}
          </p>
        ))}
      </section>

      {/* `id="privacy"` so the store listing (or anyone) can link straight to it. */}
      <section className={`${SECTION} ${PAD} flex max-w-prose flex-col gap-4`} id="privacy">
        <h2 className="text-xl">
          <span className={`${HEADING} inline-block`}>{t.extPrivacyTitle}</span>
        </h2>
        {t.extPrivacy.map((paragraph, at) => (
          <p className="text-base leading-[1.85] font-normal text-ink-mid" key={at}>
            {paragraph}
          </p>
        ))}
      </section>

      <section className={`${SECTION} ${PAD} flex max-w-prose flex-col gap-3`}>
        <h2 className="text-xl">
          <span className={`${HEADING} inline-block`}>{t.extPermsTitle}</span>
        </h2>
        {t.extPerms.map(([name, why]) => (
          <div className="rounded-card bg-page-deep px-5 py-4" key={name}>
            <h3 className="font-display text-base font-extrabold text-ink">{name}</h3>
            <p className="mt-1.5 text-sm leading-relaxed font-normal text-ink-mid">{why}</p>
          </div>
        ))}
      </section>

      <section className={`${SECTION} ${PAD} flex max-w-prose flex-col gap-1`}>
        <p className="text-sm font-normal text-ink-mid">{t.extContact}</p>
        <p className="text-xs font-normal text-ink-soft">{t.extUpdated}</p>
      </section>

      <Footer year={String(new Date().getUTCFullYear())} lang={lang} />
    </PageShell>
  );
}
