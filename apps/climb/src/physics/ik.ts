/**
 * 两段式解析 IK（余弦定理）—— 对应原作用的 com.unity.2d.ik 包。
 *
 * 肘/膝不参与物理模拟，只在渲染时从"根部 + 末端"反解出来。
 * 这样物理只需要照顾 5 个端点，既稳定又便宜，而画出来的肢体弯曲完全正确。
 */

export interface Vec2 {
  x: number;
  y: number;
}

/**
 * @param bendSign 弯曲方向：+1 / -1 决定肘（膝）朝哪一侧鼓出去
 */
export function solveTwoBoneIk(
  rootX: number,
  rootY: number,
  endX: number,
  endY: number,
  upperLength: number,
  lowerLength: number,
  bendSign: number,
): Vec2 {
  const dx = endX - rootX;
  const dy = endY - rootY;
  const rawDistance = Math.hypot(dx, dy);

  // 夹到可解区间内：完全伸直 / 完全折叠时余弦定理会退化，留一点余量避免 NaN 和视觉抖动
  const minReach = Math.abs(upperLength - lowerLength) + 0.001;
  const maxReach = upperLength + lowerLength - 0.001;
  const distance = Math.min(Math.max(rawDistance, minReach), maxReach);

  const dirX = rawDistance > 1e-6 ? dx / rawDistance : 0;
  const dirY = rawDistance > 1e-6 ? dy / rawDistance : 1;

  // 关节到根部的投影距离
  const projection =
    (upperLength * upperLength - lowerLength * lowerLength + distance * distance) / (2 * distance);
  const offset = Math.sqrt(Math.max(0, upperLength * upperLength - projection * projection));

  return {
    x: rootX + dirX * projection - dirY * offset * bendSign,
    y: rootY + dirY * projection + dirX * offset * bendSign,
  };
}
