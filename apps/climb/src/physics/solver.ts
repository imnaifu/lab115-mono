import { PHYSICS } from '../config';

/**
 * Position Based Dynamics 求解器（Verlet 积分 + 距离约束投影）。
 *
 * 为什么不用 matter.js / planck 这类通用刚体引擎：攀爬者本质上就是
 * "几个被钉住的端点 + 一堆骨长约束 + 一个受重力的重心"，用 PBD 直接表达
 * 只需要几十行，而且约束刚度就是手感旋钮 —— 通用引擎的关节 solver 反而
 * 要和它自己的一套 warm-start / baumgarte 参数打架，调不出想要的橡皮感。
 */

export interface Particle {
  x: number;
  y: number;
  /** 上一步位置：Verlet 积分用它隐式表达速度 */
  prevX: number;
  prevY: number;
  /** 质量倒数。0 表示被钉死（抓握中，或正被光标拖拽） */
  invMass: number;
  /** 恢复自由时用来还原质量 */
  baseInvMass: number;
}

export type ConstraintMode =
  /** 双向：距离必须精确等于 restLength（用于躯干骨架） */
  | 'exact'
  /** 单向：只在超出 restLength 时收紧（四肢可以弯曲，但不能拉长） */
  | 'max'
  /** 单向：只在短于 restLength 时撑开（四肢作为受压支柱，不能被压瘪） */
  | 'min';

export interface DistanceConstraint {
  a: number;
  b: number;
  restLength: number;
  stiffness: number;
  mode: ConstraintMode;
}

/**
 * 把某个质点柔性地拉向一个固定位置（拖拽用）。
 *
 * 关键是"柔性"：如果把被拖的末端直接钉死（invMass = 0），它就成了一个
 * 无限强的作动器，永远赢过所有约束。于是会形成棘轮效应 ——
 * 末端被钉在离根部 N 倍臂展处 → 根部被拽过去一点 → 下一帧钳制圈以新根部为圆心
 * 又能往外挪一点 → 身体被无限撑开。有限刚度才能让系统落到真实平衡点。
 */
export interface Attachment {
  index: number;
  x: number;
  y: number;
  /** 每次迭代把质点拉向目标的比例，0..1。越小越软 */
  stiffness: number;
}

export function createParticle(x: number, y: number, mass: number): Particle {
  const invMass = mass > 0 ? 1 / mass : 0;
  return { x, y, prevX: x, prevY: y, invMass, baseInvMass: invMass };
}

export class VerletSolver {
  readonly particles: Particle[] = [];
  readonly constraints: DistanceConstraint[] = [];
  /** 每步由调用方重建（目前只有"正在被拖拽的那条肢体"会往里放一条） */
  readonly attachments: Attachment[] = [];
  gravity = PHYSICS.gravity;

  addParticle(x: number, y: number, mass: number): number {
    this.particles.push(createParticle(x, y, mass));
    return this.particles.length - 1;
  }

  addConstraint(
    a: number,
    b: number,
    mode: ConstraintMode,
    stiffness: number,
    restLength?: number,
  ): DistanceConstraint {
    const constraint: DistanceConstraint = {
      a,
      b,
      mode,
      stiffness,
      restLength: restLength ?? this.distanceBetween(a, b),
    };
    this.constraints.push(constraint);
    return constraint;
  }

  distanceBetween(a: number, b: number): number {
    const pa = this.particles[a];
    const pb = this.particles[b];
    return Math.hypot(pb.x - pa.x, pb.y - pa.y);
  }

  /** 钉住一个质点到指定位置，并让它继承这一步的位移作为速度（松手时能自然被"甩"出去） */
  pinTo(index: number, x: number, y: number): void {
    const particle = this.particles[index];
    particle.prevX = particle.x;
    particle.prevY = particle.y;
    particle.x = x;
    particle.y = y;
    particle.invMass = 0;
  }

  release(index: number): void {
    this.particles[index].invMass = this.particles[index].baseInvMass;
  }

  /** 把质点瞬移到某处并清零速度（重置关卡用） */
  teleport(index: number, x: number, y: number): void {
    const particle = this.particles[index];
    particle.x = particle.prevX = x;
    particle.y = particle.prevY = y;
  }

  step(dt: number): void {
    this.integrate(dt);
    for (let iteration = 0; iteration < PHYSICS.constraintIterations; iteration++) {
      this.projectConstraints();
    }
  }

  private integrate(dt: number): void {
    const gravityStep = this.gravity * dt * dt;
    for (const particle of this.particles) {
      if (particle.invMass === 0) continue;
      const velocityX = (particle.x - particle.prevX) * PHYSICS.velocityDamping;
      const velocityY = (particle.y - particle.prevY) * PHYSICS.velocityDamping;
      particle.prevX = particle.x;
      particle.prevY = particle.y;
      particle.x += velocityX;
      particle.y += velocityY + gravityStep;
    }
  }

  private projectConstraints(): void {
    // 软约束必须放在距离约束**之前**：它每次都会引入一点长度违反，
    // 放在后面的话最后一轮迭代引入的违反就再也没人纠正了（实测残留 17% 的肢体拉伸）。
    // 放在前面则每轮的最后一步总是距离约束投影，收敛状态干净得多。
    for (const attachment of this.attachments) {
      const particle = this.particles[attachment.index];
      if (particle.invMass === 0) continue;
      particle.x += (attachment.x - particle.x) * attachment.stiffness;
      particle.y += (attachment.y - particle.y) * attachment.stiffness;
    }

    for (const constraint of this.constraints) {
      const pa = this.particles[constraint.a];
      const pb = this.particles[constraint.b];
      const weightSum = pa.invMass + pb.invMass;
      // 两端都被钉死 —— 这条约束此刻无从修正，跳过
      if (weightSum === 0) continue;

      const dx = pb.x - pa.x;
      const dy = pb.y - pa.y;
      const distance = Math.hypot(dx, dy);
      if (distance < 1e-6) continue;
      if (constraint.mode === 'max' && distance <= constraint.restLength) continue;
      if (constraint.mode === 'min' && distance >= constraint.restLength) continue;

      const correction = ((distance - constraint.restLength) / distance) * constraint.stiffness;
      const shareA = pa.invMass / weightSum;
      const shareB = pb.invMass / weightSum;
      pa.x += dx * correction * shareA;
      pa.y += dy * correction * shareA;
      pb.x -= dx * correction * shareB;
      pb.y -= dy * correction * shareB;
    }
  }
}
