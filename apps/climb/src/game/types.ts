export type LimbId = 'handL' | 'handR' | 'footL' | 'footR';

export const LIMB_IDS: readonly LimbId[] = ['handL', 'handR', 'footL', 'footR'];

export type LimbState =
  /** 悬空，不承重 */
  | 'free'
  /** 抓在某个点上，钉死并承重 */
  | 'gripped'
  /** 正被光标拖着 */
  | 'dragging';

export type HoldKind =
  /** 大手点，好抓 */
  | 'jug'
  /** 小点，视觉上更小（第一版不影响判定，留给后续做难度差异） */
  | 'crimp'
  /** 目标点，抓到即过关 */
  | 'target';

export interface Hold {
  x: number;
  y: number;
  radius: number;
  kind: HoldKind;
}

export interface Level {
  name: string;
  holds: Hold[];
  /** 开局四肢各抓在哪个抓点上（holds 数组下标） */
  startGrips: Record<LimbId, number>;
  targetHoldIndex: number;
}
