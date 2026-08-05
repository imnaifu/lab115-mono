"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  categories,
  DIFFICULTIES,
  DifficultyKey,
  getLevel,
  getScene,
  scenesById,
  availableDifficulties,
  Word,
} from "@/lib/scenes";

type View = "home" | "play";
type Phase = "study" | "challenge";

interface SlotState extends Word {
  filled: boolean;
}
interface TileState {
  uid: string;
  word: string;
  ipa: string;
  used: boolean;
}
interface Drag {
  uid: string;
  word: string;
  ipa: string;
  x: number;
  y: number;
  ox: number;
  oy: number;
  w: number;
  sx: number;
  sy: number;
  moved: boolean;
}

const ORDER: DifficultyKey[] = ["easy", "medium", "hard"];

function shuffle<T>(a: T[]): T[] {
  const r = a.slice();
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

function speak(word: string) {
  try {
    const sc = window.speechSynthesis;
    if (!sc || !word) return;
    sc.cancel();
    const u = new SpeechSynthesisUtterance(word.toLowerCase().replace(/med\./, "medical"));
    u.lang = "en-US";
    u.rate = 0.9;
    sc.speak(u);
  } catch {
    /* speech not available */
  }
}

function fmt(s: number) {
  const m = Math.floor(s / 60);
  const ss = s % 60;
  return `${m < 10 ? "0" : ""}${m}:${ss < 10 ? "0" : ""}${ss}`;
}

export default function WordMatchGame() {
  const [view, setView] = useState<View>("home");
  const [sceneId, setSceneId] = useState<string | null>(null);
  const [difficulty, setDifficulty] = useState<DifficultyKey | null>(null);
  const [phase, setPhase] = useState<Phase>("study");
  const [slots, setSlots] = useState<SlotState[]>([]);
  const [tiles, setTiles] = useState<TileState[]>([]);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [hoverSlotId, setHoverSlotId] = useState<string | null>(null);
  const [shakeUid, setShakeUid] = useState<string | null>(null);
  const [solved, setSolved] = useState(false);
  const [failed, setFailed] = useState(false);
  const [lives, setLives] = useState(3);
  const [elapsed, setElapsed] = useState(0);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const t0Ref = useRef(0);
  const dragRef = useRef<Drag | null>(null);
  dragRef.current = drag;

  const scene = getScene(sceneId);
  const level = getLevel(scene, difficulty);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);
  const startTimer = useCallback(() => {
    stopTimer();
    t0Ref.current = Date.now();
    timerRef.current = setInterval(() => setElapsed(Math.floor((Date.now() - t0Ref.current) / 1000)), 250);
  }, [stopTimer]);

  const setup = useCallback(
    (sid: string | null, diff: DifficultyKey | null, run: boolean) => {
      const sc = getScene(sid);
      const lv = getLevel(sc, diff);
      const defs = lv?.words ?? [];
      setSlots(defs.map((w) => ({ ...w, filled: false })));
      setTiles(shuffle(defs.map((w) => ({ uid: w.id, word: w.word, ipa: w.ipa, used: false }))));
      setDrag(null);
      setHoverSlotId(null);
      setShakeUid(null);
      setSolved(false);
      setFailed(false);
      setLives(3);
      setElapsed(0);
      if (run) startTimer();
      else stopTimer();
    },
    [startTimer, stopTimer]
  );

  // global pointer handlers for dragging
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      e.preventDefault();
      const moved = d.moved || Math.abs(e.clientX - d.sx) > 5 || Math.abs(e.clientY - d.sy) > 5;
      let hover: string | null = null;
      if (moved) {
        const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
        const sl = el?.closest?.("[data-slot-id]") as HTMLElement | null;
        if (sl) {
          const s = sl.getAttribute("data-slot-id");
          const filled = sl.getAttribute("data-filled") === "1";
          if (s && !filled) hover = s;
        }
      }
      setDrag({ ...d, x: e.clientX, y: e.clientY, moved });
      setHoverSlotId(hover);
    };
    const onUp = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      if (!d.moved) {
        speak(d.word);
        setDrag(null);
        setHoverSlotId(null);
        return;
      }
      const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
      const sl = el?.closest?.("[data-slot-id]") as HTMLElement | null;
      const slotId = sl?.getAttribute("data-slot-id") ?? null;
      const slotWord = sl?.getAttribute("data-word") ?? null;
      const slotFilled = sl?.getAttribute("data-filled") === "1";
      if (slotId && !slotFilled && slotWord === d.word) {
        setSlots((prev) => {
          const next = prev.map((s) => (s.id === slotId ? { ...s, filled: true } : s));
          if (next.every((s) => s.filled)) {
            stopTimer();
            setSolved(true);
          }
          return next;
        });
        setTiles((prev) => prev.map((t) => (t.uid === d.uid ? { ...t, used: true } : t)));
        speak(d.word);
        setDrag(null);
        setHoverSlotId(null);
      } else {
        const uid = d.uid;
        setLives((l) => {
          const nl = l - 1;
          if (nl <= 0) {
            stopTimer();
            setFailed(true);
          }
          return nl;
        });
        setDrag(null);
        setHoverSlotId(null);
        setShakeUid(uid);
        setTimeout(() => setShakeUid((cur) => (cur === uid ? null : cur)), 420);
      }
    };
    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [stopTimer]);

  useEffect(() => () => stopTimer(), [stopTimer]);

  // ---- actions ----
  const enterPlay = (id: string, key: DifficultyKey) => {
    const sc = scenesById[id];
    if (!sc?.levels?.[key]) return;
    setView("play");
    setSceneId(id);
    setDifficulty(key);
    setPhase("study");
    setup(id, key, false);
  };
  const goHome = () => {
    stopTimer();
    setView("home");
    setPhase("study");
    setSolved(false);
    setFailed(false);
    setDrag(null);
  };
  const startChallenge = () => {
    setPhase("challenge");
    setup(sceneId, difficulty, true);
  };
  const backStudy = () => {
    stopTimer();
    setPhase("study");
    setup(sceneId, difficulty, false);
  };
  const changeDifficulty = (key: DifficultyKey) => {
    if (key === difficulty || !getLevel(scene, key)) return;
    setDifficulty(key);
    setup(sceneId, key, phase === "challenge");
  };
  const restart = () => setup(sceneId, difficulty, true);
  const nextDifficulty = () => {
    if (!scene) return;
    const i = ORDER.indexOf(difficulty as DifficultyKey);
    const next = ORDER.slice(i + 1).find((k) => scene.levels?.[k]);
    if (next) {
      setDifficulty(next);
      setup(sceneId, next, true);
    } else {
      goHome();
    }
  };

  const onTilePointerDown = (e: React.PointerEvent, tile: TileState) => {
    if (solved || failed) return;
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    e.preventDefault();
    setDrag({
      uid: tile.uid,
      word: tile.word,
      ipa: tile.ipa,
      x: e.clientX,
      y: e.clientY,
      ox: e.clientX - r.left,
      oy: e.clientY - r.top,
      w: r.width,
      sx: e.clientX,
      sy: e.clientY,
      moved: false,
    });
  };

  const beatPercent = () => {
    const total = slots.length || 1;
    const fast = total * 1.8;
    const slow = total * 7;
    const ratio = (elapsed - fast) / (slow - fast);
    const beat = Math.round(98 - ratio * 92) - (3 - lives) * 4;
    return Math.max(5, Math.min(98, beat));
  };

  const isStudy = phase === "study";
  const isChallenge = phase === "challenge";
  const done = slots.filter((s) => s.filled).length;
  const trayTiles = tiles.filter((t) => !t.used);
  const nextKey = scene ? ORDER.slice(ORDER.indexOf(difficulty as DifficultyKey) + 1).find((k) => scene.levels?.[k]) : null;
  const nextDiffLabel = nextKey ? `挑战「${DIFFICULTIES.find((d) => d.key === nextKey)!.label}」` : "换个场景";
  const curDiffLabel = DIFFICULTIES.find((d) => d.key === difficulty)?.label ?? "";

  // ---- styles ----
  const primaryBtn: React.CSSProperties = {
    fontFamily: "var(--font-body)", fontWeight: 700, fontSize: 15, padding: "13px 22px",
    border: "2px solid var(--color-accent)", borderRadius: "var(--radius)", background: "var(--color-accent)",
    color: "#fff", cursor: "pointer", textAlign: "left",
  };
  const ghostBtn: React.CSSProperties = {
    fontFamily: "var(--font-body)", fontWeight: 700, fontSize: 14, padding: "10px 16px",
    border: "2px solid var(--color-text)", borderRadius: "var(--radius)", background: "transparent",
    color: "var(--color-text)", cursor: "pointer", textAlign: "left",
  };
  const label: React.CSSProperties = {
    fontSize: 11, letterSpacing: ".14em", textTransform: "uppercase",
    color: "var(--color-sub)", fontWeight: 700, marginBottom: 6,
  };

  return (
    <div style={{ minHeight: "100vh", padding: "24px clamp(16px,4vw,48px) 56px" }}>
      <div style={{ maxWidth: 1080, margin: "0 auto" }}>
        {view === "home" && (
          <div>
            <div style={{ fontSize: 12, letterSpacing: ".16em", textTransform: "uppercase", color: "var(--color-accent)", fontWeight: 700 }}>
              Word Match · 单词配对
            </div>
            <h1 style={{ fontFamily: "var(--font-head)", fontWeight: 800, fontSize: "clamp(28px,4.5vw,46px)", margin: "6px 0 4px", lineHeight: 1.02 }}>
              选择一个场景
            </h1>
            <p style={{ margin: 0, maxWidth: "58ch", color: "var(--color-sub)", fontSize: 15 }}>
              先学习场景里的单词，再进入拖拽挑战。每个难度是一张独立的画面与一组不同的单词。
            </p>

            {categories.map((cat) => (
              <div key={cat.id} style={{ marginTop: 34 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
                  <div style={{ fontFamily: "var(--font-head)", fontWeight: 800, fontSize: 20 }}>{cat.name}</div>
                  <div style={{ fontSize: 12, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--color-muted)", fontWeight: 700 }}>{cat.en}</div>
                </div>
                <div style={{ height: 2, background: "var(--color-divider)", margin: "10px 0 18px" }} />
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 20 }}>
                  {cat.scenes.map((id) => {
                    const s = scenesById[id];
                    if (!s) return null;
                    const keys = availableDifficulties(s);
                    const playable = keys.length > 0;
                    const thumbImg = playable ? s.levels![keys[0]]!.image : null;
                    return (
                      <div key={id} style={{ border: "2px solid var(--color-text)", borderRadius: "var(--radius)", background: "var(--color-surface)", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "var(--shadow)" }}>
                        <div style={{ position: "relative", aspectRatio: "16/9", background: thumbImg ? `#000 url('${thumbImg}') center/cover no-repeat` : "var(--color-neutral-200)" }}>
                          {s.locked && (
                            <div style={{ position: "absolute", inset: 0, background: "rgba(20,16,18,.5)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontFamily: "var(--font-head)", fontWeight: 800, fontSize: 16, letterSpacing: ".1em" }}>
                              敬请期待
                            </div>
                          )}
                        </div>
                        <div style={{ padding: "16px 18px", borderTop: "2px solid var(--color-divider)", flex: 1, display: "flex", flexDirection: "column" }}>
                          <div style={{ fontFamily: "var(--font-head)", fontWeight: 800, fontSize: 19, lineHeight: 1.05 }}>{s.name}</div>
                          <div style={{ fontSize: 13, color: "var(--color-sub)", marginTop: 3 }}>
                            {playable ? `${keys.length} 个难度可玩` : "暂未开放"}
                          </div>
                          {playable && (
                            <div style={{ marginTop: 14, display: "flex", gap: 8 }}>
                              {DIFFICULTIES.map((d) => {
                                const has = !!s.levels?.[d.key];
                                const n = has ? s.levels![d.key]!.words.length : 0;
                                return (
                                  <button
                                    key={d.key}
                                    type="button"
                                    disabled={!has}
                                    onClick={() => enterPlay(id, d.key)}
                                    style={{
                                      flex: 1, fontFamily: "var(--font-body)", fontWeight: 700, fontSize: 13, padding: "9px 8px",
                                      border: "2px solid var(--color-text)", borderRadius: "var(--radius)",
                                      background: has ? "var(--color-accent-100)" : "transparent",
                                      color: has ? "var(--color-accent-700)" : "var(--color-muted)",
                                      cursor: has ? "pointer" : "not-allowed", textAlign: "center", opacity: has ? 1 : 0.55,
                                    }}
                                  >
                                    {has ? `${d.label} · ${n}` : d.label}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {view === "play" && scene && (
          <div>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: 16 }}>
              <div>
                <button type="button" onClick={goHome} style={{ ...ghostBtn, fontSize: 13, padding: "7px 14px", marginBottom: 12 }}>← 场景列表</button>
                <h1 style={{ fontFamily: "var(--font-head)", fontWeight: 800, fontSize: "clamp(24px,3.6vw,38px)", margin: 0, lineHeight: 1.02 }}>{scene.name}</h1>
                <div style={{ fontSize: 13, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--color-sub)", fontWeight: 700, marginTop: 4 }}>
                  {scene.category} · {curDiffLabel} · {slots.length} 词
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {(["study", "challenge"] as Phase[]).map((p, i) => {
                  const active = phase === p;
                  return (
                    <button key={p} type="button" onClick={() => (p === "challenge" ? startChallenge() : backStudy())}
                      style={{ fontFamily: "var(--font-body)", fontWeight: 700, fontSize: 14, padding: "10px 20px", border: "2px solid var(--color-text)", borderRadius: "var(--radius)", cursor: "pointer", textAlign: "left", background: active ? "var(--color-text)" : "transparent", color: active ? "var(--color-bg)" : "var(--color-text)" }}>
                      {i + 1} · {p === "study" ? "学习" : "挑战"}
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ height: 2, background: "var(--color-divider)", margin: "16px 0 18px" }} />

            <div style={{ display: "flex", flexWrap: "wrap", gap: "20px 32px", alignItems: "flex-end", marginBottom: 18, minHeight: 46 }}>
              <div>
                <div style={label}>难度</div>
                <div style={{ display: "flex", gap: 8 }}>
                  {DIFFICULTIES.map((d) => {
                    const has = !!scene.levels?.[d.key];
                    const active = d.key === difficulty;
                    return (
                      <button key={d.key} type="button" disabled={!has} onClick={() => changeDifficulty(d.key)}
                        style={{ fontFamily: "var(--font-body)", fontWeight: 700, fontSize: 14, padding: "9px 18px", border: "2px solid var(--color-text)", borderRadius: "var(--radius)", cursor: has ? "pointer" : "not-allowed", textAlign: "left", background: active ? "var(--color-text)" : "transparent", color: active ? "var(--color-bg)" : has ? "var(--color-text)" : "var(--color-muted)", opacity: has ? 1 : 0.5 }}>
                        {d.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {isChallenge && (
                <div style={{ marginLeft: "auto", display: "flex", alignItems: "flex-end", gap: 26 }}>
                  <div>
                    <div style={{ ...label, marginBottom: 4 }}>生命值</div>
                    <div style={{ display: "flex", gap: 6, alignItems: "center", height: 28 }}>
                      {[0, 1, 2].map((i) => {
                        const alive = i < lives;
                        return (
                          <span key={i} style={{ display: "inline-flex", color: alive ? "var(--color-accent)" : "var(--color-muted)", opacity: alive ? 1 : 0.4, animation: alive ? "wm-float 2.4s ease-in-out infinite" : undefined }}>
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                              <path d="M12 21s-7.5-4.9-10-9.2C.3 8.6 1.6 5 5 5c2 0 3.2 1.1 4 2.3C9.8 6.1 11 5 13 5c3.4 0 4.7 3.6 3 6.8C19.5 16.1 12 21 12 21z" />
                            </svg>
                          </span>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <div style={{ ...label, marginBottom: 4 }}>用时</div>
                    <div style={{ fontFamily: "var(--font-head)", fontWeight: 800, fontSize: 26, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{fmt(elapsed)}</div>
                  </div>
                  <div>
                    <div style={{ ...label, marginBottom: 4 }}>进度</div>
                    <div style={{ fontFamily: "var(--font-head)", fontWeight: 800, fontSize: 26, lineHeight: 1 }}>
                      {done}
                      <span style={{ color: "var(--color-muted)" }}>/{slots.length}</span>
                    </div>
                  </div>
                  <button type="button" onClick={restart} style={{ ...ghostBtn, fontSize: 14, padding: "9px 16px" }}>重来</button>
                </div>
              )}
            </div>

            {/* stage */}
            <div style={{ position: "relative", width: "100%", aspectRatio: (scene.aspectRatio ?? "1024 / 559").replace("/", "/"), background: `#000 url('${level?.image ?? ""}') center/100% 100% no-repeat`, border: "2px solid var(--color-text)", borderRadius: "var(--radius)", overflow: "hidden", touchAction: "none", userSelect: "none" }}>
              {slots.map((s) => {
                const [l, t, w, h] = s.box;
                let bg = "var(--box-idle)";
                let bd = "var(--box-bd)";
                let color = "transparent";
                let cursor = "default";
                if (isStudy) {
                  bg = "var(--color-surface)";
                  bd = "var(--color-text)";
                  color = "var(--color-text)";
                  cursor = "pointer";
                } else if (s.filled) {
                  bg = "var(--color-correct)";
                  bd = "var(--color-correct-bd)";
                  color = "#fff";
                  cursor = "pointer";
                } else if (hoverSlotId === s.id) {
                  bg = "var(--color-accent-100)";
                  bd = "var(--color-accent)";
                }
                return (
                  <div key={s.id} data-slot-id={s.id} data-word={s.word} data-filled={s.filled ? "1" : "0"}
                    onClick={() => { if (isStudy) speak(s.word); else if (s.filled) speak(s.word); }}
                    style={{ position: "absolute", left: `${l}%`, top: `${t}%`, width: `${w}%`, height: `${h}%`, display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", border: `2px solid ${bd}`, borderRadius: "var(--box-radius)", background: bg, color, cursor, transition: "background .15s,border-color .15s", overflow: "hidden" }}>
                    {isStudy && (
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", lineHeight: 1.08, width: "100%", padding: "0 2px" }}>
                        <div style={{ fontFamily: "var(--font-head)", fontWeight: 800, fontSize: "clamp(9px,1.25vw,14px)" }}>{s.word}</div>
                        <div style={{ fontSize: "clamp(8px,1vw,11px)", color: "var(--color-accent-700)" }}>{s.ipa}</div>
                        <div style={{ fontSize: "clamp(9px,1.1vw,12px)", color: "var(--color-sub)" }}>{s.zh}</div>
                      </div>
                    )}
                    {!isStudy && s.filled && (
                      <span style={{ fontFamily: "var(--font-head)", fontWeight: 800, fontSize: "clamp(9px,1.35vw,15px)", letterSpacing: ".02em", lineHeight: 1, padding: "0 2px" }}>{s.word}</span>
                    )}
                  </div>
                );
              })}
            </div>

            {isStudy && (
              <div style={{ marginTop: 20, display: "flex", flexWrap: "wrap", gap: 14, alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ fontSize: 14, color: "var(--color-sub)" }}>点击画面上的单词卡可听发音。记住后进入挑战。</div>
                <button type="button" onClick={startChallenge} style={primaryBtn}>进入挑战 →</button>
              </div>
            )}

            {isChallenge && (
              <div>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", margin: "22px 0 10px" }}>
                  <div style={{ fontFamily: "var(--font-head)", fontWeight: 800, fontSize: 18 }}>单词卡</div>
                  <div style={{ fontSize: 13, color: "var(--color-sub)" }}>拖到画面 · 点击听音 · 拖错扣一颗心</div>
                </div>
                <div style={{ height: 2, background: "var(--color-divider)", marginBottom: 16 }} />
                <div style={{ display: "flex", flexWrap: "wrap", gap: 12, minHeight: 74 }}>
                  {trayTiles.map((t) => {
                    const dragging = drag?.uid === t.uid && drag.moved;
                    const shake = shakeUid === t.uid;
                    return (
                      <div key={t.uid} onPointerDown={(e) => onTilePointerDown(e, t)}
                        style={{ display: "inline-flex", flexDirection: "column", alignItems: "flex-start", padding: "10px 14px", minWidth: 96, background: dragging ? "var(--color-neutral-200)" : "var(--color-surface)", border: "2px solid var(--color-text)", borderRadius: "var(--radius)", cursor: "grab", touchAction: "none", userSelect: "none", boxShadow: "var(--shadow)", opacity: dragging ? 0.35 : 1, animation: shake ? "wm-shake .42s ease" : undefined }}>
                        <span style={{ fontFamily: "var(--font-head)", fontWeight: 800, fontSize: 17, lineHeight: 1.05 }}>{t.word}</span>
                        <span style={{ fontSize: 12, color: "var(--color-accent-700)", marginTop: 3 }}>{t.ipa}</span>
                      </div>
                    );
                  })}
                  {trayTiles.length === 0 && <div style={{ color: "var(--color-muted)", fontSize: 14, alignSelf: "center" }}>卡片已全部放置。</div>}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* drag ghost */}
      {drag?.moved && (
        <div style={{ position: "fixed", left: drag.x - drag.ox, top: drag.y - drag.oy, width: drag.w, zIndex: 150, pointerEvents: "none", display: "flex", flexDirection: "column", alignItems: "flex-start", padding: "10px 14px", background: "var(--color-surface)", border: "2px solid var(--color-accent)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)" }}>
          <span style={{ fontFamily: "var(--font-head)", fontWeight: 800, fontSize: 17, lineHeight: 1.05 }}>{drag.word}</span>
          <span style={{ fontSize: 12, color: "var(--color-accent-700)", marginTop: 3 }}>{drag.ipa}</span>
        </div>
      )}

      {/* win */}
      {solved && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(20,16,18,.5)", backdropFilter: "blur(2px)" }}>
          {Array.from({ length: 40 }).map((_, i) => {
            const cols = ["var(--color-accent)", "var(--color-correct)", "var(--color-accent-700)", "#f3c53b", "#3b7bf3"];
            const left = Math.random() * 100;
            const dur = 2 + Math.random() * 2;
            const delay = Math.random() * 0.8;
            const sz = 7 + Math.random() * 8;
            return <div key={i} style={{ position: "fixed", top: -20, left: `${left}%`, width: sz, height: sz, borderRadius: 2, background: cols[i % cols.length], zIndex: 190, animation: `wm-fall ${dur}s linear ${delay}s infinite` }} />;
          })}
          <div style={{ background: "var(--color-surface)", border: "2px solid var(--color-text)", borderRadius: "var(--radius)", padding: "36px 40px", textAlign: "left", boxShadow: "var(--shadow)", animation: "wm-pop .4s ease both", maxWidth: 460 }}>
            <div style={{ fontSize: 12, letterSpacing: ".16em", textTransform: "uppercase", color: "var(--color-accent)", fontWeight: 700 }}>Complete</div>
            <div style={{ fontFamily: "var(--font-head)", fontWeight: 800, fontSize: 34, lineHeight: 1.02, margin: "8px 0 14px" }}>挑战成功！</div>
            <div style={{ display: "flex", border: "2px solid var(--color-divider)", borderRadius: "var(--radius)", overflow: "hidden", marginBottom: 16 }}>
              <div style={{ flex: 1, padding: "14px 16px", borderRight: "2px solid var(--color-divider)" }}>
                <div style={label}>用时</div>
                <div style={{ fontFamily: "var(--font-head)", fontWeight: 800, fontSize: 28, fontVariantNumeric: "tabular-nums" }}>{fmt(elapsed)}</div>
              </div>
              <div style={{ flex: 1, padding: "14px 16px" }}>
                <div style={label}>剩余生命</div>
                <div style={{ fontFamily: "var(--font-head)", fontWeight: 800, fontSize: 28 }}>{lives} <span style={{ fontSize: 16, color: "var(--color-muted)" }}>/ 3</span></div>
              </div>
            </div>
            <p style={{ margin: "0 0 20px", color: "var(--color-text)", fontSize: 16, lineHeight: 1.5 }}>
              你超过了 <span style={{ color: "var(--color-accent)", fontWeight: 800, fontSize: 22 }}>{beatPercent()}%</span> 的玩家（{scene?.name} · {curDiffLabel}）。
            </p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button type="button" onClick={restart} style={primaryBtn}>再玩一次</button>
              <button type="button" onClick={nextDifficulty} style={ghostBtn}>{nextDiffLabel}</button>
              <button type="button" onClick={goHome} style={ghostBtn}>换个场景</button>
            </div>
          </div>
        </div>
      )}

      {/* fail */}
      {failed && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(20,16,18,.55)", backdropFilter: "blur(2px)" }}>
          <div style={{ background: "var(--color-surface)", border: "2px solid var(--color-text)", borderRadius: "var(--radius)", padding: "36px 40px", textAlign: "left", boxShadow: "var(--shadow)", animation: "wm-pop .4s ease both", maxWidth: 440 }}>
            <div style={{ fontSize: 12, letterSpacing: ".16em", textTransform: "uppercase", color: "var(--color-accent)", fontWeight: 700 }}>Game Over</div>
            <div style={{ fontFamily: "var(--font-head)", fontWeight: 800, fontSize: 34, lineHeight: 1.02, margin: "8px 0 6px" }}>生命值耗尽</div>
            <p style={{ margin: "0 0 20px", color: "var(--color-sub)", fontSize: 15 }}>三次错误用完了。回学习页再熟悉一下单词，或直接重试。</p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button type="button" onClick={restart} style={primaryBtn}>再试一次</button>
              <button type="button" onClick={backStudy} style={ghostBtn}>返回学习</button>
              <button type="button" onClick={goHome} style={ghostBtn}>换个场景</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
