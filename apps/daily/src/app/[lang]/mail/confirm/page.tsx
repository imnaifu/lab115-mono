import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { PageShell } from "@/components/PageShell";
import { EndLink, Footer, Masthead, PAD } from "@/components/Shell";
import { strings } from "@/lib/i18n";
import { DEFAULT_LANG, href, isLang } from "@/lib/lang";
import { segmentFor, subscribeContact } from "@/lib/mail/resend";
import { readConfirmToken } from "@/lib/mail/token";

/**
 * Step two of double opt-in, and the only place a reader becomes a contact.
 *
 * A GET WITH A SIDE EFFECT, knowingly. Every confirmation link in every
 * newsletter works this way, and the alternative — a page with a button that
 * POSTs — trades a real cost for a theoretical one: it asks the reader to
 * confirm their confirmation, and it breaks entirely for anyone reading mail in
 * a client that will not run the form. The cost being accepted is that a
 * link-following security scanner can confirm a subscription the reader had not
 * got round to. That reader is a real one who really did submit the form, and
 * they have an unsubscribe link in every issue.
 *
 * IDEMPOTENT BY CONSTRUCTION: `subscribeContact` creates, or updates the
 * existing contact back to subscribed. Following the same link twice is a
 * no-op, which matters because that is exactly what a reader does when the
 * first tap opened the wrong browser.
 */
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const t = strings(isLang(lang) ? lang : DEFAULT_LANG);
  return {
    title: `${t.subscribe} · ${t.brand}`,
    /**
     * A one-off page reached only from a link in an email, carrying a signed
     * token in its query. There is nothing here for an index to hold, and a
     * crawled confirmation URL is a subscription confirmed by a crawler.
     */
    robots: { index: false, follow: false },
  };
}

export default async function ConfirmPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();

  const { t: token } = await searchParams;
  const t = strings(lang);
  const payload = token ? readConfirmToken(token) : null;

  let confirmed = false;
  if (payload) {
    const segment = segmentFor(payload.lang);
    if (segment) {
      try {
        await subscribeContact(payload.email, segment);
        console.log(`[mail] contact confirmed into ${payload.lang}`);
        confirmed = true;
      } catch (error) {
        // The reader sees the same page an expired link produces: from where
        // they are standing, "this did not work, subscribe again" is the whole
        // of the actionable truth either way.
        console.error("[mail] confirm failed:", error);
      }
    } else {
      console.error(`[mail] no segment configured for "${payload.lang}"`);
    }
  }

  return (
    <PageShell lang={lang} path="/">
      <Masthead title={confirmed ? t.confirmedTitle : t.confirmInvalidTitle}>
        <span>{confirmed ? t.confirmedBody : t.confirmInvalidBody}</span>
      </Masthead>

      <div className={PAD}>
        <EndLink
          href={href(lang, "/")}
          label={t.backHome}
          sub={t.tagline}
        />
      </div>

      <Footer year={String(new Date().getFullYear())} lang={lang} />
    </PageShell>
  );
}
