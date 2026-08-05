import { BODY, GRIP, PHYSICS, STAMINA } from '../config';
import type { Particle } from '../physics/solver';
import { VerletSolver } from '../physics/solver';
import { findHoldNear } from './level';
import { LIMB_IDS, type Level, type LimbId, type LimbState } from './types';

export interface Limb {
  id: LimbId;
  /** 手/脚在 solver 里的质点下标 */
  tipIndex: number;
  /** 肩/髋在 solver 里的质点下标 */
  rootIndex: number;
  upperLength: number;
  lowerLength: number;
  /** 完全伸直时根到末端的距离 */
  reach: number;
  /** IK 弯曲方向：让肘/膝朝身体外侧鼓出去 */
  bendSign: number;
  state: LimbState;
  holdIndex: number | null;
  /** 光标目标位置（state === 'dragging' 时有效） */
  dragX: number;
  dragY: number;
}

export interface TorsoJoints {
  pelvis: number;
  chest: number;
  head: number;
  shoulderL: number;
  shoulderR: number;
  hipL: number;
  hipR: number;
}

/** 相对髋部的静止姿势偏移。所有骨长约束的 restLength 都从这个姿势量出来，保证自洽。 */
const REST_POSE = {
  pelvis: { x: 0, y: 0 },
  chest: { x: 0, y: -BODY.torsoLength },
  head: { x: 0, y: -BODY.torsoLength - BODY.neckLength },
  shoulderL: { x: -BODY.shoulderHalfWidth, y: -BODY.torsoLength + 2 },
  shoulderR: { x: BODY.shoulderHalfWidth, y: -BODY.torsoLength + 2 },
  hipL: { x: -BODY.hipHalfWidth, y: 2 },
  hipR: { x: BODY.hipHalfWidth, y: 2 },
  handL: { x: -BODY.restHandOffset.x, y: BODY.restHandOffset.y },
  handR: { x: BODY.restHandOffset.x, y: BODY.restHandOffset.y },
  footL: { x: -BODY.restFootOffset.x, y: BODY.restFootOffset.y },
  footR: { x: BODY.restFootOffset.x, y: BODY.restFootOffset.y },
} as const;

const ARM_REACH = BODY.upperArmLength + BODY.forearmLength;
const LEG_REACH = BODY.thighLength + BODY.shinLength;

export class Climber {
  readonly solver = new VerletSolver();
  readonly joints: TorsoJoints;
  readonly limbs: Record<LimbId, Limb>;
  stamina = 1;

  constructor() {
    const { solver } = this;
    const mass = BODY.mass;

    this.joints = {
      pelvis: solver.addParticle(REST_POSE.pelvis.x, REST_POSE.pelvis.y, mass.pelvis),
      chest: solver.addParticle(REST_POSE.chest.x, REST_POSE.chest.y, mass.chest),
      head: solver.addParticle(REST_POSE.head.x, REST_POSE.head.y, mass.head),
      shoulderL: solver.addParticle(REST_POSE.shoulderL.x, REST_POSE.shoulderL.y, mass.shoulder),
      shoulderR: solver.addParticle(REST_POSE.shoulderR.x, REST_POSE.shoulderR.y, mass.shoulder),
      hipL: solver.addParticle(REST_POSE.hipL.x, REST_POSE.hipL.y, mass.hip),
      hipR: solver.addParticle(REST_POSE.hipR.x, REST_POSE.hipR.y, mass.hip),
    };

    const handL = solver.addParticle(REST_POSE.handL.x, REST_POSE.handL.y, mass.hand);
    const handR = solver.addParticle(REST_POSE.handR.x, REST_POSE.handR.y, mass.hand);
    const footL = solver.addParticle(REST_POSE.footL.x, REST_POSE.footL.y, mass.foot);
    const footR = solver.addParticle(REST_POSE.footR.x, REST_POSE.footR.y, mass.foot);

    this.limbs = {
      handL: this.makeLimb('handL', handL, this.joints.shoulderL, BODY.upperArmLength, BODY.forearmLength, ARM_REACH, -1),
      handR: this.makeLimb('handR', handR, this.joints.shoulderR, BODY.upperArmLength, BODY.forearmLength, ARM_REACH, 1),
      footL: this.makeLimb('footL', footL, this.joints.hipL, BODY.thighLength, BODY.shinLength, LEG_REACH, 1),
      footR: this.makeLimb('footR', footR, this.joints.hipR, BODY.thighLength, BODY.shinLength, LEG_REACH, -1),
    };

    this.buildTorsoTruss();
    this.buildLimbConstraints();
  }

  private makeLimb(
    id: LimbId,
    tipIndex: number,
    rootIndex: number,
    upperLength: number,
    lowerLength: number,
    reach: number,
    bendSign: number,
  ): Limb {
    return {
      id,
      tipIndex,
      rootIndex,
      upperLength,
      lowerLength,
      reach,
      bendSign,
      state: 'free',
      holdIndex: null,
      dragX: 0,
      dragY: 0,
    };
  }

  /**
   * 躯干做成刚性桁架：除了骨架本身，还加上交叉斜撑。
   * 只有链式约束的话躯干会像面条一样剪切变形，加了斜撑之后它才能整体旋转而不塌。
   */
  private buildTorsoTruss(): void {
    const j = this.joints;
    const pairs: Array<[number, number]> = [
      [j.pelvis, j.chest],
      [j.chest, j.head],
      [j.pelvis, j.head],
      [j.chest, j.shoulderL],
      [j.chest, j.shoulderR],
      [j.shoulderL, j.shoulderR],
      [j.shoulderL, j.head],
      [j.shoulderR, j.head],
      [j.pelvis, j.hipL],
      [j.pelvis, j.hipR],
      [j.hipL, j.hipR],
      // 斜撑
      [j.pelvis, j.shoulderL],
      [j.pelvis, j.shoulderR],
      [j.chest, j.hipL],
      [j.chest, j.hipR],
      [j.shoulderL, j.hipL],
      [j.shoulderR, j.hipR],
      [j.shoulderL, j.hipR],
      [j.shoulderR, j.hipL],
    ];
    for (const [a, b] of pairs) {
      this.solver.addConstraint(a, b, 'exact', PHYSICS.torsoStiffness);
    }
  }

  /**
   * 每条肢体两条单向约束，正好对应真实肢体的两种受力：
   *  - max：拉不长。拉直了继续拖光标 → 拽动躯干（"拖手换重心"的手感来源）
   *  - min：压不瘪。腿因此能当受压支柱把身体撑在脚点上
   */
  private buildLimbConstraints(): void {
    for (const id of LIMB_IDS) {
      const limb = this.limbs[id];
      const isLeg = id === 'footL' || id === 'footR';
      const foldRatio = isLeg ? BODY.minFold.leg : BODY.minFold.arm;
      this.solver.addConstraint(limb.rootIndex, limb.tipIndex, 'max', PHYSICS.limbStiffness, limb.reach);
      this.solver.addConstraint(
        limb.rootIndex,
        limb.tipIndex,
        'min',
        PHYSICS.limbStiffness,
        limb.reach * foldRatio,
      );
    }
  }

  particle(index: number): Particle {
    return this.solver.particles[index];
  }

  get pelvis(): Particle {
    return this.particle(this.joints.pelvis);
  }

  limbTip(id: LimbId): Particle {
    return this.particle(this.limbs[id].tipIndex);
  }

  limbRoot(id: LimbId): Particle {
    return this.particle(this.limbs[id].rootIndex);
  }

  get grippedCount(): number {
    let count = 0;
    for (const id of LIMB_IDS) if (this.limbs[id].state === 'gripped') count++;
    return count;
  }

  get draggingLimb(): Limb | null {
    for (const id of LIMB_IDS) if (this.limbs[id].state === 'dragging') return this.limbs[id];
    return null;
  }

  // ---------------------------------------------------------------- 交互

  /** 找出光标附近可拾取的肢体末端；优先返回更近的那个 */
  pickLimb(x: number, y: number): LimbId | null {
    let best: LimbId | null = null;
    let bestDistance: number = GRIP.pickRadius;
    for (const id of LIMB_IDS) {
      const tip = this.limbTip(id);
      const distance = Math.hypot(tip.x - x, tip.y - y);
      if (distance <= bestDistance) {
        bestDistance = distance;
        best = id;
      }
    }
    return best;
  }

  /**
   * 尝试开始拖拽。返回 false 表示被拒绝 —— 目前唯一的拒绝原因是
   * 这是最后一个抓点，松开就必掉，直接不给拾取比让玩家白掉一次更友好。
   */
  beginDrag(id: LimbId, x: number, y: number): boolean {
    const limb = this.limbs[id];
    if (limb.state === 'gripped' && this.grippedCount <= 1 && !GRIP.allowReleasingLastGrip) {
      return false;
    }
    limb.state = 'dragging';
    limb.holdIndex = null;
    limb.dragX = x;
    limb.dragY = y;
    return true;
  }

  updateDrag(x: number, y: number): void {
    const limb = this.draggingLimb;
    if (!limb) return;
    limb.dragX = x;
    limb.dragY = y;
  }

  /**
   * 当前拖拽的肢体松手会抓住哪个点，null 表示会落空。
   * UI 的落点预览和 endDrag 共用这一个判定，保证"看到会抓住"和"真的抓住"永远一致。
   */
  snapCandidate(level: Level): number | null {
    const limb = this.draggingLimb;
    if (!limb) return null;

    // 用手/脚质点的真实位置，而不是光标位置。
    // 拖拽是软约束，身体拖不动时手就会落在光标后面 —— 那时候手其实没够到，
    // 预览环也就不该亮。"够不到吸不上"因此由物理本身保证，不需要额外规则。
    const tip = this.particle(limb.tipIndex);
    const holdIndex = findHoldNear(level, tip.x, tip.y, GRIP.snapRadius);
    if (holdIndex === null) return null;

    // 兜底：即使物理有残差也不允许抓住够不到的点。见 GRIP.snapReachTolerance 的注释。
    const root = this.particle(limb.rootIndex);
    const hold = level.holds[holdIndex];
    const rootToHold = Math.hypot(hold.x - root.x, hold.y - root.y);
    if (rootToHold > limb.reach * GRIP.snapReachTolerance) return null;

    return holdIndex;
  }

  /** 松手：能抓住就抓住，否则变成悬空的自由肢体。返回抓住的抓点下标 */
  endDrag(level: Level): number | null {
    const limb = this.draggingLimb;
    if (!limb) return null;
    const holdIndex = this.snapCandidate(level);
    if (holdIndex === null) {
      limb.state = 'free';
      limb.holdIndex = null;
      this.solver.release(limb.tipIndex);
      return null;
    }
    limb.state = 'gripped';
    limb.holdIndex = holdIndex;
    return holdIndex;
  }

  releaseAllGrips(): void {
    for (const id of LIMB_IDS) {
      const limb = this.limbs[id];
      limb.state = 'free';
      limb.holdIndex = null;
      this.solver.release(limb.tipIndex);
    }
  }

  // ---------------------------------------------------------------- 模拟

  /** 一个物理子步。先把抓握/拖拽写成硬约束（钉死质点），再让求解器收敛 */
  step(dt: number, level: Level): void {
    this.applyPins(level);
    this.solver.step(dt);
  }

  private applyPins(level: Level): void {
    this.solver.attachments.length = 0;
    for (const id of LIMB_IDS) {
      const limb = this.limbs[id];

      // 抓握是硬锚点：手扣在岩点上就是不动。这里用 invMass = 0 是对的 ——
      // 每个抓握在建立时都验证过肢体真的够得到，所以不会产生不可行的配置。
      if (limb.state === 'gripped' && limb.holdIndex !== null) {
        const hold = level.holds[limb.holdIndex];
        this.solver.pinTo(limb.tipIndex, hold.x, hold.y);
        continue;
      }

      // 拖拽是软约束，绝不能钉死。钉死会让它变成无限强的作动器，
      // 和被抓住的点形成棘轮、把躯干无限撑开（见 solver.ts 的 Attachment 注释）。
      if (limb.state === 'dragging') {
        this.solver.release(limb.tipIndex);
        const target = this.dragTarget(limb);
        this.solver.attachments.push({
          index: limb.tipIndex,
          x: target.x,
          y: target.y,
          stiffness: GRIP.dragStiffness,
        });
        continue;
      }

      this.solver.release(limb.tipIndex);
    }
  }

  /**
   * 拖拽中的肢体末端实际会被放到哪里。
   * 光标可以拉到 reach 之外 —— 超出的部分经由 'max' 约束变成拽动躯干的力，
   * 这就是"拖手换重心"的手感来源。只设一个上限防止无限拉伸。
   */
  private dragTarget(limb: Limb): { x: number; y: number } {
    const root = this.particle(limb.rootIndex);
    const limit = limb.reach * GRIP.maxDragStretch;
    const dx = limb.dragX - root.x;
    const dy = limb.dragY - root.y;
    const distance = Math.hypot(dx, dy);
    const scale = distance > limit ? limit / distance : 1;
    return { x: root.x + dx * scale, y: root.y + dy * scale };
  }

  /** 返回 true 表示体力刚刚耗尽，调用方应该触发脱手 */
  updateStamina(dt: number): boolean {
    if (this.grippedCount === 0) return false;

    let grippedHands = 0;
    let grippedFeet = 0;
    let armExtensionSum = 0;
    for (const id of LIMB_IDS) {
      const limb = this.limbs[id];
      if (limb.state !== 'gripped') continue;
      if (id === 'footL' || id === 'footR') {
        grippedFeet++;
        continue;
      }
      grippedHands++;
      const root = this.particle(limb.rootIndex);
      const tip = this.particle(limb.tipIndex);
      armExtensionSum += Math.min(1, Math.hypot(tip.x - root.x, tip.y - root.y) / limb.reach);
    }

    const isDragging = this.draggingLimb !== null;

    // 双脚踩稳 + 至少一只手抓着 + 没在动 = 休息姿势
    if (grippedFeet >= 2 && grippedHands >= 1 && !isDragging) {
      this.stamina = Math.min(1, this.stamina + STAMINA.recoverPerSecond * dt);
      return false;
    }

    const support =
      grippedFeet >= 2
        ? STAMINA.supportFactor.twoFeet
        : grippedFeet === 1
          ? STAMINA.supportFactor.oneFoot
          : STAMINA.supportFactor.noFeet;
    const arms =
      grippedHands >= 2
        ? STAMINA.armFactor.twoHands
        : grippedHands === 1
          ? STAMINA.armFactor.oneHand
          : STAMINA.armFactor.noHands;

    // 只统计手臂的伸展度：手臂拉直代表体重全挂在关节上，这才是真正的消耗来源
    const armExtension = grippedHands > 0 ? armExtensionSum / grippedHands : 0;
    const extensionPenalty =
      1 +
      (STAMINA.armExtensionPenalty *
        Math.max(0, armExtension - STAMINA.armExtensionThreshold)) /
        (1 - STAMINA.armExtensionThreshold);
    const dragPenalty = isDragging ? STAMINA.dragMultiplier : 1;

    this.stamina -=
      STAMINA.baseDrainPerSecond * support * arms * extensionPenalty * dragPenalty * dt;
    if (this.stamina <= 0) {
      this.stamina = 0;
      return true;
    }
    return false;
  }

  // ---------------------------------------------------------------- 重置

  /**
   * 把身体摆回关卡起始姿势。
   * 先按静止姿势摊开，再钉住四个起始抓点跑若干步物理让它自己"沉"到一个合法姿势 ——
   * 这样就不用手写每关的初始骨骼位置。
   */
  resetTo(level: Level): void {
    const grips = level.startGrips;
    const handMidX = (level.holds[grips.handL].x + level.holds[grips.handR].x) / 2;
    const handMidY = (level.holds[grips.handL].y + level.holds[grips.handR].y) / 2;
    const footMidX = (level.holds[grips.footL].x + level.holds[grips.footR].x) / 2;
    const footMidY = (level.holds[grips.footL].y + level.holds[grips.footR].y) / 2;

    // 髋部落在手脚之间偏下的位置，接近真实悬挂姿势
    const originX = footMidX + (handMidX - footMidX) * 0.45;
    const originY = footMidY + (handMidY - footMidY) * 0.55;

    const j = this.joints;
    const place = (index: number, offset: { x: number; y: number }) => {
      this.solver.teleport(index, originX + offset.x, originY + offset.y);
    };
    place(j.pelvis, REST_POSE.pelvis);
    place(j.chest, REST_POSE.chest);
    place(j.head, REST_POSE.head);
    place(j.shoulderL, REST_POSE.shoulderL);
    place(j.shoulderR, REST_POSE.shoulderR);
    place(j.hipL, REST_POSE.hipL);
    place(j.hipR, REST_POSE.hipR);
    place(this.limbs.handL.tipIndex, REST_POSE.handL);
    place(this.limbs.handR.tipIndex, REST_POSE.handR);
    place(this.limbs.footL.tipIndex, REST_POSE.footL);
    place(this.limbs.footR.tipIndex, REST_POSE.footR);

    for (const id of LIMB_IDS) {
      const limb = this.limbs[id];
      limb.state = 'gripped';
      limb.holdIndex = grips[id];
      limb.dragX = 0;
      limb.dragY = 0;
    }

    this.stamina = 1;
    this.settle(level, 120);
  }

  private settle(level: Level, steps: number): void {
    for (let step = 0; step < steps; step++) {
      this.step(PHYSICS.fixedDt, level);
    }
    // 沉降过程积累的速度不该带进正式游戏，清掉
    for (const particle of this.solver.particles) {
      particle.prevX = particle.x;
      particle.prevY = particle.y;
    }
  }
}
