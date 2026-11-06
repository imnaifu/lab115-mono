// Sokosoko-style single-line illustrations: one ink line (art-line) over flat
// pastel fills. The same drawings appear on rednote.lab115.com.
const ART = {
  // a RedNote feed in a browser window — "open a list page first"
  browser: (
    <>
      <rect x="8" y="16" width="80" height="64" rx="6" fill="#fff" />
      <path d="M8 22a6 6 0 0 1 6-6h68a6 6 0 0 1 6 6v6H8Z" fill="var(--fill-sky)" />
      <circle cx="16" cy="22" r="1.5" fill="var(--art-line)" stroke="none" />
      <circle cx="22" cy="22" r="1.5" fill="var(--art-line)" stroke="none" />
      <circle cx="28" cy="22" r="1.5" fill="var(--art-line)" stroke="none" />
      <rect x="16" y="35" width="18" height="22" rx="3" fill="var(--fill-pink)" />
      <rect x="39" y="35" width="18" height="30" rx="3" fill="var(--fill-mint)" />
      <rect x="62" y="35" width="18" height="17" rx="3" fill="var(--fill-yellow)" />
      <rect x="16" y="62" width="18" height="11" rx="3" fill="var(--fill-lilac)" />
      <rect x="62" y="57" width="18" height="16" rx="3" fill="var(--fill-sky)" />
    </>
  ),
  // a phone showing one post with a download badge — "open a post first"
  post: (
    <>
      <rect x="28" y="10" width="38" height="70" rx="7" fill="#fff" />
      <rect x="34" y="18" width="26" height="30" rx="3" fill="var(--well)" />
      <circle cx="53" cy="26" r="3.5" fill="var(--brand)" />
      <path d="M34 46 43 35l6 6 4-4 7 8v1H34Z" fill="var(--fill-mint)" />
      <path d="M35 57h20M35 64h13" />
      <circle cx="66" cy="70" r="13" fill="var(--brand)" />
      <path d="M66 63v13m-5-5 5 5 5-5" />
    </>
  ),
};

export default function Illust({ name, className = '' }) {
  return (
    <svg
      viewBox="0 0 96 96"
      aria-hidden="true"
      fill="none"
      stroke="var(--art-line)"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {ART[name]}
    </svg>
  );
}
