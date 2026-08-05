import { Graphics } from 'pixi.js';
import { BODY, COLORS, GRIP, STAMINA } from '../config';
import type { Climber } from '../game/climber';
import { solveTwoBoneIk } from '../physics/ik';
import { LIMB_IDS, type LimbId } from '../game/types';
import { lerpColor } from './color';

export interface ClimberViewState {
  /** 光标悬停在哪个肢体上（高亮提示可拖拽） */
  hoveredLimb: LimbId | null;
  /** 被拒绝拾取的肢体，闪红提示"这是最后一个抓点" */
  warnLimb: LimbId | null;
}

export function drawClimber(graphics: Graphics, climber: Climber, state: ClimberViewState): void {
  graphics.clear();

  // 体力越低身体越偏向警告色，不用看 HUD 也能感知到快掉了
  const fatigue = 1 - Math.min(1, climber.stamina / STAMINA.warnThreshold);
  const limbColor = lerpColor(COLORS.limb, COLORS.warn, fatigue * 0.7);
  const torsoColor = lerpColor(COLORS.torso, COLORS.warn, fatigue * 0.5);

  const joints = climber.joints;
  const pelvis = climber.particle(joints.pelvis);
  const chest = climber.particle(joints.chest);
  const head = climber.particle(joints.head);
  const shoulderL = climber.particle(joints.shoulderL);
  const shoulderR = climber.particle(joints.shoulderR);
  const hipL = climber.particle(joints.hipL);
  const hipR = climber.particle(joints.hipR);

  // 正在拖拽的肢体先画可达范围，压在身体下面
  const dragging = climber.draggingLimb;
  if (dragging) {
    const root = climber.particle(dragging.rootIndex);
    graphics
      .circle(root.x, root.y, dragging.reach)
      .stroke({ width: 1.5, color: COLORS.reachHint, alpha: 0.22 });
    graphics
      .circle(root.x, root.y, dragging.reach * GRIP.maxDragStretch)
      .stroke({ width: 1, color: COLORS.reachHint, alpha: 0.12 });
  }

  // 四肢：肘/膝由 IK 反解，画成圆头折线
  for (const id of LIMB_IDS) {
    const limb = climber.limbs[id];
    const root = climber.particle(limb.rootIndex);
    const tip = climber.particle(limb.tipIndex);
    const joint = solveTwoBoneIk(
      root.x,
      root.y,
      tip.x,
      tip.y,
      limb.upperLength,
      limb.lowerLength,
      limb.bendSign,
    );
    const isLeg = id === 'footL' || id === 'footR';
    const width = isLeg ? 9 : 7.5;
    const color = state.warnLimb === id ? COLORS.warn : limbColor;

    graphics.moveTo(root.x, root.y).lineTo(joint.x, joint.y).lineTo(tip.x, tip.y);
    graphics.stroke({ width, color, cap: 'round', join: 'round' });
  }

  // 躯干：肩髋四点围成的多边形 + 一条加粗的脊柱
  graphics
    .poly([shoulderL.x, shoulderL.y, shoulderR.x, shoulderR.y, hipR.x, hipR.y, hipL.x, hipL.y])
    .fill({ color: torsoColor });
  graphics
    .moveTo(pelvis.x, pelvis.y)
    .lineTo(chest.x, chest.y)
    .stroke({ width: 15, color: torsoColor, cap: 'round' });

  // 脖子 + 头
  graphics
    .moveTo(chest.x, chest.y)
    .lineTo(head.x, head.y)
    .stroke({ width: 8, color: torsoColor, cap: 'round' });
  graphics.circle(head.x, head.y, BODY.headRadius).fill({ color: COLORS.head });

  // 手脚末端：抓住的画实心大点，悬空的画小一点，悬停的加一圈提示
  for (const id of LIMB_IDS) {
    const limb = climber.limbs[id];
    const tip = climber.particle(limb.tipIndex);
    const isGripped = limb.state === 'gripped';
    const radius = isGripped ? 6 : 5;

    if (state.hoveredLimb === id || limb.state === 'dragging') {
      graphics
        .circle(tip.x, tip.y, radius + 5)
        .stroke({ width: 2, color: COLORS.reachHint, alpha: 0.55 });
    }
    graphics.circle(tip.x, tip.y, radius).fill({ color: COLORS.extremity });
    graphics
      .circle(tip.x, tip.y, radius)
      .stroke({ width: 2, color: state.warnLimb === id ? COLORS.warn : limbColor });
  }
}
