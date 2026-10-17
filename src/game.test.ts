import { afterEach, describe, expect, it } from "vitest";
import { createCanvas } from "@napi-rs/canvas";
import { ConstantClock, createEngine } from "@clockwyrks/simple-2d";
import { game } from "./game";
import * as C from "./constants";
const cleanup: (() => void)[] = [];
afterEach(() => cleanup.splice(0).forEach((f) => f()));
async function setup(ms = 8) {
  const events = new EventTarget();
  const engine = createEngine({
    canvas: createCanvas(C.FIELD_W, C.FIELD_H) as unknown as HTMLCanvasElement,
    width: C.FIELD_W,
    height: C.FIELD_H,
    game,
    background: "#0b121a",
    layout: C.LAYOUT,
    clock: new ConstantClock(ms),
    surface: {
      cssWidth: () => C.FIELD_W,
      cssHeight: () => C.FIELD_H,
      dpr: () => 1,
      events: () => events,
    },
  });
  await engine.initialize();
  cleanup.push(() => engine.destroy());
  const key = (code: string, type = "keydown") => {
    const e = new Event(type);
    Object.assign(e, { code, repeat: false });
    events.dispatchEvent(e);
  };
  const pointer = (type: string, x: number, y: number) => {
    const e = new Event(type);
    Object.assign(e, {
      clientX: x,
      clientY: y,
      pointerId: 1,
      pointerType: "mouse",
      isPrimary: true,
      button: 0,
      buttons: type === "pointerup" ? 0 : 1,
    });
    events.dispatchEvent(e);
  };
  return { e: engine, d: engine.debug, key, pointer };
}
describe("Carom engine integration", () => {
  it("reads every debug pose and separates AI senses from movement", async () => {
    const { e, d } = await setup();
    e.apply((s) => d.setTitleIndex(s, 1));
    e.apply((s) => d.setMenuIndex(s, 2));
    e.apply((s) => d.setResumeScreen(s, "countdown"));
    e.apply((s) => d.setWinner(s, "right"));
    e.apply((s) => d.setReceiver(s, "right"));
    e.apply((s) => d.setBallHoldTimer(s, 0.2));
    e.apply((s) => d.setBallServeSign(s, -1));
    e.apply((s) => d.drawBallServeSign(s));
    e.apply((s) => d.setAiTracking(s, false));
    e.apply((s) => d.setAiMovement(s, false));
    const snap = d.snapshot(e.state);
    expect(snap.titleIndex).toBe(1);
    expect(snap.menuIndex).toBe(2);
    expect(snap.resumeScreen).toBe("countdown");
    expect(snap.winner).toBe("right");
    expect(snap.receiver).toBe("right");
    expect(snap.ball!.holdTimer).toBe(0.2);
    expect(Math.abs(snap.ball!.serveSign)).toBe(1);
    e.apply((s) => d.setScreen(s, "playing"));
    e.apply((s) => d.setPaddleCy(s, "right", 100));
    await e.advance(1);
    expect(e.state.paddles.right.cy).toBe(100);
    e.apply((s) => d.setAiMovement(s, true));
    await e.advance(1);
    expect(e.state.paddles.right.cy).toBeGreaterThan(100);
    expect(d.menuItemRect(e.state, 0)).toBeNull();
  });
  it("uses both arrow actions for the solo player and mutes on every screen", async () => {
    const { e, d, key } = await setup();
    e.apply((s) => d.setScreen(s, "countdown"));
    key("ArrowDown");
    key("KeyM");
    await e.advance(1);
    expect(e.state.paddles.left.cy).toBeGreaterThan(C.FIELD_CY);
    expect(e.state.paddles.right.cy).toBe(C.FIELD_CY);
    expect(e.state.muted).toBe(true);
  });
  it("opens complete, immutable title state and registers diagnostics", async () => {
    const { e, d } = await setup();
    const before = e.state;
    await e.advance(1);
    expect(before.simTime).toBe(0);
    expect(e.state.simTime).toBe(0.008);
    expect(d.snapshot(e.state).version).toBe(C.CAROM_DEBUG_VERSION);
    expect(e.diagnostics().length).toBeGreaterThanOrEqual(10);
  });
  it("starts, serves without moving that frame, pauses and resumes once", async () => {
    const { e, key } = await setup(10);
    key("Enter");
    await e.advance(1);
    expect(e.state.screen).toBe("countdown");
    await e.advance(99);
    expect(e.state.screen).toBe("playing");
    expect(e.state.ball?.x).toBe(C.FIELD_CX);
    await e.advance(1);
    expect(e.state.ball!.vx).toBeLessThan(0);
    key("Escape");
    await e.advance(1);
    const x = e.state.ball!.x;
    expect(e.state.screen).toBe("paused");
    await e.advance(10);
    expect(e.state.ball!.x).toBe(x);
    key("Escape", "keyup");
    key("Escape");
    await e.advance(1);
    expect(e.state.screen).toBe("playing");
  });
  it("navigates with priority, remembers title selection, supports how-to", async () => {
    const { e, key } = await setup();
    key("ArrowUp");
    key("Enter");
    await e.advance(1);
    expect(e.state.menuIndex).toBe(2);
    expect(e.state.screen).toBe("title");
    key("Enter", "keyup");
    key("Enter");
    await e.advance(1);
    expect(e.state.screen).toBe("howto");
    key("Escape");
    await e.advance(1);
    expect(e.state.menuIndex).toBe(2);
    expect(e.state.screen).toBe("title");
  });
  it("confirms only a pointer whose press and release share a region", async () => {
    const { e, d, pointer } = await setup();
    const r = d.menuItemRect(e.state, 1)!;
    pointer("pointerdown", 0, 0);
    await e.advance(1);
    pointer("pointerup", r.x + 10, r.y + 10);
    await e.advance(1);
    expect(e.state.screen).toBe("title");
    pointer("pointerdown", r.x + 10, r.y + 10);
    await e.advance(1);
    pointer("pointerup", r.x + 10, r.y + 10);
    await e.advance(1);
    expect(e.state.mode).toBe("versus");
    expect(e.state.screen).toBe("countdown");
  });
  it("moves driven paddles, clamps actual velocity, preserves requested velocity", async () => {
    const { e, d } = await setup();
    e.apply((s) => d.setScreen(s, "playing"));
    e.apply((s) => d.setPaddleDriven(s, "left", true));
    e.apply((s) => d.setPaddleCy(s, "left", C.PADDLE_MAX_CY));
    e.apply((s) => d.setPaddleVy(s, "left", 200));
    await e.advance(1);
    expect(e.state.paddles.left.vy).toBe(0);
    expect(e.state.paddles.left.drivenVy).toBe(200);
  });
  it("resolves paddle hits with speed gain and spin", async () => {
    const { e, d } = await setup();
    e.apply((s) => d.clearWorld(s));
    e.apply((s) => d.spawnBall(s));
    e.apply((s) => d.setBallHeld(s, false));
    e.apply((s) => d.setScreen(s, "playing"));
    e.apply((s) => d.setPaddleDriven(s, "left", true));
    e.apply((s) => d.setPaddleVy(s, "left", 100));
    e.apply((s) => d.setBallPosition(s, C.P1_X1 + C.BALL_R + 1, C.FIELD_CY));
    e.apply((s) => d.setBallVelocity(s, -C.SERVE_SPEED, 0));
    await e.advance(1);
    expect(e.state.ball!.vx).toBeGreaterThan(0);
    expect(Math.hypot(e.state.ball!.vx, e.state.ball!.vy)).toBeCloseTo(
      C.SERVE_SPEED * C.SPEED_MULT,
    );
    expect(e.state.ball!.spin).toBeGreaterThan(0);
  });
  it("reflects walls and oriented obstacles without changing speed", async () => {
    const { e, d } = await setup();
    e.apply((s) => d.setScreen(s, "playing"));
    e.apply((s) => d.setBallHeld(s, false));
    e.apply((s) => d.setBallPosition(s, 300, C.BALL_R + 1));
    e.apply((s) => d.setBallVelocity(s, 0, -500));
    await e.advance(1);
    expect(e.state.ball!.vy).toBe(500);
    e.apply((s) => d.setObstacleClock(s, 0));
    e.apply((s) => d.setObstacleClockRunning(s, false));
    e.apply((s) =>
      d.setBallPosition(
        s,
        C.OBSTACLE_CENTERS[0].x - C.OBSTACLE_HW - C.BALL_R - 1,
        C.OBSTACLE_CENTERS[0].y,
      ),
    );
    e.apply((s) => d.setBallVelocity(s, 500, 0));
    await e.advance(1);
    expect(e.state.ball!.vx).toBe(-500);
  });
  it("scores, requires a two-point lead, and parks after a non-winning point", async () => {
    const { e, d } = await setup();
    e.apply((s) => d.setScreen(s, "playing"));
    e.apply((s) => d.setScore(s, 10, 10));
    e.apply((s) => d.setBallHeld(s, false));
    e.apply((s) => d.setBallPosition(s, C.FIELD_W + C.BALL_R + 1, 200));
    await e.advance(1);
    expect(e.state.screen).toBe("countdown");
    expect(e.state.score.p1).toBe(11);
    expect(e.state.receiver).toBe("right");
    e.apply((s) => d.setScreen(s, "playing"));
    e.apply((s) => d.setBallPosition(s, C.FIELD_W + C.BALL_R + 1, 200));
    await e.advance(1);
    expect(e.state.screen).toBe("matchover");
    expect(e.state.winner).toBe("left");
  });
  it("poses all world controls, resets, and rejects absent entities", async () => {
    const { e, d } = await setup();
    e.apply((s) => d.clearWorld(s));
    expect(() => d.setBallSpin(e.state, 3)).toThrow();
    expect(() => d.spawnObstacle(e.state, 3)).toThrow();
    e.apply((s) => d.spawnObstacle(s, 1));
    e.apply((s) => d.setObstacleClock(s, 1));
    expect(e.state.obstacles[0].theta).toBe(C.OBSTACLE_SPIN_RATE);
    const before = e.state;
    e.apply((s) => d.reconcile(s));
    expect(e.state).toEqual(before);
    e.apply((s) => d.setMuted(s, true));
    e.apply((s) => d.reset(s));
    expect(e.state.muted).toBe(true);
    expect(e.state.simTime).toBe(0);
    expect(e.state.obstacles).toHaveLength(2);
  });
  it("decays spin consistently across frame sizes", async () => {
    const results = [];
    for (const ms of [2, 16]) {
      const { e, d } = await setup(ms);
      e.apply((s) => d.clearWorld(s));
      e.apply((s) => d.spawnBall(s));
      e.apply((s) => d.setScreen(s, "playing"));
      e.apply((s) => d.setBallHeld(s, false));
      e.apply((s) => d.setBallVelocity(s, 400, 0));
      e.apply((s) => d.setBallSpin(s, 200));
      await e.advance(800 / ms);
      results.push(e.state.ball!);
    }
    expect(results[0].spin).toBeCloseTo(100);
    expect(results[0].vx).toBeCloseTo(results[1].vx, 0);
    expect(results[0].vy).toBeCloseTo(results[1].vy, 0);
  });
  it("renders every screen and records the live drawing", async () => {
    const { e, d } = await setup();
    for (const screen of [
      "title",
      "howto",
      "paused",
      "matchover",
      "countdown",
      "playing",
    ] as const) {
      e.apply((s) => d.setScreen(s, screen));
      await e.advance(1);
    }
    e.startRecording();
    await e.advance(3);
    expect(e.stopRecording().frames).toHaveLength(3);
  });
});
