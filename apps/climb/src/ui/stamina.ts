import { Graphics } from 'pixi.js';
import { COLORS, STAMINA } from '../config';
import { lerpColor } from '../render/color';

const RING = {
  centerX: 46,
  centerY: 46,
  radius: 20,
  thickness: 6,
} as const;

/**
 * 塞尔达式体力圆环。从 12 点方向顺时针填充。
 * 放在固定 HUD 位置而不是跟着角色走 —— 角色贴到画面顶部时跟随版会被裁掉。
 */
export function drawStaminaRing(graphics: Graphics, stamina: number): void {
  graphics.clear();

  graphics
    .circle(RING.centerX, RING.centerY, RING.radius)
    .stroke({ width: RING.thickness, color: COLORS.staminaTrack, alpha: 0.55 });

  if (stamina <= 0) return;

  // 高 → 中 → 低 两段插值，绿到橙到红
  const color =
    stamina > 0.5
      ? lerpColor(COLORS.staminaMid, COLORS.staminaHigh, (stamina - 0.5) / 0.5)
      : lerpColor(COLORS.staminaLow, COLORS.staminaMid, stamina / 0.5);

  // 必须先 moveTo 到弧的起点：Pixi v8 的 stroke() 不重置路径，
  // 直接 arc() 会从上一个 circle() 的终点连一条线过来
  const start = -Math.PI / 2;
  graphics
    .moveTo(RING.centerX, RING.centerY - RING.radius)
    .arc(RING.centerX, RING.centerY, RING.radius, start, start + Math.PI * 2 * stamina)
    .stroke({ width: RING.thickness, color, cap: 'round' });

  // 见底时补一个内圈闪烁提示
  if (stamina < STAMINA.warnThreshold) {
    graphics
      .circle(RING.centerX, RING.centerY, RING.radius - RING.thickness)
      .stroke({ width: 1.5, color: COLORS.staminaLow, alpha: 0.5 });
  }
}
