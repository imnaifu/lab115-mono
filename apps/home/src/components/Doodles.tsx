import type { ReactNode } from "react";

/**
 * The drawn discs in the white space — Sokosoko's category tiles without their
 * labels: a pastel disc holding a small drawing, drawn the way the design
 * system draws everything, one ink line over flat fills on a 96 grid.
 *
 * Pure decoration, like Blocks: nothing links anywhere and nothing is read off
 * them. An idea, a model, making, play and a spark — the lab in five pictures,
 * but only as mood.
 *
 * Landscape scatters them over the white above the lockup; `portrait:` lines
 * them up in the band between the blocks and the lockup. A screen shorter than
 * 560px (a phone on its side) has no room above the lockup, so they hide there
 * rather than run into it.
 */
export function Doodles() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 [@media(max-height:559px)]:hidden"
    >
      <Disc className="left-[9%] top-[12%] bg-fill-sky portrait:left-[8%] portrait:top-[50%]">
        {/* A lightbulb: an idea. */}
        <path d="M48 14v5M26 22l4 4M70 22l-4 4M18 42h5M73 42h5" className="fill-none" />
        <path d="M40 56a17 17 0 1 1 16 0v6H40Z" className="fill-brand" />
        <path d="M40 40a9 9 0 0 1 7-8" className="fill-none" />
        <rect x={40} y={62} width={16} height={9} rx={3} className="fill-paper" />
        <path d="M44 76h8" className="fill-none" />
      </Disc>

      <Disc className="left-[29%] top-[7%] bg-fill-mint portrait:left-[26%] portrait:top-[52.5%]">
        {/* A robot: the model. */}
        <path d="M48 37V25" className="fill-none" />
        <circle cx={48} cy={21} r={4} className="fill-fill-pink" />
        <rect x={20} y={50} width={7} height={14} rx={3.5} className="fill-fill-sky" />
        <rect x={69} y={50} width={7} height={14} rx={3.5} className="fill-fill-sky" />
        <rect x={26} y={37} width={44} height={40} rx={12} className="fill-paper" />
        <circle cx={39} cy={54} r={4} className="fill-ink" />
        <circle cx={57} cy={54} r={4} className="fill-ink" />
        <path d="M41 66q7 5 14 0" className="fill-none" />
      </Disc>

      <Disc className="left-[19%] top-[27%] bg-fill-lilac portrait:left-[44%] portrait:top-[50%]">
        {/* A pencil: making things. Drawn level, then tipped onto the diagonal. */}
        <g transform="rotate(-45 48 48)">
          <rect x={16} y={40} width={10} height={16} rx={3} className="fill-fill-pink" />
          <rect x={24} y={40} width={40} height={16} className="fill-brand" />
          <path d="M64 40l16 8-16 8Z" className="fill-paper" />
          <path d="M74 45l6 3-6 3Z" className="fill-ink" />
        </g>
      </Disc>

      <Disc className="left-[38%] top-[23%] bg-fill-yellow portrait:left-[62%] portrait:top-[52.5%]">
        {/* A game controller: play. Raised 4 so its bulk sits on the centre. */}
        <g transform="translate(0 -4)">
          <path
            d="M30 36h36a12 12 0 0 1 11.6 8.9l4.6 17.2a7 7 0 0 1-12 6.4L63 61H33l-7.2 7.5a7 7 0 0 1-12-6.4l4.6-17.2A12 12 0 0 1 30 36Z"
            className="fill-paper"
          />
          <path d="M31 45v12M25 51h12" className="fill-none" />
          <circle cx={62} cy={47} r={3} className="fill-fill-pink" />
          <circle cx={69} cy={54} r={3} className="fill-fill-sky" />
        </g>
      </Disc>

      <Disc className="left-[7%] top-[40%] bg-fill-pink portrait:left-[80%] portrait:top-[50%]">
        {/* Sparkles: the spark. */}
        <path
          d="M44 30c2 12 6 16 18 18-12 2-16 6-18 18-2-12-6-16-18-18 12-2 16-6 18-18Z"
          className="fill-brand"
        />
        <path
          d="M66 20c1 6 3 8 9 9-6 1-8 3-9 9-1-6-3-8-9-9 6-1 8-3 9-9Z"
          className="fill-paper"
        />
        <circle cx={68} cy={66} r={3} className="fill-paper" />
      </Disc>
    </div>
  );
}

/**
 * One disc. Landscape sizes it by the screen's width, held between 64 and 120px
 * so it does not balloon on a wide monitor; portrait makes it 13vw so five fit
 * across a phone. The drawing is 72% of the disc, larger and bolder than the
 * design system's CategoryTile (60%, 2.5 line): with no label under it, the
 * drawing has to carry the disc on its own.
 */
function Disc({ className, children }: { className: string; children: ReactNode }) {
  return (
    <div
      className={`absolute grid aspect-square w-[clamp(64px,7vw,120px)] place-items-center rounded-full portrait:w-[13vw] ${className}`}
    >
      <svg
        viewBox="0 0 96 96"
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-[72%] stroke-ink"
      >
        {children}
      </svg>
    </div>
  );
}
