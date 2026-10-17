import * as C from "./constants";
import type {
  CaromState,
  ReadState,
  BallState,
  PaddleState,
  Side,
  Screen,
  Mode,
} from "./game";
import { menuItemRect } from "./menus";
export const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));
export const drawSign = (): 1 | -1 => (Math.random() < 0.5 ? -1 : 1);
export function parked(): BallState {
  return {
    x: C.FIELD_CX,
    y: C.FIELD_CY,
    vx: 0,
    vy: 0,
    spin: 0,
    held: true,
    holdTimer: C.HOLD_TIME,
    serveSign: drawSign(),
    trail: [],
  };
}
export function obstacle(index: number, t: number) {
  const base = C.OBSTACLE_CENTERS[index];
  if (!base) throw new Error("Unknown obstacle index");
  return {
    index,
    cx: base.x,
    cy:
      base.y +
      (index === 0 ? 1 : -1) *
        C.OBSTACLE_SWAY_AMP *
        Math.sin((2 * Math.PI * t) / C.OBSTACLE_SWAY_PERIOD),
    theta: C.OBSTACLE_SPIN_RATE * t,
  };
}
export function initialState(muted: boolean): CaromState {
  const paddle = (): PaddleState => ({
    cy: C.FIELD_CY,
    vy: 0,
    driven: false,
    drivenVy: 0,
  });
  return {
    screen: "title",
    mode: "solo",
    menuIndex: 0,
    titleIndex: 0,
    resumeScreen: "playing",
    score: { p1: 0, p2: 0 },
    winner: null,
    paddles: { left: paddle(), right: paddle() },
    ai: { tracking: true, movement: true },
    receiver: "left",
    ball: parked(),
    obstacles: C.OBSTACLE_CENTERS.map((_, i) => obstacle(i, 0)),
    obstacleClock: 0,
    obstacleClockRunning: true,
    simTime: 0,
    muted,
  };
}
export function startMatch(s: ReadState, mode: Mode): CaromState {
  const fresh = initialState(s.muted);
  return {
    ...fresh,
    mode,
    screen: "countdown",
    titleIndex: s.titleIndex,
    simTime: s.simTime,
    paddles: {
      left: {
        ...fresh.paddles.left,
        driven: s.paddles.left.driven,
        drivenVy: s.paddles.left.drivenVy,
      },
      right: {
        ...fresh.paddles.right,
        driven: s.paddles.right.driven,
        drivenVy: s.paddles.right.drivenVy,
      },
    },
  };
}
export const title = (s: ReadState): CaromState => ({
  ...initialState(s.muted),
  simTime: s.simTime,
  titleIndex: s.titleIndex,
  menuIndex: s.titleIndex,
});
function ballPatch(s: ReadState, p: Partial<BallState>): CaromState {
  if (!s.ball) throw new Error("No ball on the field");
  return { ...s, ball: { ...s.ball, ...p } };
}
function paddlePatch(
  s: ReadState,
  side: Side,
  p: Partial<PaddleState>,
): CaromState {
  return {
    ...s,
    paddles: { ...s.paddles, [side]: { ...s.paddles[side], ...p } },
  };
}
function declaredState(s: ReadState) {
  const { menuContacts: _contacts, ...declared } = s;
  return declared;
}
export function makeDebug() {
  return {
    version: C.CAROM_DEBUG_VERSION,
    clearWorld: (s: ReadState): CaromState => ({
      ...s,
      ball: null,
      obstacles: [],
    }),
    spawnBall: (s: ReadState): CaromState => ({ ...s, ball: parked() }),
    spawnObstacle: (s: ReadState, index: number): CaromState => ({
      ...s,
      obstacles: [
        ...s.obstacles.filter((o) => o.index !== index),
        obstacle(index, s.obstacleClock),
      ].sort((a, b) => a.index - b.index),
    }),
    reset: (s: ReadState) => initialState(s.muted),
    reconcile: (s: ReadState): CaromState => ({
      ...s,
      obstacles: s.obstacles.map((o) => obstacle(o.index, s.obstacleClock)),
    }),
    setScreen: (s: ReadState, screen: Screen): CaromState => ({ ...s, screen }),
    setMode: (s: ReadState, mode: Mode): CaromState => ({ ...s, mode }),
    setMenuIndex: (s: ReadState, menuIndex: number): CaromState => ({
      ...s,
      menuIndex,
    }),
    setTitleIndex: (s: ReadState, titleIndex: number): CaromState => ({
      ...s,
      titleIndex,
    }),
    setResumeScreen: (
      s: ReadState,
      resumeScreen: "countdown" | "playing",
    ): CaromState => ({ ...s, resumeScreen }),
    setScore: (s: ReadState, p1: number, p2: number): CaromState => ({
      ...s,
      score: { p1, p2 },
    }),
    setWinner: (s: ReadState, winner: Side | null): CaromState => ({
      ...s,
      winner,
    }),
    setReceiver: (s: ReadState, receiver: Side): CaromState => ({
      ...s,
      receiver,
    }),
    setPaddleCy: (s: ReadState, side: Side, cy: number) =>
      paddlePatch(s, side, { cy }),
    setPaddleVy: (s: ReadState, side: Side, drivenVy: number) =>
      paddlePatch(s, side, { drivenVy }),
    setPaddleDriven: (s: ReadState, side: Side, driven: boolean) =>
      paddlePatch(s, side, { driven }),
    setBallPosition: (s: ReadState, x: number, y: number) =>
      ballPatch(s, { x, y }),
    setBallVelocity: (s: ReadState, vx: number, vy: number) =>
      ballPatch(s, { vx, vy }),
    setBallSpin: (s: ReadState, spin: number) => ballPatch(s, { spin }),
    setBallHeld: (s: ReadState, held: boolean) => ballPatch(s, { held }),
    setBallHoldTimer: (s: ReadState, holdTimer: number) =>
      ballPatch(s, { holdTimer }),
    setBallServeSign: (s: ReadState, serveSign: 1 | -1) =>
      ballPatch(s, { serveSign }),
    drawBallServeSign: (s: ReadState) =>
      ballPatch(s, { serveSign: drawSign() }),
    setAiTracking: (s: ReadState, tracking: boolean): CaromState => ({
      ...s,
      ai: { ...s.ai, tracking },
    }),
    setAiMovement: (s: ReadState, movement: boolean): CaromState => ({
      ...s,
      ai: { ...s.ai, movement },
    }),
    setMuted: (s: ReadState, muted: boolean): CaromState => ({ ...s, muted }),
    setObstacleClock: (s: ReadState, obstacleClock: number): CaromState => ({
      ...s,
      obstacleClock,
      obstacles: s.obstacles.map((o) => obstacle(o.index, obstacleClock)),
    }),
    setObstacleClockRunning: (
      s: ReadState,
      obstacleClockRunning: boolean,
    ): CaromState => ({ ...s, obstacleClockRunning }),
    snapshot: (s: ReadState) => ({
      ...declaredState(s),
      version: C.CAROM_DEBUG_VERSION,
      ball: s.ball
        ? { ...s.ball, speed: Math.hypot(s.ball.vx, s.ball.vy) }
        : null,
    }),
    menuItemRect,
  };
}
