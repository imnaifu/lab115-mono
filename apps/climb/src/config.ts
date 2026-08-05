/**
 * 所有可调参数集中在这里 —— 手感调校只改这个文件。
 * 长度单位 = 逻辑像素（800x450 画布内）；时间单位 = 秒。
 */

export const VIEW = {
  width: 800,
  height: 450,
} as const;

export const PHYSICS = {
  gravity: 1500,
  /** 固定步长积分：和帧率解耦，保证不同刷新率下手感一致 */
  fixedDt: 1 / 120,
  /** 单帧最多补几步，防止切标签页回来后一次性追赶几千步 */
  maxStepsPerFrame: 8,
  /** 每步速度衰减，值越小身体摆动停得越快 */
  velocityDamping: 0.994,
  /** PBD 约束迭代次数：越高身体越"硬"，越低越橡皮 */
  constraintIterations: 12,
  /** 躯干桁架刚度。给满 1：躯干被拉长是最容易被察觉的畸形，不留余量 */
  torsoStiffness: 1,
  /**
   * 四肢长度约束的刚度。给得偏硬（0.92）：
   * "拖手拽动身体"正是靠这条约束传力，硬一点传得更直接、肢体拉伸残差也更小。
   * 太软的话拖拽会先把肢体抽长，才慢慢带动身体，看起来像橡皮筋。
   */
  limbStiffness: 0.92,
} as const;

/**
 * 整体体型缩放。改这一个数就能等比放大/缩小攀爬者。
 * 1.3 是为了让角色在 800x450 里够醒目（约 140px 高），
 * 同时把臂展提到 62、腿展提到 72，让关卡不必挤成密密麻麻的小点。
 */
const BODY_SCALE = 1.3;
const scaled = (base: number) => Math.round(base * BODY_SCALE);

export const BODY = {
  /** 髋 → 胸 */
  torsoLength: scaled(40),
  /** 胸 → 头 */
  neckLength: scaled(14),
  headRadius: scaled(10),
  shoulderHalfWidth: scaled(14),
  hipHalfWidth: scaled(11),
  upperArmLength: scaled(24),
  forearmLength: scaled(24),
  thighLength: scaled(28),
  shinLength: scaled(28),
  /** 静止姿势里手/脚相对髋部的偏移，跟着体型一起缩放 */
  restHandOffset: { x: scaled(30), y: scaled(-32) },
  restFootOffset: { x: scaled(16), y: scaled(44) },
  /**
   * 四肢最多能折叠到 reach 的多少比例。
   * 这条"防压缩"约束让腿变成受压支柱（能站在脚点上把身体撑起来），
   * 没有它的话重力会把髋部一路压到脚上、膝盖甩出体外。
   * 手臂给得更松一些，因为攀爬时确实会把身体拉到贴近岩壁。
   */
  minFold: {
    arm: 0.34,
    // 腿留足余量：一旦顶到这个下限，膝盖会被 IK 甩到体侧极远处、看起来像根横杠
    leg: 0.45,
  },
  /** 各质点质量：髋最重，所以重心自然落在髋部附近 */
  mass: {
    pelvis: 2.4,
    chest: 1.6,
    head: 0.6,
    shoulder: 0.5,
    hip: 0.5,
    hand: 0.35,
    foot: 0.5,
  },
} as const;

export const GRIP = {
  /** 点击拾取肢体末端的判定半径 */
  pickRadius: 26,
  /** 松手时，手脚落点距抓点圆心多远以内算抓住 */
  snapRadius: 24,
  /**
   * 拖拽的软约束刚度（每次约束迭代把手/脚拉向光标的比例）。
   * 必须明显软于躯干和骨长约束，否则它会赢过它们、把身体撑开。
   * 调大 = 跟手但容易拉变形；调小 = 拖起来发黏。
   */
  dragStiffness: 0.35,
  /**
   * 拖拽目标点离肢体根部最远多少倍臂长。
   * 软约束的拉力与距离成正比，这个钳制是给拉力设上限，
   * 防止光标甩到画面另一头时产生一个大到能压过所有约束的力。
   */
  maxDragStretch: 1.6,
  /**
   * 吸附时抓点必须落在 reach 的这个倍数以内。
   * 拖拽阶段可以拉到 maxDragStretch 那么远（靠钉死末端硬拽身体），
   * 但"抓住"必须是肢体真的够得到 —— 否则松手后身体被其它抓点拉回，
   * 那条超长的 max 约束在有限迭代内解不开，手臂就变成橡皮筋。
   */
  snapReachTolerance: 1.02,
  /**
   * 是否允许松开"最后一个抓点"。
   * false = 拒绝拾取（给出红色警告），对新手更友好；
   * true = 允许，然后你就掉下去，纯物理规则。
   */
  allowReleasingLastGrip: false,
} as const;

/**
 * 体力模型刻意区分手和脚：踩住脚点是省力的，真正累的是把体重挂在手上。
 * 于是策略压力变成"先把脚放好，再动手" —— 这也是真实攀爬的核心技巧。
 */
export const STAMINA = {
  /** 基准每秒消耗，后面所有系数都乘在它上面 */
  baseDrainPerSecond: 0.055,
  /** 脚点支撑带来的缩放：两只脚踩稳几乎不累，一只脚都没踩就是全身挂在手上 */
  supportFactor: {
    twoFeet: 0.42,
    oneFoot: 0.78,
    noFeet: 1.5,
  },
  /** 手点数量带来的缩放：单手悬挂最费，纯靠脚站着最省 */
  armFactor: {
    twoHands: 1,
    oneHand: 1.75,
    noHands: 0.5,
  },
  /** 手臂伸展超过这个比例才开始额外惩罚（收紧的姿势不该被罚） */
  armExtensionThreshold: 0.6,
  /** 手臂拉到完全伸直时的额外消耗系数 */
  armExtensionPenalty: 1.2,
  /** 拖动肢体时的额外消耗倍率 */
  dragMultiplier: 1.3,
  /** 双脚踩稳 + 至少一只手抓着 + 没在拖动 = 休息姿势，每秒回复 */
  recoverPerSecond: 0.1,
  /** 低于这个值开始变色报警 */
  warnThreshold: 0.3,
} as const;

export const FALL = {
  /** 髋部掉到这个 y 以下就算落地，触发重置 */
  resetBelowY: VIEW.height + 80,
  /** 或者坠落超过这么久也重置（防止卡在半空） */
  resetAfterSeconds: 1.6,
} as const;

/** 克制的低饱和配色 —— 对应原作被评论提到的 "calm color palette" */
export const COLORS = {
  background: 0xe6e2d9,
  rockFar: 0xd9d3c6,
  rockNear: 0xcbc3b3,
  rockLine: 0xbcb3a2,
  mat: 0x9aa39b,
  hold: 0x8b9a8c,
  holdRim: 0x6f7e6f,
  holdOccupied: 0xafbcab,
  holdTarget: 0xd98c5f,
  holdTargetRim: 0xb97146,
  reachHint: 0x46525c,
  torso: 0x3d4852,
  limb: 0x505f6a,
  head: 0x333e47,
  extremity: 0xe3dfd6,
  staminaHigh: 0x6f9e72,
  staminaMid: 0xd0a05c,
  staminaLow: 0xc35f49,
  staminaTrack: 0xb4ada0,
  text: 0x47525c,
  warn: 0xc35f49,
  success: 0x5f8f63,
} as const;
