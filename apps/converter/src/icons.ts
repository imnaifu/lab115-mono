// Inline SVG illustration map. Keys are referenced by REFS[*].svg and by tab
// icons in <Tabs>. Kept as raw string templates rather than JSX so the original
// SVG markup (with class names like `stroke` / `fill-accent`) can stay verbatim.
// Rendered via dangerouslySetInnerHTML — the strings are static, not user input.

const g = (inner: string) => `<svg viewBox="0 0 60 60">${inner}</svg>`;

export const ICON: Record<string, string> = {
  // ===== Tab icons =====
  tab_length: `<svg viewBox="0 0 24 24"><rect class="stroke" x="2" y="9" width="20" height="7" rx="1"/><line class="stroke" x1="6" y1="9" x2="6" y2="13"/><line class="stroke" x1="10" y1="9" x2="10" y2="13"/><line class="stroke" x1="14" y1="9" x2="14" y2="13"/><line class="stroke" x1="18" y1="9" x2="18" y2="13"/></svg>`,
  tab_weight: `<svg viewBox="0 0 24 24"><path class="stroke" d="M5 9h14l-1.5 11h-11z"/><circle class="stroke" cx="12" cy="6.5" r="2.5"/><line class="stroke" x1="9.5" y1="6.5" x2="14.5" y2="6.5"/></svg>`,
  tab_temp:   `<svg viewBox="0 0 24 24"><path class="stroke" d="M10 14V5a2 2 0 1 1 4 0v9a4 4 0 1 1-4 0z"/><circle class="fill-accent" cx="12" cy="17" r="2.3"/></svg>`,
  tab_volume: `<svg viewBox="0 0 24 24"><path class="stroke" d="M8 4h8v3l-1 1v11a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2V8L8 7z"/><path class="fill-accent" d="M9 13h6v5.5a1.5 1.5 0 0 1-1.5 1.5h-3A1.5 1.5 0 0 1 9 18.5z"/></svg>`,
  tab_area:   `<svg viewBox="0 0 24 24"><rect class="stroke" x="3" y="5" width="18" height="14"/><line class="stroke" stroke-dasharray="1.5 2" x1="3" y1="12" x2="21" y2="12"/><line class="stroke" stroke-dasharray="1.5 2" x1="12" y1="5" x2="12" y2="19"/></svg>`,
  tab_speed:  `<svg viewBox="0 0 24 24"><path class="stroke" d="M3 17a9 9 0 0 1 18 0"/><line class="stroke" x1="12" y1="17" x2="17" y2="9"/><circle class="fill-accent" cx="12" cy="17" r="1.6"/></svg>`,

  // ===== LENGTH =====
  grain: g(`
    <ellipse class="stroke fill-soft" cx="22" cy="36" rx="5" ry="8" transform="rotate(-20 22 36)"/>
    <ellipse class="stroke fill-soft" cx="32" cy="32" rx="5" ry="8" transform="rotate(-20 32 32)"/>
    <ellipse class="stroke fill-accent" cx="42" cy="28" rx="5" ry="8" transform="rotate(-20 42 28)"/>
  `),
  fingernail: g(`
    <path class="stroke fill-soft" d="M16 48 Q14 26 22 16 Q30 6 38 14 Q46 22 44 38 Q42 54 28 54 Q18 54 16 48z"/>
    <path class="fill-accent" d="M24 18 Q30 12 36 18 Q38 24 36 30 Q30 28 24 30 Q22 24 24 18z"/>
    <path class="stroke" d="M24 18 Q30 12 36 18 Q38 24 36 30"/>
  `),
  thumb: g(`
    <path class="stroke fill-accent" d="M22 50 V32 Q22 22 30 18 Q34 16 36 18 Q38 22 36 26 H44 Q48 26 48 30 Q48 32 46 33 Q48 34 48 36 Q48 38 46 39 Q47 40 47 42 Q47 44 45 45 Q46 46 46 48 Q44 50 40 50z"/>
    <line class="stroke" x1="22" y1="32" x2="28" y2="32"/>
  `),
  phone: g(`
    <g class="anim-bob">
      <rect class="stroke fill-soft" x="20" y="8" width="20" height="44" rx="3"/>
      <rect class="fill-accent" x="22.5" y="13" width="15" height="32"/>
      <circle class="fill-ink" cx="30" cy="49" r="1.4"/>
    </g>
  `),
  foot: g(`
    <g class="anim-walk-r" style="transform-origin: 12px 50px;">
      <path class="stroke fill-soft" d="M10 46 Q8 32 16 26 Q26 20 36 22 Q48 24 50 32 Q52 40 46 44 Q40 48 30 48 Q14 48 10 46z"/>
      <circle class="fill-ink" cx="46" cy="28" r="2"/>
      <circle class="fill-ink" cx="42" cy="25.5" r="1.6"/>
      <circle class="fill-ink" cx="38" cy="24" r="1.4"/>
      <circle class="fill-ink" cx="34" cy="23" r="1.2"/>
      <circle class="fill-ink" cx="30" cy="22.5" r="1"/>
    </g>
  `),
  guitar: g(`
    <g class="anim-sway" style="transform-origin: 30px 30px;">
      <rect class="stroke fill-soft" x="29" y="6" width="2" height="20"/>
      <ellipse class="stroke fill-accent" cx="30" cy="40" rx="14" ry="16"/>
      <circle class="stroke fill-ink" cx="30" cy="42" r="4"/>
      <line class="stroke" stroke-width="0.6" x1="30" y1="6" x2="30" y2="56"/>
    </g>
  `),
  person: g(`
    <g class="anim-bob">
      <circle class="stroke fill-soft" cx="30" cy="14" r="6"/>
      <path class="stroke fill-accent" d="M22 26 H38 V42 a4 4 0 0 1 -4 4 H26 a4 4 0 0 1 -4 -4 z"/>
      <line class="stroke" x1="26" y1="46" x2="26" y2="56"/>
      <line class="stroke" x1="34" y1="46" x2="34" y2="56"/>
    </g>
  `),
  car: g(`
    <g class="anim-bob">
      <path class="stroke fill-accent" d="M6 40 L12 28 Q14 24 18 24 H42 Q46 24 48 28 L54 40 V46 H6 z"/>
      <line class="stroke" x1="20" y1="24" x2="20" y2="40"/>
      <line class="stroke" x1="40" y1="24" x2="40" y2="40"/>
      <circle class="stroke fill-ink" cx="18" cy="46" r="5"/>
      <circle class="stroke fill-ink" cx="42" cy="46" r="5"/>
    </g>
  `),
  bus: g(`
    <g class="anim-bob">
      <rect class="stroke fill-accent" x="6" y="18" width="48" height="26" rx="3"/>
      <rect class="fill-soft" x="10" y="22" width="8" height="8"/>
      <rect class="fill-soft" x="22" y="22" width="8" height="8"/>
      <rect class="fill-soft" x="34" y="22" width="8" height="8"/>
      <rect class="fill-soft" x="46" y="22" width="6" height="8"/>
      <line class="stroke" x1="6" y1="36" x2="54" y2="36"/>
      <circle class="stroke fill-ink" cx="16" cy="46" r="4"/>
      <circle class="stroke fill-ink" cx="44" cy="46" r="4"/>
    </g>
  `),
  field: g(`
    <rect class="stroke fill-moss" x="6" y="14" width="48" height="32" rx="2"/>
    <line class="stroke" x1="30" y1="14" x2="30" y2="46"/>
    <circle class="stroke" cx="30" cy="30" r="5" fill="none"/>
    <rect class="stroke" x="6" y="22" width="6" height="16" fill="none"/>
    <rect class="stroke" x="48" y="22" width="6" height="16" fill="none"/>
  `),
  walk: g(`
    <circle class="stroke fill-soft" cx="30" cy="14" r="6"/>
    <line class="stroke" x1="30" y1="20" x2="30" y2="36"/>
    <line class="stroke anim-walk-l" x1="30" y1="36" x2="22" y2="52" style="transform-origin: 30px 36px;"/>
    <line class="stroke anim-walk-r" x1="30" y1="36" x2="38" y2="52" style="transform-origin: 30px 36px;"/>
    <line class="stroke anim-walk-l" x1="30" y1="26" x2="22" y2="34" style="transform-origin: 30px 26px;"/>
    <line class="stroke anim-walk-r" x1="30" y1="26" x2="38" y2="34" style="transform-origin: 30px 26px;"/>
  `),
  road: g(`
    <path class="stroke fill-soft" d="M6 54 L24 22 L36 22 L54 54 z"/>
    <line class="stroke" stroke-dasharray="2 3" x1="30" y1="22" x2="30" y2="54"/>
    <circle class="fill-accent" cx="30" cy="18" r="4"/>
  `),

  // ===== WEIGHT =====
  paperclip: g(`
    <g class="anim-wiggle" style="transform-origin: 30px 30px;">
      <path class="stroke" stroke-width="2.6" fill="none" d="M20 10 V46 a8 8 0 0 0 16 0 V18 a4 4 0 0 0 -8 0 V42"/>
    </g>
  `),
  coin: g(`
    <g class="anim-spin">
      <circle class="stroke fill-accent" cx="30" cy="30" r="22"/>
      <circle class="stroke fill-soft" cx="30" cy="30" r="16"/>
      <text x="30" y="36" text-anchor="middle" font-family="Newsreader, serif" font-size="16"  font-weight="700" fill="#1d1a14">¢</text>
    </g>
  `),
  egg: g(`
    <g class="anim-bob">
      <ellipse class="stroke fill-soft" cx="30" cy="34" rx="14" ry="18"/>
      <ellipse class="fill-paper" cx="26" cy="26" rx="3" ry="5" opacity="0.7"/>
    </g>
  `),
  butter: g(`
    <g class="anim-bob">
      <path class="stroke fill-accent" d="M8 26 L12 22 H46 L52 26 V42 H8 z"/>
      <line class="stroke" x1="12" y1="22" x2="12" y2="26"/>
      <line class="stroke" x1="46" y1="22" x2="46" y2="26"/>
      <line class="stroke" x1="20" y1="22" x2="20" y2="26"/>
      <line class="stroke" x1="28" y1="22" x2="28" y2="26"/>
      <line class="stroke" x1="38" y1="22" x2="38" y2="26"/>
      <text x="30" y="36" text-anchor="middle" font-family="Newsreader, serif" font-size="8"  font-weight="700" fill="#1d1a14">BUTTER</text>
    </g>
  `),
  bread: g(`
    <g class="anim-bob">
      <path class="stroke fill-soft" d="M10 30 Q10 18 22 16 Q30 8 38 16 Q50 18 50 30 V46 H10 z"/>
      <line class="stroke" x1="10" y1="32" x2="50" y2="32"/>
      <line class="stroke" x1="20" y1="38" x2="40" y2="38"/>
      <line class="stroke" x1="20" y1="42" x2="36" y2="42"/>
    </g>
  `),
  sugarbag: g(`
    <path class="stroke fill-soft" d="M14 18 H46 L48 22 V52 H12 V22 z"/>
    <line class="stroke" x1="14" y1="18" x2="18" y2="14"/>
    <line class="stroke" x1="46" y1="18" x2="42" y2="14"/>
    <line class="stroke" x1="18" y1="14" x2="42" y2="14"/>
    <text x="30" y="38" text-anchor="middle" font-family="Newsreader, serif" font-size="11"  font-weight="600" fill="#b94d2e">SUGAR</text>
    <text x="30" y="48" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="6" fill="#5a5043">1 KG</text>
  `),
  bowling: g(`
    <g class="anim-spin">
      <circle class="stroke fill-ink" cx="30" cy="30" r="22"/>
      <circle class="fill-soft" cx="22" cy="22" r="2.2"/>
      <circle class="fill-soft" cx="30" cy="20" r="2.2"/>
      <circle class="fill-soft" cx="26" cy="26" r="2.2"/>
    </g>
  `),
  piano: g(`
    <rect class="stroke fill-ink" x="8" y="14" width="44" height="34"/>
    <rect class="fill-paper" x="12" y="30" width="36" height="14"/>
    <rect class="fill-ink" x="14" y="30" width="2" height="9"/>
    <rect class="fill-ink" x="20" y="30" width="2" height="9"/>
    <rect class="fill-ink" x="28" y="30" width="2" height="9"/>
    <rect class="fill-ink" x="34" y="30" width="2" height="9"/>
    <rect class="fill-ink" x="42" y="30" width="2" height="9"/>
    <line class="stroke" stroke-width="0.6" x1="12" y1="38" x2="48" y2="38"/>
    <rect class="fill-accent" x="14" y="18" width="32" height="10"/>
  `),
  elephant: g(`
    <g class="anim-bob">
      <path class="stroke fill-soft" d="M10 38 Q8 22 22 18 Q34 14 42 22 Q50 24 50 32 Q50 40 44 42 L46 50 H40 L38 44 H22 L20 50 H14 L16 42 Q12 42 10 38z"/>
      <path class="stroke fill-soft" d="M42 22 Q48 22 50 26 L48 30 z"/>
      <path class="stroke fill-soft" d="M22 36 Q22 46 18 50 Q16 48 17 44 Q18 40 22 36z"/>
      <circle class="fill-ink" cx="34" cy="26" r="1.5"/>
    </g>
  `),

  // ===== TEMPERATURE =====
  nitrogen: g(`
    <g class="anim-flicker">
      <path class="stroke fill-accent" d="M30 12 v36 M18 16 l24 28 M42 16 l-24 28 M14 30 h32"/>
      <path class="stroke fill-accent" d="M30 8 l-4 4 l8 0z M30 52 l-4 -4 l8 0z"/>
    </g>
  `),
  snowflake: g(`
    <g class="anim-spin" style="animation-duration: 14s;">
      <path class="stroke" d="M30 8 v44 M11 19 l38 22 M11 41 l38 -22"/>
      <path class="stroke" d="M30 14 l-3 4 l6 0z M30 46 l-3 -4 l6 0z"/>
      <path class="stroke" d="M14 22 l1 5 l5 -1 M46 38 l-1 -5 l-5 1 M14 38 l5 1 l-1 5 M46 22 l-5 -1 l1 5"/>
    </g>
  `),
  ice: g(`
    <g class="anim-bob">
      <path class="stroke fill-soft" d="M10 38 L18 20 H42 L50 38 L42 50 H18 z"/>
      <path class="fill-paper" d="M14 38 L20 26 L28 26 L24 38 z" opacity="0.6"/>
    </g>
  `),
  fridge: g(`
    <rect class="stroke fill-soft" x="14" y="6" width="32" height="48" rx="2"/>
    <line class="stroke" x1="14" y1="22" x2="46" y2="22"/>
    <rect class="fill-ink" x="40" y="12" width="3" height="6"/>
    <rect class="fill-ink" x="40" y="30" width="3" height="10"/>
    <path class="stroke fill-accent" d="M22 30 v6 M19 33 h6 M22 38 v6 M19 41 h6" stroke-width="1.2"/>
  `),
  jacket: g(`
    <path class="stroke fill-accent" d="M14 18 L24 12 L30 18 L36 12 L46 18 L48 30 L42 32 V52 H18 V32 L12 30 z"/>
    <line class="stroke" x1="30" y1="18" x2="30" y2="52"/>
    <circle class="fill-paper" cx="34" cy="26" r="1"/>
    <circle class="fill-paper" cx="34" cy="34" r="1"/>
    <circle class="fill-paper" cx="34" cy="42" r="1"/>
  `),
  room: g(`
    <path class="stroke fill-accent" d="M14 30 H46 V44 H14 z"/>
    <path class="stroke fill-soft" d="M14 30 V20 H46 V30"/>
    <rect class="fill-accent" x="14" y="44" width="6" height="8"/>
    <rect class="fill-accent" x="40" y="44" width="6" height="8"/>
    <line class="stroke" x1="14" y1="36" x2="46" y2="36"/>
  `),
  sun: g(`
    <g class="anim-spin" style="animation-duration: 18s;">
      <circle class="fill-accent" cx="30" cy="30" r="10"/>
      <path class="stroke" d="M30 8 v8 M30 44 v8 M8 30 h8 M44 30 h8 M14 14 l6 6 M40 40 l6 6 M14 46 l6 -6 M40 20 l6 -6" stroke-width="2"/>
    </g>
  `),
  hottub: g(`
    <path class="stroke fill-soft" d="M10 28 H50 V46 a4 4 0 0 1 -4 4 H14 a4 4 0 0 1 -4 -4 z"/>
    <path class="fill-accent" d="M14 36 Q20 32 26 36 T38 36 T50 36 V46 a4 4 0 0 1 -4 4 H14 a4 4 0 0 1 -4 -4 z"/>
    <g class="anim-steam">
      <path class="stroke" stroke-width="1.2" d="M22 22 q2 -4 4 0 q2 4 4 0 M34 22 q2 -4 4 0"/>
    </g>
  `),
  pot: g(`
    <path class="stroke fill-soft" d="M14 24 H46 V46 a4 4 0 0 1 -4 4 H18 a4 4 0 0 1 -4 -4 z"/>
    <rect class="stroke fill-soft" x="8" y="22" width="44" height="4"/>
    <path class="fill-accent" d="M16 32 Q22 28 28 32 T40 32 T46 32 V44 a4 4 0 0 1 -4 4 H20 a4 4 0 0 1 -4 -4 z"/>
    <line class="stroke" x1="20" y1="22" x2="20" y2="18"/>
    <line class="stroke" x1="40" y1="22" x2="40" y2="18"/>
    <g class="anim-steam" style="transform-origin: 30px 18px;">
      <path class="stroke" stroke-width="1.2" d="M22 14 q2 -5 4 0 q2 5 4 0 q2 -5 4 0"/>
    </g>
  `),
  oven: g(`
    <rect class="stroke fill-soft" x="8" y="10" width="44" height="44" rx="2"/>
    <rect class="stroke fill-paper" x="12" y="22" width="36" height="28"/>
    <rect class="fill-accent" x="14" y="24" width="32" height="18"/>
    <g class="anim-flicker">
      <path class="fill-paper" d="M22 38 Q24 30 28 34 Q30 26 34 34 Q38 28 38 38 z"/>
    </g>
    <circle class="fill-ink" cx="18" cy="16" r="1.6"/>
    <circle class="fill-ink" cx="30" cy="16" r="1.6"/>
    <circle class="fill-ink" cx="42" cy="16" r="1.6"/>
  `),
  fire: g(`
    <g class="anim-flicker">
      <path class="stroke fill-accent" d="M30 6 Q22 18 22 26 Q22 32 26 32 Q22 40 26 46 Q30 52 38 46 Q42 40 38 32 Q42 32 42 24 Q42 16 30 6z"/>
      <path class="fill-paper" d="M30 22 Q26 28 28 36 Q30 42 34 38 Q36 32 34 28 Q34 24 30 22z"/>
    </g>
  `),
  lava: g(`
    <g class="anim-flicker">
      <path class="stroke fill-accent" d="M6 44 Q14 36 22 42 Q30 48 38 42 Q46 36 54 44 V54 H6 z"/>
      <circle class="fill-paper" cx="18" cy="40" r="2"/>
      <circle class="fill-paper" cx="34" cy="42" r="1.5"/>
      <circle class="fill-paper" cx="46" cy="40" r="2.5"/>
    </g>
  `),

  // ===== VOLUME =====
  drop: g(`
    <g class="anim-bob">
      <path class="stroke fill-accent" d="M30 8 Q42 26 42 38 a12 12 0 0 1 -24 0 Q18 26 30 8z"/>
      <path class="fill-paper" d="M26 30 Q26 22 30 18 Q28 24 28 30 z" opacity="0.7"/>
    </g>
  `),
  spoon: g(`
    <g class="anim-sway" style="transform-origin: 30px 50px;">
      <ellipse class="stroke fill-soft" cx="30" cy="18" rx="10" ry="14"/>
      <ellipse class="fill-accent" cx="30" cy="20" rx="6" ry="9"/>
      <rect class="stroke fill-soft" x="28" y="30" width="4" height="22" rx="1"/>
    </g>
  `),
  shot: g(`
    <path class="stroke fill-soft" d="M18 16 H42 L40 50 a4 4 0 0 1 -4 4 H24 a4 4 0 0 1 -4 -4 z"/>
    <path class="fill-accent" d="M21 32 H39 L37.5 48 a2 2 0 0 1 -2 2 H24.5 a2 2 0 0 1 -2 -2 z"/>
    <g class="anim-steam" style="transform-origin: 30px 16px;">
      <path class="stroke" stroke-width="1.1" d="M26 12 q2 -3 4 0 q2 3 4 0"/>
    </g>
  `),
  mug: g(`
    <path class="stroke fill-soft" d="M12 18 H40 V48 a4 4 0 0 1 -4 4 H16 a4 4 0 0 1 -4 -4 z"/>
    <path class="stroke" fill="none" d="M40 24 h4 a6 6 0 0 1 0 12 h-4"/>
    <path class="fill-accent" d="M15 26 H37 V47 a2 2 0 0 1 -2 2 H17 a2 2 0 0 1 -2 -2 z"/>
    <g class="anim-steam" style="transform-origin: 26px 16px;">
      <path class="stroke" stroke-width="1.1" d="M20 14 q2 -4 4 0 q2 4 4 0 q2 -4 4 0"/>
    </g>
  `),
  bottle: g(`
    <g class="anim-bob">
      <path class="stroke fill-soft" d="M26 8 H34 V14 Q34 16 36 17 Q40 19 40 24 V50 a4 4 0 0 1 -4 4 H24 a4 4 0 0 1 -4 -4 V24 Q20 19 24 17 Q26 16 26 14 z"/>
      <path class="fill-accent" d="M22 32 H38 V49 a3 3 0 0 1 -3 3 H25 a3 3 0 0 1 -3 -3 z"/>
      <line class="stroke" x1="22" y1="24" x2="38" y2="24"/>
    </g>
  `),
  pint: g(`
    <g class="anim-bob">
      <path class="stroke fill-soft" d="M18 12 H42 L40 50 a4 4 0 0 1 -4 4 H24 a4 4 0 0 1 -4 -4 z"/>
      <path class="fill-accent" d="M20 22 H40 L38.5 49 a2 2 0 0 1 -2 2 H23.5 a2 2 0 0 1 -2 -2 z"/>
      <ellipse class="stroke fill-paper" cx="30" cy="22" rx="10" ry="2"/>
    </g>
  `),
  carton: g(`
    <g class="anim-bob">
      <path class="stroke fill-soft" d="M18 16 H42 L42 22 L46 26 V52 H14 V26 L18 22 z"/>
      <line class="stroke" x1="18" y1="22" x2="42" y2="22"/>
      <rect class="fill-accent" x="20" y="30" width="20" height="14"/>
      <text x="30" y="42" text-anchor="middle" font-family="Newsreader, serif" font-size="9"  font-weight="700" fill="#faf5e8">MILK</text>
    </g>
  `),
  jug: g(`
    <g class="anim-bob">
      <path class="stroke fill-soft" d="M22 12 H32 V18 H42 a4 4 0 0 1 4 4 V50 a4 4 0 0 1 -4 4 H18 a4 4 0 0 1 -4 -4 V22 a4 4 0 0 1 4 -4 H22 z"/>
      <path class="stroke" fill="none" d="M16 24 q-4 2 -4 6 q0 4 4 6"/>
      <rect class="fill-accent" x="20" y="30" width="22" height="14"/>
      <text x="31" y="42" text-anchor="middle" font-family="Newsreader, serif" font-size="10"  font-weight="700" fill="#faf5e8">1 GAL</text>
    </g>
  `),
  bucket: g(`
    <g class="anim-bob">
      <path class="stroke fill-soft" d="M12 18 H48 L44 52 H16 z"/>
      <ellipse class="stroke fill-paper" cx="30" cy="18" rx="18" ry="3"/>
      <path class="fill-accent" d="M16 28 H44 L41 50 H19 z"/>
      <path class="stroke" fill="none" d="M14 18 Q14 6 30 6 Q46 6 46 18"/>
    </g>
  `),
  bathtub: g(`
    <path class="stroke fill-soft" d="M6 22 H54 V36 a8 8 0 0 1 -8 8 H14 a8 8 0 0 1 -8 -8 z"/>
    <path class="fill-accent" d="M10 28 H50 V36 a6 6 0 0 1 -6 6 H16 a6 6 0 0 1 -6 -6 z"/>
    <circle class="fill-ink" cx="50" cy="20" r="2"/>
    <line class="stroke" x1="50" y1="12" x2="50" y2="20" stroke-width="2"/>
    <line class="stroke" x1="14" y1="46" x2="14" y2="52"/>
    <line class="stroke" x1="46" y1="46" x2="46" y2="52"/>
  `),
  tanker: g(`
    <g class="anim-bob">
      <rect class="stroke fill-accent" x="6" y="22" width="32" height="20" rx="6"/>
      <rect class="stroke fill-soft" x="38" y="26" width="14" height="16"/>
      <circle class="stroke fill-ink" cx="14" cy="46" r="4"/>
      <circle class="stroke fill-ink" cx="26" cy="46" r="4"/>
      <circle class="stroke fill-ink" cx="44" cy="46" r="4"/>
      <text x="22" y="36" text-anchor="middle" font-family="Newsreader, serif" font-size="9"  font-weight="700" fill="#faf5e8">OIL</text>
    </g>
  `),

  // ===== AREA =====
  stamp: g(`
    <rect class="stroke fill-soft" x="14" y="14" width="32" height="36" stroke-dasharray="2 2"/>
    <rect class="fill-accent" x="18" y="18" width="24" height="20"/>
    <text x="30" y="46" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="6" fill="#5a5043">POST</text>
  `),
  paper: g(`
    <g class="anim-sway" style="transform-origin: 30px 50px;">
      <path class="stroke fill-paper" d="M14 10 H40 L46 16 V52 H14 z"/>
      <path class="fill-soft" d="M40 10 V16 H46 z"/>
      <line class="stroke" stroke-width="0.6" x1="18" y1="22" x2="42" y2="22"/>
      <line class="stroke" stroke-width="0.6" x1="18" y1="28" x2="42" y2="28"/>
      <line class="stroke" stroke-width="0.6" x1="18" y1="34" x2="42" y2="34"/>
      <line class="stroke" stroke-width="0.6" x1="18" y1="40" x2="36" y2="40"/>
    </g>
  `),
  laptop: g(`
    <g class="anim-bob">
      <path class="stroke fill-soft" d="M14 14 H46 V40 H14 z"/>
      <rect class="fill-accent" x="17" y="17" width="26" height="20"/>
      <path class="stroke fill-soft" d="M8 42 H52 L50 48 H10 z"/>
    </g>
  `),
  door: g(`
    <rect class="stroke fill-accent" x="14" y="6" width="32" height="48"/>
    <rect class="fill-soft" x="18" y="10" width="11" height="18"/>
    <rect class="fill-soft" x="31" y="10" width="11" height="18"/>
    <rect class="fill-soft" x="18" y="32" width="11" height="18"/>
    <rect class="fill-soft" x="31" y="32" width="11" height="18"/>
    <circle class="fill-ink" cx="40" cy="32" r="1.5"/>
  `),
  bed: g(`
    <path class="stroke fill-soft" d="M10 26 H50 V44 H10 z"/>
    <path class="stroke fill-accent" d="M10 32 H50 V44 H10 z"/>
    <rect class="fill-paper" x="14" y="20" width="14" height="8" rx="2"/>
    <line class="stroke" x1="10" y1="44" x2="10" y2="50"/>
    <line class="stroke" x1="50" y1="44" x2="50" y2="50"/>
  `),
  parking: g(`
    <rect class="stroke fill-soft" x="6" y="6" width="48" height="48"/>
    <line class="stroke" x1="20" y1="6" x2="20" y2="54"/>
    <line class="stroke" x1="40" y1="6" x2="40" y2="54"/>
    <text x="30" y="36" text-anchor="middle" font-family="Newsreader, serif" font-size="22"  font-weight="700" fill="#b94d2e">P</text>
  `),
  apt: g(`
    <rect class="stroke fill-soft" x="10" y="10" width="40" height="44"/>
    <rect class="fill-accent" x="14" y="14" width="8" height="8"/>
    <rect class="fill-accent" x="26" y="14" width="8" height="8"/>
    <rect class="fill-accent" x="38" y="14" width="8" height="8"/>
    <rect class="fill-accent" x="14" y="26" width="8" height="8"/>
    <rect class="fill-accent" x="26" y="26" width="8" height="8"/>
    <rect class="fill-accent" x="38" y="26" width="8" height="8"/>
    <rect class="fill-accent" x="14" y="38" width="8" height="8"/>
    <rect class="fill-ink" x="26" y="38" width="8" height="14"/>
    <rect class="fill-accent" x="38" y="38" width="8" height="8"/>
  `),
  court: g(`
    <rect class="stroke fill-moss" x="6" y="14" width="48" height="32"/>
    <line class="stroke" x1="30" y1="14" x2="30" y2="46"/>
    <line class="stroke" stroke-dasharray="2 2" x1="6" y1="30" x2="54" y2="30"/>
    <rect class="stroke" fill="none" x="14" y="20" width="32" height="20"/>
  `),
  park: g(`
    <rect class="stroke fill-moss" x="6" y="14" width="48" height="32"/>
    <circle class="stroke fill-paper" cx="18" cy="26" r="6"/>
    <circle class="stroke fill-paper" cx="42" cy="36" r="5"/>
    <path class="stroke" stroke-dasharray="2 2" d="M6 30 Q30 22 54 36" fill="none"/>
  `),
  town: g(`
    <rect class="stroke fill-soft" x="6" y="34" width="10" height="20"/>
    <rect class="stroke fill-soft" x="18" y="22" width="10" height="32"/>
    <rect class="stroke fill-accent" x="30" y="14" width="12" height="40"/>
    <rect class="stroke fill-soft" x="44" y="26" width="10" height="28"/>
    <rect class="fill-paper" x="33" y="20" width="3" height="3"/>
    <rect class="fill-paper" x="38" y="20" width="3" height="3"/>
    <rect class="fill-paper" x="33" y="28" width="3" height="3"/>
    <rect class="fill-paper" x="38" y="28" width="3" height="3"/>
    <rect class="fill-paper" x="33" y="36" width="3" height="3"/>
    <rect class="fill-paper" x="38" y="36" width="3" height="3"/>
  `),

  // ===== SPEED =====
  snail: g(`
    <g class="anim-bob">
      <circle class="stroke fill-accent" cx="26" cy="34" r="14"/>
      <circle class="stroke fill-soft" cx="26" cy="34" r="9"/>
      <path class="stroke fill-soft" d="M40 38 Q48 34 50 26 Q52 18 46 16 Q42 16 42 22 L44 38 z"/>
      <line class="stroke" x1="42" y1="16" x2="42" y2="10"/>
      <line class="stroke" x1="46" y1="16" x2="48" y2="10"/>
      <circle class="fill-ink" cx="42" cy="10" r="1.4"/>
      <circle class="fill-ink" cx="48" cy="10" r="1.4"/>
    </g>
  `),
  stroll: g(`
    <circle class="stroke fill-soft" cx="30" cy="14" r="5"/>
    <line class="stroke" x1="30" y1="19" x2="30" y2="36"/>
    <line class="stroke anim-walk-l" x1="30" y1="36" x2="24" y2="52" style="transform-origin: 30px 36px; animation-duration: 1.6s;"/>
    <line class="stroke anim-walk-r" x1="30" y1="36" x2="36" y2="52" style="transform-origin: 30px 36px; animation-duration: 1.6s;"/>
  `),
  runner: g(`
    <circle class="stroke fill-accent" cx="36" cy="12" r="5"/>
    <path class="stroke" stroke-width="2.2" d="M36 17 L28 30 L20 32 M28 30 L34 40 L24 52 M34 40 L44 36 L52 44" fill="none"/>
  `),
  bike: g(`
    <g class="anim-bob">
      <circle class="stroke" fill="none" cx="14" cy="40" r="10" stroke-width="2"/>
      <circle class="stroke" fill="none" cx="46" cy="40" r="10" stroke-width="2"/>
      <path class="stroke" stroke-width="2" fill="none" d="M14 40 L24 22 L38 22 L46 40 M30 40 L24 22 M38 22 L38 14 L34 14"/>
      <circle class="fill-accent" cx="30" cy="40" r="2"/>
    </g>
  `),
  sprint: g(`
    <circle class="stroke fill-accent" cx="40" cy="12" r="5"/>
    <path class="stroke" stroke-width="2.2" d="M40 17 L30 28 L20 26 M30 28 L36 42 L24 52 M36 42 L48 38 L54 46" fill="none"/>
    <line class="stroke" stroke-width="1.4" x1="6" y1="14" x2="20" y2="14"/>
    <line class="stroke" stroke-width="1.4" x1="6" y1="22" x2="22" y2="22"/>
    <line class="stroke" stroke-width="1.4" x1="6" y1="30" x2="18" y2="30"/>
  `),
  race: g(`
    <g class="anim-bob">
      <path class="stroke fill-accent" d="M4 36 L10 26 H22 L26 22 H38 L46 26 H54 L56 36 V42 H4 z"/>
      <path class="fill-ink" d="M22 24 H38 L40 30 H20 z"/>
      <circle class="stroke fill-ink" cx="16" cy="44" r="5"/>
      <circle class="stroke fill-ink" cx="46" cy="44" r="5"/>
    </g>
    <line class="stroke" stroke-width="1.2" x1="0" y1="18" x2="18" y2="18"/>
    <line class="stroke" stroke-width="1.2" x1="0" y1="50" x2="20" y2="50"/>
  `),
  train: g(`
    <g class="anim-bob">
      <path class="stroke fill-accent" d="M4 22 Q10 16 24 16 H50 V42 H4 z"/>
      <rect class="fill-soft" x="10" y="22" width="14" height="10"/>
      <rect class="fill-soft" x="28" y="22" width="8" height="10"/>
      <rect class="fill-soft" x="40" y="22" width="8" height="10"/>
      <circle class="stroke fill-ink" cx="14" cy="46" r="3"/>
      <circle class="stroke fill-ink" cx="32" cy="46" r="3"/>
      <circle class="stroke fill-ink" cx="46" cy="46" r="3"/>
    </g>
    <line class="stroke" stroke-width="1.2" x1="0" y1="14" x2="6" y2="14"/>
    <line class="stroke" stroke-width="1.2" x1="0" y1="20" x2="4" y2="20"/>
  `),
  sound: g(`
    <g class="anim-flicker">
      <circle class="fill-accent" cx="18" cy="30" r="3"/>
      <path class="stroke" fill="none" d="M28 18 Q34 30 28 42"/>
      <path class="stroke" fill="none" d="M36 12 Q46 30 36 48"/>
      <path class="stroke" fill="none" d="M44 6 Q56 30 44 54"/>
    </g>
  `),
  jet: g(`
    <g class="anim-bob">
      <path class="stroke fill-accent" d="M6 30 L46 24 L54 28 L46 34 z"/>
      <path class="fill-soft" d="M22 24 L20 12 L26 24 z"/>
      <path class="fill-soft" d="M22 36 L20 48 L26 36 z"/>
      <path class="fill-soft" d="M44 24 L42 18 L48 24 z"/>
      <path class="fill-soft" d="M44 36 L42 42 L48 36 z"/>
    </g>
    <line class="stroke" stroke-width="1.2" x1="0" y1="30" x2="6" y2="30"/>
    <line class="stroke" stroke-width="1.2" x1="0" y1="26" x2="4" y2="26"/>
    <line class="stroke" stroke-width="1.2" x1="0" y1="34" x2="4" y2="34"/>
  `),

  // ===== XL =====
  marathon: g(`
    <line class="stroke" x1="46" y1="8" x2="46" y2="52" stroke-width="2"/>
    <rect class="fill-accent" x="40" y="12" width="8" height="5"/>
    <line class="stroke" x1="40" y1="12" x2="40" y2="17"/>
    <circle class="stroke fill-accent" cx="18" cy="14" r="4"/>
    <path class="stroke" stroke-width="2.2" fill="none" d="M18 18 L12 30 L6 30 M12 30 L16 42 L8 52 M16 42 L24 38 L30 48"/>
  `),
  everest: g(`
    <path class="stroke fill-soft" d="M4 50 L20 18 L28 30 L36 14 L52 38 L56 50 z"/>
    <path class="fill-paper" d="M20 18 L24 26 L28 22 L28 30 L20 18z"/>
    <path class="fill-paper" d="M36 14 L40 22 L46 18 L52 38 L36 14z"/>
  `),
  earth: g(`
    <g class="anim-spin" style="animation-duration: 22s;">
      <circle class="stroke fill-soft" cx="30" cy="30" r="22"/>
      <path class="fill-moss" d="M14 24 Q20 20 26 24 Q28 30 24 32 Q18 36 14 32 Q10 28 14 24z"/>
      <path class="fill-moss" d="M32 18 Q40 18 44 24 Q42 28 38 28 Q32 26 32 18z"/>
      <path class="fill-moss" d="M28 38 Q36 36 44 40 Q42 46 36 46 Q30 44 28 38z"/>
      <circle class="fill-paper" cx="38" cy="22" r="1" opacity="0.7"/>
    </g>
  `),
  moon: g(`
    <circle class="stroke fill-paper" cx="30" cy="30" r="20"/>
    <circle class="fill-soft" cx="36" cy="26" r="16"/>
    <circle class="fill-ink" cx="22" cy="26" r="1.4" opacity="0.4"/>
    <circle class="fill-ink" cx="20" cy="36" r="1" opacity="0.4"/>
    <circle class="fill-ink" cx="26" cy="40" r="1.6" opacity="0.4"/>
  `),
  whale: g(`
    <g class="anim-bob">
      <path class="stroke fill-accent" d="M4 32 Q2 24 10 24 Q22 20 40 24 Q52 26 54 32 Q52 40 38 40 L44 46 L36 42 Q22 42 12 38 Q4 38 4 32z"/>
      <circle class="fill-ink" cx="46" cy="30" r="1.4"/>
      <path class="stroke" fill="none" stroke-width="1.2" d="M10 22 q-2 -6 -4 -10"/>
      <path class="stroke" fill="none" stroke-width="1.2" d="M14 22 q0 -6 2 -10"/>
    </g>
  `),
  ship: g(`
    <g class="anim-bob">
      <path class="stroke fill-accent" d="M6 38 H54 L48 48 H12 z"/>
      <rect class="stroke fill-soft" x="14" y="28" width="32" height="10"/>
      <rect class="fill-paper" x="18" y="22" width="5" height="6"/>
      <rect class="fill-paper" x="26" y="22" width="5" height="6"/>
      <rect class="fill-paper" x="34" y="22" width="5" height="6"/>
      <line class="stroke" x1="30" y1="14" x2="30" y2="22" stroke-width="1.4"/>
      <rect class="fill-ink" x="30" y="14" width="6" height="3"/>
    </g>
    <line class="stroke" stroke-dasharray="2 3" x1="0" y1="52" x2="60" y2="52" stroke-width="1.2"/>
  `),
  sun_disk: g(`
    <g class="anim-spin" style="animation-duration: 16s;">
      <circle class="fill-accent" cx="30" cy="30" r="13"/>
      <g stroke="#b94d2e" stroke-width="2.4" stroke-linecap="round" fill="none">
        <line x1="30" y1="6" x2="30" y2="14"/>
        <line x1="30" y1="46" x2="30" y2="54"/>
        <line x1="6" y1="30" x2="14" y2="30"/>
        <line x1="46" y1="30" x2="54" y2="30"/>
        <line x1="14" y1="14" x2="19" y2="19"/>
        <line x1="41" y1="41" x2="46" y2="46"/>
        <line x1="14" y1="46" x2="19" y2="41"/>
        <line x1="41" y1="19" x2="46" y2="14"/>
      </g>
    </g>
    <g class="anim-flicker">
      <circle class="fill-paper" cx="26" cy="28" r="1.6" opacity="0.6"/>
      <circle class="fill-paper" cx="34" cy="32" r="1.2" opacity="0.6"/>
      <circle class="fill-paper" cx="32" cy="24" r="0.9" opacity="0.6"/>
    </g>
  `),
  pool: g(`
    <rect class="stroke fill-accent" x="6" y="20" width="48" height="28" rx="2"/>
    <path class="fill-paper" d="M10 28 Q16 25 22 28 T34 28 T46 28 V31 Q40 28 34 31 Q28 34 22 31 Q16 28 10 31z" opacity="0.5"/>
    <line class="stroke" stroke-dasharray="2 2" stroke-width="1" x1="6" y1="36" x2="54" y2="36"/>
    <line class="stroke" stroke-dasharray="2 2" stroke-width="1" x1="6" y1="42" x2="54" y2="42"/>
    <line class="stroke" stroke-width="0.8" x1="6" y1="20" x2="6" y2="14"/>
    <line class="stroke" stroke-width="0.8" x1="54" y1="20" x2="54" y2="14"/>
  `),
  city: g(`
    <rect class="stroke fill-soft" x="3" y="34" width="9" height="22"/>
    <rect class="stroke fill-accent" x="13" y="20" width="11" height="36"/>
    <rect class="stroke fill-soft" x="25" y="28" width="7" height="28"/>
    <rect class="stroke fill-accent" x="33" y="10" width="13" height="46"/>
    <rect class="stroke fill-soft" x="47" y="24" width="7" height="32"/>
    <rect class="stroke fill-soft" x="55" y="36" width="5" height="20"/>
    <g class="fill-paper">
      <rect x="15" y="26" width="2" height="2"/><rect x="19" y="26" width="2" height="2"/>
      <rect x="15" y="32" width="2" height="2"/><rect x="19" y="32" width="2" height="2"/>
      <rect x="15" y="38" width="2" height="2"/><rect x="19" y="38" width="2" height="2"/>
      <rect x="36" y="16" width="2" height="2"/><rect x="41" y="16" width="2" height="2"/>
      <rect x="36" y="22" width="2" height="2"/><rect x="41" y="22" width="2" height="2"/>
      <rect x="36" y="28" width="2" height="2"/><rect x="41" y="28" width="2" height="2"/>
      <rect x="36" y="34" width="2" height="2"/><rect x="41" y="34" width="2" height="2"/>
      <rect x="36" y="40" width="2" height="2"/><rect x="41" y="40" width="2" height="2"/>
    </g>
  `),
  iss: g(`
    <g class="anim-bob">
      <rect class="stroke fill-accent" x="26" y="22" width="8" height="18"/>
      <circle class="fill-soft" cx="30" cy="22" r="2"/>
      <line class="stroke" stroke-width="1" x1="30" y1="14" x2="30" y2="22"/>
      <rect class="stroke fill-soft" x="2" y="26" width="22" height="12"/>
      <rect class="stroke fill-soft" x="36" y="26" width="22" height="12"/>
      <g stroke="var(--ink)" stroke-width="0.6">
        <line x1="8" y1="26" x2="8" y2="38"/>
        <line x1="14" y1="26" x2="14" y2="38"/>
        <line x1="19" y1="26" x2="19" y2="38"/>
        <line x1="41" y1="26" x2="41" y2="38"/>
        <line x1="47" y1="26" x2="47" y2="38"/>
        <line x1="52" y1="26" x2="52" y2="38"/>
      </g>
    </g>
  `),
  rocket: g(`
    <g class="anim-bob">
      <path class="stroke fill-soft" d="M30 6 Q22 18 22 32 V44 H38 V32 Q38 18 30 6z"/>
      <circle class="fill-accent" cx="30" cy="22" r="3"/>
      <path class="stroke fill-accent" d="M22 36 L14 42 L22 44 z"/>
      <path class="stroke fill-accent" d="M38 36 L46 42 L38 44 z"/>
      <g class="anim-flicker" style="transform-origin: 30px 50px;">
        <path class="fill-accent" d="M26 44 Q28 52 30 54 Q32 52 34 44 z"/>
        <path class="fill-paper" d="M28 46 Q29 52 30 53 Q31 52 32 46 z"/>
      </g>
    </g>
  `),
  light: g(`
    <g class="anim-flicker">
      <circle class="fill-accent" cx="30" cy="30" r="5"/>
      <g stroke="#b94d2e" stroke-width="1.8" stroke-linecap="round" fill="none">
        <line x1="30" y1="2" x2="30" y2="14"/>
        <line x1="30" y1="46" x2="30" y2="58"/>
        <line x1="2" y1="30" x2="14" y2="30"/>
        <line x1="46" y1="30" x2="58" y2="30"/>
        <line x1="10" y1="10" x2="20" y2="20"/>
        <line x1="40" y1="40" x2="50" y2="50"/>
        <line x1="10" y1="50" x2="20" y2="40"/>
        <line x1="40" y1="20" x2="50" y2="10"/>
      </g>
    </g>
  `),
};
