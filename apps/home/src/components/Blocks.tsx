/**
 * The flat colour blocks behind the wordmark — Sokosoko's cover arrangement:
 * one tall yellow slab hanging off the top edge with paper discs and pills cut
 * into it, pastel satellites beside it, an ink pill and a pink disc below.
 *
 * Positions are percentages of the screen, so the composition scales instead of
 * reflowing. It is laid out twice: landscape puts the blocks on the right half,
 * `portrait:` stacks them across the top so a phone gets the same picture
 * rather than a squeezed one. Sizes inside the slab are in `vw` so the rows
 * always fit its width, which is itself a share of `vw`.
 *
 * lib/og.tsx draws the same blocks from the same landscape numbers — change
 * both together.
 *
 * Pure decoration: hidden from assistive tech and from the pointer.
 */
export function Blocks() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      <div className="absolute left-[52%] top-[-8%] flex h-[74%] w-[28%] flex-col gap-[1.5vw] rounded-[4vmin] bg-brand px-[2.5vw] pt-[calc(8dvh+2.5vw)] portrait:left-[8%] portrait:top-[-4%] portrait:h-[44%] portrait:w-[58%] portrait:gap-[3vw] portrait:px-[5vw] portrait:pt-[calc(4dvh+6vw)]">
        <div className="flex justify-between">
          <Dot />
          <Dot />
          <Dot />
          <Dot />
          <Dot />
        </div>
        <div className="flex justify-between">
          <Pill long />
          <Pill />
        </div>
        <div className="flex justify-between">
          <Pill />
          <Pill long />
        </div>
      </div>

      <div className="absolute left-[82%] top-[8%] h-[36%] w-[22%] rounded-[4vmin] bg-fill-sky portrait:left-[70%] portrait:top-[6%] portrait:h-[17%] portrait:w-[40%]" />
      <div className="absolute left-[82%] top-[50%] h-[60%] w-[22%] rounded-[4vmin] bg-fill-mint portrait:left-[70%] portrait:top-[26%] portrait:h-[14%] portrait:w-[40%]" />
      <div className="absolute left-[52%] top-[72%] h-[9%] w-[19%] rounded-full bg-ink portrait:left-[8%] portrait:top-[43%] portrait:h-[4.6%] portrait:w-[42%]" />
      <div className="absolute left-[73%] top-[70%] aspect-square w-[7%] rounded-full bg-fill-pink portrait:left-[54%] portrait:top-[42%] portrait:w-[13%]" />
    </div>
  );
}

function Dot() {
  return <div className="size-[3.2vw] rounded-full bg-paper portrait:size-[7vw]" />;
}

function Pill({ long = false }: { long?: boolean }) {
  return (
    <div
      className={`h-[3.2vw] rounded-full bg-paper portrait:h-[7vw] ${
        long ? "w-[14vw] portrait:w-[26vw]" : "w-[7.5vw] portrait:w-[19vw]"
      }`}
    />
  );
}
