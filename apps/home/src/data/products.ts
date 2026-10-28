export type Product = {
  id: string;
  /** Product name — the same in both languages. */
  name: string;
  /** Where it lives. THE one place to edit when a product moves or launches. */
  url: string;
};

/**
 * What the lab has shipped.
 *
 * The page no longer shows these — it carries only the wordmark — so their one
 * reader is the `Organization`'s `sameAs` in lib/seo.tsx, which tells a crawler
 * these properties belong to the same brand as this domain.
 */
export const PRODUCTS: Product[] = [
  {
    id: "daily",
    name: "Daily Picks",
    url: "https://daily.lab115.com",
  },
  {
    id: "rednote-exporter",
    name: "RedNote Exporter",
    url: "https://chromewebstore.google.com/detail/rednote-exporter/peadpgjojnooldamfigkfbdiahhffjlm",
  },
];
