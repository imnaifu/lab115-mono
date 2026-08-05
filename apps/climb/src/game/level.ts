import { BODY } from '../config';
import type { Hold, Level } from './types';

const ARM_REACH = BODY.upperArmLength + BODY.forearmLength;
const LEG_REACH = BODY.thighLength + BODY.shinLength;

/**
 * Demo 关卡用"梯级"结构生成，而不是手摆点位。
 *
 * 原因是关卡几何被身体尺寸卡得很死，手摆很容易摆出解不开的姿势：
 *  - 同一肢体相邻两步的距离必须 < 该肢体的 reach。
 *    拖拽阶段虽然能拉到 reach 的 1.6 倍去拽动身体，但"抓住"要求真的够得到
 *    （见 GRIP.snapReachTolerance），所以步距不能按拉伸后的距离来设计。
 *  - 手点和脚点的垂直间距必须落在 [手臂最短 + 躯干 + 腿最短, 手臂最长 + 躯干 + 腿最长] 之间。
 *    贴着下限会把约束顶死，求解器只能靠旋转躯干消解，姿势就歪了。
 *
 * 参数化之后这两条都能直接算出来校验（见文件末尾的断言）。
 */
/**
 * 梯级参数受两条几何不变量夹住，两条都是被实测撞出来的：
 *
 *  1. 单步距离 √(drift² + spacing²) 必须明显小于臂展。
 *     拖拽阶段能拉到臂展的 1.6 倍去拽动身体，但"抓住"要求真的够得到
 *     （见 GRIP.snapReachTolerance），所以步距不能按拉伸后的距离设计。
 *     实测 0.85 倍臂展左右是可靠的。
 *
 *  2. 手脚级差 × 单步距离（也就是身体要跨越的**斜边**，不只是垂直距离）
 *     必须落在 [身体最小跨度, 身体最大跨度] 之间。
 *     有横向漂移时这条特别容易踩：级差 4 × 步距 52 = 208 已经超过身体最大跨度 186，
 *     起始姿势直接就是超限的畸形。
 *
 *  另外这个斜边长度还决定重力下的静态姿势：太短(<151)腿会被压到最小折叠、
 *  膝盖横甩出去很丑；160 左右腿保持自然弯曲。
 */
const RUNG_COUNT = 7;
/** 相邻梯级的垂直间距 */
const RUNG_SPACING = 50;
/**
 * 每升一级向右偏移多少。
 * 刻意给得小：漂移越大，身体就越要沿对角完全张开，
 * 领先侧的两条肢体顶到长度上限、另两条松着，姿势会变成很丑的"一字马"。
 * 代价是线路只占画面中间一条窄带 —— 由 levelView 把岩壁画成一根框住线路的石柱来配合。
 */
const RUNG_DRIFT = 16;
/** 最低一级（起始脚点）的高度 */
const BASE_Y = 396;
/** 起点横坐标：让整条线路水平居中于 800 宽画面 */
const LEFT_X = 330;
/** 左右两列的水平间距 */
const COLUMN_SPAN = 60;
/** 手点比脚点高几级 */
const HAND_FOOT_RUNG_GAP = 3;

function rungY(rung: number): number {
  return BASE_Y - rung * RUNG_SPACING;
}

function rungLeftX(rung: number): number {
  return LEFT_X + rung * RUNG_DRIFT;
}

const holds: Hold[] = [];
for (let rung = 0; rung < RUNG_COUNT; rung++) {
  const y = rungY(rung);
  const leftX = rungLeftX(rung);
  // 每隔一级用小点，纯视觉变化，判定上第一版不区分难度
  const kind = rung % 2 === 1 ? 'crimp' : 'jug';
  const radius = kind === 'crimp' ? 9 : 12;
  holds.push({ x: leftX, y, radius, kind });
  holds.push({ x: leftX + COLUMN_SPAN, y, radius, kind });
}

/** 梯级 rung 的左/右抓点在 holds 里的下标 */
function holdIndexAt(rung: number, side: 'left' | 'right'): number {
  return rung * 2 + (side === 'left' ? 0 : 1);
}

/**
 * 目标点比最高一级再高多少（单位：级）。
 * 上限由"脚还踩在低 HAND_FOOT_RUNG_GAP 级、腿完全伸直、躯干刚性"决定 ——
 * 这三条一起卡死了肩膀能升到的最高位置，从而卡死手能够到的最高点。
 * 文件末尾的自检会算这个上限。
 */
const TARGET_RUNG_OFFSET = 0.5;

const topRung = RUNG_COUNT - 1;
const targetHoldIndex = holds.length;
const targetY = rungY(topRung) - Math.round(RUNG_SPACING * TARGET_RUNG_OFFSET);
holds.push({
  x: rungLeftX(topRung) + COLUMN_SPAN / 2,
  y: targetY,
  radius: 15,
  kind: 'target',
});

export const DEMO_LEVEL: Level = {
  name: 'Warm-up ladder',
  holds,
  startGrips: {
    handL: holdIndexAt(HAND_FOOT_RUNG_GAP, 'left'),
    handR: holdIndexAt(HAND_FOOT_RUNG_GAP, 'right'),
    footL: holdIndexAt(0, 'left'),
    footR: holdIndexAt(0, 'right'),
  },
  targetHoldIndex,
};

/** 导出给调试/测试用：按梯级取点，省得在外面手算下标 */
export const DEMO_LADDER = { RUNG_COUNT, HAND_FOOT_RUNG_GAP, holdIndexAt };

/**
 * 开发期几何自检。关卡尺寸和身体尺寸必须相容，摆错了直接在控制台报出来，
 * 而不是等玩起来发现姿势畸形。
 */
if (import.meta.env.DEV) {
  const stepDistance = Math.hypot(RUNG_DRIFT, RUNG_SPACING);
  /** 身体实际要跨越的是手点到脚点的斜边，不只是垂直距离 */
  const bodySpan = stepDistance * HAND_FOOT_RUNG_GAP;
  const minBodySpan =
    ARM_REACH * BODY.minFold.arm + BODY.torsoLength + LEG_REACH * BODY.minFold.leg;
  const maxBodySpan = ARM_REACH + BODY.torsoLength + LEG_REACH;
  /** 步距占臂展的比例，实测超过 ~0.9 就会频繁吸附失败 */
  const stepRatio = stepDistance / ARM_REACH;

  const problems: string[] = [];
  if (stepRatio > 0.9) {
    problems.push(`单步距离 ${stepDistance.toFixed(1)} 占臂展 ${ARM_REACH} 的 ${stepRatio.toFixed(2)}，吸附会频繁失败`);
  }
  if (bodySpan < minBodySpan || bodySpan > maxBodySpan) {
    problems.push(
      `手脚跨度(斜边) ${bodySpan.toFixed(0)} 不在身体可行区间 [${minBodySpan.toFixed(0)}, ${maxBodySpan}]`,
    );
  }

  // 第三条：最后一步够不够得到目标点。
  // 抓最高点时脚还踩在低 HAND_FOOT_RUNG_GAP 级，腿最长 + 躯干刚性一起卡死肩膀的最高位置。
  // （忽略髋部相对髋心 2px 的偏移，偏保守，宁可早报警）
  const lastFootY = rungY(topRung - HAND_FOOT_RUNG_GAP);
  const highestShoulderY = lastFootY - LEG_REACH - BODY.torsoLength;
  const highestHandY = highestShoulderY - ARM_REACH;
  const targetMargin = targetY - highestHandY;
  if (targetMargin < 8) {
    problems.push(
      `目标点 y=${targetY} 超出最后一步可达高度 ${highestHandY.toFixed(0)}（余量仅 ${targetMargin.toFixed(0)}px），` +
        `调小 TARGET_RUNG_OFFSET`,
    );
  }
  if (problems.length > 0) {
    console.warn('[level] 关卡几何与身体尺寸不相容:', problems.join('；'));
  } else {
    console.info(
      `[level] 几何自检通过 · 单步 ${stepDistance.toFixed(1)} (臂展的 ${stepRatio.toFixed(2)}) · ` +
        `手脚跨度 ${bodySpan.toFixed(0)} ∈ [${minBodySpan.toFixed(0)}, ${maxBodySpan}] · ` +
        `目标点余量 ${targetMargin.toFixed(0)}px`,
    );
  }
}

/** 找出离某点最近、且在 snapRadius 之内的抓点；找不到返回 null */
export function findHoldNear(
  level: Level,
  x: number,
  y: number,
  snapRadius: number,
): number | null {
  let bestIndex: number | null = null;
  let bestDistance = Infinity;
  for (let index = 0; index < level.holds.length; index++) {
    const hold = level.holds[index];
    const distance = Math.hypot(hold.x - x, hold.y - y);
    // 大点的判定圈也更大 —— jug 比 crimp 好抓，视觉和手感一致
    if (distance <= snapRadius + hold.radius * 0.5 && distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  }
  return bestIndex;
}
