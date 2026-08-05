import { Graphics } from 'pixi.js';
import { COLORS, VIEW } from '../config';
import type { Climber } from '../game/climber';
import { LIMB_IDS, type Level } from '../game/types';

/** 固定种子的线性同余随机 —— 岩壁纹理每次运行都一样，方便对比截图 */
function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

/** 岩壁比线路左右各宽出多少 */
const WALL_MARGIN = 78;

/**
 * 岩壁是静态的，只画一次。
 * 这里用程序化几何代替原作的 SpriteShape + 手绘贴图 —— 没有美术资源，
 * 但低饱和色块 + 微弱纹理已经足够撑起画面。
 *
 * 宽度不是写死的，而是从关卡抓点范围推出来的：线路窄就画成一根石柱，
 * 线路宽就铺满画面。这样调整关卡几何时构图会自己跟着变，不用手改两处。
 */
export function drawWall(graphics: Graphics, level: Level): void {
  const random = createSeededRandom(20260731);
  graphics.clear();

  let minHoldX = Infinity;
  let maxHoldX = -Infinity;
  for (const hold of level.holds) {
    minHoldX = Math.min(minHoldX, hold.x - hold.radius);
    maxHoldX = Math.max(maxHoldX, hold.x + hold.radius);
  }
  const wallLeft = Math.max(0, minHoldX - WALL_MARGIN);
  const wallRight = Math.min(VIEW.width, maxHoldX + WALL_MARGIN);

  graphics.rect(0, 0, VIEW.width, VIEW.height).fill({ color: COLORS.background });

  // 远景岩体：左右边缘做轻微起伏，避免看起来像个矩形
  const edgeSteps = 12;
  const columnPoints = (inset: number, wobble: number, topPad: number): number[] => {
    const points: number[] = [];
    for (let step = 0; step <= edgeSteps; step++) {
      const t = step / edgeSteps;
      points.push(wallLeft + inset + random() * wobble, topPad + t * (VIEW.height - topPad * 2));
    }
    for (let step = edgeSteps; step >= 0; step--) {
      const t = step / edgeSteps;
      points.push(wallRight - inset - random() * wobble, topPad + t * (VIEW.height - topPad * 2));
    }
    return points;
  };

  graphics.poly(columnPoints(0, 18, 0)).fill({ color: COLORS.rockFar });
  // 近景岩体：内缩一圈、色调略深，制造一点纵深
  graphics.poly(columnPoints(26, 20, 8)).fill({ color: COLORS.rockNear });

  // 岩层纹理线，横向范围跟着石柱走
  const lineLeft = wallLeft + 34;
  const lineRight = wallRight - 34;
  for (let line = 0; line < 10; line++) {
    const y = 26 + line * 42 + random() * 10;
    graphics.moveTo(lineLeft, y);
    for (let x = lineLeft + 40; x <= lineRight; x += 44) {
      graphics.lineTo(x, y + (random() - 0.5) * 12);
    }
    graphics.stroke({ width: 1.5, color: COLORS.rockLine, alpha: 0.5 });
  }

  // 底部软垫，同时给"掉下来"一个视觉落点
  graphics
    .roundRect(wallLeft - 20, VIEW.height - 26, wallRight - wallLeft + 40, 26, 6)
    .fill({ color: COLORS.mat, alpha: 0.9 });
}

/**
 * 抓点每帧重画：需要反映"被谁抓着""是不是目标点""拖拽中的落点预览"。
 * 二十来个圆的开销可以忽略，换来的是状态永远和物理一致。
 */
export function drawHolds(
  graphics: Graphics,
  level: Level,
  climber: Climber,
  snapCandidate: number | null,
): void {
  graphics.clear();

  const occupied = new Set<number>();
  for (const id of LIMB_IDS) {
    const holdIndex = climber.limbs[id].holdIndex;
    if (holdIndex !== null) occupied.add(holdIndex);
  }

  for (let index = 0; index < level.holds.length; index++) {
    const hold = level.holds[index];
    const isTarget = hold.kind === 'target';
    const fill = isTarget
      ? COLORS.holdTarget
      : occupied.has(index)
        ? COLORS.holdOccupied
        : COLORS.hold;
    const rim = isTarget ? COLORS.holdTargetRim : COLORS.holdRim;

    // 落点预览：松手就会抓住的那个点，画一圈外扩的提示环
    if (index === snapCandidate) {
      graphics
        .circle(hold.x, hold.y, hold.radius + 7)
        .stroke({ width: 2, color: rim, alpha: 0.85 });
    }

    graphics.circle(hold.x, hold.y, hold.radius).fill({ color: fill });
    graphics.circle(hold.x, hold.y, hold.radius).stroke({ width: 2, color: rim, alpha: 0.9 });

    // 目标点加一层呼吸感的外环，视线一眼就能找到终点
    if (isTarget) {
      graphics
        .circle(hold.x, hold.y, hold.radius + 5)
        .stroke({ width: 1.5, color: COLORS.holdTarget, alpha: 0.5 });
    }
  }
}
