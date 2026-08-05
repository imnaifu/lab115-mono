import type { Application, FederatedPointerEvent } from 'pixi.js';
import type { Climber } from './climber';
import type { Level, LimbId } from './types';

export interface InputState {
  pointerX: number;
  pointerY: number;
  /** 光标下可拾取的肢体，用于渲染悬停提示 */
  hoveredLimb: LimbId | null;
  /** 拾取被拒绝的肢体（最后一个抓点），配合 warnTimer 做短暂闪红 */
  warnLimb: LimbId | null;
  warnTimer: number;
  /** 坠落/过关时关掉输入 */
  enabled: boolean;
}

const WARN_DURATION = 0.55;

export function attachInput(app: Application, climber: Climber, level: Level): InputState {
  const state: InputState = {
    pointerX: 0,
    pointerY: 0,
    hoveredLimb: null,
    warnLimb: null,
    warnTimer: 0,
    enabled: true,
  };

  // stage 本身没有任何变换，所以 event.global 就是 800x450 的逻辑坐标；
  // 画布被 CSS 拉伸后 Pixi 的 EventSystem 会自动按 bounding rect 换算回来
  app.stage.eventMode = 'static';
  app.stage.hitArea = app.screen;

  app.stage.on('pointerdown', (event: FederatedPointerEvent) => {
    state.pointerX = event.global.x;
    state.pointerY = event.global.y;
    if (!state.enabled) return;

    const limbId = climber.pickLimb(state.pointerX, state.pointerY);
    if (limbId === null) return;

    if (!climber.beginDrag(limbId, state.pointerX, state.pointerY)) {
      state.warnLimb = limbId;
      state.warnTimer = WARN_DURATION;
      return;
    }
    state.hoveredLimb = limbId;
  });

  app.stage.on('pointermove', (event: FederatedPointerEvent) => {
    state.pointerX = event.global.x;
    state.pointerY = event.global.y;
    if (climber.draggingLimb) {
      climber.updateDrag(state.pointerX, state.pointerY);
      return;
    }
    state.hoveredLimb = state.enabled
      ? climber.pickLimb(state.pointerX, state.pointerY)
      : null;
  });

  const finishDrag = () => {
    if (!climber.draggingLimb) return;
    climber.endDrag(level);
  };
  app.stage.on('pointerup', finishDrag);
  app.stage.on('pointerupoutside', finishDrag);

  return state;
}

export function updateInputTimers(state: InputState, dt: number): void {
  if (state.warnTimer <= 0) return;
  state.warnTimer -= dt;
  if (state.warnTimer <= 0) state.warnLimb = null;
}
