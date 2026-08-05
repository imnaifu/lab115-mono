import { Application, Graphics, Text } from 'pixi.js';
import { BODY, COLORS, FALL, GRIP, PHYSICS, STAMINA, VIEW } from './config';
import { Climber } from './game/climber';
import { attachInput, updateInputTimers } from './game/input';
import { DEMO_LEVEL } from './game/level';
import { LIMB_IDS } from './game/types';
import { drawClimber } from './render/climberView';
import { drawHolds, drawWall } from './render/levelView';
import { drawStaminaRing } from './ui/stamina';

/** UI 文案集中在这里，要换语言只改这一处 */
const STRINGS = {
  hint: 'drag hands & feet  ·  reach the orange hold  ·  R to reset',
  stamina: 'stamina',
  slipped: 'slipped',
  toppedOut: 'topped out',
  retryHint: 'click or press R',
} as const;

type GameState = 'climbing' | 'falling' | 'won';

const level = DEMO_LEVEL;

const app = new Application();
await app.init({
  width: VIEW.width,
  height: VIEW.height,
  background: COLORS.background,
  antialias: true,
  resolution: Math.min(window.devicePixelRatio || 1, 2),
  autoDensity: true,
});
document.getElementById('stage')!.appendChild(app.canvas);

// ---------------------------------------------------------------- 图层

const wallGraphics = new Graphics();
const holdsGraphics = new Graphics();
const climberGraphics = new Graphics();
const staminaGraphics = new Graphics();
app.stage.addChild(wallGraphics, holdsGraphics, climberGraphics, staminaGraphics);

const textStyle = {
  fontFamily: 'ui-sans-serif, system-ui, -apple-system, sans-serif',
  fontSize: 13,
  fill: COLORS.text,
} as const;

// 提示文字压在底部软垫上 —— 最低一级抓点在 y=396，放在垫子上才不会跟它重叠
const hintText = new Text({ text: STRINGS.hint, style: { ...textStyle, fontSize: 12 } });
hintText.anchor.set(0.5);
hintText.position.set(VIEW.width / 2, VIEW.height - 13);
hintText.alpha = 0.7;

const staminaLabel = new Text({ text: STRINGS.stamina, style: { ...textStyle, fontSize: 10 } });
staminaLabel.anchor.set(0.5, 0);
staminaLabel.position.set(46, 72);
staminaLabel.alpha = 0.6;

const statusText = new Text({ text: '', style: { ...textStyle, fontSize: 26 } });
statusText.anchor.set(0.5);
statusText.position.set(VIEW.width / 2, VIEW.height / 2 - 10);
statusText.visible = false;

const statusHint = new Text({ text: STRINGS.retryHint, style: { ...textStyle, fontSize: 12 } });
statusHint.anchor.set(0.5);
statusHint.position.set(VIEW.width / 2, VIEW.height / 2 + 18);
statusHint.visible = false;

app.stage.addChild(hintText, staminaLabel, statusText, statusHint);

drawWall(wallGraphics, level);

// ---------------------------------------------------------------- 游戏状态

const climber = new Climber();
climber.resetTo(level);

const input = attachInput(app, climber, level);

let gameState: GameState = 'climbing';
let fallTimer = 0;

function setStatus(message: string | null, color: number = COLORS.text): void {
  if (message === null) {
    statusText.visible = false;
    statusHint.visible = false;
    return;
  }
  statusText.text = message;
  statusText.style.fill = color;
  statusText.visible = true;
  statusHint.visible = true;
}

function beginFall(): void {
  gameState = 'falling';
  fallTimer = 0;
  input.enabled = false;
  input.hoveredLimb = null;
  setStatus(STRINGS.slipped, COLORS.warn);
}

function win(): void {
  gameState = 'won';
  input.enabled = false;
  input.hoveredLimb = null;
  setStatus(STRINGS.toppedOut, COLORS.success);
}

function resetLevel(): void {
  climber.resetTo(level);
  gameState = 'climbing';
  fallTimer = 0;
  input.enabled = true;
  input.hoveredLimb = null;
  input.warnLimb = null;
  setStatus(null);
}

function hasReachedTarget(): boolean {
  for (const id of LIMB_IDS) {
    const limb = climber.limbs[id];
    if (limb.state === 'gripped' && limb.holdIndex === level.targetHoldIndex) return true;
  }
  return false;
}

window.addEventListener('keydown', (event) => {
  if (event.key === 'r' || event.key === 'R') resetLevel();
});

// 过关后点画面任意处重来（坠落是自动重置的，不需要点）
app.stage.on('pointerdown', () => {
  if (gameState === 'won') resetLevel();
});

// ---------------------------------------------------------------- 主循环

function updateGame(dt: number): void {
  updateInputTimers(input, dt);

  if (gameState === 'climbing') {
    if (climber.updateStamina(dt)) {
      // 体力耗尽 = 强制脱手，这是这类游戏唯一的"失败"来源
      climber.releaseAllGrips();
      beginFall();
      return;
    }
    if (hasReachedTarget()) {
      win();
      return;
    }
    if (climber.grippedCount === 0 && climber.draggingLimb === null) {
      beginFall();
    }
    return;
  }

  if (gameState === 'falling') {
    fallTimer += dt;
    if (climber.pelvis.y > FALL.resetBelowY || fallTimer > FALL.resetAfterSeconds) {
      resetLevel();
    }
  }
}

function render(): void {
  // 预览和 endDrag 共用 climber.snapCandidate，"看到会抓住"就一定抓得住
  drawHolds(holdsGraphics, level, climber, climber.snapCandidate(level));
  drawClimber(climberGraphics, climber, {
    hoveredLimb: input.hoveredLimb,
    warnLimb: input.warnLimb,
  });
  drawStaminaRing(staminaGraphics, climber.stamina);
}

// 开发期调试句柄：方便在 console / 自动化里读取物理与抓握状态，不进生产构建
if (import.meta.env.DEV) {
  (window as unknown as Record<string, unknown>).__climb = {
    climber,
    level,
    input,
    /** 手动推进一帧，绕开被节流的 requestAnimationFrame */
    advance: (frameSeconds: number) => advance(frameSeconds),
    resetLevel,
    /** 运行时可改，用来在浏览器里直接扫参数调手感（改完不用刷新） */
    config: { BODY, GRIP, PHYSICS, STAMINA },
    snapshot: () => ({
      gameState,
      stamina: Number(climber.stamina.toFixed(3)),
      grippedCount: climber.grippedCount,
      limbs: LIMB_IDS.map((id) => ({
        id,
        state: climber.limbs[id].state,
        holdIndex: climber.limbs[id].holdIndex,
        x: Math.round(climber.limbTip(id).x),
        y: Math.round(climber.limbTip(id).y),
      })),
      pelvis: { x: Math.round(climber.pelvis.x), y: Math.round(climber.pelvis.y) },
    }),
  };
}

let accumulator = 0;

/**
 * 推进一帧。抽成函数是为了让主循环和测试共用同一条路径 ——
 * 浏览器在后台标签页会冻结 requestAnimationFrame，自动化里没法靠真实 ticker
 * 验证坠落/过关这些状态机转移。
 */
function advance(frameSeconds: number): void {
  accumulator += frameSeconds;

  let steps = 0;
  while (accumulator >= PHYSICS.fixedDt && steps < PHYSICS.maxStepsPerFrame) {
    climber.step(PHYSICS.fixedDt, level);
    accumulator -= PHYSICS.fixedDt;
    steps++;
  }
  if (steps >= PHYSICS.maxStepsPerFrame) accumulator = 0;

  updateGame(frameSeconds);
  render();
}

app.ticker.add((ticker) => {
  // 上限 100ms：切标签页回来时不要一次性补几百步
  advance(Math.min(ticker.deltaMS / 1000, 0.1));
});
