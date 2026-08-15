import { ImageResponse } from "next/og";
import {
  POSTER_MARK,
  POSTER_WIDTH,
  posterFonts,
  posterHeight,
  posterText,
} from "@/lib/share";
import { sourceOf } from "@/lib/sources";
import { DEFAULT_LANG, isLang } from "@/lib/lang";
import { readArticle } from "@/lib/store";

export const dynamic = "force-dynamic";

/**
 * The shareable poster: one article, whole summary, rendered as a PNG.
 *
 * A route handler rather than Next's `opengraph-image` file convention,
 * because that convention wants a STATIC `size` export and this image's height
 * depends on how long the summary is. The page's `generateMetadata` points
 * og:image here and declares the same computed height, so the meta stays true.
 *
 * Satori has no CSS cascade and no `gap` worth relying on: every box that holds
 * more than one child says `display: flex` explicitly, and spacing is margins.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ lang: string; date: string; id: string }> },
) {
  const { lang, date, id } = await params;
  const found = await readArticle(date, id);
  if (!found) return new Response("Not found", { status: 404 });

  const { article } = found;
  // The poster is written in the language of the page that links to it.
  const summary = article.summary[isLang(lang) ? lang : DEFAULT_LANG];
  const source = sourceOf(article.sourceId);
  const fonts = await posterFonts(
    posterText(article, summary, `${date}每日干货Daily Takes`),
  );
  const height = posterHeight(summary, article.title);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "#fbf3e9",
          color: "#3b3563",
          padding: "56px 60px",
          fontFamily: "Manrope, Noto Sans SC",
        }}
      >
        {/* The brand is the only thing identifying where this came from now
            that the permalink is gone, so it is set as a wordmark rather than
            the small chip it used to be. */}
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={POSTER_MARK} width={48} height={48} alt="" />
            <div
              style={{
                display: "flex",
                marginLeft: 16,
                fontSize: 40,
                fontWeight: 700,
              }}
            >
              每日干货
            </div>
            <div
              style={{
                display: "flex",
                marginLeft: 14,
                fontSize: 24,
                fontWeight: 700,
                color: "#efa050",
                letterSpacing: 1,
              }}
            >
              Daily Takes
            </div>
          </div>
          <div style={{ display: "flex", fontSize: 22, color: "#8a83a8" }}>
            {date}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            marginTop: 40,
            fontSize: 44,
            fontWeight: 700,
            lineHeight: 1.25,
          }}
        >
          {article.title}
        </div>

        <div
          style={{
            display: "flex",
            marginTop: 16,
            fontSize: 20,
            fontWeight: 700,
            color: source.accent,
          }}
        >
          {source.name}
        </div>

        {/* The claim, set apart by the accent rule the site uses for emphasis. */}
        <div
          style={{
            display: "flex",
            marginTop: 32,
            paddingLeft: 20,
            borderLeft: "5px solid #efa050",
            fontSize: 30,
            fontWeight: 700,
            lineHeight: 1.5,
          }}
        >
          {summary.thesis}
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            marginTop: 28,
            fontSize: 22,
            color: "#5f5885",
            lineHeight: 1.85,
          }}
        >
          {(summary.paragraphs ?? []).map((paragraph, i) => (
            <div key={i} style={{ display: "flex", marginTop: i === 0 ? 0 : 14 }}>
              {paragraph}
            </div>
          ))}
        </div>
      </div>
    ),
    { width: POSTER_WIDTH, height, fonts },
  );
}
