import ConverterApp from "@/components/ConverterApp";
// Global stylesheet for the app (App Router allows global CSS in a page/layout).
import "@/index.css";

// schema.org WebApplication — helps Google build a rich card for the tool.
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Converter · 单位转换",
  description:
    "Free bilingual unit converter (中文 / English) for length, weight, temperature, volume, area, and speed. Click any number to edit, with real-world reference illustrations. No tracking, no signup.",
  url: "https://converter.lab115.com",
  applicationCategory: "UtilityApplication",
  operatingSystem: "Any",
  inLanguage: ["zh-CN", "en-US"],
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  featureList: [
    "Length conversion",
    "Weight conversion",
    "Temperature conversion",
    "Volume conversion",
    "Area conversion",
    "Speed conversion",
    "Real-world reference illustrations",
    "Bilingual (Chinese / English)",
  ],
};

export default function Page() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ConverterApp />
    </>
  );
}
